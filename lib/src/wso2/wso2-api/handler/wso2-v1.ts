/* eslint-disable no-console */
import { Wso2ApimClientV1, Wso2ApimSdk, publisherV1 } from 'wso2apim-sdk';
import { OpenAPIObject } from 'openapi3-ts/oas30';
import { isEqual } from 'lodash';
import { oas30 } from 'openapi3-ts';
import { definitions } from 'wso2apim-sdk/dist/v1/generated/types/devportal';

import { Wso2ApiDefinition, Wso2Config } from '../types';

import { getSecretValue } from './utils';

export const prepareWso2ApiClient = async (wso2Config: Wso2Config): Promise<Wso2ApimClientV1> => {
  // get wso2 user/pass
  const creds = await getSecretValue(wso2Config.credentialsSecretId);
  let wso2Creds;
  try {
    wso2Creds = JSON.parse(creds);
  } catch (err) {
    throw new Error(
      `Couldn't parse credentials from secret manager at ${wso2Config.credentialsSecretId}. Check if it's a json with attributes {'user':'someuser', 'pwd':'mypass'}. err=${err}`,
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
  apiDefinition: Wso2ApiDefinition;
  wso2Tenant: string;
}): Promise<publisherV1.definitions['APIInfo'] | undefined> => {
  const searchQuery = `name:${args.apiDefinition.name} version:${args.apiDefinition.version} context:${args.apiDefinition.context}`;

  const { data, error } = await args.wso2Client.publisher.GET('/apis', {
    params: {
      query: {
        query: searchQuery,
      },
      header: {},
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

export type UpsertWso2Args = {
  wso2Client: Wso2ApimClientV1;
  wso2Tenant: string;
  existingWso2ApiId: string | undefined;
  apiDefinition: Wso2ApiDefinition;
  openapiDocument: OpenAPIObject;
};

/**
 * Delete API in WSO2 server
 */
export const removeApiInWso2 = async (args: {
  wso2Client: Wso2ApimClientV1;
  wso2ApiId: string;
}): Promise<void> => {
  if (!args.wso2ApiId) {
    throw new Error('wso2ApiId is required for deleting API');
  }

  const { error } = await args.wso2Client.publisher.DELETE('/apis/{apiId}', {
    params: {
      path: {
        apiId: args.wso2ApiId,
      },
      header: {},
    },
  });
  if (error) {
    throw new Error(`Error deleting API '${args.wso2ApiId}' in WSO2. err=${error}`);
  }
};

/**
 * Perform calls in WSO2 API to create or update an API, update Openapi definitions
 * and change the API lifecycle to PUBLISHED
 * @returns {string} Id of the API in WSO2
 */
export const createUpdateAndPublishApiInWso2 = async (
  args: UpsertWso2Args,
): Promise<{ wso2ApiId: string; endpointUrl?: string }> => {
  // TODO add retry witth backoff for all these operations

  console.log('');
  console.log(`>>> Create or update api in WSO2...`);
  const wso2ApiId = await createUpdateApiInWso2AndCheck(args);

  console.log('');
  console.log(`>>> Update Openapi definitions in WSO2 (Swagger)...`);
  await updateOpenapiInWso2AndCheck({
    ...args,
    wso2ApiId,
  });

  console.log('');
  console.log(`>>> Change api status to 'PUBLISHED'...`);
  const endpointUrl = await publishApiInWso2AndCheck({
    wso2Client: args.wso2Client,
    wso2ApiId,
    apiDefinition: args.apiDefinition,
    wso2Tenant: args.wso2Tenant,
  });

  return { wso2ApiId, endpointUrl };
};

export const publishApiInWso2AndCheck = async (args: {
  wso2Client: Wso2ApimClientV1;
  apiDefinition: Wso2ApiDefinition;
  wso2ApiId: string;
  wso2Tenant: string;
}): Promise<string | undefined> => {
  console.log(`Requesting to publish to WSO2`);
  const { error } = await args.wso2Client.publisher.POST('/apis/change-lifecycle', {
    params: {
      query: { apiId: args.wso2ApiId, action: 'Publish' },
      header: {},
    },
  });
  if (error) {
    throw new Error(`Error publishing api. err=${error}`);
  }
  console.log(`Request to publish sent to WSO2`);

  const fapi = await findWso2Api({
    apiDefinition: args.apiDefinition,
    wso2Client: args.wso2Client,
    wso2Tenant: args.wso2Tenant,
  });

  if (!fapi) {
    throw new Error(`API ${args.wso2ApiId} could not be found`);
  }
  if (fapi.lifeCycleStatus !== 'PUBLISHED') {
    throw new Error(`API ${args.wso2ApiId} is not in status 'PUBLISHED'`);
  }

  // get invokable API Url
  const apir = await args.wso2Client.devportal.GET('/apis/{apiId}', {
    params: {
      path: {
        apiId: args.wso2ApiId,
      },
      header: {},
    },
  });
  if (apir.error) {
    throw new Error(`Error getting invokable api. err=${error}`);
  }

  // find the endpoint URL of the environment that was defined in this API
  const apid = apir.data as definitions['API'];
  const endpointUrl = apid.endpointURLs?.reduce((acc, elem) => {
    if (
      elem.environmentName &&
      args.apiDefinition.gatewayEnvironments?.includes(elem.environmentName)
    ) {
      if (elem.URLs?.https) {
        return elem.URLs?.https;
      }
      if (elem.defaultVersionURLs?.https) {
        return elem.defaultVersionURLs?.https;
      }
    }
    return acc;
  }, '');

  return endpointUrl;
};

export const updateOpenapiInWso2AndCheck = async (args: {
  wso2Client: Wso2ApimClientV1;
  wso2ApiId: string;
  wso2Tenant: string;
  openapiDocument: oas30.OpenAPIObject;
  apiDefinition: Wso2ApiDefinition;
}): Promise<void> => {
  // TODO use axios for this
  //     const url = `https://${wso2APIM.host}:${wso2APIM.port}/api/am/publisher/${wso2APIM.versionSlug}/apis/${apiId}/swagger`;
  //     const config = {
  //       headers: {
  //         'Authorization': 'Bearer ' + accessToken,
  //         'Content-Type': 'multipart/form-data'
  //       },
  //       httpsAgent: new https.Agent({
  //         rejectUnauthorized: false
  //       })
  //     const data = new FormData();
  //     data.append('apiDefinition', JSON.stringify(swaggerSpec));

  //     return axios.put(url, data, config)
  //       .then((_) => undefined).catch((err) => {
  //         utils.renderError(err);
  //       }); // eat the http response, not needed outside of this api layer
  //   }

  console.log(`Requesting update openapi to WSO2`);
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
  console.log(`Requested update openapi to WSO2`);
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
      header: {},
    });
    if (error) {
      throw new Error(`Error creating new API in WSO2. err=${error}`);
    }
    const dataRes = data as publisherV1.definitions['API'];
    console.log(`API created in WSO2`);
    if (!dataRes.id)
      throw new Error(`'api' id wasn't returned as part of the API creation response`);
    checkApiExistsAndMatches(args);
    return dataRes.id;
  }

  // update existing API in WSO2
  console.log(`Requesting API update to WSO2`);
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
  console.log(`Requested API update to WSO2`);

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
    apiDefinition: args.apiDefinition,
    wso2Client: args.wso2Client,
    wso2Tenant: args.wso2Tenant,
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
