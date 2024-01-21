/* eslint-disable no-console */
import { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda';
import { Wso2ApimClientV1 } from 'wso2apim-sdk';
import { definitions } from 'wso2apim-sdk/dist/v1/generated/types/publisher';

import { Wso2ApiBaseProperties, Wso2ApiDefinition } from '../types';

import { createUpdateAndPublishApiInWso2, findWso2Api, prepareWso2ApiClient } from './wso2-v1';

export type Wso2ApiCustomResourceEvent = CdkCustomResourceEvent & {
  ResourceProperties: Wso2ApiBaseProperties;
};

export type Wso2ApiCustomResourceResponse = CdkCustomResourceResponse & {
  Data?: {
    EndpointUrlProduction?: string;
    EndpointUrlSandbox?: string;
    Error?: unknown;
  };
};

export const handler = async (
  event: Wso2ApiCustomResourceEvent,
  // context: Context,
): Promise<Wso2ApiCustomResourceResponse> => {
  console.log(`Wso2 Custom Resource invoked with: ${JSON.stringify(event)}`);

  const response: Wso2ApiCustomResourceResponse = {
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  };

  try {
    if (event.ResourceProperties.apiDefinition.wso2Version !== 'v1') {
      throw new Error(`Only WSO2 version 'v1' is supported by this Custom Resource`);
    }

    const wso2Client = await prepareWso2ApiClient(event.ResourceProperties.wso2Config);

    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      const wso2ApiId = await createOrUpdateWso2Api(event, wso2Client);
      response.PhysicalResourceId = wso2ApiId;
      response.Status = 'SUCCESS';
      return response;
    }
    if (event.RequestType === 'Delete') {
      await removeWso2Api(event, wso2Client);
      response.Status = 'SUCCESS';
      return response;
    }
    throw new Error('Unrecognized RequestType');
  } catch (error) {
    if (error instanceof Error) {
      response.Reason = error.message;
    }
    response.Status = 'FAILED';
    response.Data = { Error: error };
    return response;
  }
};

const createOrUpdateWso2Api = async (
  event: Wso2ApiCustomResourceEvent,
  wso2Client: Wso2ApimClientV1,
): Promise<string> => {
  if (!event.ResourceProperties.apiDefinition.version) {
    throw new Error('apidef.version should be defined');
  }

  // find existing WSO2 API
  const existingApi = await findWso2Api({
    wso2Client,
    apiName: event.ResourceProperties.apiDefinition.name,
    apiVersion: event.ResourceProperties.apiDefinition.version,
    apiContext: event.ResourceProperties.apiDefinition.context,
    apiTenant: event.ResourceProperties.wso2Config.tenant,
  });

  if (existingApi) {
    console.log(
      `Found existing WSO2 API. apiId=${existingApi}; name=${existingApi.name}; version=${existingApi.version} context=${existingApi.context}`,
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
      wso2Client,
      apiDefinition: event.ResourceProperties.apiDefinition,
      openapiDocument: event.ResourceProperties.openapiDocument,
      wso2Tenant: event.ResourceProperties.wso2Config.tenant,
      existingWso2ApiId: existingApi?.id,
    });
  }

  throw new Error(`Invalid requestType found. requestType=${event.ResourceType}`);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const removeWso2Api = async (
  event: Wso2ApiCustomResourceEvent,
  wso2Client: Wso2ApimClientV1,
): Promise<void> => {
  if (event.RequestType === 'Delete') {
    // TODO
    console.log(`Removing WSO2 API apiId=${event.PhysicalResourceId}`);
  }
};
