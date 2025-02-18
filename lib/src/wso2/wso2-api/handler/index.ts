/* eslint-disable no-console */
import { AxiosInstance } from 'axios';
import { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda';

import { Wso2ApiCustomResourceProperties } from '../types';
import { prepareAxiosForWso2Calls } from '../../wso2-utils';
import { applyRetryDefaults, truncateStr } from '../../utils';

import {
  createUpdateAndChangeLifecycleStatusInWso2,
  findWso2Api,
  getWso2ApiById,
  removeApiInWso2,
} from './wso2-v1';

export type Wso2ApiCustomResourceEvent = CdkCustomResourceEvent & {
  ResourceProperties: Wso2ApiCustomResourceProperties;
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
    console.log('>>> Prepare WSO2 API client...');
    const wso2Axios = await prepareAxiosForWso2Calls(event.ResourceProperties.wso2Config);

    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      if (event.RequestType === 'Update') {
        response.PhysicalResourceId = event.PhysicalResourceId;
      }
      console.log('>>> Creating or Updating WSO2 API...');
      const { wso2ApiId, endpointUrl } = await createOrUpdateWso2Api(event, wso2Axios);
      response.PhysicalResourceId = wso2ApiId;
      response.Data = {
        EndpointUrl: endpointUrl,
        Wso2ApiId: wso2ApiId,
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
    throw new Error(truncateStr(`${error}`, 1000));
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
    apiName: event.ResourceProperties.apiDefinition.name,
    apiVersion: event.ResourceProperties.apiDefinition.version,
    apiContext: event.ResourceProperties.apiDefinition.context,
    wso2Tenant: event.ResourceProperties.wso2Config.tenant ?? '',
  });

  let apiBeforeUpdate;
  if (existingApi && existingApi.id) {
    console.log(
      `Found existing WSO2 API. apiId=${existingApi.id}; name=${existingApi.name}; version=${existingApi.version} context=${existingApi.context}`,
    );
    apiBeforeUpdate = await getWso2ApiById({ wso2Axios, wso2ApiId: existingApi.id });
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
    return createUpdateAndChangeLifecycleStatusInWso2({
      wso2Axios,
      apiDefinition: event.ResourceProperties.apiDefinition,
      openapiDocument: event.ResourceProperties.openapiDocument,
      wso2Tenant: event.ResourceProperties.wso2Config.tenant ?? '',
      apiBeforeUpdate,
      retryOptions: applyRetryDefaults(event.ResourceProperties.retryOptions),
      lifecycleStatus: event.ResourceProperties.lifecycleStatus,
    });
  }

  throw new Error(`Invalid requestType found. requestType=${event.ResourceType}`);
};
