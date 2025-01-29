/* eslint-disable no-console */
import { AxiosInstance } from 'axios';
import { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda';

import { prepareAxiosForWso2Calls } from '../../wso2-utils';
import { truncateStr } from '../../utils';
import { Wso2ApiSubscriptionProps } from '../types';

import {
  createWso2ApiSubscription,
  findWso2ApiSubscription,
  getWso2Api,
  getWso2Application,
  removeWso2ApiSubscription,
  updateWso2ApiSubscription,
} from './wso2-v1';

export type Wso2ApiCustomResourceEvent = CdkCustomResourceEvent & {
  ResourceProperties: Wso2ApiSubscriptionProps;
};

export type Wso2ApiCustomResourceResponse = CdkCustomResourceResponse & {
  Data?: {
    Wso2ApiId?: string;
    SubscriptionId?: string;
    ApplicationId?: string;
    Error?: unknown;
  };
  Status?: 'SUCCESS' | 'FAILED';
  Reason?: string;
};

export const handler = async (
  event: Wso2ApiCustomResourceEvent,
): Promise<Wso2ApiCustomResourceResponse> => {
  const response: Wso2ApiCustomResourceResponse = {
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  };

  try {
    console.log('>>> Prepare WSO2 API client...');
    const wso2Axios = await prepareAxiosForWso2Calls(event.ResourceProperties.wso2Config);

    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      console.log('>>> Creating or Updating WSO2 API Subscription...');

      const { wso2ApiId, subscriptionId, applicationId } = await createOrUpdateWso2ApiSubscription(
        event,
        wso2Axios,
      );

      return {
        ...response,
        PhysicalResourceId: subscriptionId,
        Data: {
          Wso2ApiId: wso2ApiId,
          SubscriptionId: subscriptionId,
          ApplicationId: applicationId,
        },
        Status: 'SUCCESS',
      };
    }

    if (event.RequestType === 'Delete') {
      console.log('>>> Deleting WSO2 API Subscription...');

      await removeWso2ApiSubscription({
        wso2Axios,
        subscriptionId: event.PhysicalResourceId,
        retryOptions: event.ResourceProperties.retryOptions,
      });

      return {
        ...response,
        PhysicalResourceId: event.PhysicalResourceId,
        Status: 'SUCCESS',
      };
    }
    throw new Error('Unrecognized RequestType');
  } catch (error) {
    console.log(`An error has occurred. err=${error}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;
    if (err.stack) {
      console.log(err.stack);
    }
    throw new Error(truncateStr(`${error}`, 1000));
  }
};

const createOrUpdateWso2ApiSubscription = async (
  event: Wso2ApiCustomResourceEvent,
  wso2Axios: AxiosInstance,
): Promise<{ wso2ApiId: string; subscriptionId: string; applicationId: string }> => {
  console.log(`Verifying if WSO2 API ${event.ResourceProperties.apiId} exists in WSO2...`);
  const wso2Api = await getWso2Api({
    wso2Axios,
    apiId: event.ResourceProperties.apiId,
    wso2Tenant: event.ResourceProperties.wso2Config.tenant,
    apiSearchParameters: event.ResourceProperties.apiSearchParameters,
  });

  console.log(`Verifying if WSO2 Application ${event.ResourceProperties.applicationId} exists in WSO2...`);
  const wso2Application = await getWso2Application({
    wso2Axios,
    applicationId: event.ResourceProperties.applicationId,
    applicationSearchParameters: event.ResourceProperties.applicationSearchParameters,
  });

  const wso2Subscription = await findWso2ApiSubscription({
    wso2Axios,
    apiId: wso2Api.id!,
    applicationId: wso2Application.applicationId!,
  });

  if (
    wso2Subscription &&
    wso2Subscription.throttlingPolicy === event.ResourceProperties.throttlingPolicy
  ) {
    console.log('Current subscription already exists with the same configuration. Skipping update');
    return {
      wso2ApiId: wso2Api.id!,
      subscriptionId: wso2Subscription.subscriptionId!,
      applicationId: wso2Application.applicationId!,
    };
  }

  if (wso2Subscription) {
    console.log('Subscription already exists. Updating...');
    const result = await updateWso2ApiSubscription({
      wso2Axios,
      subscriptionId: wso2Subscription.subscriptionId!,
      apiId: wso2Api.id!,
      applicationId: wso2Application.applicationId!,
      throttlingPolicy: event.ResourceProperties.throttlingPolicy,
      retryOptions: event.ResourceProperties.retryOptions,
    });

    return {
      wso2ApiId: wso2Api.id!,
      subscriptionId: result.subscriptionId!,
      applicationId: wso2Application.applicationId!,
    };
  }

  console.log('Creating a new subscription...');
  const result = await createWso2ApiSubscription({
    wso2Axios,
    apiId: wso2Api.id!,
    applicationId: wso2Application.applicationId!,
    throttlingPolicy: event.ResourceProperties.throttlingPolicy,
    retryOptions: event.ResourceProperties.retryOptions,
  });

  return {
    wso2ApiId: wso2Api.id!,
    subscriptionId: result.subscriptionId!,
    applicationId: wso2Application.applicationId!,
  };
};
