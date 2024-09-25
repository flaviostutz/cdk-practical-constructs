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
  await args.wso2Axios.delete(`/api/am/store/v1/applications/${args.wso2ApplicationId}`);
};

/**
 * Perform calls in WSO2 API to create or update an Application
 * @returns {string} Id of the Application in WSO2
 */
export const createUpdateApplicationInWso2 = async (args: UpsertWso2Args): Promise<string> => {
  console.log('');
  console.log(`>>> Create or update application in WSO2...`);
  // will retry create/update api operation if fails
  const wso2ApplicationId = await backOff(
    async () => createUpdateApplicationInWso2AndCheck(args),
    args.retryOptions.mutationRetries,
  );

  console.log('Application created/updated on WSO2 server successfuly');

  return wso2ApplicationId;
};

export const createUpdateApplicationInWso2AndCheck = async (
  args: UpsertWso2Args,
): Promise<string> => {
  // create new API in WSO2
  if (!args.existingApplication) {
    console.log(`Creating new Application in WSO2`);
    const apir = await args.wso2Axios.post(
      `/api/am/store/v1/applications`,
      args.applicationDefinition,
    );

    const dataRes = apir.data as Wso2ApplicationInfo;
    if (!dataRes.applicationId) {
      throw new Error(
        `'applicationId' id wasn't returned as part of the Application creation response`,
      );
    }
    console.log(`Application created in WSO2`);

    // wait for Application to be created by retrying checks
    await backOff(async () => {
      await args.wso2Axios.get(`/api/am/store/v1/applications/${dataRes.applicationId}`);
    }, args.retryOptions.checkRetries);

    return dataRes.applicationId;
  }

  // update existing API in WSO2
  console.log(`Updating Application definitions in WSO2`);

  if (!args.existingApplication.applicationId) {
    throw new Error('Existing applicationId should be defined');
  }

  await args.wso2Axios.put(
    `/api/am/store/v1/applications/${args.existingApplication.applicationId}`,
    args.applicationDefinition,
  );

  // wait for Application to be created by retrying checks
  await backOff(async () => {
    await args.wso2Axios.get(
      `/api/am/store/v1/applications/${args.existingApplication?.applicationId}`,
    );
  }, args.retryOptions.checkRetries);

  return args.existingApplication.applicationId;
};
