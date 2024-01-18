/* eslint-disable camelcase */
// import { ScopedAws } from 'aws-cdk-lib';
// import { Construct } from 'constructs';
// import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
// import { Peer, Port } from 'aws-cdk-lib/aws-ec2';
// import { StringParameter } from 'aws-cdk-lib/aws-ssm';

// export class AppStack extends DefaultStack {
//   constructor(scope: Construct, id: string, props: DefaultStackProps) {
//     super(scope, id, props);

//     const { accountId, region } = new ScopedAws(this);

//     // eslint-disable-next-line no-new
//     const func = new BaseNodeJsFunction(this, 'splunkForward', {
//       ...props.stageConfig.lambda,
//       stage: props.stage,
//       network: props.stageConfig.network,
//       eventType: EventType.Cloudwatch,
//       description: 'Forwards Cloudwatch events to Splunk',
//       initialPolicy: [
//         PolicyStatement.fromJson({
//           Effect: 'Allow',
//           Action: 'secretsmanager:GetSecretValue',
//           Resource: `arn:aws:secretsmanager:${region}:${accountId}:secret:services/splunk-forward-service/splunk-hec-token*`,
//         }),
//       ],
//     });
//     func.defaultSecurityGroup.addEgressRule(
//       Peer.ipv4('10.109.0.0/16'),
//       Port.tcp(8088),
//       'Allow connection to Splunk Collector',
//     );

//     // Store splunk forward lambda arn in parameter store
//     // eslint-disable-next-line no-new
//     new StringParameter(this, 'SplunkForwardLambdaArn', {
//       parameterName: `/${props.stage}/services/splunk-forward-service/lambda-arn`,
//       description: 'Cloudwatch to Splunk log forwarder Lambda ARN',
//       stringValue: func.nodeJsFunction.functionArn,
//     });
//   }
// }
