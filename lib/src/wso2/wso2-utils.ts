/* eslint-disable no-console */
import https from 'https';

import axios, { AxiosInstance } from 'axios';
import qs from 'qs';

import { prepareAxiosLogs } from '../utils/axios';

import { Wso2Config } from './types';
import { getSecretValue } from './utils';

export type Wso2ApimConfig = {
  /**
   * WSO2 API base Url. E.g.: https://mywso2.com
   */
  baseUrl: string;
  /**
   * WSO2 API username
   */
  username: string;
  /**
   * WSO2 API password
   */
  password: string;
  /**
   * WSO2 client name registered before API calls
   * @default cdk-practical-constructs-2015-01
   */
  clientName?: string;
  /**
   * WSO2 owner identification
   * @default username
   */
  owner?: string;
  /**
   * Rejects unverified hosts during TLS handshake (self signed certificates etc)
   * @default true
   */
  tlsRejectUnauthorized?: boolean;
};

export type ClientCredentials = {
  clientId: string;
  clientSecret: string;
};

export const prepareAxiosForWso2Calls = async (wso2Config: Wso2Config): Promise<AxiosInstance> => {
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

  const wso2ApimConfig: Wso2ApimConfig = {
    baseUrl: wso2Config.baseApiUrl,
    username,
    password: wso2Creds.pwd,
    clientName: `${wso2Config.credentialsSecretId}_2015-01`,
  };

  // get Bearer Token
  const axiosClient = axios.create({
    baseURL: wso2Config.baseApiUrl,
  });
  prepareAxiosLogs(axiosClient);

  const clientCredentials = await registerClient(wso2ApimConfig, axiosClient);
  const accessToken = await getBearerToken(wso2ApimConfig, axiosClient, clientCredentials);
  await checkWso2ServerVersion(wso2ApimConfig, axiosClient, 'v1');

  // set bearer token for all invocations
  const client = axios.create({
    baseURL: wso2Config.baseApiUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  prepareAxiosLogs(client);

  return client;
};

export const registerClient = async (
  config: Wso2ApimConfig,
  axiosClient: AxiosInstance,
): Promise<ClientCredentials> => {
  const data = {
    clientName: config.clientName ?? `cdk-practical-constructs-2025-01}`,
    owner: config.owner ?? config.username,
    grantType: 'password refresh_token client_credentials',
    saasApp: true,
  };

  const authTokenBase64 = Buffer.from(`${config.username}:${config.password}`).toString('base64');

  const axiosConfig = {
    headers: {
      Authorization: `Basic ${authTokenBase64}`,
      'Content-Type': 'application/json',
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: config.tlsRejectUnauthorized,
    }),
  };

  console.log('Registering client...');

  const res = axiosClient.post<ClientCredentials>(
    `/client-registration/v0.17/register`,
    data,
    axiosConfig,
  );

  return (await res).data;
};

export const getBearerToken = async (
  config: Wso2ApimConfig,
  axiosClient: AxiosInstance,
  clientCredentials: ClientCredentials,
): Promise<string> => {
  // tested minimum for publisher: apim:api_create apim:api_view apim:api_publish apim:api_delete
  const scopesPublisher =
    'apim:api_create apim:api_delete apim:api_publish apim:api_view apim:client_certificates_add apim:client_certificates_update apim:client_certificates_view apim:document_create apim:document_manage apim:ep_certificates_add apim:ep_certificates_update apim:ep_certificates_view apim:mediation_policy_manage apim:pub_alert_manage apim:publisher_settings apim:subscription_block apim:subscription_view apim:threat_protection_policy_create apim:threat_protection_policy_manage';
  const scopesStore =
    'apim:api_key apim:app_manage apim:store_settings apim:sub_alert_manage apim:sub_manage apim:subscribe';

  const data = qs.stringify({
    // eslint-disable-next-line camelcase
    grant_type: 'client_credentials',
    scope: `${scopesPublisher} ${scopesStore}`,
  });

  const authTokenBase64 = Buffer.from(
    `${clientCredentials.clientId}:${clientCredentials.clientSecret}`,
  ).toString('base64');

  const axiosConfig = {
    headers: {
      Authorization: `Basic ${authTokenBase64}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: config.tlsRejectUnauthorized,
    }),
  };

  console.log('Getting bearer token...');

  const res = axiosClient.post<{ access_token: string }>(`/oauth2/token`, data, axiosConfig);

  return (await res).data.access_token;
};

export const checkWso2ServerVersion = async (
  config: Wso2ApimConfig,
  axiosClient: AxiosInstance,
  wso2ApiVersion: string,
): Promise<void> => {
  let info = '';
  try {
    const res = axiosClient.get<string>(`/services/Version`, {
      httpsAgent: new https.Agent({ rejectUnauthorized: config.tlsRejectUnauthorized }),
    });
    const responseBody = (await res).data;
    info = responseBody.replaceAll(/<[^>]+>/g, '');
  } catch (err) {
    throw new Error(`Couldn't check server version. err=${err}`);
  }
  if (wso2ApiVersion === 'v1') {
    if (info.indexOf('WSO2 API Manager-3') === -1) {
      throw new Error(`Client for API v1 requires WSO2 server 3.x. Found '${info}'`);
    }
    return;
  }
  if (wso2ApiVersion === 'v2') {
    if (info.indexOf('WSO2 API Manager-4') === -1) {
      throw new Error(`Client for API v2 requires WSO2 server 4.x. Found '${info}'`);
    }
    return;
  }
  throw new Error(`'wso2Api' version is not supported`);
};
