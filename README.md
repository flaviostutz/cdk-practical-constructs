# cdk-practical-constructs

A collection of CDK constructs and utilities for making the development of AWS based applications easier and safer in a practical way.

See examples for BaseNodeJsLambda and OpenApiGatewayLambda below.

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
        runtime: Runtime.NODEJS_18_X,
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
    lambdaConfig.logGroupSubscriberLambdaArn =
      'arn:aws:lambda:eu-west-1:012345678:function:datadogForwarder';

    // instantiate Lambda construct
    const func = new BaseNodeJsFunction(stack, 'test-lambda', lambdaConfig);

    // add custom network access rules to default security group created for this lambda
    func.defaultSecurityGroup.addEgressRule(
      Peer.ipv4('10.20.30.40/32'),
      Port.tcp(8888),
      'Allow lambda to access api X',
    );

```

## Construct OpenApiGatewayLambda

Rest API built from Openapi specs and aws extensions for running on Lambda functions with the following characteristics:
  - Uses API Gateway extensions for OpenAPI for connecting api routes to Lambdas (https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions.html)
  - Creates an AWS API Gateway along with multiple Lambdas for each route defined in OpenAPI spec
  - Uses api operations that supports Zod schemas in definitions (prop.openapiOperations)
  - An opiniated set of defaults that can be overwritten in props
 
Partialy inspired on https://blog.serverlessadvocate.com/serverless-openapi-amazon-api-gateway-with-the-aws-cdk-part-1-8a90477ebc24

AWS labs has a similar construct, but it relies on openapi specs written in yml and deployed to S3 buckets and CustomResources. We want to avoid S3 buckets and CustomResources to keep things faster/simpler and want to write our openapi specs in pure TS for better typing.

Check https://github.com/awslabs/aws-solutions-constructs/blob/main/source/patterns/%40aws-solutions-constructs/aws-openapigateway-lambda/lib/index.ts

### Usage

TODO

## Construct WSO2 API



### Usage

Supported output attributes of this Custom Resource (you can use GetAtt on these):
  - ApiEndpointUrl: returns the endpoint that can be used to invoke this API in WSO2

For this construct, lots of experiences were extracted from [serverless-wso2-apim](https://github.com/ramgrandhi/serverless-wso2-apim). Thanks for the good work, Ram!

