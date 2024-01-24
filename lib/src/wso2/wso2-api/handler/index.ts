/* eslint-disable no-console */
import { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda';
import { AxiosInstance } from 'axios';

import { RetryOptions, Wso2ApiBaseProperties } from '../types';

import {
  createUpdateAndPublishApiInWso2,
  findWso2Api,
  prepareAxiosForWso2Api,
  removeApiInWso2,
} from './wso2-v1';

export type Wso2ApiCustomResourceEvent = CdkCustomResourceEvent & {
  ResourceProperties: Wso2ApiBaseProperties;
};

export type Wso2ApiCustomResourceResponse = CdkCustomResourceResponse & {
  Data?: {
    ApiEndpointUrl?: string;
    Error?: unknown;
  };
  Status?: 'SUCCESS' | 'FAILED';
  Reason?: string;
};

export const handler = async (
  event: Wso2ApiCustomResourceEvent,
): Promise<Wso2ApiCustomResourceResponse> => {
  // console.log(`WSO2 API Custom Resource invoked with: ${JSON.stringify(event)}`);

  if (!event.ResourceProperties.apiDefinition) {
    throw new Error('event.apiDefinition should be defined');
  }
  if (!event.ResourceProperties.wso2Config) {
    throw new Error('event.wso2Config should be defined');
  }
  if (!event.ResourceProperties.openapiDocument) {
    throw new Error('event.openapiDocument should be defined');
  }

  const response: Wso2ApiCustomResourceResponse = {
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  };

  try {
    if (event.ResourceProperties.apiDefinition.wso2Version !== 'v1') {
      throw new Error(`Only WSO2 version 'v1' is supported by this Custom Resource`);
    }

    console.log('>>> Prepare WSO2 API client...');
    // const wso2Client = await prepareWso2ApiClient(event.ResourceProperties.wso2Config);
    const wso2Axios = await prepareAxiosForWso2Api(event.ResourceProperties.wso2Config);

    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      if (event.RequestType === 'Update') {
        response.PhysicalResourceId = event.PhysicalResourceId;
      }
      console.log('>>> Creating or Updating WSO2 API...');
      const { wso2ApiId, endpointUrl } = await createOrUpdateWso2Api(event, wso2Axios);
      response.PhysicalResourceId = wso2ApiId;
      response.Data = {
        ApiEndpointUrl: endpointUrl,
      };
      response.Status = 'SUCCESS';
      return response;
    }
    if (event.RequestType === 'Delete') {
      console.log('>>> Deleting WSO2 API...');
      response.PhysicalResourceId = event.PhysicalResourceId;
      await removeApiInWso2({
        wso2Axios,
        wso2ApiId: event.PhysicalResourceId,
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
    throw error;
  }
};

const createOrUpdateWso2Api = async (
  event: Wso2ApiCustomResourceEvent,
  wso2Axios: AxiosInstance,
): Promise<{ wso2ApiId: string; endpointUrl?: string }> => {
  if (!event.ResourceProperties.apiDefinition.version) {
    throw new Error('apidef.version should be defined');
  }

  // find existing WSO2 API
  console.log('Searching if API already exists in WSO2...');
  const existingApi = await findWso2Api({
    wso2Axios,
    apiDefinition: event.ResourceProperties.apiDefinition,
    wso2Tenant: event.ResourceProperties.wso2Config.tenant ?? '',
  });

  if (existingApi) {
    console.log(
      `Found existing WSO2 API. apiId=${existingApi.id}; name=${existingApi.name}; version=${existingApi.version} context=${existingApi.context}`,
    );
  }

  if (event.RequestType === 'Create' && existingApi && event.ResourceProperties.failIfExists) {
    throw new Error(
      `WSO2 API already exists but cannot be managed by this resource. Change 'failIfExists' to change this behavior`,
    );
  }

  if (event.RequestType === 'Update' && !existingApi) {
    console.log(
      `WARNING: This is an Update operation but the API couldn't be found in WSO2. It will be created again`,
    );
  }

  if (event.RequestType === 'Create' || event.RequestType === 'Update') {
    return createUpdateAndPublishApiInWso2({
      wso2Axios,
      apiDefinition: event.ResourceProperties.apiDefinition,
      openapiDocument: event.ResourceProperties.openapiDocument,
      wso2Tenant: event.ResourceProperties.wso2Config.tenant ?? '',
      existingWso2Api: existingApi,
      retryOptions: applyRetryDefaults(event.ResourceProperties.retryOptions),
    });
  }

  throw new Error(`Invalid requestType found. requestType=${event.ResourceType}`);
};

const defaultRetryOpts = {
  checkRetries: {
    startingDelay: 500,
    delayFirstAttempt: true,
    maxDelay: 10000,
    numOfAttempts: 10,
    timeMultiple: 1.5,
    // 500, 750, 1125, 1687 (4s), 2531, 3796, 5696 (16s), 8542 (24s), 10000, 10000, 10000, 10000, 10000 (74s)
  },
  mutationRetries: {
    startingDelay: 2000,
    delayFirstAttempt: false,
    maxDelay: 5000,
    numOfAttempts: 2,
    timeMultiple: 1.5,
    // 2000, 3000
  },
};
const applyRetryDefaults = (retryOptions?: RetryOptions): RetryOptions => {
  const ropts: RetryOptions = {
    // default config for backoff
    ...defaultRetryOpts,
  };

  if (retryOptions?.checkRetries) {
    ropts.checkRetries = retryOptions?.checkRetries;
  }
  if (retryOptions?.mutationRetries) {
    ropts.mutationRetries = retryOptions?.mutationRetries;
  }

  if (ropts.checkRetries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ropts.checkRetries.retry = (err: any, attemptNumber: number): boolean => {
      console.log(`Error detected. err=${err}`);
      console.log(`Retrying check (#${attemptNumber})...`);
      return true;
    };
  }
  if (ropts.mutationRetries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ropts.mutationRetries.retry = (err: any, attemptNumber: number): boolean => {
      console.log(`Error detected. err=${err}`);
      console.log(`Retrying mutation (#${attemptNumber})...`);
      return true;
    };
  }
  return ropts;
};

// const truncateStr = (str: string, size: number): string => {
//   return str.substring(0, Math.min(str.length, size));
// };
