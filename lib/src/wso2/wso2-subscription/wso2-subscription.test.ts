/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable fp/no-mutating-methods */

import { App, Stack } from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';

import { Wso2SubscriptionProps } from './types';
import { Wso2Subscription } from './wso2-subscription';

describe('wso2-subscription-construct', () => {
  it('minimal wso2 api', async () => {
    const app = new App();
    const stack = new Stack(app);

    const testProps1 = testProps();
    const wso2Subscription = new Wso2Subscription(stack, 'wso2', testProps1);

    expect(wso2Subscription.customResourceFunction).toBeDefined();

    const template = Template.fromStack(stack);
    // eslint-disable-next-line no-console
    // console.log(JSON.stringify(template.toJSON(), null, 2));

    template.hasResourceProperties('Custom::Wso2Subscription', {
      wso2Config: testProps1.wso2Config,
      subscriptionDefinition: testProps1.subscriptionDefinition,
    });
  });
});

const testProps = (): Wso2SubscriptionProps => {
  return {
    wso2Config: {
      baseApiUrl: 'http://localhost:8080/wso2',
      credentialsSecretId: 'arn::creds',
    },
    subscriptionDefinition: {
      apiId: '1111-2222',
      applicationId: '3333-4444',
      throttlingPolicy: 'Unlimited',
    },
  };
};
