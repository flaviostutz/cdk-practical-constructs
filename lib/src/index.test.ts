import { Stack } from 'aws-cdk-lib/core';

import { BaseNodeJsFunction, EventType } from './index';

describe('cdk lib', () => {
  it('lib exported', () => {
    const func = new BaseNodeJsFunction(new Stack(), 'test-lambda', {
      stage: 'dev',
      network: {
        vpcId: 'aaa',
        availabilityZones: ['a'],
        privateSubnetIds: ['a'],
        privateSubnetRouteTableIds: ['a'],
      },
      eventType: EventType.Http,
      baseCodePath: 'src/lambda/__tests__/',
    });
    expect(func).toBeDefined();
  });
});
