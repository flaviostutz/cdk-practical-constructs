/* eslint-disable no-console */
import { CdkCustomResourceEvent, CdkCustomResourceResponse, Context } from 'aws-lambda';

export const handler = async (
  event: CdkCustomResourceEvent,
  context: Context,
): Promise<CdkCustomResourceResponse> => {
  console.log(`Wso2 Custom Resource invoked with: ${JSON.stringify(event)}`);

  const response: CdkCustomResourceResponse = {
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    PhysicalResourceId: context.logGroupName,
  };

  if (event.RequestType === 'Create') {
    response.Status = 'SUCCESS';
    response.Data = { Result: 'None' };
    return response;
  }

  if (event.RequestType === 'Delete') {
    response.Status = 'SUCCESS';
    response.Data = { Result: 'None' };
    return response;
  }

  try {
    const multiplyResult = event.ResourceProperties.customResourceNumber * 2;
    response.Status = 'SUCCESS';
    response.Data = { Result: multiplyResult };
    return response;
  } catch (error) {
    if (error instanceof Error) {
      response.Reason = error.message;
    }
    response.Status = 'FAILED';
    response.Data = { Result: error };
    return response;
  }
};
