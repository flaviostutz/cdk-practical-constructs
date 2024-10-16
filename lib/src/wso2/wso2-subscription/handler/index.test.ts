/* eslint-disable no-console */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */

import nock from 'nock';

import { Wso2SubscriptionDefinition } from '../v1/types';
import { Wso2SubscriptionCustomResourceProperties } from '../types';
import { nockBasicWso2SDK } from '../../wso2-utils.test';

import { handler, Wso2SubscriptionCustomResourceEvent } from './index';

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

describe('wso2 subscription custom resource lambda', () => {
  beforeEach(() => {
    nock.cleanAll();
    // silence verbose console logs. comment this for debugging
    // console.log = (): void => {};
  });
  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('wso2 subscription delete', async () => {
    nockBasicWso2SDK(baseWso2Url);

    // application get mock
    nock(baseWso2Url)
      .delete(/.*\/store\/v1\/subscriptions\/[^\\/]+$/)
      .times(1) // check if was created
      .reply(200);

    const eres = await handler(testCFNEventDelete(testEvent, '123-456'));
    expect(eres.Status).toBe('SUCCESS');
  });

  it('basic wso2 subscription update', async () => {
    nockBasicWso2SDK(baseWso2Url);

    const testDefs: Wso2SubscriptionDefinition = testSubscriptionDefs();

    // subscriptions list mock
    nock(baseWso2Url)
      .get(/.*\/store\/v1\/subscriptions.*/)
      .query(true)
      .times(1) // check create or update
      .reply(200, { list: [{ ...testDefs, subscriptionId: '123-456' }] });

    // subscription update mock
    nock(baseWso2Url)
      .put(/.*\/store\/v1\/subscriptions\/[^\\/]+$/)
      .times(1)
      .reply(200);

    // subscription get mock
    nock(baseWso2Url)
      .get(/.*\/store\/v1\/subscriptions\/[^\\/]+$/)
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

  it('basic wso2 subscription create', async () => {
    nockBasicWso2SDK(baseWso2Url);

    // subscriptions list mock
    nock(baseWso2Url)
      .get(/.*\/store\/v1\/subscriptions.*/)
      .query(true)
      .times(1) // check create or update
      .reply(200, { list: [] });

    const testDefs: Wso2SubscriptionDefinition = testSubscriptionDefs();

    // subscription create mock
    nock(baseWso2Url)
      .post(/.*\/store\/v1\/subscriptions$/)
      .reply(201, { ...testDefs, subscriptionId: '123-456' });

    // subscription get mock
    nock(baseWso2Url)
      .get(/.*\/store\/v1\/subscriptions\/[^\\/]+$/)
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

  const testSubscriptionDefs = (): Wso2SubscriptionDefinition => {
    return {
      apiId: '111-222',
      applicationId: '333-444',
      throttlingPolicy: 'Unlimited',
    };
  };

  const commonEvt = {
    StackId: 'test-stack',
    RequestId: '123-123123',
    LogicalResourceId: 'abc abc',
    ServiceToken: 'arn:somelambdatest',
    ResponseURL: 's3bucketxxx',
    ResourceType: 'wso2subscription',
  };

  const testCFNEventCreate = (
    baseProperties: Wso2SubscriptionCustomResourceProperties,
  ): Wso2SubscriptionCustomResourceEvent => {
    return {
      ...commonEvt,
      RequestType: 'Create',
      ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
    };
  };
  const testCFNEventDelete = (
    baseProperties: Wso2SubscriptionCustomResourceProperties,
    PhysicalResourceId: string,
  ): Wso2SubscriptionCustomResourceEvent => {
    return {
      ...commonEvt,
      RequestType: 'Delete',
      ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
      PhysicalResourceId,
    };
  };
  // const testCFNEventUpdate = (
  //   baseProperties: Wso2SubscriptionCustomResourceProperties,
  //   PhysicalResourceId: string,
  //   oldResourceProperties: Record<string, string>,
  // ): Wso2SubscriptionCustomResourceEvent => {
  //   return {
  //     ...commonEvt,
  //     RequestType: 'Update',
  //     ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
  //     PhysicalResourceId,
  //     OldResourceProperties: oldResourceProperties,
  //   };
  // };

  const testEvent: Wso2SubscriptionCustomResourceProperties = {
    wso2Config: {
      baseApiUrl: baseWso2Url,
      credentialsSecretId: 'arn:aws:secretsmanager:us-east-1:123123123:secret:MySecret',
      apiVersion: 'v1',
    },
    subscriptionDefinition: testSubscriptionDefs(),
    retryOptions: testRetryOptions,
  };
});
