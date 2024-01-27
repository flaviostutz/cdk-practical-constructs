/* eslint-disable no-console */
import https from 'https';

import axios, { AxiosError, AxiosInstance } from 'axios';
import qs from 'qs';

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
   * @default 'wso2apim-sdk-client'
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
    clientName: 'cdk-practical-constructs-wso2',
  };

  const clientCredentials = await registerClient(wso2ApimConfig);
  const accessToken = await getBearerToken(wso2ApimConfig, clientCredentials);

  await checkWso2ServerVersion(wso2ApimConfig, 'v1');

  const client = axios.create({
    baseURL: wso2Config.baseApiUrl,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client.interceptors.request.use((config: any) => {
    // eslint-disable-next-line no-param-reassign
    config.metadata = { startTime: new Date().getTime() };
    console.log(`> REQUEST: ${config.method?.toUpperCase()} ${wso2Config.baseApiUrl}${config.url}`);
    console.log(
      JSON.stringify({
        baseURL: config.baseURL,
        url: config.url,
        params: config.params,
        method: config.method,
        headers: config.headers,
        status: config.status,
        data: config.data,
      }),
    );
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const elapsedTime = new Date().getTime() - response.config.metadata.startTime;
      console.log(`> RESPONSE: ${response.status} (${elapsedTime}ms)`);
      console.log(
        JSON.stringify({
          status: response.status,
          headers: response.headers,
          data: response.data,
        }),
      );
      return response;
    },
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    (error: Error | AxiosError) => {
      if (axios.isAxiosError(error)) {
        console.log(`RESPONSE ERROR: status=${error.response?.status}`);
        console.log(
          JSON.stringify({
            status: error.response?.status,
            headers: error.response?.headers,
            data: error.response?.data,
          }),
        );
      }
      throw error;
    },
  );

  return client;
};

export const registerClient = async (config: Wso2ApimConfig): Promise<ClientCredentials> => {
  const data = {
    clientName: config.clientName ?? 'wso2apim-sdk-client',
    owner: config.owner ?? config.username,
    grantType: 'password refresh_token',
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

  const res = axios.post<ClientCredentials>(
    `${config.baseUrl}/client-registration/v0.17/register`,
    data,
    axiosConfig,
  );

  return (await res).data;
};

export const getBearerToken = async (
  config: Wso2ApimConfig,
  clientCredentials: ClientCredentials,
): Promise<string> => {
  const data = qs.stringify({
    // eslint-disable-next-line camelcase
    grant_type: 'password',
    username: config.username,
    password: config.password,
    scope: 'apim:api_create apim:api_view apim:api_publish apim:api_delete',
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

  const res = axios.post<{ access_token: string }>(
    `${config.baseUrl}/oauth2/token`,
    data,
    axiosConfig,
  );

  return (await res).data.access_token;
};

export const checkWso2ServerVersion = async (
  config: Wso2ApimConfig,
  wso2ApiVersion: string,
): Promise<void> => {
  let info = '';
  try {
    const res = axios.get<string>(`${config.baseUrl}/services/Version`, {
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
