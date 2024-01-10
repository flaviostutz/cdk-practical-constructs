import { Schedule } from 'aws-cdk-lib/aws-applicationautoscaling';
import { ISecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

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

export type LambdaConfig = NodejsFunctionProps & {
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
  logGroupSubscriberLambdaArn?: string;
};

export enum EventType {
  Cloudwatch,
  Http,
}

export type BaseNodeJsProps = LambdaConfig & {
  stage: string;
};
