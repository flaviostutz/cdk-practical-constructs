/* eslint-disable no-console */

import type { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda';
import type { AxiosInstance } from 'axios';

import { prepareAxiosForWso2Calls } from '../../wso2-utils';
import { applyRetryDefaults, truncateStr } from '../../utils';
import type { Wso2SubscriptionInfo } from '../v1/types';
import type { Wso2SubscriptionCustomResourceProperties } from '../types';

import { createUpdateSubscriptionInWso2, removeSubscriptionInWso2 } from './wso2-v1';

export type Wso2ApplicationCustomResourceEvent = CdkCustomResourceEvent & {
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
  event: Wso2ApplicationCustomResourceEvent,
): Promise<Wso2SubscriptionCustomResourceResponse> => {
  // console.log(`WSO2 API Custom Resource invoked with: ${JSON.stringify(event)}`);

  // FIXME CHECK SUBSCRIPTION API AND CHANGE IMPLEMENTATION BELOW

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
      console.log('>>> Creating or Updating WSO2 Application...');
      const wso2ApplicationId = await createOrUpdateWso2Application(event, wso2Axios);
      response.PhysicalResourceId = wso2ApplicationId;
      response.Data = {
        Wso2ApplicationId: wso2ApplicationId,
      };
      response.Status = 'SUCCESS';
      return response;
    }
    if (event.RequestType === 'Delete') {
      console.log('>>> Deleting WSO2 Application...');
      response.PhysicalResourceId = event.PhysicalResourceId;
      await removeApplicationInWso2({
        wso2Axios,
        wso2ApplicationId: event.PhysicalResourceId,
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

const createOrUpdateWso2Application = async (
  event: Wso2ApplicationCustomResourceEvent,
  wso2Axios: AxiosInstance,
): Promise<string> => {
  if (!event.ResourceProperties.applicationDefinition?.name) {
    throw new Error('applicationDefinition.name should be defined');
  }

  // find existing WSO2 application
  console.log('Searching if Application already exists in WSO2...');
  let existingApplication: Wso2ApplicationInfo | undefined;
  const apil = await wso2Axios.get(`/api/am/store/v1/applications`, {
    params: { query: event.ResourceProperties.applicationDefinition.name },
  });
  const apiRes = apil.data.list as Wso2ApplicationInfo[];
  if (apiRes.length > 1) {
    throw new Error(
      `More than one Application with name '${event.ResourceProperties.applicationDefinition.name}' was found in WSO2 so we cannot determine it's id automatically`,
    );
  }
  if (apiRes.length === 1) {
    existingApplication = apiRes[0];
    console.log(
      `Found existing WSO2 Application. applicationId=${existingApplication.applicationId}; name=${existingApplication.name}`,
    );
  }

  if (
    event.RequestType === 'Create' &&
    existingApplication &&
    event.ResourceProperties.failIfExists
  ) {
    throw new Error(
      `WSO2 Application ${existingApplication.applicationId}' already exists but cannot be managed by this resource. Change 'failIfExists' to change this behavior`,
    );
  }

  if (event.RequestType === 'Update' && !existingApplication) {
    console.log(
      `WARNING: This is an Update operation but the Application couldn't be found in WSO2. It will be created again`,
    );
  }

  if (event.RequestType === 'Create' || event.RequestType === 'Update') {
    return createUpdateApplicationInWso2({
      wso2Axios,
      wso2Tenant: event.ResourceProperties.wso2Config.tenant ?? '',
      applicationDefinition: event.ResourceProperties.applicationDefinition,
      existingApplication,
      retryOptions: applyRetryDefaults(event.ResourceProperties.retryOptions),
    });
  }

  throw new Error(`Invalid requestType found. requestType=${event.ResourceType}`);
};
