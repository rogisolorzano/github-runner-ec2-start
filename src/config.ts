import { getInput } from '@actions/core';
import { Tag } from '@aws-sdk/client-ec2';

const required = (value: string): string => {
  if (value === '') {
    throw new Error(`Required action input ${value} was empty.`);
  }
  return value;
};

const optional = (value: string): string | undefined => (value === '' ? undefined : value);

const optionalJson = <T>(value: string): T | undefined => (value === '' ? undefined : (JSON.parse(value) as T));

const optionalNumber = (value: string): number | undefined => (value === '' ? undefined : Number(value));

function parseGeneralSettings(): any {
  return {
    githubToken: required(getInput('github-token')),
    runnerDirectory: required(getInput('runner-directory')),
    startupCommands: optionalJson<string[]>(getInput('startup-commands')),
    retryDelay: optionalNumber(getInput('retry-delay')) ?? 5,
    retryAmount: optionalNumber(getInput('retry-amount')) ?? 12,
  };
}

function parseExplicitConfig(): any {
  return {
    subnetId: required(getInput('subnet-id')),
    imageId: required(getInput('image-id')),
    securityGroupId: required(getInput('security-group-id')),
    instanceType: optional(getInput('instance-type')) ?? 't2.micro',
    region: optional(getInput('region')) ?? 'us-east-1',
    keyName: optional(getInput('key-name')),
    tags: optionalJson<Tag[]>(getInput('ec2-tags')),
    iamRoleName: optional(getInput('iam-role-name')),
  };
}

function parseLaunchTemplateConfig(): any {
  return {
    launchTemplateId: optional(getInput('launch-template-id')),
    launchTemplateName: optional(getInput('launch-template-name')),
    launchTemplateVersion: optional(getInput('launch-template-version')),
  };
}

function parseConfig(): any {
  const launchTemplate = optional(getInput('launch-template'));
  if (launchTemplate == 'true')
  {
    return { ...parseLaunchTemplateConfig(), ...parseGeneralSettings() };
  }
  else
  {
    return { ...parseExplicitConfig(), ...parseGeneralSettings() };
  }
}

export const config = parseConfig();
