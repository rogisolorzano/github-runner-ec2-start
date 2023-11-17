import { EC2Client, TerminateInstancesCommand, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { error, setFailed, info, getState } from '@actions/core';
import { getOctokit, context } from '@actions/github';
import { config } from './config';
import { getHoursDifference } from './utils';

const ec2Client = new EC2Client({ region: config.region });

/**
 * Terminates the EC2 instance.
 *
 * @param instanceId
 */
async function terminateEc2Instance(instanceId: string) {
    info(`Terminating EC2 instance ${instanceId}`);

    try {
        const command = new TerminateInstancesCommand({
            InstanceIds: [instanceId],
        });
        await ec2Client.send(command);
    } catch (err: unknown) {
        error('An error occurred while terminating the EC2 instance.');
        throw err;
    }
}

/**
 * Cleanup EC2 instances with a tag name and value that have been running
 * for more than x hours. This is useful to cleanup any dangling instances that
 * might have failed to be terminated in previous workflow runs for some reason.
 *
 * @param tagName
 * @param tagValue
 */
async function cleanupEc2Instances(tagName: string, tagValue: string) {
    info(`Cleaning up EC2 instances with tag name ${tagName} and value ${tagValue}`);

    try {
        const describeCommand = new DescribeInstancesCommand({
            Filters: [
                {
                    Name: `tag:${tagName}`,
                    Values: [tagValue],
                },
                {
                    Name: 'instance-state-name',
                    Values: ['running'],
                },
            ],
        });
        const response = await ec2Client.send(describeCommand);
        const instanceIds = response.Reservations?.flatMap((reservation) => reservation.Instances)
            ?.filter(
                (instance) =>
                    !!instance?.InstanceId &&
                    !!instance?.LaunchTime &&
                    getHoursDifference(new Date(instance.LaunchTime), new Date()) > config.cleanupOlderThanHours
            )
            .map((instance) => instance?.InstanceId)
            .filter((id): id is string => !!id);

        if (!instanceIds || instanceIds.length === 0) {
            info('Found no dangling instances that need to be terminated.');
            return;
        }

        const terminateCommand = new TerminateInstancesCommand({
            InstanceIds: instanceIds,
        });
        await ec2Client.send(terminateCommand);
        info(`Cleaned up ${instanceIds.length} dangling instances.`);
    } catch (err: unknown) {
        error('An error occurred while cleaning up EC2 instances.');
        throw err;
    }
}

/**
 * Gets the github runner.
 *
 * @param label
 * @returns The runner.
 */
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
 * Removes the github runner with a specific label.
 *
 * @param label
 * @param token
 */
async function removeRunner(label: string, token: string) {
    info(`Trying to remove runner with label ${label}`);

    try {
        const runner = await getRunner(label);
        const octokit = getOctokit(token);

        if (!runner) {
            info('Runner does not exist anymore - skipping removal.');
            return;
        }

        await octokit.request('DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}', {
            ...context.repo,
            runner_id: runner.id,
        });
    } catch (err: unknown) {
        error('An error occurred while removing the runner from Github.');
        throw err;
    }
}

/**
 * The main entry point of the action. Coordinates everything.
 */
async function start() {
    try {
        await removeRunner(getState('runner-label'), config.githubToken);
        await terminateEc2Instance(getState('instance-id'));
        if (config.cleanupTagName && config.cleanupTagValue) {
            await cleanupEc2Instances(config.cleanupTagName, config.cleanupTagValue);
        }
    } catch (e: unknown) {
        error('The workflow failed with some errors.');
        error(e as Error);
        setFailed((e as Error).message);
    }
}

start();
