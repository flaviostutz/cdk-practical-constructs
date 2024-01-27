# cdk-practical-constructs

A collection of CDK constructs and utilities for making the development of AWS based applications easier and safer in a practical way.


## Construct BaseNodeJsLambda

Creates a Lambda with common utilities for default live alias, auto scaling of provisioned concurrency, log subscription, default security group, custom CA certificate config etc

  - Check [Construct BaseNodeJsLambda](base-nodejs-lambda.md) for more details


## Construct OpenapiGatewayLambda
  
Creates an AWS APIGateway from definitions in an Openapi document based on Zod schemas and connects routes defined in Openapi to Lambda functions.

  - Check [Construct OpenapiGatewayLambda](openapigateway-lambda.md) for more details


## WSO2

### Construct WSO2Api
  
Creates an WSO2 API from definitions in an Openapi document.

  - Check [Construct Wso2Api](wso2-api.md) for more details

