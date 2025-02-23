/* eslint-disable no-console */
import { existsSync } from 'fs';

import { Duration, ScopedAws } from 'aws-cdk-lib/core';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { IVpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';

import { BaseNodeJsFunction } from '../lambda/lambda-base';
import { EventType } from '../lambda/types';
import { vpcFromConfig } from '../utils';

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

  // never use network configuration, only explicit VPC from previous step
  const { network, ...customResourceConfig } = args.props.customResourceConfig ?? {};

  // resolve the entry file from workspace (.ts file), or
  // from the dist dir (.js file) when being used as a lib
  let wso2LambdaEntry = `${args.baseDir}/handler/index.ts`;
  if (!existsSync(wso2LambdaEntry)) {
    wso2LambdaEntry = `${args.baseDir}/handler/index.js`;
  }

  // vpc is undefined if no network is defined
  let vpc: IVpc | undefined;

  const securityGroups = customResourceConfig?.securityGroups ?? [];

  // Create security group for custom resource if VPC is defined and no security group is defined
  if (args.props.customResourceConfig?.network) {
    vpc = vpcFromConfig(args.scope, args.props.customResourceConfig.network);

    if (securityGroups.length === 0) {
      // create default security group for the lambda function
      const securityGroup = new SecurityGroup(args.scope, `sg-cr-${args.scope.node.id}`, {
        vpc,
        description: `Security group for WSO2 CustomResource ${args.scope.node.id}`,
        allowAllOutbound: true,
      });
      securityGroups.push(securityGroup);
    }
  }

  // define the initial policy for the custom resource lambda by adding secret and CMK permissions
  const initialPolicy = [
    PolicyStatement.fromJson({
      Effect: 'Allow',
      Action: 'secretsmanager:GetSecretValue',
      Resource: `arn:aws:secretsmanager:${region}:${accountId}:secret:${args.props.wso2Config.credentialsSecretId}*`,
    }),
  ];

  if (args.props.wso2Config.credentialsSecretKMSKeyId) {
    initialPolicy.push(
      PolicyStatement.fromJson({
        Effect: 'Allow',
        Action: 'kms:decrypt',
        Resource: `arn:aws:kms:${region}:${accountId}:key/${args.props.wso2Config.credentialsSecretKMSKeyId}`,
      }),
    );
  }

  // lambda function used for invoking WSO2 APIs during CFN operations
  const customResourceFunction = new BaseNodeJsFunction(args.scope, `${args.id}-custom-lambda`, {
    ...customResourceConfig,
    vpc,
    securityGroups,
    stage: 'wso2-custom-lambda',
    timeout: Duration.minutes(10),
    memorySize: 256,
    runtime: Runtime.NODEJS_20_X,
    eventType: EventType.CustomResource,
    createLiveAlias: false,
    createDefaultLogGroup: true,
    entry: wso2LambdaEntry,
    initialPolicy,
    logGroupRetention,
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
