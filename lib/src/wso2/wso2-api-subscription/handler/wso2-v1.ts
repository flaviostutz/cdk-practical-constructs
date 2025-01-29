/* eslint-disable no-console */
import { AxiosInstance } from 'axios';
import { backOff } from 'exponential-backoff';

import { Wso2ApiSubscriptionProps } from '../types';
import { findWso2Api, getWso2ApiById } from '../../wso2-api/handler/wso2-v1';
import { ApiFromListV1 } from '../../wso2-api/v1/types';
import {
  findWso2Application,
  getWso2ApplicationById,
} from '../../wso2-application/handler/wso2-v1';
import { Wso2ApplicationInfo } from '../../wso2-application/v1/types';
import {
  Wso2SubscriptionDefinition,
  Wso2SubscriptionInfo,
  Wso2SubscriptionList,
} from '../v1/types';

export type GetWso2ApiArgs = Pick<Wso2ApiSubscriptionProps, 'apiId' | 'apiSearchParameters'> & {
  wso2Axios: AxiosInstance;
  wso2Tenant?: string;
};

export const getWso2Api = async ({
  wso2Axios,
  apiId,
  wso2Tenant,
  apiSearchParameters,
}: GetWso2ApiArgs): Promise<ApiFromListV1> => {
  if (apiId) {
    console.log('Getting WSO2 API by id...');
    const apiDetails = await getWso2ApiById({ wso2Axios, wso2ApiId: apiId });
    return apiDetails;
  }

  if (!apiSearchParameters) {
    throw new Error('apiSearchParameters is required for searching API');
  }

  console.log('Getting WSO2 API by search parameters...');
  const apiDetails = await findWso2Api({
    wso2Axios,
    apiContext: apiSearchParameters.context,
    apiName: apiSearchParameters.name,
    apiVersion: apiSearchParameters.version,
    wso2Tenant,
  });

  if (!apiDetails) {
    throw new Error(
      `Cannot find the WSO2 API from the provided search parameters (name=${apiSearchParameters.name}; version=${apiSearchParameters.version}; context=${apiSearchParameters.context})`,
    );
  }

  return apiDetails;
};

export type GetWso2ApplicationArgs = Pick<
  Wso2ApiSubscriptionProps,
  'applicationId' | 'applicationSearchParameters'
> & {
  wso2Axios: AxiosInstance;
};

export const getWso2Application = async ({
  wso2Axios,
  applicationId,
  applicationSearchParameters,
}: GetWso2ApplicationArgs): Promise<Wso2ApplicationInfo> => {
  if (applicationId) {
    console.log('Getting WSO2 Application by id...');
    const application = await getWso2ApplicationById({ wso2Axios, applicationId });
    return application;
  }

  if (!applicationSearchParameters) {
    throw new Error('applicationSearchParameters is required for searching application');
  }

  console.log('Getting WSO2 API by search parameters...');
  const application = await findWso2Application({
    wso2Axios,
    name: applicationSearchParameters.name,
  });

  if (!application) {
    throw new Error('Cannot find the WSO2 application is related to this Custom Resource.');
  }

  return application;
};

export type FindWso2ApiSubscriptionArgs = {
  wso2Axios: AxiosInstance;
  apiId: string;
  applicationId: string;
};
export const findWso2ApiSubscription = async ({
  wso2Axios,
  apiId,
  applicationId,
}: FindWso2ApiSubscriptionArgs): Promise<Wso2SubscriptionInfo | undefined> => {
  const apil = await wso2Axios.get<Wso2SubscriptionList>(`/api/am/store/v1/subscriptions`, {
    params: {
      apiId,
      applicationId,
    },
  });

  const apiRes = apil.data.list;

  if (!apiRes) {
    throw new Error('find subscription response is empty');
  }

  if (apiRes.length > 1) {
    throw new Error(
      `More than one subscription found for api '${apiId}' and application '${applicationId}' so we cannot determine it's id automatically`,
    );
  }

  if (apiRes.length === 0) {
    // eslint-disable-next-line no-undefined
    return undefined;
  }

  const existingSubscription = apiRes[0];
  console.log(
    `Found existing WSO2 Subscription. subscriptionId=${existingSubscription.subscriptionId};`,
  );

  return existingSubscription;
};

export type GetWso2ApiSubscriptionByIdArgs = {
  wso2Axios: AxiosInstance;
  subscriptionId: string;
};

const getWso2ApiSubscriptionById = async ({
  wso2Axios,
  subscriptionId,
}: GetWso2ApiSubscriptionByIdArgs): Promise<Wso2SubscriptionInfo> => {
  const res = await wso2Axios.get<Wso2SubscriptionInfo>(
    `/api/am/store/v1/subscriptions/${subscriptionId}`,
  );
  return res.data;
};

export type CreateWso2ApiSubscriptionArgs = Pick<Wso2ApiSubscriptionProps, 'retryOptions'> & {
  wso2Axios: AxiosInstance;
  apiId: string;
  applicationId: string;
  throttlingPolicy: Wso2SubscriptionInfo['throttlingPolicy'];
};

export const createWso2ApiSubscription = async ({
  wso2Axios,
  apiId,
  applicationId,
  throttlingPolicy,
  retryOptions,
}: CreateWso2ApiSubscriptionArgs): Promise<Wso2SubscriptionInfo> => {
  const payload: Wso2SubscriptionDefinition = {
    applicationId,
    apiId,
    throttlingPolicy,
  };

  const res = await backOff(
    async () => wso2Axios.post<Wso2SubscriptionInfo>(`/api/am/store/v1/subscriptions`, payload),
    retryOptions?.mutationRetries,
  );

  // wait for Application to be created by retrying checks
  await backOff(async () => {
    await getWso2ApiSubscriptionById({
      wso2Axios,
      subscriptionId: res.data.subscriptionId,
    });
  }, retryOptions?.checkRetries);

  return res.data;
};

export type UpdateWso2ApiSubscriptionArgs = CreateWso2ApiSubscriptionArgs & {
  subscriptionId: string;
};

export const updateWso2ApiSubscription = async ({
  wso2Axios,
  subscriptionId,
  apiId,
  applicationId,
  throttlingPolicy,
  retryOptions,
}: UpdateWso2ApiSubscriptionArgs): Promise<Wso2SubscriptionInfo> => {
  const payload: Wso2SubscriptionDefinition = {
    applicationId,
    apiId,
    throttlingPolicy,
  };

  const res = await backOff(
    async () =>
      wso2Axios.put<Wso2SubscriptionInfo>(
        `/api/am/store/v1/subscriptions/${subscriptionId}`,
        payload,
      ),
    retryOptions?.mutationRetries,
  );

  return res.data;
};

export type RemoveWso2ApiSubscriptionArgs = Pick<Wso2ApiSubscriptionProps, 'retryOptions'> & {
  wso2Axios: AxiosInstance;
  subscriptionId: string;
};

export const removeWso2ApiSubscription = async ({
  wso2Axios,
  subscriptionId,
  retryOptions,
}: RemoveWso2ApiSubscriptionArgs): Promise<void> => {
  await backOff(
    async () => wso2Axios.delete(`/api/am/store/v1/subscriptions/${subscriptionId}`),
    retryOptions?.mutationRetries,
  );
};
