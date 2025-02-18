/* eslint-disable no-console */
import nock from 'nock';

import { Wso2SubscriptionDefinition } from '../v1/types';
import { Wso2ApiSubscriptionProps } from '../types';
import { nockBasicWso2SDK } from '../../__tests__/wso2-utils';

import { handler, Wso2ApiSubscriptionCustomResourceEvent } from './index';

const baseWso2Url = 'https://mywso2.com';

const testRetryOptions = {
  checkRetries: {
    startingDelay: 100,
    delayFirstAttempt: true,
    maxDelay: 100,
    numOfAttempts: 3,
    timeMultiple: 1.1,
  },
  mutationRetries: {
    startingDelay: 100,
    delayFirstAttempt: true,
    maxDelay: 100,
    numOfAttempts: 3,
    timeMultiple: 1.1,
  },
};

const originalConsoleLog = console.log;

describe('wso2 subscription custom resource lambda', () => {
  describe('request type create', () => {
    beforeEach(() => {
      nock.cleanAll();
      // silence verbose console logs. comment this for debugging
      console.log = (): void => {};
    });

    afterEach(() => {
      console.log = originalConsoleLog;
    });

    it('should create the subscription', async () => {
      nockBasicWso2SDK(baseWso2Url);
      const testDefs: Wso2SubscriptionDefinition = testSubscriptionDefs();

      // get api mock
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis\/111-222/)
        .times(1)
        .reply(200, { id: '111-222' });

      // get application mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/applications\/333-444/)
        .times(1)
        .reply(200, { applicationId: '333-444' });

      // subscriptions list mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions.*/)
        .query(true)
        .times(1)
        .reply(200, { list: [] });

      // subscription get mock
      const getSubscriptionNock = nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(1) // check if was created
        .reply(200, { ...testDefs, throttlingPolicy: 'Unlimited' });

      // subscription create mock
      const createNock = nock(baseWso2Url)
        .post(/.*\/store\/v1\/subscriptions/)
        .times(1)
        .reply(200, { subscriptionId: '123-456' });

      const eres = await handler(testCFNEventCreate(testEvent));
      expect(eres.Status).toBe('SUCCESS');

      // make sure that the subscription create was called
      createNock.done();
      getSubscriptionNock.done();
    });

    it('should create the subscription by searching for api and application', async () => {
      nockBasicWso2SDK(baseWso2Url);
      const testDefs: Wso2SubscriptionDefinition = testSubscriptionDefs();

      const apiSearchParameters = {
        name: 'my-api',
        version: 'v1',
        context: '/my-api',
      };

      // search api mock
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis/)
        .query({ query: 'name:my-api version:v1 context:/my-api' })
        .times(1)
        .reply(200, { list: [{ id: '111-222', ...apiSearchParameters }] });

      // get application mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/applications/)
        .query({ query: 'my-app' })
        .times(1)
        .reply(200, { list: [{ applicationId: '333-444' }] });

      // subscriptions list mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions.*/)
        .query(true)
        .times(1) // check create or update
        .reply(200, { list: [] });

      // subscription get mock
      const getSubscriptionNock = nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(1)
        .reply(200, { ...testDefs, throttlingPolicy: 'Unlimited' });

      // subscription create mock
      const createNock = nock(baseWso2Url)
        .post(/.*\/store\/v1\/subscriptions/)
        .times(1)
        .reply(200, { subscriptionId: '123-456' });

      const eres = await handler(
        testCFNEventCreate({
          ...testEvent,
          // eslint-disable-next-line no-undefined
          apiId: undefined,
          // eslint-disable-next-line no-undefined
          applicationId: undefined,
          apiSearchParameters,
          applicationSearchParameters: {
            name: 'my-app',
          },
        }),
      );
      expect(eres.Status).toBe('SUCCESS');

      // make sure that the subscription create was called
      createNock.done();
      getSubscriptionNock.done();
    });

    it('should skip update subscription when no changes are detected', async () => {
      nockBasicWso2SDK(baseWso2Url);
      const testDefs: Wso2SubscriptionDefinition = testSubscriptionDefs();

      // get api mock
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis\/111-222/)
        .times(1)
        .reply(200, { id: '111-222' });

      // get application mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/applications\/333-444/)
        .times(1)
        .reply(200, { applicationId: '333-444' });

      // subscriptions list mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions.*/)
        .query(true)
        .times(1)
        .reply(200, { list: [{ ...testDefs, subscriptionId: '123-456' }] });

      // subscription create mock
      const createNock = nock(baseWso2Url)
        .post(/.*\/store\/v1\/subscriptions/)
        .times(1)
        .reply(200, { subscriptionId: '123-456' });

      // subscription update mock
      const updateNock = nock(baseWso2Url)
        .put(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(1)
        .reply(200);

      const eres = await handler(testCFNEventCreate(testEvent));
      expect(eres.Status).toBe('SUCCESS');

      expect(updateNock.isDone()).toBeFalsy();
      expect(createNock.isDone()).toBeFalsy();
    });

    it('should update subscription when throttling policy changes', async () => {
      nockBasicWso2SDK(baseWso2Url);
      const testDefs: Wso2SubscriptionDefinition = testSubscriptionDefs('Gold');

      // get api mock
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis\/111-222/)
        .times(1)
        .reply(200, { id: '111-222' });

      // get application mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/applications\/333-444/)
        .times(1)
        .reply(200, { applicationId: '333-444' });

      // subscriptions list mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions.*/)
        .query(true)
        .times(1)
        .reply(200, { list: [{ ...testDefs, subscriptionId: '123-456' }] });

      // subscription create mock
      const createNock = nock(baseWso2Url)
        .post(/.*\/store\/v1\/subscriptions/)
        .times(1)
        .reply(200, { subscriptionId: '123-456' });

      // subscription update mock
      const updateNock = nock(baseWso2Url)
        .put(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(1)
        .reply(200);

      const eres = await handler(testCFNEventCreate(testEvent));
      expect(eres.Status).toBe('SUCCESS');

      updateNock.done();
      expect(createNock.isDone()).toBeFalsy();
    });

    it('should fail if subscription already exists and failIfExists is true', async () => {
      nockBasicWso2SDK(baseWso2Url);
      const testDefs: Wso2SubscriptionDefinition = testSubscriptionDefs();

      // get api mock
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis\/111-222/)
        .times(1)
        .reply(200, { id: '111-222' });

      // get application mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/applications\/333-444/)
        .times(1)
        .reply(200, { applicationId: '333-444' });

      // subscriptions list mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions.*/)
        .query(true)
        .times(1)
        .reply(200, { list: [{ ...testDefs, subscriptionId: '123-456' }] });

      // subscription create mock
      const createNock = nock(baseWso2Url)
        .post(/.*\/store\/v1\/subscriptions/)
        .times(1)
        .reply(200, { subscriptionId: '123-456' });

      // subscription update mock
      const updateNock = nock(baseWso2Url)
        .put(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(1)
        .reply(200);

      await expect(
        handler(testCFNEventCreate({ ...testEvent, failIfExists: true })),
      ).rejects.toThrow(
        `Error: WSO2 Subscription '123-456' already exists but cannot be managed by this resource. Change 'failIfExists' to change this behavior`,
      );

      expect(updateNock.isDone()).toBeFalsy();
      expect(createNock.isDone()).toBeFalsy();
    });
  });

  describe('request type update', () => {
    beforeEach(() => {
      nock.cleanAll();
      // silence verbose console logs. comment this for debugging
      console.log = (): void => {};
    });
    afterEach(() => {
      console.log = originalConsoleLog;
    });

    it('should update the subscription', async () => {
      nockBasicWso2SDK(baseWso2Url);
      const testDefs: Wso2SubscriptionDefinition = testSubscriptionDefs('Gold');

      // get api mock
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis\/111-222/)
        .times(1)
        .reply(200, { id: '111-222' });

      // get application mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/applications\/333-444/)
        .times(1)
        .reply(200, { applicationId: '333-444' });

      // subscriptions list mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions.*/)
        .query(true)
        .times(1)
        .reply(200, { list: [{ ...testDefs, subscriptionId: '123-456' }] });

      // subscription update mock
      const updateNock = nock(baseWso2Url)
        .put(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(1)
        .reply(200);

      const eres = await handler(testCFNEventUpdate(testEvent, '123-456'));
      expect(eres.Status).toBe('SUCCESS');

      // make sure that the subscription update was called
      updateNock.done();
    });

    it('should update the subscription by searching for api and application', async () => {
      nockBasicWso2SDK(baseWso2Url);
      const testDefs: Wso2SubscriptionDefinition = testSubscriptionDefs('Gold');

      const apiSearchParameters = {
        name: 'my-api',
        version: 'v1',
        context: '/my-api',
      };

      // search api mock
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis/)
        .query({ query: 'name:my-api version:v1 context:/my-api' })
        .times(1)
        .reply(200, { list: [{ id: '111-222', ...apiSearchParameters }] });

      // get application mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/applications/)
        .query({ query: 'my-app' })
        .times(1)
        .reply(200, { list: [{ applicationId: '333-444' }] });

      // subscriptions list mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions.*/)
        .query(true)
        .times(1) // check create or update
        .reply(200, { list: [{ ...testDefs, subscriptionId: '123-456' }] });

      // subscription update mock
      const updateNock = nock(baseWso2Url)
        .put(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(1)
        .reply(200);

      const eres = await handler(
        testCFNEventUpdate(
          {
            ...testEvent,
            // eslint-disable-next-line no-undefined
            apiId: undefined,
            // eslint-disable-next-line no-undefined
            applicationId: undefined,
            apiSearchParameters,
            applicationSearchParameters: {
              name: 'my-app',
            },
          },
          '123-456',
        ),
      );
      expect(eres.Status).toBe('SUCCESS');

      // make sure that the subscription update was called
      updateNock.done();
    });

    it('should skip update subscription when no changes are detected', async () => {
      nockBasicWso2SDK(baseWso2Url);
      const testDefs: Wso2SubscriptionDefinition = testSubscriptionDefs();

      // get api mock
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis\/111-222/)
        .times(1)
        .reply(200, { id: '111-222' });

      // get application mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/applications\/333-444/)
        .times(1)
        .reply(200, { applicationId: '333-444' });

      // subscriptions list mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions.*/)
        .query(true)
        .times(1) // check create or update
        .reply(200, { list: [{ ...testDefs, subscriptionId: '123-456' }] });

      // subscription update mock
      const updateNock = nock(baseWso2Url)
        .put(/.*\/store\/v1\/subscriptions\/123-456/)
        .reply(200);

      const eres = await handler(testCFNEventUpdate(testEvent, '123-456'));
      expect(eres.Status).toBe('SUCCESS');
      expect(updateNock.isDone()).toBeFalsy();
    });
  });

  describe('request type delete', () => {
    beforeEach(() => {
      nock.cleanAll();
      // silence verbose console logs. comment this for debugging
      console.log = (): void => {};
    });
    afterEach(() => {
      console.log = originalConsoleLog;
    });

    it('should delete the subscription', async () => {
      nockBasicWso2SDK(baseWso2Url);

      // subscription delete mock
      nock(baseWso2Url)
        .delete(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(1)
        .reply(200);

      const eres = await handler(testCFNEventDelete(testEvent, '123-456'));
      expect(eres.Status).toBe('SUCCESS');
    });

    it('should return success when the subscription is already deleted', async () => {
      nockBasicWso2SDK(baseWso2Url);

      // subscription delete mock
      nock(baseWso2Url)
        .delete(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(1)
        .reply(404, { message: 'subscription not found' });

      const eres = await handler(testCFNEventDelete(testEvent, '123-456'));
      expect(eres.Status).toBe('SUCCESS');
    });
  });

  describe('retries', () => {
    beforeEach(() => {
      nock.cleanAll();
      // silence verbose console logs. comment this for debugging
      console.log = (): void => {};
    });
    afterEach(() => {
      console.log = originalConsoleLog;
    });

    it('should retry on create subscription', async () => {
      nockBasicWso2SDK(baseWso2Url);
      const testDefs: Wso2SubscriptionDefinition = testSubscriptionDefs();

      // get api mock
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis\/111-222/)
        .times(1)
        .reply(200, { id: '111-222' });

      // get application mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/applications\/333-444/)
        .times(1)
        .reply(200, { applicationId: '333-444' });

      // subscriptions list mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions.*/)
        .query(true)
        .times(1)
        .reply(200, { list: [] });

      // subscription get mock (checks if the api was created)
      const getSubscriptionFailNock = nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(2)
        .reply(500);
      const getSubscriptionSuccessNock = nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(1)
        .reply(200, testDefs);

      // subscription create mock
      const createFailNock = nock(baseWso2Url)
        .post(/.*\/store\/v1\/subscriptions/)
        .times(2)
        .reply(500);

      const createSuccessNock = nock(baseWso2Url)
        .post(/.*\/store\/v1\/subscriptions/)
        .times(1)
        .reply(200, { subscriptionId: '123-456' });

      const eres = await handler(testCFNEventCreate(testEvent));
      expect(eres.Status).toBe('SUCCESS');

      createFailNock.done();
      createSuccessNock.done();
      getSubscriptionFailNock.done();
      getSubscriptionSuccessNock.done();
    });

    it('should retry on update subscription', async () => {
      nockBasicWso2SDK(baseWso2Url);
      const testDefs: Wso2SubscriptionDefinition = testSubscriptionDefs('Gold');

      // get api mock
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis\/111-222/)
        .times(1)
        .reply(200, { id: '111-222' });

      // get application mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/applications\/333-444/)
        .times(1)
        .reply(200, { applicationId: '333-444' });

      // subscriptions list mock
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/subscriptions.*/)
        .query(true)
        .times(1)
        .reply(200, { list: [{ ...testDefs, subscriptionId: '123-456' }] });

      // subscription update mock
      const updateFailNock = nock(baseWso2Url)
        .put(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(2)
        .reply(500);

      const updateSuccessNock = nock(baseWso2Url)
        .put(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(1)
        .reply(200, { subscriptionId: '123-456' });

      const eres = await handler(testCFNEventUpdate(testEvent, '123-456'));
      expect(eres.Status).toBe('SUCCESS');

      updateFailNock.done();
      updateSuccessNock.done();
    });

    it('should retry on delete subscription', async () => {
      nockBasicWso2SDK(baseWso2Url);

      // subscription delete mock
      const deleteFailMock = nock(baseWso2Url)
        .delete(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(2)
        .reply(500);

      const deleteSuccessMock = nock(baseWso2Url)
        .delete(/.*\/store\/v1\/subscriptions\/123-456/)
        .times(1)
        .reply(200);

      const eres = await handler(testCFNEventDelete(testEvent, '123-456'));
      expect(eres.Status).toBe('SUCCESS');

      deleteFailMock.done();
      deleteSuccessMock.done();
    });
  });

  const testSubscriptionDefs = (
    throttlingPolicy?: Wso2SubscriptionDefinition['throttlingPolicy'],
  ): Wso2SubscriptionDefinition => {
    return {
      apiId: '111-222',
      applicationId: '333-444',
      throttlingPolicy: throttlingPolicy ?? 'Unlimited',
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
    baseProperties: Wso2ApiSubscriptionProps,
  ): Wso2ApiSubscriptionCustomResourceEvent => {
    return {
      ...commonEvt,
      RequestType: 'Create',
      ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
    };
  };

  const testCFNEventUpdate = (
    baseProperties: Wso2ApiSubscriptionProps,
    PhysicalResourceId: string,
    OldResourceProperties: Record<string, string> = {},
  ): Wso2ApiSubscriptionCustomResourceEvent => {
    return {
      ...commonEvt,
      RequestType: 'Update',
      ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
      PhysicalResourceId,
      OldResourceProperties,
    };
  };

  const testCFNEventDelete = (
    baseProperties: Wso2ApiSubscriptionProps,
    PhysicalResourceId: string,
  ): Wso2ApiSubscriptionCustomResourceEvent => {
    return {
      ...commonEvt,
      RequestType: 'Delete',
      ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
      PhysicalResourceId,
    };
  };

  const testEvent: Wso2ApiSubscriptionProps = {
    wso2Config: {
      baseApiUrl: baseWso2Url,
      credentialsSecretId: 'arn:aws:secretsmanager:us-east-1:123123123:secret:MySecret',
      apiVersion: 'v1',
    },
    ...testSubscriptionDefs(),
    retryOptions: testRetryOptions,
  };
});
