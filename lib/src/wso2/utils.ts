/* eslint-disable no-console */
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { RetryOptions } from './types';

const defaultRetryOpts = {
  checkRetries: {
    startingDelay: 500,
    delayFirstAttempt: true,
    maxDelay: 10000,
    numOfAttempts: 10,
    timeMultiple: 1.5,
    // 500, 750, 1125, 1687 (4s), 2531, 3796, 5696 (16s), 8542 (24s), 10000, 10000, 10000, 10000, 10000 (74s)
  },
  mutationRetries: {
    startingDelay: 2000,
    delayFirstAttempt: false,
    maxDelay: 5000,
    numOfAttempts: 3,
    timeMultiple: 1.5,
    // 2000, 3000
  },
};

export const applyRetryDefaults = (retryOptions?: RetryOptions): RetryOptions => {
  const ropts: RetryOptions = {
    // default config for backoff
    ...defaultRetryOpts,
  };

  if (retryOptions?.checkRetries) {
    ropts.checkRetries = retryOptions?.checkRetries;
  }
  if (retryOptions?.mutationRetries) {
    ropts.mutationRetries = retryOptions?.mutationRetries;
  }

  if (ropts.checkRetries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ropts.checkRetries.retry = (err: any, attemptNumber: number): boolean => {
      console.log(`Error detected. err=${err}`);
      console.log(`Retrying check (#${attemptNumber})...`);
      return true;
    };
  }
  if (ropts.mutationRetries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ropts.mutationRetries.retry = (err: any, attemptNumber: number): boolean => {
      console.log(`Error detected. err=${err}`);
      console.log(`Retrying mutation (#${attemptNumber})...`);
      return true;
    };
  }
  return ropts;
};

export const truncateStr = (str: string, size: number): string => {
  return str.substring(0, Math.min(str.length, size));
};

export const getSecretValue = async (secretId: string): Promise<string> => {
  const client = new SecretsManagerClient();
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
