/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */

import fetchMock, { enableFetchMocks } from 'jest-fetch-mock';
import nock from 'nock';
import { mockClient } from 'aws-sdk-client-mock';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { petstoreOpenapi } from '../__tests__/petstore';
import { Wso2ApiBaseProperties, Wso2ApiDefinition } from '../types';

import { Wso2ApiCustomResourceEvent, handler } from './index';

const baseWso2Url = 'https://mywso2.com';

// nock doesn't work with api fetch
enableFetchMocks();

describe('wso2 custom resource lambda', () => {
  it.only('basic wso2 api creation', async () => {
    nockBasicWso2SDK();

    // api list mock
    const testDefs = {
      ...testBasicWso2ApiDefs(),
      id: '123-456',
    };
    fetchMock.doMockOnceIf(/.*\/apis/, JSON.stringify({ list: [testDefs] }), {
      status: 200,
    });

    // api update mock
    fetchMock.doMockOnceIf(/.*\/apis\/.+/, JSON.stringify(testDefs), {
      status: 201,
    });

    // api openapi update mock
    fetchMock.doMockOnceIf(/.*\/apis\/123-456\/swagger/, '', {
      status: 200,
    });

    const eres = await handler(
      testCFNEventCreate({
        ...testEvent,
      }),
    );
    expect(eres.Data?.Error).toBe('aa');
    expect(eres.PhysicalResourceId).toBe('test123Swagger Petstore');
  });
});

const testBasicWso2ApiDefs = (): Wso2ApiDefinition => {
  return {
    wso2Version: 'v1',
    context: '/testcontext1',
    name: 'myapitest',
    version: '1.0.0',
  };
};

const commonEvt = {
  StackId: 'test-stack',
  RequestId: '123-123123',
  LogicalResourceId: 'abc abc',
  ServiceToken: 'arn:somelambdatest',
  ResponseURL: 's3bucketxxx',
  ResourceType: 'wso2api',
};

const testCFNEventCreate = (baseProperties: Wso2ApiBaseProperties): Wso2ApiCustomResourceEvent => {
  return {
    ...commonEvt,
    RequestType: 'Create',
    ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
  };
};
// const testCFNEventDelete = (
//   resourceProperties: { [key: string]: any },
//   physicalResourceId: string,
// ): Wso2ApiCustomResourceEvent => {
//   return {
//     ...commonEvt,
//     RequestType: 'Delete',
//     ResourceProperties: { ...resourceProperties, ServiceToken: 'arn:somelambdatest' },
//     PhysicalResourceId: physicalResourceId,
//   };
// };
// const testCFNEventUpdate = (
//   resourceProperties: { [key: string]: any },
//   oldResourceProperties: { [key: string]: any },
//   physicalResourceId: string,
// ): Wso2ApiCustomResourceEvent => {
//   return {
//     ...commonEvt,
//     RequestType: 'Update',
//     ResourceProperties: { ...resourceProperties, ServiceToken: 'arn:somelambdatest' },
//     PhysicalResourceId: physicalResourceId,
//     OldResourceProperties: oldResourceProperties,
//   };
// };

const testEvent: Wso2ApiBaseProperties = {
  wso2Config: {
    baseApiUrl: baseWso2Url,
    credentialsSecretId: 'arn:aws:secretsmanager:us-east-1:123123123:secret:MySecret',
  },
  openapiDocument: petstoreOpenapi,
  apiDefinition: testBasicWso2ApiDefs(),
};

const nockBasicWso2SDK = (): void => {
  const secretMock = mockClient(SecretsManagerClient);
  secretMock.on(GetSecretValueCommand).resolves({
    SecretBinary: Buffer.from(JSON.stringify({ user: 'user1', pwd: 'pwd1' })),
  });

  // register client mock
  nock(baseWso2Url).post('/client-registration/v0.17/register').reply(200, {
    clientId: 'clientId1',
    clientSecret: 'clientSecret1',
  });

  // get token mock
  nock(baseWso2Url).post('/oauth2/token').reply(200, {
    access_token: '1111-1111-1111',
  });

  // mock server check
  nock(baseWso2Url)
    .get('/services/Version')
    .reply(
      200,
      '<ns:getVersionResponse xmlns:ns="http://version.services.core.carbon.wso2.org"><return>WSO2 API Manager-3.2.0</return></ns:getVersionResponse>',
    );
};
