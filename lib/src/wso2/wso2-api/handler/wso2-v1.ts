import { Wso2ApimClientV1, Wso2ApimSdk, publisherV1 } from 'wso2apim-sdk';
import { OpenAPIObject } from 'openapi3-ts/oas30';
import { isEqual } from 'lodash';
import { oas30 } from 'openapi3-ts';

import { Wso2ApiDefinition, Wso2Config } from '../types';

import { getHeaders } from './utils';

export const prepareWso2ApiClient = async (wso2Config: Wso2Config): Promise<Wso2ApimClientV1> => {
  // get wso2 user/pass
  const creds = wso2Config.credentialsSecretId;
  let wso2Creds;
  try {
    wso2Creds = JSON.parse(creds);
  } catch (err) {
    throw new Error(
      `Couldn't parse credentials from secret manager at ${wso2Config.credentialsSecretId}. Check if it's a json with attributes {'user':'someuser', 'pwd':'mypass'}`,
    );
  }
  if (!wso2Creds.user || !wso2Creds.pwd) {
    throw new Error(
      `'user' and 'pwd' attributes from credentials  ${wso2Config.credentialsSecretId} are required`,
    );
  }

  // prepare wso2 api client
  let username = wso2Creds.user;
  if (wso2Config.tenant) {
    username = `${wso2Creds.user}@${wso2Config.tenant}`;
  }
  return Wso2ApimSdk.createV1({
    baseUrl: wso2Config.baseApiUrl,
    username,
    password: wso2Creds.pwd,
  });
};

