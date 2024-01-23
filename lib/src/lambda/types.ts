import { Schedule } from 'aws-cdk-lib/aws-applicationautoscaling';
import { ISecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy } from 'aws-cdk-lib/core';

export type NetworkConfig = {
  vpcId: string;
  availabilityZones: string[];
  privateSubnetIds: string[];
  privateSubnetRouteTableIds: string[];
};

export type ScheduledProvisionedConcurrentExecution = {
  minCapacity: number;
  maxCapacity: number;
  schedule: Schedule;
  name?: string;
};

export type LambdaConfig = Omit<
  NodejsFunctionProps,
  'logGroupRetentionRole' | 'logRetentionRetryOptions' | 'logRetention'
> & {
  /**
   * Cidr for a egress rule allowing connections from this Lambda to TLS services in port 443
   */
  allowTLSOutboundTo?: string;
  securityGroups?: ISecurityGroup[];
  eventType?: EventType;
  baseCodePath?: string;
  provisionedConcurrentExecutions?: {
    minCapacity?: number;
    maxCapacity?: number;
    target?: number;
    schedules?: ScheduledProvisionedConcurrentExecution[];
  };
  extraCaPubCert?: string;
  network?: NetworkConfig;
  /**
   * Retention days for default log group for this Lambda
   * @default RetentionDays.INFINITE
   */
  logGroupRetention?: RetentionDays;
  /**
   * Removal policy for default log group for this Lambda
   * @default RemovalPolicy.RETAIN
   */
  logGroupRemovalPolicy?: RemovalPolicy;
  logGroupSubscriberLambdaArn?: string;
};

export enum EventType {
  Cloudwatch = 'cloudwatch',
  Http = 'http',
  CustomResource = 'custom-resource',
}

export type BaseNodeJsProps = LambdaConfig & {
  stage: string;
};
