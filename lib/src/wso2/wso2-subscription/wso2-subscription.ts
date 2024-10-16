import { Construct } from 'constructs';
import { CustomResource, RemovalPolicy } from 'aws-cdk-lib/core';
import { IFunction } from 'aws-cdk-lib/aws-lambda';

import { addLambdaAndProviderForWso2Operations } from '../utils-cdk';

import { Wso2SubscriptionCustomResourceProperties, Wso2SubscriptionProps } from './types';

/**
 * WSO2 API CDK construct for creating a WSO2 subscription from one application to an API
 * This construct is related to one "physical" subscription in WSO2.
 *
 * The internal implementation tries to protect itself from various scenarios where larger or more complex
 * WSO2 clusters might lead to out-of-order or delays in operations that happen assynchronously after the API
 * accepts the requests, so for every mutation, there is a check to verify sanity.
 */
export class Wso2Subscription extends Construct {
  readonly customResourceFunction: IFunction;

  constructor(scope: Construct, id: string, props: Wso2SubscriptionProps) {
    super(scope, id);

    // Do as much of the logic in the construct as possible and leave only
    // the minimal complexity to the Lambda Custom Resource as it's harder
    // to debug and eventual errors will rollback the entire stack and will
    // make the feedback cycle much longer.

    // Keep this construct stateless (don't access WSO2 apis) and
    // leave the stateful part to the Lambda Custom Resource (accessing WSO2 apis etc)

    validateProps(props);

    const { customResourceProvider, customResourceFunction } =
      addLambdaAndProviderForWso2Operations({
        scope: this,
        id: `${id}-wso2sub`,
        props,
        baseDir: __dirname,
      });

    // eslint-disable-next-line no-new
    new CustomResource(this, `${id}-wso2sub-custom-resource`, {
      serviceToken: customResourceProvider.serviceToken,
      properties: {
        wso2Config: props.wso2Config,
        subscriptionDefinition: props.subscriptionDefinition,
        retryOptions: props.retryOptions,
      } as Wso2SubscriptionCustomResourceProperties,
      resourceType: 'Custom::Wso2Subscription',
      removalPolicy: props.removalPolicy ?? RemovalPolicy.RETAIN,
    });

    this.customResourceFunction = customResourceFunction.nodeJsFunction;
  }
}

export const validateProps = (props: Wso2SubscriptionProps): void => {
  if (!props.wso2Config) throw new Error('wso2Config is required');
  if (!props.wso2Config.baseApiUrl) throw new Error('wso2Config.baseApiUrl is required');
  if (!props.wso2Config.credentialsSecretId) {
    throw new Error('wso2Config.credentialsSecretManagerPath is required');
  }
  if (!props.subscriptionDefinition) {
    throw new Error('subscriptionDefinition is required');
  }
  if (!props.subscriptionDefinition.apiId) {
    throw new Error('subscriptionDefinition.apiId is required');
  }
  if (!props.subscriptionDefinition.applicationId) {
    throw new Error('subscriptionDefinition.applicationId is required');
  }
  if (!props.subscriptionDefinition.throttlingPolicy) {
    throw new Error('subscriptionDefinition.throttlingPolicy is required');
  }
};
