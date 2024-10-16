/* eslint-disable no-console */

import type { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda';
import type { AxiosInstance } from 'axios';

import { prepareAxiosForWso2Calls } from '../../wso2-utils';
import { applyRetryDefaults, truncateStr } from '../../utils';
import type { Wso2SubscriptionInfo } from '../v1/types';
import type { Wso2SubscriptionCustomResourceProperties } from '../types';

import { createUpdateSubscriptionInWso2, removeSubscriptionInWso2 } from './wso2-v1';

export type Wso2SubscriptionCustomResourceEvent = CdkCustomResourceEvent & {
  ResourceProperties: Wso2SubscriptionCustomResourceProperties;
};

export type Wso2SubscriptionCustomResourceResponse = CdkCustomResourceResponse & {
  Data?: {
    ApiEndpointUrl?: string;
    Error?: unknown;
  };
  Status?: 'SUCCESS' | 'FAILED';
  Reason?: string;
};

export const handler = async (
  event: Wso2SubscriptionCustomResourceEvent,
): Promise<Wso2SubscriptionCustomResourceResponse> => {
  console.log(`WSO2 API Custom Resource invoked with: ${JSON.stringify(event)}`);

  if (!event.ResourceProperties.subscriptionDefinition) {
    throw new Error('event.subscriptionDefinition should be defined');
  }
  if (!event.ResourceProperties.wso2Config) {
    throw new Error('event.wso2Config should be defined');
  }

  const response: Wso2SubscriptionCustomResourceResponse = {
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  };

  try {
    console.log('>>> Prepare WSO2 API client...');
    const wso2Axios = await prepareAxiosForWso2Calls(event.ResourceProperties.wso2Config);

    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      if (event.RequestType === 'Update') {
        response.PhysicalResourceId = event.PhysicalResourceId;
      }
      console.log('>>> Creating or Updating WSO2 Subscription...');
      const wso2SubscriptionId = await createOrUpdateWso2Subscription(event, wso2Axios);
      response.PhysicalResourceId = wso2SubscriptionId;
      response.Data = {
        Wso2SubscriptionId: wso2SubscriptionId,
      };
      response.Status = 'SUCCESS';
      return response;
    }
    if (event.RequestType === 'Delete') {
      console.log('>>> Deleting WSO2 Subscription...');
      response.PhysicalResourceId = event.PhysicalResourceId;
      await removeSubscriptionInWso2({
        wso2Axios,
        wso2SubscriptionId: event.PhysicalResourceId,
      });
      response.Status = 'SUCCESS';
      return response;
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

const createOrUpdateWso2Subscription = async (
  event: Wso2SubscriptionCustomResourceEvent,
  wso2Axios: AxiosInstance,
): Promise<string> => {
  if (!event.ResourceProperties.subscriptionDefinition?.apiId) {
    throw new Error('subscriptionDefinition.apiId should be defined');
  }
  if (!event.ResourceProperties.subscriptionDefinition?.applicationId) {
    throw new Error('subscriptionDefinition.applicationId should be defined');
  }

  // find existing WSO2 subscription to the same apiId by the same applicationId
  console.log('Searching if Subscription already exists in WSO2...');
  let existingSubscription: Wso2SubscriptionInfo | undefined;
  const apil = await wso2Axios.get(`/api/am/store/v1/subscriptions`, {
    params: {
      applicationId: event.ResourceProperties.subscriptionDefinition.applicationId,
      apiId: event.ResourceProperties.subscriptionDefinition.apiId,
    },
  });
  const apiRes = apil.data.list as Wso2SubscriptionInfo[];
  if (apiRes.length > 1) {
    throw new Error(
      `More than one Subscription for apiId='${event.ResourceProperties.subscriptionDefinition.apiId}' and applicationId='${event.ResourceProperties.subscriptionDefinition.applicationId}' was found in WSO2 so we cannot determine which subscription to manage automatically`,
    );
  }
  if (apiRes.length === 1) {
    existingSubscription = apiRes[0];
    console.log(
      `Found existing WSO2 Subscription. subscriptionId=${existingSubscription.subscriptionId}; apiId=${existingSubscription.apiId}; applicationId=${existingSubscription.applicationId}`,
    );
  }

  if (
    event.RequestType === 'Create' &&
    existingSubscription &&
    event.ResourceProperties.failIfExists
  ) {
    throw new Error(
      `WSO2 Subscription '${existingSubscription.subscriptionId}' already exists but cannot be managed by this resource. Change 'failIfExists' to change this behavior`,
    );
  }

  if (event.RequestType === 'Update' && !existingSubscription) {
    console.log(
      `WARNING: This is an Update operation but the Subscription couldn't be found in WSO2. It will be created again`,
    );
  }

  if (event.RequestType === 'Create' || event.RequestType === 'Update') {
    return createUpdateSubscriptionInWso2({
      wso2Axios,
      wso2Tenant: event.ResourceProperties.wso2Config.tenant ?? '',
      subscriptionDefinition: event.ResourceProperties.subscriptionDefinition,
      existingSubscription,
      retryOptions: applyRetryDefaults(event.ResourceProperties.retryOptions),
    });
  }

  throw new Error(`Invalid requestType found. requestType=${event.ResourceType}`);
};
