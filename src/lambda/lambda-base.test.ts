import { App, Duration, Stack } from 'aws-cdk-lib/core';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Template } from 'aws-cdk-lib/assertions';
import { Peer, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Schedule } from 'aws-cdk-lib/aws-applicationautoscaling';

import { vpcFromConfig } from '../utils';

import { BaseNodeJsProps, EventType } from './types';
import { BaseNodeJsFunction } from './lambda-base';

describe('lambda-base', () => {
  it('basic instantiation', async () => {
    const app = new App();
    const stack = new Stack(app);

    const lambdaConfig: BaseNodeJsProps = {
      stage: 'dev',
      network: {
        vpcId: 'aaa',
        availabilityZones: ['a'],
        privateSubnetIds: ['a'],
        privateSubnetRouteTableIds: ['a'],
      },
      eventType: EventType.Http,
      baseCodePath: 'src/apigateway/__tests__',
      allowTLSOutboundTo: '0.0.0.0/0',
      extraCaPubCert: 'CERTIFICATE CONTENTS!',
      provisionedConcurrentExecutions: {
        minCapacity: 3,
      },
    };

    if (!lambdaConfig.network) throw new Error('lambdaConfig.network should be defined');
    const vpc = vpcFromConfig(stack, lambdaConfig.network);
    if (!vpc) throw new Error('vpc should be defined');

    const customSG = new SecurityGroup(stack, 'customsg', {
      vpc,
      description: 'custom sg',
      allowAllOutbound: false,
    });
    customSG.addIngressRule(Peer.ipv4('9.9.9.9/32'), Port.allTraffic(), 'allow ingress');
    customSG.addEgressRule(Peer.ipv4('8.8.8.8/32'), Port.allTraffic(), 'allow egress');
    lambdaConfig.securityGroups = [customSG];
    lambdaConfig.logGroupSubscriberLambdaArn =
      'arn:aws:lambda:eu-west-1:012345678:function:tstLogging';

    const func = new BaseNodeJsFunction(stack, 'test-lambda', lambdaConfig);
    if (!func.defaultSecurityGroup) throw new Error('defaultSecurityGroup should be defined');
    func.defaultSecurityGroup.addEgressRule(
      Peer.ipv4('1.2.3.4/32'),
      Port.tcp(8888),
      'Sample egress rule',
    );

    expect(func).toBeDefined();
    expect(func.nodeJsFunction.runtime).toBe(Runtime.NODEJS_18_X);
    expect(func.nodeJsFunction.node.id).toBe('test-lambda-dev');

    // execute synth and test results
    const template = Template.fromStack(stack);
    // console.log(JSON.stringify(template.toJSON(), null, 2));
    template.hasResourceProperties('AWS::Lambda::Function', {
      Code: {
        S3Bucket: {
          // eslint-disable-next-line no-template-curly-in-string
          'Fn::Sub': 'cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}',
        },
      },
      Environment: {
        Variables: {
          STAGE: 'dev',
          NODE_EXTRA_CA_CERTS: '/var/task/extra-ca.pub',
        },
      },
      Handler: 'index.handler',
      Runtime: 'nodejs18.x',
    });

    template.hasResourceProperties('AWS::Lambda::Alias', {
      Name: 'live',
      ProvisionedConcurrencyConfig: {
        ProvisionedConcurrentExecutions: 3,
      },
    });

    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Default security group for Lambda test-lambda',
      SecurityGroupEgress: [
        { CidrIp: '0.0.0.0/0', FromPort: 443, IpProtocol: 'tcp' },
        { CidrIp: '1.2.3.4/32', FromPort: 8888, IpProtocol: 'tcp' },
      ],
    });

    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'custom sg',
      SecurityGroupIngress: [{ CidrIp: '9.9.9.9/32' }],
      SecurityGroupEgress: [{ CidrIp: '8.8.8.8/32' }],
    });

    template.hasResourceProperties('AWS::Logs::SubscriptionFilter', {
      DestinationArn: 'arn:aws:lambda:eu-west-1:012345678:function:tstLogging',
      LogGroupName: {
        'Fn::GetAtt': ['testlambdatestlambdadevLogRetention7398ECBA', 'LogGroupName'],
      },
    });

    template.hasResourceProperties('AWS::Logs::SubscriptionFilter', {
      DestinationArn: 'arn:aws:lambda:eu-west-1:012345678:function:tstLogging',
      LogGroupName: {
        'Fn::GetAtt': ['testlambdatestlambdadevLogRetention7398ECBA', 'LogGroupName'],
      },
    });

    template.hasResourceProperties('AWS::Lambda::Permission', {
      FunctionName: 'arn:aws:lambda:eu-west-1:012345678:function:tstLogging',
      Action: 'lambda:InvokeFunction',
      Principal: 'logs.eu-west-1.amazonaws.com',
    });
  });

  it('no vpc declaration', async () => {
    const app = new App();
    const stack = new Stack(app);

    const f = (): void => {
      // eslint-disable-next-line no-new
      new BaseNodeJsFunction(stack, 'test-lambda', {
        stage: 'dev',
        eventType: EventType.Http,
        baseCodePath: 'src/lambda/__tests__',
        allowTLSOutboundTo: '0.0.0.0/0', // shouldn't be used when no VPC or network is defined
      });
    };
    expect(f).toThrow();

    const func = new BaseNodeJsFunction(stack, 'test-lambda2', {
      stage: 'dev',
      entry: 'src/lambda/__tests__/http/test-lambda/index.ts',
    });

    expect(func.nodeJsFunction.isBoundToVpc).toBe(false);

    // execute synth and test results
    const template = Template.fromStack(stack);
    // console.log(JSON.stringify(template.toJSON(), null, 2));
    template.hasResourceProperties('AWS::Lambda::Function', {});
  });

  it('advanced instantiation', async () => {
    const app = new App();
    const stack = new Stack(app);

    const lambdaConfig: BaseNodeJsProps = {
      stage: 'dev-pr-123',
      network: {
        vpcId: 'aaa',
        availabilityZones: ['a'],
        privateSubnetIds: ['a'],
        privateSubnetRouteTableIds: ['a'],
      },
      eventType: EventType.Http,
      entry: 'src/lambda/__tests__/http/test-lambda/index.ts',
      reservedConcurrentExecutions: 10,
      environment: {
        TEST1: 'VALUE1',
      },
      bundling: {
        sourceMap: true,
      },
      provisionedConcurrentExecutions: {
        minCapacity: 4,
        maxCapacity: 9,
        schedules: [
          {
            minCapacity: 0,
            maxCapacity: 3,
            schedule: Schedule.cron({ minute: '*/2' }),
            name: 'Run each other minute',
          },
          {
            minCapacity: 3,
            maxCapacity: 8,
            schedule: Schedule.rate(Duration.days(1)),
          },
        ],
      },
    };

    const func = new BaseNodeJsFunction(stack, 'test-lambda', lambdaConfig);

    expect(func.nodeJsFunction.node.id).toBe('test-lambda-dev-pr-123');

    // execute synth and test results
    const template = Template.fromStack(stack);
    // console.log(JSON.stringify(template.toJSON(), null, 2));

    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      ReservedConcurrentExecutions: 10,
      Environment: {
        Variables: {
          STAGE: 'dev-pr-123',
          NODE_OPTIONS: '--enable-source-maps',
          TEST1: 'VALUE1',
        },
      },
    });

    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Default security group for Lambda test-lambda',
      SecurityGroupEgress: [{ CidrIp: '255.255.255.255/32', Description: 'Disallow all traffic' }],
    });

    template.hasResource('AWS::Lambda::Version', {});

    template.hasResourceProperties('AWS::Lambda::Alias', {
      Name: 'live',
      ProvisionedConcurrencyConfig: {
        ProvisionedConcurrentExecutions: 4,
      },
    });

    template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', {
      MinCapacity: 4,
      MaxCapacity: 9,
      ScalableDimension: 'lambda:function:ProvisionedConcurrency',
      ScheduledActions: [
        {
          ScalableTargetAction: {
            MinCapacity: 0,
            MaxCapacity: 3,
          },
          Schedule: 'cron(*/2 * * * ? *)',
          ScheduledActionName: 'Run each other minute',
        },
        {
          ScalableTargetAction: {
            MinCapacity: 3,
            MaxCapacity: 8,
          },
          Schedule: 'rate(1 day)',
        },
      ],
    });
  });
});
