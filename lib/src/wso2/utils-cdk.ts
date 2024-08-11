/* eslint-disable no-console */
import { existsSync } from 'fs';

import { Duration, ScopedAws } from 'aws-cdk-lib/core';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

import { BaseNodeJsFunction } from '../lambda/lambda-base';
import { EventType } from '../lambda/types';

import { Wso2BaseProperties } from './types';

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
    timeout: Duration.minutes(10),
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
