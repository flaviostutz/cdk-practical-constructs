/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */

import nock from 'nock';
import { mockClient } from 'aws-sdk-client-mock';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { petstoreOpenapi } from '../__tests__/petstore';
import { Wso2ApiBaseProperties, Wso2ApiDefinition } from '../types';

import { Wso2ApiCustomResourceEvent, handler } from './index';

const baseWso2Url = 'https://mywso2.com';

describe('wso2 custom resource lambda', () => {
  it('basic wso2 api creation', async () => {
    nockBasicWso2SDK();

    // api list mock (check if api exists)
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .reply(200, { list: [] });

    // api create mock
    const testDefs = {
      ...testBasicWso2ApiDefs(),
      id: '123-456',
    };
    nock(baseWso2Url)
      .post(/.*\/publisher\/v1\/apis/)
      .query({ openAPIVersion: 'V3' })
      .reply(201, testDefs);

    // api list mock
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(3) // check if updated, check if published
      .reply(200, { list: [testDefs] });

    nockAfterUpdateCreate(testDefs);

    const eres = await handler(
      testCFNEventCreate({
        ...testEvent,
      }),
    );
    expect(eres.PhysicalResourceId).toBe('123-456');
  });
});

it('basic wso2 api update', async () => {
  nockBasicWso2SDK();

  // api list mock
  const testDefs = {
    ...testBasicWso2ApiDefs(),
    id: '123-456',
  };
  nock(baseWso2Url)
    .get(/.*\/publisher\/v1\/apis$/)
    .query(true)
    .times(3) // check create or update, check if updated, check if published
    .reply(200, { list: [testDefs] });

  // api update mock
  nock(baseWso2Url)
    .put(/.*\/publisher\/v1\/apis\/.*/)
    .reply(201, testDefs);

  nockAfterUpdateCreate(testDefs);

  const eres = await handler(
    testCFNEventCreate({
      ...testEvent,
    }),
  );
  expect(eres.PhysicalResourceId).toBe('123-456');
  expect(eres.Status).toBe('SUCCESS');
});

it('basic wso2 api change on UPDATE operation', async () => {
  nockBasicWso2SDK();

  // api list mock
  const testDefs = {
    ...testBasicWso2ApiDefs(),
    id: '123-456',
  };
  nock(baseWso2Url)
    .get(/.*\/publisher\/v1\/apis$/)
    .query(true)
    .times(3) // check create or update, check if updated, check if published
    .reply(200, { list: [testDefs] });

  // api update mock
  nock(baseWso2Url)
    .put(/.*\/publisher\/v1\/apis\/.*/)
    .reply(201, testDefs);

  nockAfterUpdateCreate(testDefs);

  const eres = await handler(
    testCFNEventUpdate(
      {
        ...testEvent,
      },
      '123-456',
      {},
    ),
  );
  expect(eres.PhysicalResourceId).toBe('123-456');
  expect(eres.Status).toBe('SUCCESS');
});

it('basic wso2 api delete on DELETE operation', async () => {
  nockBasicWso2SDK();

  // api update mock
  nock(baseWso2Url)
    .delete(/.*\/publisher\/v1\/apis\/.*/)
    .reply(200);

  const eres = await handler(
    testCFNEventDelete(
      {
        ...testEvent,
      },
      '123-456',
    ),
  );
  expect(eres.Status).toBe('SUCCESS');
});

const testBasicWso2ApiDefs = (): Wso2ApiDefinition => {
  return {
    wso2Version: 'v1',
    context: '/testcontext1',
    name: 'myapitest',
    version: '1.0.0',
    lifeCycleStatus: 'PUBLISHED',
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
const testCFNEventDelete = (
  baseProperties: Wso2ApiBaseProperties,
  PhysicalResourceId: string,
): Wso2ApiCustomResourceEvent => {
  return {
    ...commonEvt,
    RequestType: 'Delete',
    ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
    PhysicalResourceId,
  };
};
const testCFNEventUpdate = (
  baseProperties: Wso2ApiBaseProperties,
  PhysicalResourceId: string,
  oldResourceProperties: Record<string, string>,
): Wso2ApiCustomResourceEvent => {
  return {
    ...commonEvt,
    RequestType: 'Update',
    ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
    PhysicalResourceId,
    OldResourceProperties: oldResourceProperties,
  };
};

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

const nockAfterUpdateCreate = (testDefs: Wso2ApiDefinition): void => {
  // api openapi update mock
  nock(baseWso2Url)
    .put(/.*\/publisher\/v1\/apis\/123-456\/swagger/)
    .reply(200);

  // api openapi get mock
  nock(baseWso2Url)
    .get(/.*\/publisher\/v1\/apis\/123-456\/swagger/)
    .reply(200, JSON.stringify(testEvent.openapiDocument), ['Content-Type', 'text/plain']);

  // api change to published mock
  nock(baseWso2Url)
    .post(/.*\/publisher\/v1\/apis\/change-lifecycle/)
    .query({ apiId: '123-456', action: 'Publish' })
    .reply(200);

  // api get endpoint urls mock
  nock(baseWso2Url)
    .get(/.*\/store\/v1\/apis\/123-456$/)
    .reply(200, testDefs);
};