export const findWso2Api = async (args: {
  wso2Client: Wso2ApimClientV1;
  apiName: string;
  apiVersion: string;
  apiContext: string;
  apiTenant?: string;
}): Promise<publisherV1.definitions['APIInfo'] | undefined> => {
  const searchQuery = `name:${args.apiName} version:${args.apiVersion} context:${args.apiContext}`;

  const { data, error } = await args.wso2Client.publisher.GET('/apis', {
    params: {
      query: {
        query: searchQuery,
      },
      header: getHeaders(args.apiTenant),
    },
  });
  if (error) {
    throw new Error(`Couldn't query for apis in Wso2 API. err=${error}`);
  }

  const apilist = data as publisherV1.definitions['APIList'];

  if (!apilist.list) {
    throw new Error('apilist.list should exist even if empty');
  }

  // no api found with query parameters
  if (apilist.list.length === 0) {
    // eslint-disable-next-line no-undefined
    return undefined;
  }

  // filter out apis that were found but don't match our tenant
  const filteredApis = apilist.list.filter((api) => {
    if (api.name !== args.apiName || api.version !== args.apiVersion) {
      return false;
    }
    if (!api.context) return false;
    // 'api.context' may contain the full context name in wso2, which means '/t/[tenant]/[api context]'
    if (api.context.endsWith(args.apiContext)) {
      if (args.apiTenant) {
        return api.context.startsWith(`/t/${args.apiTenant}`);
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
    `Cannot determine which WSO2 API is related to this Custom Resource. More than 1 API with search query '${searchQuery}' matches. name=${args.apiName} context=${args.apiContext} version=${args.apiVersion} tenant=${args.apiTenant}`,
  );
};

export type UpsertWso2Args = {
  wso2Client: Wso2ApimClientV1;
  wso2Tenant?: string;
  existingWso2ApiId: string | undefined;
  apiDefinition: Wso2ApiDefinition;
  openapiDocument: OpenAPIObject;
};

/**
 * Perform calls in WSO2 API to create or update an API, update Openapi definitions
 * and change the API lifecycle to PUBLISHED
 * @returns {string} Id of the API in WSO2
 */
export const createUpdateAndPublishApiInWso2 = async (args: UpsertWso2Args): Promise<string> => {
  // TODO add backoff for all those operations

  // create or update api in WSO2
  const wso2ApiId = await createUpdateApiInWso2AndCheck(args);

  // update Openapi definitions in WSO2 (Swagger)
  await updateOpenapiInWso2AndCheck({
    ...args,
    wso2ApiId,
  });

  // change api status to 'PUBLISHED'
  await publishApiInWso2AndCheck({
    wso2Client: args.wso2Client,
    wso2ApiId,
    apiContext: args.apiDefinition.context,
    apiName: args.apiDefinition.name,
    apiTenant: args.wso2Tenant,
    apiVersion: args.apiDefinition.version,
  });

  return wso2ApiId;
};

export const publishApiInWso2AndCheck = async (args: {
  wso2Client: Wso2ApimClientV1;
  wso2ApiId: string;
  apiContext: string;
  apiName: string;
  apiVersion: string;
  apiTenant?: string;
}): Promise<void> => {
  const { error } = await args.wso2Client.publisher.POST('/apis/change-lifecycle', {
    params: {
      query: { apiId: args.wso2ApiId, action: 'Publish' },
      header: {},
    },
  });
  if (error) {
    throw new Error(`Error publishing api. err=${error}`);
  }

  const fapi = await findWso2Api({
    apiContext: args.apiContext,
    apiName: args.apiName,
    apiVersion: args.apiVersion,
    wso2Client: args.wso2Client,
    apiTenant: args.apiTenant,
  });

  if (!fapi) {
    throw new Error(`API ${args.wso2ApiId} could not be found`);
  }
  if (fapi.lifeCycleStatus !== 'PUBLISHED') {
    throw new Error(`API ${args.wso2ApiId} is not in status 'PUBLISHED'`);
  }
};

export const updateOpenapiInWso2AndCheck = async (args: {
  wso2Client: Wso2ApimClientV1;
  wso2ApiId: string;
  openapiDocument: oas30.OpenAPIObject;
  apiDefinition: Wso2ApiDefinition;
}): Promise<void> => {
  const { data, error } = await args.wso2Client.publisher.PUT('/apis/{apiId}/swagger', {
    params: {
      path: {
        apiId: args.wso2ApiId,
      },
      formData: {
        apiDefinition: JSON.stringify(args.openapiDocument),
      },
      header: {},
    },
  });
  if (error) {
    throw new Error(`Error updating Openapi document for API in WSO2. err=${error}`);
  }
  const dataRes = data as publisherV1.definitions['API'];
  if (!dataRes.id) throw new Error(`'api' id wasn't returned as part of the API creation response`);
  checkApiExistsAndMatches(args);
};

export const createUpdateApiInWso2AndCheck = async (args: UpsertWso2Args): Promise<string> => {
  // create new API in WSO2
  if (!args.existingWso2ApiId) {
    const { data, error } = await args.wso2Client.publisher.POST('/apis', {
      params: {
        body: {
          body: args.apiDefinition,
        },
        query: {
          openAPIVersion: 'V3',
        },
      },
      header: getHeaders(args.wso2Tenant),
    });
    if (error) {
      throw new Error(`Error creating new API in WSO2. err=${error}`);
    }
    const dataRes = data as publisherV1.definitions['API'];
    if (!dataRes.id)
      throw new Error(`'api' id wasn't returned as part of the API creation response`);
    checkApiExistsAndMatches(args);
    return dataRes.id;
  }

  // update existing API in WSO2
  const { data, error } = await args.wso2Client.publisher.PUT('/apis/{apiId}', {
    params: {
      path: {
        apiId: args.existingWso2ApiId,
      },
      body: {
        body: args.apiDefinition,
      },
      header: {},
    },
  });

  if (error) {
    throw new Error(`Error updating API in WSO2. err=${error}`);
  }
  const dataRes = data as publisherV1.definitions['API'];
  if (!dataRes.id) throw new Error(`'api' id wasn't returned as part of the API creation response`);
  checkApiExistsAndMatches(args);
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
  args: Pick<UpsertWso2Args, 'apiDefinition' | 'wso2Client' | 'wso2Tenant'>,
): Promise<void> => {
  // TODO check if the returned contents won't come with default values and things that doesn't actually indicates a real issue but makes it doesnt match
  const fapi = await findWso2Api({
    apiContext: args.apiDefinition.context,
    apiName: args.apiDefinition.name,
    apiVersion: args.apiDefinition.version,
    wso2Client: args.wso2Client,
    apiTenant: args.wso2Tenant,
  });

  // check if they are equal, but make sure to add "id" because during creation it won't be passed
  if (
    !isEqual(fapi, {
      ...args.apiDefinition,
      id: fapi?.id,
    })
  ) {
    throw new Error(`WSO2 Api Definition returned from query doesn't match the submitted contents`);
  }
};
