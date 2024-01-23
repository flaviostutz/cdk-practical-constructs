import https from 'https';

import axios from 'axios';
import qs from 'qs';

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
