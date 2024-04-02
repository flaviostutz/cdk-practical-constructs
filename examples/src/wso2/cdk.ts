/* eslint-disable camelcase */
import { Construct } from 'constructs';
import { Wso2Api, Wso2ApiProps } from 'cdk-practical-constructs';

import { petstoreOpenapi } from './petstore-openapi';

export const addWso2Api = (scope: Construct): void => {
  // prepare api definition
  const wso2Props: Wso2ApiProps = {
    wso2Config: {
      baseApiUrl: 'https://mywso2.com',
      credentialsSecretId: 'shared/wso2-creds',
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
    openapiDocument: petstoreOpenapi,
  };

  // eslint-disable-next-line no-new
  new Wso2Api(scope, 'wso2-petstore', wso2Props);
};
