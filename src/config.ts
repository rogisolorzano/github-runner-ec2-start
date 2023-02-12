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

export const config = {
  githubToken: required(getInput('github-token')),
  subnetId: required(getInput('subnet-id')),
  imageId: required(getInput('image-id')),
  runnerDirectory: required(getInput('runner-directory')),
  securityGroupId: required(getInput('security-group-id')),
  instanceType: optional(getInput('ec2-instance-type')) ?? 't2.micro',
  iamRoleName: optional(getInput('iam-role-name')),
  startupCommands: optionalJson<string[]>(getInput('startup-commands')),
  keyName: optional(getInput('key-name')),
  tags: optionalJson<Tag[]>(getInput('ec2-tags')),
  region: optional(getInput('region')) ?? 'us-east-1',
  retryDelay: optionalNumber(getInput('retry-delay')) ?? 5,
  retryAmount: optionalNumber(getInput('retry-amount')) ?? 12,
} as const;
