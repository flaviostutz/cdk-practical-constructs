/* eslint-disable no-console */
import { oas30 } from 'openapi3-ts';
import FormData from 'form-data';
import { backOff } from 'exponential-backoff';
import { AxiosInstance } from 'axios';
import isEqual from 'lodash.isequal';

import {
  ApiFromListV1,
  PublisherPortalAPIv1,
  Wso2ApiDefinitionV1,
  Wso2ApiListV1,
} from '../v1/types';
import {
  areAttributeNamesEqual,
  normalizeCorsConfigurationValues,
  objectWithContentOrUndefined,
} from '../utils';
import { Wso2ApiProps } from '../types';

export const findWso2Api = async (args: {
  wso2Axios: AxiosInstance;
  apiDefinition: Wso2ApiDefinitionV1;
  wso2Tenant: string;
}): Promise<ApiFromListV1 | undefined> => {
  const searchQuery = `name:${args.apiDefinition.name} version:${args.apiDefinition.version} context:${args.apiDefinition.context}`;

  const res = await args.wso2Axios.get(`/api/am/publisher/v1/apis`, {
    params: { query: searchQuery },
  });

  const apilist = res.data as Wso2ApiListV1;

  if (!apilist.list) {
    throw new Error('apilist.list should exist even if empty');
  }

  // no api found with query parameters
  if (apilist.list.length === 0) {
    console.log(`No APIs were returned from WSO2 list with query='${searchQuery}'`);
    // eslint-disable-next-line no-undefined
    return undefined;
  }

  // filter out apis that were found but don't match our tenant
  const filteredApis = apilist.list.filter((api) => {
    if (api.name !== args.apiDefinition.name || api.version !== args.apiDefinition.version) {
      return false;
    }
    if (!api.context) return false;
    // 'api.context' may contain the full context name in wso2, which means '/t/[tenant]/[api context]'
    if (api.context.endsWith(args.apiDefinition.context)) {
      if (args.wso2Tenant) {
        return api.context.startsWith(`/t/${args.wso2Tenant}`);
      }
      // when we don't have tenants, there is no /t/[tenant] prefix
      return true;
    }
    // context doesn't match
    return false;
  });

  if (filteredApis.length === 1) {
    return filteredApis[0];
  }
  if (filteredApis.length === 0) {
    // eslint-disable-next-line no-undefined
    return undefined;
  }
  throw new Error(
    `Cannot determine which WSO2 API is related to this Custom Resource. More than 1 API with search query '${searchQuery}' matches. name=${args.apiDefinition.name} context=${args.apiDefinition.context} version=${args.apiDefinition.version} tenant=${args.wso2Tenant}`,
  );
};

export type UpsertWso2Args = Pick<Wso2ApiProps, 'lifecycleStatus'> &
  Required<Pick<Wso2ApiProps, 'retryOptions' | 'openapiDocument' | 'apiDefinition'>> & {
    wso2Axios: AxiosInstance;
    wso2Tenant: string;
    apiBeforeUpdate?: {
      id?: string;
      lastUpdatedTime?: string;
    };
  };

/**
 * Delete API in WSO2 server
 */
export const removeApiInWso2 = async (args: {
  wso2Axios: AxiosInstance;
  wso2ApiId: string;
}): Promise<void> => {
  if (!args.wso2ApiId) {
    throw new Error('wso2ApiId is required for deleting API');
  }
  await args.wso2Axios.delete(`/api/am/publisher/v1/apis/${args.wso2ApiId}`, {
    validateStatus(status) {
      // If it returns 404, the api is already deleted
      return status === 200 || status === 404;
    },
  });
};

/**
 * Perform calls in WSO2 API to create or update an API, update Openapi definitions
 * and change the API lifecycle to the desired status (if defined)
 * @returns {string} Id of the API in WSO2
 */
