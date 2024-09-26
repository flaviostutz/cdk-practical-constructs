/* eslint-disable no-console */
import { backOff } from 'exponential-backoff';
import { AxiosInstance } from 'axios';

import type { Wso2SubscriptionDefinition, Wso2SubscriptionInfo } from '../v1/types';
import type { RetryOptions } from '../../types';

export type UpsertWso2Args = {
  wso2Axios: AxiosInstance;
  wso2Tenant: string;
  existingSubscription?: Wso2SubscriptionInfo;
  subscriptionDefinition: Wso2SubscriptionDefinition;
  retryOptions: RetryOptions;
};

// FIXME FIND APIS AND CREATE CONNECTOR

/**
 * Delete Subscription in WSO2 server
 */
export const removeSubscriptionInWso2 = async (args: {
  wso2Axios: AxiosInstance;
  wso2SubscriptionId: string;
}): Promise<void> => {
  if (!args.wso2SubscriptionId) {
    throw new Error('wso2SubscriptionId is required for deleting Application');
  }
  await args.wso2Axios.delete(`/api/am/store/v1/applications/${args.wso2SubscriptionId}`);
};

/**
 * Perform calls in WSO2 API to create or update an Application
 * @returns {string} Id of the Application in WSO2
 */
export const createUpdateSubscriptionInWso2 = async (args: UpsertWso2Args): Promise<string> => {
  console.log('');
  console.log(`>>> Create or update subscription in WSO2...`);
  // will retry create/update api operation if fails
  const wso2SubscriptionId = await backOff(
    async () => createUpdateSubscriptionInWso2AndCheck(args),
    args.retryOptions.mutationRetries,
  );

  console.log('Subscription created/updated on WSO2 server successfuly');

  return wso2SubscriptionId;
};

export const createUpdateSubscriptionInWso2AndCheck = async (
  args: UpsertWso2Args,
): Promise<string> => {
  // create new Subscription in WSO2
  if (!args.existingSubscription) {
    console.log(`Creating new Subscription in WSO2...`);
    const apir = await args.wso2Axios.post(
      `/api/am/store/v1/subscriptions`,
      args.subscriptionDefinition,
    );

    const dataRes = apir.data as Wso2SubscriptionInfo;
    if (!dataRes.subscriptionId) {
      throw new Error(
        `'subscriptionId' wasn't returned as part of the Subscription creation response`,
      );
    }
    console.log(`Subscription "${dataRes.subscriptionId}" created in WSO2`);

    console.log(`Checking if the Subscription was created in WSO2 by retrying checks`);
    await backOff(async () => {
      await args.wso2Axios.get(`/api/am/store/v1/subscriptions/${dataRes.subscriptionId}`);
      // TODO check if returned contents match desired state
    }, args.retryOptions.checkRetries);

    return dataRes.subscriptionId;
  }

  // update existing Subscription in WSO2
  console.log(`Updating Subscription definitions in WSO2`);

  if (!args.existingSubscription.subscriptionId) {
    throw new Error('Existing subscriptionId should be defined');
  }

  await args.wso2Axios.put(
    `/api/am/store/v1/subscriptions/${args.existingSubscription.subscriptionId}`,
    args.subscriptionDefinition,
  );

  console.log(`Checking if the Subscription exists in WSO2 by retrying checks`);
  await backOff(async () => {
    await args.wso2Axios.get(
      `/api/am/store/v1/subscriptions/${args.existingSubscription?.applicationId}`,
    );
    // TODO check if returned contents match desired state
  }, args.retryOptions.checkRetries);

  return args.existingSubscription.subscriptionId;
};
