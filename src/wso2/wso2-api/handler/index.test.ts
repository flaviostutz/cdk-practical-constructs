/* eslint-disable @typescript-eslint/no-explicit-any */
import { CdkCustomResourceEvent } from 'aws-lambda';

import { petstoreOpenapi } from '../__tests__/petstore';
import { Wso2ApiDefinition } from '../types';

import { handler } from './index';

describe('wso2 custom resource lambda', () => {
  it.skip('basic secret fetch and wso2 version check', async () => {
    const eres = await handler(
      testCFNEventCreate({
        ...testEvent,
      }),
      {} as any,
    );
    expect(eres.PhysicalResourceId).toBe('123-456-789');
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

const testCFNEventCreate = (resourceProperties: { [key: string]: any }): CdkCustomResourceEvent => {
  return {
    ...commonEvt,
    RequestType: 'Create',
    ResourceProperties: { ...resourceProperties, ServiceToken: 'arn:somelambdatest' },
  };
};
// const testCFNEventDelete = (
//   resourceProperties: { [key: string]: any },
//   physicalResourceId: string,
// ): CdkCustomResourceEvent => {
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
// ): CdkCustomResourceEvent => {
//   return {
//     ...commonEvt,
//     RequestType: 'Update',
//     ResourceProperties: { ...resourceProperties, ServiceToken: 'arn:somelambdatest' },
//     PhysicalResourceId: physicalResourceId,
//     OldResourceProperties: oldResourceProperties,
//   };
// };

const testEvent = {
  wso2BaseUrl: 'http://testwso2.com',
  wso2CredentialsSecretManagerPath: 'arn:aws:secretsmanager:us-east-1:123123123:secret:MySecret',
  openapiDocument: petstoreOpenapi,
  wso2ApiDefinition: testBasicWso2ApiDefs(),
};
