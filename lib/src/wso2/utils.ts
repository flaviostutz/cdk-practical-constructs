/* eslint-disable no-console */
import { existsSync } from 'fs';

import { Duration, ScopedAws } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { BaseNodeJsFunction } from '../lambda/lambda-base';
import { EventType } from '../lambda/types';

import { RetryOptions, Wso2BaseProperties } from './types';

export const addLambdaAndProviderForWso2Operations = (args: {
  scope: Construct;
  id: string;
  props: Wso2BaseProperties;
  baseDir: string;
}): { customResourceProvider: Provider; customResourceFunction: BaseNodeJsFunction } => {
  const logGroupRetention =
    args.props.customResourceConfig?.logGroupRetention ?? RetentionDays.ONE_MONTH;

  const { accountId, region } = new ScopedAws(args.scope);

  // resolve the entry file from workspace (.ts file), or
  // from the dist dir (.js file) when being used as a lib
  let wso2LambdaEntry = `${args.baseDir}/handler/index.ts`;
  if (!existsSync(wso2LambdaEntry)) {
    wso2LambdaEntry = `${args.baseDir}/handler/index.js`;
  }

  // lambda function used for invoking WSO2 APIs during CFN operations
  const customResourceFunction = new BaseNodeJsFunction(args.scope, `${args.id}-custom-lambda`, {
    ...args.props.customResourceConfig,
    stage: 'wso2-custom-lambda',
    timeout: Duration.minutes(5),
    memorySize: 256,
    runtime: Runtime.NODEJS_18_X,
    eventType: EventType.CustomResource,
    createLiveAlias: false,
    createDefaultLogGroup: true,
    entry: wso2LambdaEntry,
    initialPolicy: [
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 'secretsmanager:GetSecretValue',
        Resource: `arn:aws:secretsmanager:${region}:${accountId}:secret:${args.props.wso2Config.credentialsSecretId}*`,
      }),
    ],
    logGroupRetention,
    // allow all outbound by default
    allowAllOutbound: typeof args.props.customResourceConfig?.network !== 'undefined',
  });

  if (args.props.customResourceConfig?.logGroupRemovalPolicy) {
    customResourceFunction.nodeJsFunction.applyRemovalPolicy(
      args.props.customResourceConfig.logGroupRemovalPolicy,
    );
  }

  const customResourceProvider = new Provider(args.scope, `${args.id}-custom-provider`, {
    onEventHandler: customResourceFunction.nodeJsFunction,
  });

  return { customResourceProvider, customResourceFunction };
};

export const getSecretValue = async (secretId: string): Promise<string> => {
  const client = new SecretsManagerClient();
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretId,
    }),
  );
  if (response.SecretString) {
    return response.SecretString;
  }
  if (!response.SecretBinary) {
    throw new Error('Invalid type of secret found');
  }
  const buff = Buffer.from(response.SecretBinary);
  return buff.toString('ascii');
};

const defaultRetryOpts = {
  checkRetries: {
    startingDelay: 500,
    delayFirstAttempt: true,
    maxDelay: 10000,
    numOfAttempts: 10,
    timeMultiple: 1.5,
    // 500, 750, 1125, 1687 (4s), 2531, 3796, 5696 (16s), 8542 (24s), 10000, 10000, 10000, 10000, 10000 (74s)
  },
  mutationRetries: {
    startingDelay: 2000,
    delayFirstAttempt: false,
    maxDelay: 5000,
    numOfAttempts: 3,
    timeMultiple: 1.5,
    // 2000, 3000
  },
};
export const applyRetryDefaults = (retryOptions?: RetryOptions): RetryOptions => {
  const ropts: RetryOptions = {
    // default config for backoff
    ...defaultRetryOpts,
  };

  if (retryOptions?.checkRetries) {
    ropts.checkRetries = retryOptions?.checkRetries;
  }
  if (retryOptions?.mutationRetries) {
    ropts.mutationRetries = retryOptions?.mutationRetries;
  }

  if (ropts.checkRetries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ropts.checkRetries.retry = (err: any, attemptNumber: number): boolean => {
      console.log(`Error detected. err=${err}`);
      console.log(`Retrying check (#${attemptNumber})...`);
      return true;
    };
  }
  if (ropts.mutationRetries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ropts.mutationRetries.retry = (err: any, attemptNumber: number): boolean => {
      console.log(`Error detected. err=${err}`);
      console.log(`Retrying mutation (#${attemptNumber})...`);
      return true;
    };
  }
  return ropts;
};

export const truncateStr = (str: string, size: number): string => {
  return str.substring(0, Math.min(str.length, size));
};
