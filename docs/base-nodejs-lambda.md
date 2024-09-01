## Construct BaseNodeJsLambda

Based on [AWS Construct NodeJsFunction](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs.NodejsFunction.html) and adds the following capabilities:
  - creates a default security group. See property 'defaultSecurityGroup' of this construct
  - creates an alias called "live" pointing to the latest lambda version and replaced versions are deleted automatically. See property 'liveAlias' of this construct
  - typed configuration props for common usage scenarios
  - autoscaling of provisioned concurrent invocations (so you lower cold starts). You can also use automatic scheduling to tweak min/max depending on a cron expression. See props.provisionedConcurrentExecutions
  - explicit private VPC configuration (see props.network)
  - source code path standardization to "[basePath]/[lambdaEventType]/[lambdaName]/index.ts" (can be overwritten by explicit props.entry)
  - custom CA support for HTTP calls (NodeJS NODE_EXTRA_CA_CERTS). See props.extraCaPubCert
  - option to subscribe an Lambda Arn to the log group related to the Lambda function. See props.logGroupSubscriberLambdaArn
  - adds environment STAGE to Lambda. See props.stage

### Usage

#### Simple Typescript Lambda Function

```ts
    // instantiate Lambda construct
    // this will bundle your ts code using esbuild
    const func = new BaseNodeJsFunction(stack, 'test-lambda', {
        stage: 'dev',
        eventType: EventType.Http
    });
```

#### Complex Typescript Lambda Function

```ts
    // this can be reused in various lambda definitions
    const globalLambdaConfig = {
        eventType: EventType.Http,
        runtime: Runtime.NODEJS_20_X,
        extraCaPubCert: 'ABCXxxxyz123123123' // add private CA pub certificate to NodeJS
    }

    const lambdaConfig: BaseNodeJsProps = {
        // merge config with global defaults
        ...globalLambdaConfig,
        sourceMap: true, // add code source map to esbuild and configure Node. This might impose severe performance penauties
        provisionedConcurrentExecutions: {
            minCapacity: 1, // min instances in auto-scaling of provisioned lambdas
            maxCapacity: 5, // max instances in auto-scaling. if empty, the number of provisioned instances will be fixed to "minCapacity"
            schedules: [ // for automatically changing min/max on certain hours
                {
                    minCapacity: 0,
                    maxCapacity: 2,
                    schedule: Schedule.cron({ hour: '22' }),
                    name: 'Lower provisioned instances during the night'
                },
                {
                    minCapacity: 1,
                    maxCapacity: 5,
                    schedule: Schedule.cron({ hour: '7' }),
                    name: 'Keep at minimum one provisioned instance during the day'
                }
            ]
        }
    }

    // register an external Lambda to receive all Cloudwatch log events 
    // created by this Lambda (used to forward logs to Datadog, Splunk etc)
    lambdaConfig.logGroupSubscriberLambdaArn = {
        type: LogGroupSubscriberLambdaArnType.Arn,
        value: 'arn:aws:lambda:eu-west-1:012345678:function:datadogForwarder',
    };

    // You can also provide an AWS Systems Manager Parameter Store name that points
    // to the Arn of the Lambda function that will subscribe to the log group
    lambdaConfig.logGroupSubscriberLambdaArn = {
        type: LogGroupSubscriberLambdaArnType.Ssm,
        value: 'datadog-forwarder-lambda-arn',
    };

    // instantiate Lambda construct
    const func = new BaseNodeJsFunction(stack, 'test-lambda', lambdaConfig);

    // add custom network access rules to default security group created for this lambda
    func.defaultSecurityGroup.addEgressRule(
      Peer.ipv4('10.20.30.40/32'),
      Port.tcp(8888),
      'Allow lambda to access api X',
    );

```

[Check here for a complete example](/examples/src/lambda/cdk.ts)