export const createUpdateAndChangeLifecycleStatusInWso2 = async (
  args: UpsertWso2Args,
): Promise<{ wso2ApiId: string; endpointUrl?: string }> => {
  const needWaitBeforeUpdateOpenapiDocument = await checkApiDefAndOpenapiOverlap(args);

  console.log('');
  console.log(`>>> Create or update api in WSO2...`);
  // will retry create/update api operation if fails
  const wso2ApiId = await backOff(
    async () => createUpdateApiInWso2AndCheck(args),
    args.retryOptions.mutationRetries,
  );

  console.log(`API created/updated in WSO2. apiId='${wso2ApiId}'`);

  if (needWaitBeforeUpdateOpenapiDocument) {
    console.log('');
    console.log(
      '>>> Wait for 2 minutes for the WSO2 api changes propagate before updating Openapi document...',
    );
    // eslint-disable-next-line no-promise-executor-return, promise/param-names
    await new Promise((resolveP) => setTimeout(resolveP, 120000));
  }

  console.log('');
  console.log(`>>> Update Openapi definitions in WSO2 (Swagger)...`);
  // will retry publishing openapi if fails
  await backOff(
    async () =>
      updateOpenapiInWso2AndCheck({
        ...args,
        wso2ApiId,
      }),
    args.retryOptions.mutationRetries,
  );

  if (args.lifecycleStatus) {
    console.log('');
    console.log(`>>> Changing lifecycle status to '${args.lifecycleStatus}'...`);
    // will retry changing to PUBLISHED if fails
    await backOff(async () =>
      changeLifecycleStatusInWso2AndCheck({
        wso2Axios: args.wso2Axios,
        wso2ApiId,
        apiDefinition: args.apiDefinition,
        wso2Tenant: args.wso2Tenant,
        retryOptions: args.retryOptions,
        lifecycleStatus: args.lifecycleStatus,
      }),
    );
  }

  // get endpoint url
  // console.log(`Getting API endpoint url`);
  // const apir = await args.wso2Axios.get(`/api/am/store/v1/apis/${wso2ApiId}`);

  // DISABLING ENDPOINT URL WHILE WE FIX AN ISSUE
  const endpointUrl = '';
  // // find the endpoint URL of the environment that was defined in this API
  // const apid = apir.data as DevPortalAPIv1;
  // const endpointUrl = apid.endpointURLs?.reduce((acc, elem) => {
  //   if (
  //     elem.environmentName &&
  //     args.apiDefinition.gatewayEnvironments?.includes(elem.environmentName)
  //   ) {
  //     if (elem.URLs?.https) {
  //       return elem.URLs?.https;
  //     }
  //     if (elem.defaultVersionURLs?.https) {
  //       return elem.defaultVersionURLs?.https;
  //     }
  //   }
  //   return acc;
  // }, '');

  console.log('API created/updated successfully on WSO2 server');

  return { wso2ApiId, endpointUrl };
};

const actionMap = {
  PUBLISHED: 'Publish',
  CREATED: 'Demote to created',
  DEPRECATED: 'Deprecate',
  BLOCKED: 'Block',
  RETIRED: 'Retire',
  PROTOTYPED: 'Deploy as a Prototype',
};

