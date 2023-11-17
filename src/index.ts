import { EC2Client, RunInstancesCommand, waitUntilInstanceRunning, ResourceType, RunInstancesRequest, LaunchTemplateSpecification } from '@aws-sdk/client-ec2';
import { setOutput, saveState, error, setFailed, info } from '@actions/core';
import { getOctokit, context } from '@actions/github';
import { config } from './config';
import { wait, getRandomSlug } from './utils';

const ec2Client = new EC2Client({ region: config.region });

/**
 * Builds the startup commands passed into the EC2 instance as UserData.
 *
 * @param runnerLabel
 * @param runnerToken
 * @returns The startup commands.
 */
const getStartupCommands = (runnerLabel: string, runnerToken: string): string => {
  const runnerName = getRandomSlug();
  const repoUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}`;

  if (config.startupCommands) {
    info('Using custom startup commands.');
    return config.startupCommands
      .map((command: string) =>
        command
          .replace(`{name}`, runnerName)
          .replace(`{repoUrl}`, repoUrl)
          .replace('{token}', runnerToken)
          .replace('{label}', runnerLabel)
      )
      .join('\n');
  }

  return [
    '#!/bin/bash',
    `cd ${config.runnerDirectory}`,
    'export RUNNER_ALLOW_RUNASROOT=1',
    `./config.sh ` +
    `--url ${repoUrl} ` +
    `--token ${runnerToken} ` +
    `--labels ${runnerLabel} ` +
    `--name ${runnerName} ` +
    `--unattended ` +
    `--ephemeral`,
    './run.sh',
  ].join('\n');
};

/**
 * Gets the runner registration token from Github.
 *
 * @returns The token.
 */
async function getRegistrationToken() {
  const octokit = getOctokit(config.githubToken);

  try {
    const response = await octokit.request(
      'POST /repos/{owner}/{repo}/actions/runners/registration-token',
      context.repo
    );
    info(`Got GitHub Registration Token.`);
    return response.data.token;
  } catch (err: unknown) {
    error('An error occurred while getting the GitHub Registration Token.');
    throw err;
  }
}

function getRunInstancesRequest(runnerLabel: string, runnerToken: string): RunInstancesRequest {
  const runInstancesRequest = {
    MinCount: 1,
    MaxCount: 1,
    UserData: Buffer.from(getStartupCommands(runnerLabel, runnerToken)).toString('base64'),
    IamInstanceProfile: config.iamRoleName ? { Name: config.iamRoleName } : undefined,
    TagSpecifications: config.tags
      ? [
        {
          ResourceType: ResourceType.instance,
          Tags: config.tags,
        },
      ]
      : undefined,
  } as RunInstancesRequest;

  if (config.launchTemplateId) {
    info(`Using launch template mode.`);
    runInstancesRequest.LaunchTemplate = {
      LaunchTemplateId: config.launchTemplateId,
      LaunchTemplateName: config.launchTemplateName,
      Version: config.launchTemplateVersion,
    } as LaunchTemplateSpecification;
    return runInstancesRequest;
  }

  info(`Using image id mode.`);

  return {
    ImageId: config.imageId,
    InstanceType: config.instanceType,
    KeyName: config.keyName,
    SubnetId: config.subnetId,
    SecurityGroupIds: config.securityGroupId ? [config.securityGroupId] : undefined,
    ...runInstancesRequest
  } as RunInstancesRequest;
}

/**
 * Starts the EC2 Instance.
 *
 * @param runnerLabel
 * @param runnerToken
 * @returns The EC2 instance ID.
 */
async function startEc2Instance(runnerLabel: string, runnerToken: string): Promise<string> {
  info('Starting EC2 instance.');

  try {
    const runInstancesCommand = new RunInstancesCommand(getRunInstancesRequest(runnerLabel, runnerToken));
    const output = await ec2Client.send(runInstancesCommand);
    const instanceId = output.Instances?.[0]?.InstanceId;

    if (!instanceId) {
      throw new Error('Instance ID was empty.');
    }

    await waitUntilInstanceRunning(
      {
        client: ec2Client,
        maxWaitTime: 120,
      },
      { InstanceIds: [instanceId] }
    );

    info(`AWS EC2 instance ${instanceId} is started`);

    return instanceId;
  } catch (err: unknown) {
    error('An error occurred while starting the EC2 instance.');
    throw err;
  }
}

async function getRunner(label: string) {
  info(`Trying to get runner with label ${label}`);

  try {
    const octokit = getOctokit(config.githubToken);
    const runners = await octokit.paginate('GET /repos/{owner}/{repo}/actions/runners', context.repo);
    return runners.find((runner) => runner.labels.find((l) => l.name === label));
  } catch (err: unknown) {
    error('An error occurred while getting runners.');
    throw err;
  }
}

/**
 * Waits for the EC2 instance to fully startup and register itself as a self-hosted runner.
 *
 * @param label
 */
async function waitForRunnerRegistered(label: string) {
  info('Waiting for the EC2 instance to be registered in GitHub as a new self-hosted runner.');
  let retryCount = 1;

  while (retryCount < config.retryAmount) {
    const runner = await getRunner(label);

    if (runner?.status === 'online') {
      info(`GitHub self-hosted runner ${runner.name} is registered and ready to use.`);
      return;
    }

    await wait(config.retryDelay * 1000);
    retryCount++;
  }

  throw new Error('Timed out waiting for runner to be registered in Github.');
}

/**
 * The main entry point of the action. Coordinates everything.
 */
async function start() {
  try {
    const label = getRandomSlug();
    const githubRegistrationToken = await getRegistrationToken();
    const instanceId = await startEc2Instance(label, githubRegistrationToken);
    saveState('runner-label', label);
    saveState('instance-id', instanceId)
    setOutput('runner-label', label);
    setOutput('instance-id', instanceId);
    await waitForRunnerRegistered(label);
  } catch (e: unknown) {
    error('The workflow failed with some errors.');
    error(e as Error);
    setFailed((e as Error).message);
  }
}

start();
