/* eslint-disable no-console */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */

import nock from 'nock';

import { petstoreOpenapi } from '../__tests__/petstore';
import { ApiFromListV1, PublisherPortalAPIv1, Wso2ApiDefinitionV1 } from '../v1/types';
import { Wso2ApiCustomResourceProperties } from '../types';
import { nockBasicWso2SDK } from '../../__tests__/wso2-utils';

import { Wso2ApiCustomResourceEvent, handler } from './index';

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

describe('wso2 custom resource lambda', () => {
  beforeEach(() => {
    nock.cleanAll();
    // silence verbose console logs. comment this for debugging
    console.log = (): void => {};
  });
  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('basic wso2 api create', async () => {
    nockBasicWso2SDK(baseWso2Url);

    // api list mock
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(1) // check create or update
      .reply(200, { list: [] });

    const testDefs: Wso2ApiDefinitionV1 = {
      ...testBasicWso2ApiDefs(),
      id: '123-456',
    };

    // api create mock
    nock(baseWso2Url)
      .post(/.*\/publisher\/v1\/apis\?.*$/)
      .reply(201, testDefs);

    // api get mock
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis\/[^\\/]*$/)
      .times(2) // check if content matches
      .reply(200, { ...testDefs, lastUpdatedTime: '2020-10-10' });

    const nocksUpdateCreate = nockAfterCreateUpdateAndChangeLifecycleStatusInWso2(testDefs);

    const eres = await handler(
      testCFNEventCreate({
        ...testEvent,
      }),
    );
    expect(eres.PhysicalResourceId).toBe('123-456');
    expect(eres.Status).toBe('SUCCESS');

    // check if the correct endpoints were invoked during update/create process
    // eslint-disable-next-line no-restricted-syntax
    for (const n of nocksUpdateCreate) {
      n.done();
    }
  });

  it('wso2 api create and PUBLISH', async () => {
    nockBasicWso2SDK(baseWso2Url);

    // api list mock
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(1) // check create or update
      .reply(200, { list: [] });

    const testDefs: Wso2ApiDefinitionV1 = {
      ...testBasicWso2ApiDefs(),
      id: '123-456',
    };

    // api create mock
    nock(baseWso2Url)
      .post(/.*\/publisher\/v1\/apis\?.*$/)
      .reply(201, testDefs);

    // api get mock
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis\/[^\\/]*$/)
      .times(2) // check if content matches
      .reply(200, { ...testDefs, lastUpdatedTime: '2020-10-10' });

    const nocksUpdateCreate = nockAfterCreateUpdateAndChangeLifecycleStatusInWso2(
      testDefs,
      'Publish',
    );

    const eres = await handler(
      testCFNEventCreate({
        ...testEvent,
        lifecycleStatus: 'PUBLISHED',
      }),
    );
    expect(eres.PhysicalResourceId).toBe('123-456');
    expect(eres.Status).toBe('SUCCESS');

    // check if the correct endpoints were invoked during update/create process
    // eslint-disable-next-line no-restricted-syntax
    for (const n of nocksUpdateCreate) {
      n.done();
    }
  });

  it('basic wso2 api update', async () => {
    nockBasicWso2SDK(baseWso2Url);

    // api list mock
    const testDefs: Wso2ApiDefinitionV1 = {
      ...testBasicWso2ApiDefs(),
      id: '123-456',
    };

    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(2) // check overlap, check create or update
      .reply(200, toResultList({ ...testDefs, lastUpdatedTime: '2020-10-10' }));

    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(2) // check if updated, check if published
      .reply(200, toResultList(testDefs));

    // api update mock
    nock(baseWso2Url)
      .put(/.*\/publisher\/v1\/apis\/.*$/)
      .reply(201, testDefs);

    // api get mock
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis\/.*$/)
      .times(2) // check overlap, check if content matches
      .reply(200, { ...testDefs, lastUpdatedTime: '2020-10-10' });

    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis\/.*$/)
      .times(1) // check if content matches
      .reply(200, { ...testDefs, lastUpdatedTime: '2020-10-11' });

    nockAfterCreateUpdateAndChangeLifecycleStatusInWso2(testDefs);

    const eres = await handler(
      testCFNEventCreate({
        ...testEvent,
      }),
    );
    expect(eres.PhysicalResourceId).toBe('123-456');
    expect(eres.Status).toBe('SUCCESS');
  });

  it('basic wso2 api change on UPDATE operation', async () => {
    nockBasicWso2SDK(baseWso2Url);

    // api list mock
    const testDefs: Wso2ApiDefinitionV1 = {
      ...testBasicWso2ApiDefs(),
      id: '123-456',
    };
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(4) // check overlap, check create or update, check if updated, check if published
      .reply(200, toResultList(testDefs));

    // api get mock
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis\/.*$/)
      .times(2) // check overlap, check if content matches
      .reply(200, { ...testDefs, lastUpdatedTime: '2020-10-10' });

    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis\/.*$/)
      .times(1) // check if content matches
      .reply(200, { ...testDefs, lastUpdatedTime: '2020-10-11' });

    // api update mock
    nock(baseWso2Url)
      .put(/.*\/publisher\/v1\/apis\/.*$/)
      .reply(201, testDefs);

    nockAfterCreateUpdateAndChangeLifecycleStatusInWso2(testDefs);

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

  it('should pass with success if wso2 answers properly after a few retries', async () => {
    nockBasicWso2SDK(baseWso2Url);

    // api list mock
    const testDefs: Wso2ApiDefinitionV1 = {
      ...testBasicWso2ApiDefs(),
      id: '123-456',
    };
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(2) // check overlap, create or update
      .reply(200, toResultList(testDefs));

    // api get mock (check overlap fields)
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis\/.*$/)
      .times(1) // check if content matches
      .reply(200, { ...testDefs, lastUpdatedTime: '2020-10-10' });

    // api update mock
    nock(baseWso2Url)
      .put(/.*\/publisher\/v1\/apis\/.*$/)
      .times(1)
      .reply(200, testDefs);

    // api list mock
    const nfail = nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(3) // check updated (fails 3 times)
      .reply(500);

    // api list mock
    const nsuccess = nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(1) // check updated (works on 4th time)
      .reply(200, toResultList(testDefs));

    // api get mock
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis\/.*$/)
      .times(1) // check if content matches
      .reply(200, { ...testDefs, lastUpdatedTime: '2020-10-10' });

    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis\/.*$/)
      .times(1) // check if content matches
      .reply(200, { ...testDefs, lastUpdatedTime: '2020-10-11' });

    nockAfterCreateUpdateAndChangeLifecycleStatusInWso2(testDefs);

    const eres = await handler(
      testCFNEventUpdate(
        {
          ...testEvent,
          retryOptions: {
            ...testRetryOptions,
            checkRetries: {
              startingDelay: 100,
              numOfAttempts: 4,
              timeMultiple: 1.1,
            },
          },
        },
        '123-456',
        {},
      ),
    );
    expect(eres.PhysicalResourceId).toBe('123-456');
    expect(eres.Status).toBe('SUCCESS');
    nfail.done();
    nsuccess.done();
  });

  it('should fail after retrying checking WSO2 api for a few times', async () => {
    nockBasicWso2SDK(baseWso2Url);

    // api list mock
    const testDefs: Wso2ApiDefinitionV1 = {
      ...testBasicWso2ApiDefs(),
      id: '123-456',
    };
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis/)
      .query(true)
      .times(1) // check create or update
      .reply(200, toResultList(testDefs));

    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis\/.*$/)
      .query(true)
      .times(1) // get api as existing
      .reply(200, { ...testDefs, lastUpdatedTime: '2020-10-10' });

    // api update mock
    nock(baseWso2Url)
      .put(/.*\/publisher\/v1\/apis\/.*$/)
      .times(1)
      .reply(200, testDefs);

    // api list mock (fail 4 times)
    const nfail = nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(4) // check create or update (failing 4 times)
      .reply(500);

    const fn = async (): Promise<void> => {
      await handler(
        testCFNEventUpdate(
          {
            ...testEvent,
            retryOptions: {
              checkRetries: {
                startingDelay: 100,
                numOfAttempts: 4,
                timeMultiple: 1.1,
              },
              mutationRetries: {
                startingDelay: 0,
                numOfAttempts: 0,
                timeMultiple: 0,
              },
            },
          },
          '123-456',
          {},
        ),
      );
    };
    await expect(fn).rejects.toThrow('Request failed with status code 500');
    nfail.done();
  });

  it('basic wso2 api delete on DELETE operation', async () => {
    nockBasicWso2SDK(baseWso2Url);

    // api update mock
    nock(baseWso2Url)
      .delete(/.*\/publisher\/v1\/apis\/.*$/)
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

  it('should return success when api does not exists on DELETE operation', async () => {
    nockBasicWso2SDK(baseWso2Url);

    // api update mock
    nock(baseWso2Url)
      .delete(/.*\/publisher\/v1\/apis\/.*$/)
      .reply(404);

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

  const toResultList = (apiDefs: PublisherPortalAPIv1): { list: ApiFromListV1[] } => {
    return {
      list: [
        {
          id: apiDefs.id ?? 'INVALID',
          context: apiDefs.context,
          name: apiDefs.name,
          lifeCycleStatus: apiDefs.lifeCycleStatus ?? 'INVALID',
          version: apiDefs.version,
          provider: apiDefs.provider,
          type: apiDefs.type,
        },
      ],
    };
  };

  const testBasicWso2ApiDefs = (): Wso2ApiDefinitionV1 => {
    return {
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

  const testCFNEventCreate = (
    baseProperties: Wso2ApiCustomResourceProperties,
  ): Wso2ApiCustomResourceEvent => {
    return {
      ...commonEvt,
      RequestType: 'Create',
      ResourceProperties: { ...baseProperties, ServiceToken: 'arn:somelambdatest' },
    };
  };
  const testCFNEventDelete = (
    baseProperties: Wso2ApiCustomResourceProperties,
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
    baseProperties: Wso2ApiCustomResourceProperties,
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

  const testEvent: Wso2ApiCustomResourceProperties = {
    wso2Config: {
      baseApiUrl: baseWso2Url,
      credentialsSecretId: 'arn:aws:secretsmanager:us-east-1:123123123:secret:MySecret',
      apiVersion: 'v1',
    },
    openapiDocument: petstoreOpenapi,
    apiDefinition: testBasicWso2ApiDefs(),
    // defaults to not retrying in regular tests
    retryOptions: testRetryOptions,
  };

  const nockAfterCreateUpdateAndChangeLifecycleStatusInWso2 = (
    testDefs: Wso2ApiDefinitionV1,
    lifecycleAction?: string,
  ): nock.Scope[] => {
    const nocks: nock.Scope[] = [];

    // api openapi update mock
    nocks.push(
      nock(baseWso2Url)
        .put(/.*\/publisher\/v1\/apis\/123-456\/swagger/)
        .times(1)
        .reply(200),
    );

    // api openapi get mock
    nocks.push(
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis\/123-456\/swagger/)
        .times(1)
        .reply(200, JSON.stringify(testEvent.openapiDocument), ['Content-Type', 'text/plain']),
    );

    if (lifecycleAction) {
      console.log('NOCK CHANGE LIFE CYCLE');
      // api change to published mock
      nocks.push(
        nock(baseWso2Url)
          .post(/.*\/publisher\/v1\/apis\/change-lifecycle/)
          .query({ apiId: '123-456', action: lifecycleAction })
          .times(1)
          .reply(200),
      );

      // api get apis mock for checking if lifecycle was changed
      nocks.push(
        nock(baseWso2Url)
          .get(/.*\/publisher\/v1\/apis$/)
          .query(true)
          .times(1) // check if it is published
          .reply(200, toResultList(testDefs)),
      );
    }

    // api get endpoint urls mock
    nocks.push(
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/apis\/123-456$/)
        .times(1)
        .reply(200, testDefs),
    );

    // api get apis mock
    nocks.push(
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis$/)
        .query(true)
        .times(1) // check if it is published
        .reply(200, toResultList(testDefs)),
    );

    return nocks;
  };
});
