import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import nock from 'nock';

export const nockBasicWso2SDK = (baseWso2Url: string): void => {
  const secretMock = mockClient(SecretsManagerClient);
  secretMock.on(GetSecretValueCommand).resolves({
    SecretBinary: Buffer.from(JSON.stringify({ user: 'user1', pwd: 'pwd1' })),
  });

  // register client mock
  nock(baseWso2Url).post('/client-registration/v0.17/register').reply(200, {
    clientId: 'clientId1',
    clientSecret: 'clientSecret1',
  });

  // get token mock
  nock(baseWso2Url).post('/oauth2/token').reply(200, {
    // eslint-disable-next-line camelcase
    access_token: '1111-1111-1111',
  });

  // mock server check
  nock(baseWso2Url)
    .get('/services/Version')
    .reply(
      200,
      '<ns:getVersionResponse xmlns:ns="http://version.services.core.carbon.wso2.org"><return>WSO2 API Manager-3.2.0</return></ns:getVersionResponse>',
    );
};