export const changeLifecycleStatusInWso2AndCheck = async (
  args: Pick<Wso2ApiProps, 'lifecycleStatus'> &
    Required<Pick<Wso2ApiProps, 'retryOptions' | 'apiDefinition'>> & {
      wso2Axios: AxiosInstance;
      wso2ApiId: string;
      wso2Tenant: string;
    },
): Promise<undefined> => {
  if (!args.lifecycleStatus) throw new Error(`'lifecycleStatus' is required`);
  console.log(`Changing API status to '${args.lifecycleStatus}' in WSO2`);

  // define the action to be taken based on target lifecycle status
  const action = actionMap[args.lifecycleStatus];
  if (!action) {
    throw new Error(`Lifecycle status '${args.lifecycleStatus}' is not supported`);
  }

  console.log(`Using action '${action}' for lifecycle change`);
  await args.wso2Axios.post(
    '/api/am/publisher/v1/apis/change-lifecycle',
    {},
    {
      params: {
        apiId: args.wso2ApiId,
        action,
      },
    },
  );

  // wait for API to have the desired status by retrying checks
  await backOff(async () => {
    console.log('');
    console.log(`Checking if API is in lifecycle status '${args.lifecycleStatus}'...`);
    const fapi = await findWso2Api({
      apiDefinition: args.apiDefinition,
      wso2Axios: args.wso2Axios,
      wso2Tenant: args.wso2Tenant,
    });

    if (!fapi) {
      throw new Error(`API ${args.wso2ApiId} could not be found`);
    }

    // Workflow trigger detected. It might indicate the need for manual approval or a slow process
    // so we will ignore checking the API lifecycle status check for now
    if (fapi.workflowStatus !== '' && fapi.workflowStatus !== 'APPROVED') {
      console.log(
        `API lifecycle status check SKIPPED. API ${args.wso2ApiId} has workflow status '${fapi.workflowStatus}', which might require manual approval before the actual lifecycle status is changed`,
      );
      return;
    }

    if (fapi.lifeCycleStatus !== args.lifecycleStatus) {
      throw new Error(
        `API ${args.wso2ApiId} is in status ${fapi.lifeCycleStatus} (not '${args.lifecycleStatus}')`,
      );
    }
    console.log(`API lifecycle status check OK. lifecycleStatus='${args.lifecycleStatus}'`);
  }, args.retryOptions.checkRetries);
};

