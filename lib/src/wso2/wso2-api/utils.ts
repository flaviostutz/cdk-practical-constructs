import type { APICorsConfiguration } from './v1/types-swagger';

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

type NormalizedCorsConfiguration = Omit<
  APICorsConfiguration,
  'corsConfigurationEnabled' | 'accessControlAllowCredentials'
> & {
  corsConfigurationEnabled?: string;
  accessControlAllowCredentials?: string;
};

/**
 * This functions normalizes the CORS values by stringifying the values
 */
export const normalizeCorsConfigurationValues = (
  corsConfiguration?: APICorsConfiguration,
): undefined | NormalizedCorsConfiguration => {
  const corsConfigurationObject = objectWithContentOrUndefined(corsConfiguration);
  if (!corsConfigurationObject) {
    // eslint-disable-next-line no-undefined
    return undefined;
  }

  const { corsConfigurationEnabled, accessControlAllowCredentials, ...restCorsConfiguration } =
    corsConfigurationObject;

  return {
    ...restCorsConfiguration,
    ...(typeof corsConfigurationEnabled === 'boolean' && {
      corsConfigurationEnabled: String(corsConfigurationEnabled),
    }),
    ...(typeof accessControlAllowCredentials === 'boolean' && {
      accessControlAllowCredentials: String(accessControlAllowCredentials),
    }),
  };
};

/**
 * This function checks if the object has content or nor and only returns the object if it has content
 */
export const objectWithContentOrUndefined = <T>(obj: T): T | undefined => {
  if (!obj || typeof obj !== 'object' || !Object.keys(obj).length) {
    // eslint-disable-next-line no-undefined
    return undefined;
  }
  return obj;
};
