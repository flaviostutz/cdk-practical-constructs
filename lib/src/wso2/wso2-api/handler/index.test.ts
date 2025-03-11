/* eslint-disable no-console */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */

import nock from 'nock';
import { mockClient } from 'aws-sdk-client-mock';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { petstoreOpenapi } from '../__tests__/petstore';
import { ApiFromListV1, PublisherPortalAPIv1 } from '../v1/types';
import { Wso2ApiCustomResourceProperties } from '../types';

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
    nockBasicWso2SDK();

    // api list mock
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(1) // check create or update
      .reply(200, { list: [] });

    const testDefs: PublisherPortalAPIv1 = {
      ...testBasicWso2ApiDefs(),
      id: '123-456',
      lifeCycleStatus: 'CREATED',
    };

    // api create mock
    nock(baseWso2Url)
      .post(/.*\/publisher\/v1\/apis\?.*$/)
      .reply(201, testDefs);

    // api find mock
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(1) // check if content matches
      .reply(200, toResultList(testDefs));

    // api get mock
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis\/[^\\/]*$/)
      .times(1) // check if content matches
      .reply(200, { ...testDefs, lastUpdatedTime: '2020-10-10' });

    const nocksUpdateCreate = nockAfterCreateUpdateAndChangeLifecycleStatusInWso2(
      testDefs,
      'Publish',
    );

    const eres = await handler(
      testCFNEventCreate({
        ...testEvent,
      }),
    );

    expect(eres.PhysicalResourceId).toBe('123-456');
    expect(eres.Status).toBe('SUCCESS');

    // check if the correct endpoints were invoked during update/create process
    // eslint-disable-next-line no-restricted-syntax
    for (const n of nocksUpdateCreate.nocksForOpenapi) {
      n.done();
    }

    // check that the lifecycle status was not changed
    expect(nocksUpdateCreate.nocksForLifecycle[0].isDone()).toBeFalsy();

    // check that the endpoint url was not retrieved
    expect(nocksUpdateCreate.nocksEndpointUrl[1].isDone()).toBeFalsy();
  });

  it('wso2 api create and PUBLISH', async () => {
    nockBasicWso2SDK();

    // api list mock
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(1) // check create or update
      .reply(200, { list: [] });

    const testDefs: PublisherPortalAPIv1 = {
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
      .times(1) // check if content matches
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
    const allNocks = [
      ...nocksUpdateCreate.nocksEndpointUrl,
      ...nocksUpdateCreate.nocksForLifecycle,
      ...nocksUpdateCreate.nocksForOpenapi,
    ];

    // eslint-disable-next-line no-restricted-syntax
    for (const n of allNocks) {
      n.done();
    }
  });

  it('basic wso2 api update', async () => {
    nockBasicWso2SDK();

    // api list mock
    const testDefs: PublisherPortalAPIv1 = {
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
    nockBasicWso2SDK();

    // api list mock
    const testDefs: PublisherPortalAPIv1 = {
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
    nockBasicWso2SDK();

    // api list mock
    const testDefs: PublisherPortalAPIv1 = {
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
    nockBasicWso2SDK();

    // api list mock
    const testDefs: PublisherPortalAPIv1 = {
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
    nockBasicWso2SDK();

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
    nockBasicWso2SDK();

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

  it('should be able to update the lifecycle on UPDATE operation', async () => {
    nockBasicWso2SDK();

    // api list mock
    const testDefs: PublisherPortalAPIv1 = {
      ...testBasicWso2ApiDefs(),
      id: '123-456',
      lifeCycleStatus: 'CREATED',
    };
    nock(baseWso2Url)
      .get(/.*\/publisher\/v1\/apis$/)
      .query(true)
      .times(3) // check overlap, check create or update, check if updated, check if published
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

    const { nocksForLifecycle } = nockAfterCreateUpdateAndChangeLifecycleStatusInWso2(
      testDefs,
      'Publish',
    );

    const eres = await handler(
      testCFNEventUpdate(
        {
          ...testEvent,
          lifecycleStatus: 'PUBLISHED',
        },
        '123-456',
        {},
      ),
    );
    expect(eres.PhysicalResourceId).toBe('123-456');
    expect(eres.Status).toBe('SUCCESS');

    // check that the lifecycle status was changed
    // eslint-disable-next-line no-restricted-syntax
    for (const n of nocksForLifecycle) {
      n.done();
    }
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

  const testBasicWso2ApiDefs = (): PublisherPortalAPIv1 => {
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

  const nockAfterCreateUpdateAndChangeLifecycleStatusInWso2 = (
    testDefs: PublisherPortalAPIv1,
    lifecycleAction?: string,
  ): {
    nocksForOpenapi: nock.Scope[];
    nocksForLifecycle: nock.Scope[];
    nocksEndpointUrl: nock.Scope[];
  } => {
    const nocksForOpenapi: nock.Scope[] = [];
    const nocksForLifecycle: nock.Scope[] = [];
    const nocksEndpointUrl: nock.Scope[] = [];

    // api openapi update mock
    nocksForOpenapi.push(
      nock(baseWso2Url)
        .put(/.*\/publisher\/v1\/apis\/123-456\/swagger/)
        .times(1)
        .reply(200),
    );

    // api openapi get mock
    nocksForOpenapi.push(
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis\/123-456\/swagger/)
        .times(1)
        .reply(200, JSON.stringify(testEvent.openapiDocument), ['Content-Type', 'text/plain']),
    );

    if (lifecycleAction) {
      console.log('NOCK CHANGE LIFE CYCLE');
      // api change to published mock
      nocksForLifecycle.push(
        nock(baseWso2Url)
          .post(/.*\/publisher\/v1\/apis\/change-lifecycle/)
          .query({ apiId: '123-456', action: lifecycleAction })
          .times(1)
          .reply(200),
      );

      // api get apis mock for checking if lifecycle was changed
      nocksForLifecycle.push(
        nock(baseWso2Url)
          .get(/.*\/publisher\/v1\/apis$/)
          .query(true)
          .times(1) // check if it is published
          .reply(200, toResultList({ ...testDefs, lifeCycleStatus: 'PUBLISHED' })),
      );
    }

    // Endpoint url retrieval - checking if the api is published
    nocksEndpointUrl.push(
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis\/.*$/)
        .times(1)
        .reply(200, {
          ...testDefs,
          lastUpdatedTime: '2020-10-11',
          ...(lifecycleAction === 'Publish' && { lifecycleStatus: 'PUBLISHED' }),
        }),
    );

    // api get endpoint urls mock
    nocksEndpointUrl.push(
      nock(baseWso2Url)
        .get(/.*\/store\/v1\/apis\/123-456$/)
        .times(1)
        .reply(200, testDefs),
    );

    // api get apis mock
    nocksEndpointUrl.push(
      nock(baseWso2Url)
        .get(/.*\/publisher\/v1\/apis$/)
        .query(true)
        .times(1)
        .reply(200, toResultList(testDefs)),
    );

    return {
      nocksEndpointUrl,
      nocksForLifecycle,
      nocksForOpenapi,
    };
  };
});
