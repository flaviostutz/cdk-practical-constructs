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

