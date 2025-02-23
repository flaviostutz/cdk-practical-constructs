/* eslint-disable camelcase */
import { Peer, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  BaseNodeJsFunction,
  BaseNodeJsProps,
  EventType,
  vpcFromConfig,
  LogGroupSubscriberLambdaArnType,
} from 'cdk-practical-constructs';
import { Construct } from 'constructs';

export const addLambdaGetTest = (scope: Construct): void => {
  const vpc = vpcFromConfig(scope, {
    // get these from your actual AWS account configuration
    vpcId: 'aaa',
    availabilityZones: ['a'],
    privateSubnetIds: ['a'],
    privateSubnetRouteTableIds: ['a'],
  });
  const customSG = new SecurityGroup(scope, 'customsg', {
    vpc,
    description: 'custom sg',
    allowAllOutbound: false,
  });
  customSG.addIngressRule(Peer.ipv4('9.9.9.9/32'), Port.allTraffic(), 'allow ingress');
  customSG.addEgressRule(Peer.ipv4('8.8.8.8/32'), Port.allTraffic(), 'allow egress');
  customSG.addEgressRule(Peer.ipv4('1.2.3.4/32'), Port.tcp(8888), 'Sample egress rule');

  const lambdaConfig: BaseNodeJsProps = {
    stage: 'dev',
    network: {
      // get these from your actual AWS account configuration
      vpcId: 'aaa',
      availabilityZones: ['a'],
      privateSubnetIds: ['a'],
      privateSubnetRouteTableIds: ['a'],
    },
    eventType: EventType.Http,
    provisionedConcurrentExecutions: {
      minCapacity: 1,
    },
    baseCodePath: 'src/lambda',
    logGroupRetention: RetentionDays.FIVE_DAYS,
    securityGroups: [customSG],
  };

  lambdaConfig.logGroupSubscriberLambdaArn = {
    type: LogGroupSubscriberLambdaArnType.Arn,
    value: 'arn:aws:lambda:eu-west-1:012345678:function:tstLogging',
  };

  const func = new BaseNodeJsFunction(scope, 'getTest', lambdaConfig);
  if (!func.defaultLogGroup) throw new Error('defaultLogGroup should be created by default');
};
