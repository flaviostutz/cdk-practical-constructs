/* eslint-disable camelcase */
import { Peer, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  BaseNodeJsFunction,
  BaseNodeJsProps,
  EventType,
  vpcFromConfig,
} from 'cdk-practical-constructs';
import { Construct } from 'constructs';

export const addLambdaGetTest = (scope: Construct): void => {
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
    logGroupRetention: RetentionDays.FIVE_DAYS,
  };

  if (!lambdaConfig.network) throw new Error('network should be defined');
  const vpc = vpcFromConfig(scope, lambdaConfig.network);

  const customSG = new SecurityGroup(scope, 'customsg', {
    vpc,
    description: 'custom sg',
    allowAllOutbound: false,
  });
  customSG.addIngressRule(Peer.ipv4('9.9.9.9/32'), Port.allTraffic(), 'allow ingress');
  customSG.addEgressRule(Peer.ipv4('8.8.8.8/32'), Port.allTraffic(), 'allow egress');
  lambdaConfig.securityGroups = [customSG];
  lambdaConfig.logGroupSubscriberLambdaArn =
    'arn:aws:lambda:eu-west-1:012345678:function:tstLogging';

  const func = new BaseNodeJsFunction(scope, 'getTest', lambdaConfig);
  if (!func.defaultSecurityGroup) throw new Error('defaultSecurityGroup should be defined');
  func.defaultSecurityGroup.addEgressRule(
    Peer.ipv4('1.2.3.4/32'),
    Port.tcp(8888),
    'Sample egress rule',
  );
};