export const updateOpenapiInWso2AndCheck = async (
  args: Required<Pick<Wso2ApiProps, 'openapiDocument' | 'apiDefinition' | 'retryOptions'>> & {
    wso2Axios: AxiosInstance;
    wso2ApiId: string;
    wso2Tenant: string;
  },
): Promise<void> => {
  console.log('Updating Openapi document in WSO2');
  const fdata = new FormData();
  const openapiDocumentStr = JSON.stringify(args.openapiDocument);
  fdata.append('apiDefinition', openapiDocumentStr);
  await args.wso2Axios.put(`/api/am/publisher/v1/apis/${args.wso2ApiId}/swagger`, fdata, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  await backOff(async () => {
    console.log('');
    console.log('Checking if Openapi was updated on WSO2...');
    const res = await args.wso2Axios.get(`/api/am/publisher/v1/apis/${args.wso2ApiId}/swagger`, {
      responseType: 'text',
      transformResponse: [(v): typeof v => v],
    });
    const openapiFromWso2Str = res.data as string;

    // The document returned by WSO2 have differences introduced by WSO2 itself
    // so we can't do a strict check. Check for a few things in the document to check sanity
    const openapiFromWso2 = JSON.parse(openapiFromWso2Str) as oas30.OpenAPIObject;

    if (!openapiSimilarWso2(openapiFromWso2, args.openapiDocument)) {
      console.log(
        `Openapi doc downloaded from WSO2 doesn't match submitted definition. EXPECTED='${openapiDocumentStr}'\nACTUAL='${openapiFromWso2Str}`,
      );
      throw new Error(`Openapi doc downloaded from WSO2 doesn't match submitted definition`);
    }
    console.log('API Openapi document check OK');
  }, args.retryOptions.checkRetries);
};

export const createUpdateApiInWso2AndCheck = async (args: UpsertWso2Args): Promise<string> => {
  // create new API in WSO2
  if (!args.apiBeforeUpdate) {
    console.log(`Creating new API in WSO2`);
    const apir = await args.wso2Axios.post(
      `/api/am/publisher/v1/apis?openAPIVersion=V3`,
      args.apiDefinition,
    );

    const dataRes = apir.data as PublisherPortalAPIv1;
    if (!dataRes.id) {
      throw new Error(`'api' id wasn't returned as part of the API creation response`);
    }
    console.log(`API created in WSO2`);

    // wait for API to be created by retrying checks
    await backOff(async () => checkApiExistsAndMatches(args), args.retryOptions.checkRetries);
    return dataRes.id;
  }

  // update existing API in WSO2
  console.log(`Updating API definitions in WSO2`);
  const res = await args.wso2Axios.put(
    `/api/am/publisher/v1/apis/${args.apiBeforeUpdate.id}`,
    args.apiDefinition,
  );
  const dataRes = res.data as PublisherPortalAPIv1;
  if (!dataRes.id) throw new Error(`'api' id wasn't returned as part of the API creation response`);

  // wait for API to be created by retrying checks
  await backOff(async () => checkApiExistsAndMatches(args), args.retryOptions.checkRetries);
  return dataRes.id;
};

/**
 * Check if api was created succesfully and if it is the same as we sent.
 * Sometimes WSO2 have some issue with cluster synchronisation and we want to
 * be sure sure that this is not happening
 * An exception will be thrown if the API doesn't exist or if its contents
 * are different
 */
const checkApiExistsAndMatches = async (
  args: Pick<UpsertWso2Args, 'apiDefinition' | 'wso2Axios' | 'wso2Tenant' | 'apiBeforeUpdate'>,
): Promise<void> => {
  // TODO check if the returned contents won't come with default values and things that doesn't actually indicates a real issue but makes it doesnt match
  console.log('');
  console.log('Checking if API exists and matches the desired definition in WSO2...');
  const searchApi = await findWso2Api({
    apiDefinition: args.apiDefinition,
    wso2Axios: args.wso2Axios,
    wso2Tenant: args.wso2Tenant,
  });

  if (!searchApi) {
    throw new Error(`API couldn't be found on WSO2`);
  }

  console.log(`API '${searchApi.id}' found in WSO2 search`);

  const apir = await args.wso2Axios.get(`/api/am/publisher/v1/apis/${searchApi.id}`);
  const apiDetails = apir.data as PublisherPortalAPIv1;

  if (!apiDetails.lastUpdatedTime) {
    throw new Error('lastUpdatedTime is null in api');
  }

  if (
    apiDetails.name !== searchApi.name ||
    apiDetails.context !== searchApi.context ||
    apiDetails.version !== searchApi.version ||
    apiDetails.lifeCycleStatus !== searchApi.lifeCycleStatus
  ) {
    throw new Error(
      `Some contents from the search API results are different from the ones fetched in /api/{id}. 
      ${JSON.stringify(apiDetails)} -- ${JSON.stringify(searchApi)}`,
    );
  }

  const { isEquivalent, failedChecks } = checkWSO2Equivalence(apiDetails, args.apiDefinition);

  if (!isEquivalent) {
    throw new Error(
      `Some contents from the current deployed WSO2 api are different from the ones defined to be deployed: ${JSON.stringify(
        failedChecks,
      )}`,
    );
  }

  if (!args.apiBeforeUpdate) {
    console.log(`API '${searchApi.id}' check OK`);
    return;
  }

  // This is an update. Check if timestamp has changed
  if (!args.apiBeforeUpdate.lastUpdatedTime) {
    throw new Error('lastUpdatedTime is null in api before updated');
  }
  if (apiDetails.lastUpdatedTime <= args.apiBeforeUpdate.lastUpdatedTime) {
    throw new Error(`API 'lastUpdatedTime' has not changed after updating the API definitions yet`);
  }

  console.log(`API '${searchApi.id}' check OK`);
};

/**
 * Verifies if openapi spec sent and downloaded from Wso2 seems the same
 * WSO2 adds attributes to the original Openapi spec, so we have to do
 * an best effort to do this check
 */
export const openapiSimilarWso2 = (
  subOpenapi: oas30.OpenAPIObject,
  wso2Openapi: oas30.OpenAPIObject,
): boolean => {
  if (
    subOpenapi.info.title !== wso2Openapi.info.title ||
    subOpenapi.paths.length !== wso2Openapi.paths.length ||
    // TODO: wso2 fetch seems to not return the servers
    (wso2Openapi.servers && subOpenapi.servers?.length !== wso2Openapi.servers?.length) ||
    !areAttributeNamesEqual(subOpenapi.components?.schemas, wso2Openapi.components?.schemas) ||
    !areAttributeNamesEqual(subOpenapi.paths, wso2Openapi.paths) ||
    subOpenapi.openapi !== wso2Openapi.openapi
  ) {
    return false;
  }
  return true;
};

type CheckWSO2EquivalenceOutput = {
  isEquivalent: boolean;
  failedChecks: Array<{
    name: string;
    data: {
      inWso2: unknown;
      toBeDeployed: unknown;
    };
  }>;
};

/**
 * Checks wether the deployed WSO2 API is equivalent with the definition in the WSO2 construct
 *
 * @param wso2ApiDefinition The API definition returned from wso2 server
 * @param toBeDeployedApiDefinition The definition of the WSO2 CDK construct
 */
export const checkWSO2Equivalence = (
  wso2ApiDefinition: PublisherPortalAPIv1,
  constructApiDefinition: Wso2ApiDefinitionV1,
): CheckWSO2EquivalenceOutput => {
  const equivalenceCheckMatrix: Array<{
    name: string;
    check: boolean;
    data: CheckWSO2EquivalenceOutput['failedChecks'][number]['data'];
  }> = [
    {
      name: 'businessInformation',
      check: isEqual(
        objectWithContentOrUndefined(wso2ApiDefinition.businessInformation),
        objectWithContentOrUndefined(constructApiDefinition.businessInformation),
      ),
      data: {
        inWso2: wso2ApiDefinition.businessInformation,
        toBeDeployed: constructApiDefinition.businessInformation,
      },
    },
    {
      name: 'endpointConfig',
      check: isEqual(
        objectWithContentOrUndefined(wso2ApiDefinition.endpointConfig),
        objectWithContentOrUndefined(constructApiDefinition.endpointConfig),
      ),
      data: {
        inWso2: wso2ApiDefinition.endpointConfig,
        toBeDeployed: constructApiDefinition.endpointConfig,
      },
    },
    {
      name: 'additionalProperties',
      check: isEqual(
        objectWithContentOrUndefined(wso2ApiDefinition.additionalProperties),
        objectWithContentOrUndefined(constructApiDefinition.additionalProperties),
      ),
      data: {
        inWso2: wso2ApiDefinition.additionalProperties,
        toBeDeployed: constructApiDefinition.additionalProperties,
      },
    },
    {
      name: 'corsConfiguration',
      check: isEqual(
        normalizeCorsConfigurationValues(wso2ApiDefinition.corsConfiguration),
        objectWithContentOrUndefined(constructApiDefinition.corsConfiguration),
      ),
      data: {
        inWso2: normalizeCorsConfigurationValues(wso2ApiDefinition.corsConfiguration),
        toBeDeployed: constructApiDefinition.corsConfiguration,
      },
    },
  ];

  const failedEquivalenceChecks = equivalenceCheckMatrix.filter(({ check }) => !check);

  return {
    isEquivalent: !failedEquivalenceChecks.length,
    failedChecks: failedEquivalenceChecks.map(({ name, data }) => ({
      name,
      data,
    })),
  };
};

/**
 * Checks wether the deployment has overlaps between the API definition and the OpenAPI document
 */
const checkApiDefAndOpenapiOverlap = async (args: UpsertWso2Args): Promise<boolean> => {
  if (!args.apiBeforeUpdate) {
    // ? API is being created
    return false;
  }

  return backOff(async () => {
    const searchApi = await findWso2Api({
      apiDefinition: args.apiDefinition,
      wso2Axios: args.wso2Axios,
      wso2Tenant: args.wso2Tenant,
    });

    if (!searchApi) {
      throw new Error('WSO2 API not found');
    }

    const apir = await args.wso2Axios.get(`/api/am/publisher/v1/apis/${searchApi.id}`);
    const apiDetails = apir.data as PublisherPortalAPIv1;

    const { isEquivalent } = checkWSO2Equivalence(apiDetails, args.apiDefinition);

    // ? if the wso2 configuration is not equivalent, it will also overlap the openapi document information
    return !isEquivalent;
  }, args.retryOptions.checkRetries);
};
