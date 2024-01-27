## Construct WSO2 API

Creates a new WSO2 API in a WSO2 server based on api definitions and an Openapi document.

Check type *Wso2ApiProps* for a complete definition of the props for this construct.

Supported output attributes for this CustomResource in CFN via GetAtt are:
  - EndpointUrl: Endpoint URL of this API in WSO2
  - Wso2ApiId: Id of the API in WSO2

### Usage

```ts
  const wso2Props: Wso2ApiProps = {
    wso2Config: {
      baseApiUrl: 'https://mywso2.com',
      credentialsSecretId: 'myWso2Creds',
    },
    apiDefinition: {
      version: 'v1',
      type: 'HTTP',
      endpointConfig: {
        production_endpoints: {
          url: 'http://serverabc.com',
        },
        endpoint_type: 'http',
      },
      context: '/petstore',
      name: 'petstore-sample',
      gatewayEnvironments: ['public'],
      corsConfiguration: {
        accessControlAllowOrigins: ['testwebsite.com'],
      },
    },
    openapiDocument: mypetstoreOpenapiDoc,
  };

  // instantiate cdk construct
  new Wso2Api(scope, `wso2-petstore`, wso2Props);
```

See a complete example at [/examples/src/wso2](/examples/src/wso2)

For this construct, lots of experiences were extracted from [serverless-wso2-apim](https://github.com/ramgrandhi/serverless-wso2-apim). Thanks for the good work, Ram!
