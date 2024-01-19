/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable fp/no-mutating-methods */

import { cloneDeep } from 'lodash';
import { App, Stack } from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';

import { petstoreOpenapi } from './__tests__/petstore';
import { Wso2Api } from './wso2-api';
import { Wso2ApiDefinition, Wso2ApiProps } from './types';

describe('wso2-api-construct', () => {
  it('minimal wso2 api', async () => {
    const app = new App();
    const stack = new Stack(app);

    const testProps1 = testProps();
    const wso2Api = new Wso2Api(stack, 'wso2', testProps1);

    expect(wso2Api.customResourceFunction).toBeDefined();
    expect(wso2Api.wso2ApiDefinition.enableStore).toBeTruthy();

    const template = Template.fromStack(stack);
    // console.log(JSON.stringify(template.toJSON(), null, 2));

    template.hasResourceProperties('Custom::Wso2ApiCustomResource', {
      wso2BaseUrl: testProps1.wso2BaseUrl,
      wso2CredentialsSecretManagerPath: testProps1.wso2CredentialsSecretManagerPath,
      wso2ApiDefinition: wso2Api.wso2ApiDefinition,
      openapiDocument: testProps1.openapiDocument,
    });
  });

  it('openapi lint should fail', async () => {
    const app = new App();
    const stack = new Stack(app);

    const testProps1 = testProps();
    // @ts-ignore
    testProps1.openapiDocument.paths['/pets/{petId}'].get.parameters[0].name = 'SOMETHING';

    const f = (): void => {
      // eslint-disable-next-line no-new
      new Wso2Api(stack, 'wso2', testProps1);
    };
    expect(f).toThrow('Operation must define parameter "{petId}"');
  });

  it('cors config sugar should work', async () => {
    const app = new App();
    const stack = new Stack(app);

    const testProps1 = testProps();
    testProps1.wso2ApiDefinition.corsConfiguration = {
      accessControlAllowOrigins: ['testwebsite.com'],
    };
    const wso2Api = new Wso2Api(stack, 'wso2', testProps1);

    expect(wso2Api.wso2ApiDefinition.corsConfiguration).toMatchObject({
      accessControlAllowHeaders: [
        'Authorization',
        'Access-Control-Allow-Origin',
        'Content-Type',
        'SOAPAction',
      ],
      corsConfigurationEnabled: true,
      accessControlAllowOrigins: ['testwebsite.com'],
    });
  });
});

const testWso2ApiDefs = (args: { context: string; backendUrl: string }): Wso2ApiDefinition => {
  return {
    wso2Version: 'v1',
    version: '1.0.0',
    type: 'HTTP',
    endpointConfig: {
      production_endpoints: {
        url: args.backendUrl,
      },
      sandbox_endpoints: {
        url: args.backendUrl,
      },
      endpoint_type: 'http',
    },
    context: args.context,
    name: args.context,
    gatewayEnvironments: ['public'],
  };
};

const testProps = (): Wso2ApiProps => {
  return {
    wso2BaseUrl: 'http://localhost:8080/wso2',
    wso2CredentialsSecretManagerPath: 'arn::creds',
    wso2ApiDefinition: testWso2ApiDefs({
      context: '/test1',
      backendUrl: 'http://localhost:8080/',
    }),
    openapiDocument: cloneDeep(petstoreOpenapi),
  };
};
