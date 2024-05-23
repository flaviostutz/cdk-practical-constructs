import { Schedule } from 'aws-cdk-lib/aws-applicationautoscaling';
import { IPeer, ISecurityGroup, Port } from 'aws-cdk-lib/aws-ec2';
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

/**
 * Lambda configurations
 */
export type LambdaConfig = Omit<
  NodejsFunctionProps,
  'logGroupRetentionRole' | 'logRetentionRetryOptions' | 'logRetention' | 'allowAllOutbound'
> & {
  /**
   * Allow connections to any outbound host in any port
   * @default false
   */
  allowAllOutbound?: boolean;
  /**
   * Egress rules allowing connections from this Lambda to other services
   * @default none
   */
  allowOutboundTo?: { peer: IPeer; port: Port }[];
  /**
   * Add these security groups to the Lambda function
   * @default none
   */
  securityGroups?: ISecurityGroup[];
  /**
   * Define an event type that will be used for naming the path of the handler.
   * Ignored if "entry" is used
   * @default none
   */
  eventType?: EventType;
  /**
   * Base code path for looking for handler entry point
   * Default entry point is "[baseCodePath]/[eventType]/[functionName]/index.ts"
   * @defaul src/handlers
   */
  baseCodePath?: string;
  /**
   * Min and max auto-scaling of provisioned concurrent executions for Lambda
   * If only min is defined, a fixed provisioned concurrent will be set
   * If min and max is set, auto-scaling is configured
   * @default none - No provisioned concurrent executions is set
   */
  provisionedConcurrentExecutions?: {
    minCapacity?: number;
    maxCapacity?: number;
    target?: number;
    schedules?: ScheduledProvisionedConcurrentExecution[];
  };
  /**
   * String with contents of a public certificate of a CA to be added to the Lambda
   * function filesystem so that HTTPS calls uses it
   * @default none
   */
  extraCaPubCert?: string;
  /**
   * Static network configuration for private VPCs
   * @default none - will use default vpc if available
   */
  network?: NetworkConfig;
  /**
   * Create a log group with name /aws/lambda/[function-name] and associate to this function
   * @default true
   */
  createDefaultLogGroup?: boolean;
  /**
   * Retention days for default log group for this Lambda
   * @default RetentionDays.ONE_YEAR
   */
  logGroupRetention?: RetentionDays;
  /**
   * Removal policy for default log group for this Lambda
   * @default RemovalPolicy.DESTROY
   */
  logGroupRemovalPolicy?: RemovalPolicy;
  /**
   * Register a Lambda as a subscriber of the default log group
   * @default none
   */
  logGroupSubscriberLambdaArn?: LogGroupSubscriberLambdaArn;
  /**
   * Create an alias named "live" that points to the latest version of this function
   * @defaults true
   */
  createLiveAlias?: boolean;
};

/**
 * Log group subscriber configuration
 * It will create a `AWS::Logs::SubscriptionFilter` resource
 * This resource will trigger the configured function with all the logs generated in the deployed function
 */
export type LogGroupSubscriberLambdaArn = {
  type: LogGroupSubscriberLambdaArnType;
  value: string;
};

export enum LogGroupSubscriberLambdaArnType {
  /** The Arn of the Lambda function that will subscribe to the log group */
  Arn = 'arn',
  /** The AWS Systems Manager Parameter Store name that points to the Arn of the Lambda function that will subscribe to the log group */
  Ssm = 'ssm',
}

export enum EventType {
  Cloudwatch = 'cloudwatch',
  Http = 'http',
  CustomResource = 'custom-resource',
}

export type BaseNodeJsProps = LambdaConfig & {
  stage: string;
};
