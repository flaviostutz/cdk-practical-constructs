/* eslint-disable no-console */
import { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda';

import { Wso2ApiBaseProperties } from '../types';

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
    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      const wso2ApiId = publishWso2Api(event);
      response.PhysicalResourceId = wso2ApiId;
      response.Status = 'SUCCESS';
      return response;
    }
    if (event.RequestType === 'Delete') {
      removeWso2Api(event);
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

const publishWso2Api = (event: Wso2ApiCustomResourceEvent): string => {
  console.log('Publishing WSO2 API');
  return `test123${event.ResourceProperties.openapiDocument.info.title}`;
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const removeWso2Api = (event: Wso2ApiCustomResourceEvent): void => {
  if (event.RequestType === 'Delete') {
    console.log(`Removing WSO2 API apiId=${event.PhysicalResourceId}`);
  }
};
