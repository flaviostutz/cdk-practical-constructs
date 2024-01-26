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

export const areAttributeNamesEqual = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj1: Record<string, any> | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj2: Record<string, any> | undefined,
): boolean => {
  // eslint-disable-next-line no-undefined
  if (obj1 === undefined && obj2 === undefined) {
    return true;
  }
  // eslint-disable-next-line no-undefined
  if (obj1 === undefined || obj2 === undefined) {
    return false;
  }
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) {
    return false;
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const key of keys1) {
    if (!keys2.includes(key)) {
      return false;
    }
  }
  // Check if all keys in obj2 are also in obj1
  // eslint-disable-next-line no-restricted-syntax
  for (const key of keys2) {
    if (!keys1.includes(key)) {
      return false;
    }
  }
  return true;
};
