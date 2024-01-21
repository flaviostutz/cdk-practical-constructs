import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export const getSecretValue = async (secretId: string): Promise<string> => {
  const client = new SecretsManagerClient({ region: 'eu-west-1' });
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretId,
    }),
  );
  if (response.SecretString) {
    return response.SecretString;
  }
  if (!response.SecretBinary) {
    throw new Error('Invalid type of secret found');
  }
  const buff = Buffer.from(response.SecretBinary);
  return buff.toString('ascii');
};

export const getHeaders = (
  tenant: string | undefined,
): { 'X-WSO2-Tenant'?: string | undefined; 'Content-Type'?: string | undefined } => {
  if (tenant) {
    return {
      'X-WSO2-Tenant': tenant,
      'Content-Type': 'application/json',
    };
  }
  return {};
};
