/* eslint-disable no-console */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */

import nock from 'nock';
import { mockClient } from 'aws-sdk-client-mock';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { Wso2ApplicationDefinition } from '../v1/types';
import { Wso2ApplicationCustomResourceProperties } from '../types';

import { Wso2ApplicationCustomResourceEvent, handler } from './index';

const baseWso2Url = 'https://mywso2.com';

const testRetryOptions = {
  checkRetries: {
    startingDelay: 100,
    delayFirstAttempt: true,
    maxDelay: 100,
    numOfAttempts: 0,
    timeMultiple: 1.1,
  },
  mutationRetries: {
    startingDelay: 100,
    delayFirstAttempt: true,
    maxDelay: 100,
    numOfAttempts: 0,
    timeMultiple: 1.1,
  },
};

const originalConsoleLog = console.log;

describe('wso2 application custom resource lambda', () => {
  beforeEach(() => {
    nock.cleanAll();
    // silence verbose console logs. comment this for debugging
    // console.log = (): void => {};
  });
  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('wso2 application delete', async () => {
    nockBasicWso2SDK();

    // application get mock
    nock(baseWso2Url)
      .delete(/.*\/store\/v1\/applications\/[^\\/]+$/)
      .times(1) // check if was created
      .reply(200);

    const eres = await handler(testCFNEventDelete(testEvent, '123-456'));
    expect(eres.Status).toBe('SUCCESS');
  });

  it('basic wso2 application update', async () => {
    nockBasicWso2SDK();

    const testDefs: Wso2ApplicationDefinition = testApplicationDefs();

    // api list mock
    nock(baseWso2Url)
      .get(/.*\/store\/v1\/applications.*/)
      .query(true)
      .times(1) // check create or update
      .reply(200, { list: [{ ...testDefs, applicationId: '123-456' }] });

    // application update mock
    nock(baseWso2Url)
      .put(/.*\/store\/v1\/applications\/[^\\/]+$/)
      .times(1)
      .reply(200);

    // application get mock
    nock(baseWso2Url)
      .get(/.*\/store\/v1\/applications\/[^\\/]+$/)
      .times(1) // check if was created
      .reply(200, { ...testDefs });

    const eres = await handler(
      testCFNEventCreate({
        ...testEvent,
      }),
    );
    expect(eres.PhysicalResourceId).toBe('123-456');
    expect(eres.Status).toBe('SUCCESS');
  });

  it('basic wso2 application create', async () => {
    nockBasicWso2SDK();

    // api list mock
    nock(baseWso2Url)
      .get(/.*\/store\/v1\/applications.*/)
      .query(true)
      .times(1) // check create or update
      .reply(200, { list: [] });

    const testDefs: Wso2ApplicationDefinition = testApplicationDefs();

    // application create mock
    nock(baseWso2Url)
      .post(/.*\/store\/v1\/applications$/)
      .reply(201, { ...testDefs, applicationId: '123-456' });

    // application get mock
    nock(baseWso2Url)
      .get(/.*\/store\/v1\/applications\/[^\\/]+$/)
      .times(1) // check if was created
      .reply(200, { ...testDefs });

    const eres = await handler(
      testCFNEventCreate({
        ...testEvent,
      }),
    );
    expect(eres.PhysicalResourceId).toBe('123-456');
    expect(eres.Status).toBe('SUCCESS');
  });

  const testApplicationDefs = (): Wso2ApplicationDefinition => {
    return {
      name: 'someapplication',
      throttlingPolicy: 'Unlimited',
      attributes: {
        mycustom1: 'value1',
        mycustom2: 'value2',
      },
    };
  };

  const commonEvt = {
    StackId: 'test-stack',
    RequestId: '123-123123',
    LogicalResourceId: 'abc abc',
    ServiceToken: 'arn:somelambdatest',
    ResponseURL: 's3bucketxxx',
    ResourceType: 'wso2application',
  };

  const testCFNEventCreate = (
    baseProperties: Wso2ApplicationCustomResourceProperties,
  ): Wso2ApplicationCustomResourceEvent => {
    return {
      ...commonEvt,
      RequestType: 'Create',
      ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
    };
  };
  const testCFNEventDelete = (
    baseProperties: Wso2ApplicationCustomResourceProperties,
    PhysicalResourceId: string,
  ): Wso2ApplicationCustomResourceEvent => {
    return {
      ...commonEvt,
      RequestType: 'Delete',
      ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
      PhysicalResourceId,
    };
  };
  // const testCFNEventUpdate = (
  //   baseProperties: Wso2ApplicationCustomResourceProperties,
  //   PhysicalResourceId: string,
  //   oldResourceProperties: Record<string, string>,
  // ): Wso2ApplicationCustomResourceEvent => {
  //   return {
  //     ...commonEvt,
  //     RequestType: 'Update',
  //     ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
  //     PhysicalResourceId,
  //     OldResourceProperties: oldResourceProperties,
  //   };
  // };

  const testEvent: Wso2ApplicationCustomResourceProperties = {
    wso2Config: {
      baseApiUrl: baseWso2Url,
      credentialsSecretId: 'arn:aws:secretsmanager:us-east-1:123123123:secret:MySecret',
      apiVersion: 'v1',
    },
    applicationDefinition: testApplicationDefs(),
    retryOptions: testRetryOptions,
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
});
