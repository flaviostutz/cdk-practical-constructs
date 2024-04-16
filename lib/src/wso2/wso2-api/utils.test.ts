/* eslint-disable no-undefined */
import { areAttributeNamesEqual, normalizeCorsConfigurationValues } from './utils';
import type { APICorsConfiguration } from './v1/types-swagger';

describe('areAttributeNamesEqual', () => {
  it('should return true for objects with the same attribute names', () => {
    const objA = { name: 'John', age: 30, city: 'New York' };
    const objB = { age: 30, name: 'John', city: 'New York' };

    const result = areAttributeNamesEqual(objA, objB);

    expect(result).toBe(true);
  });

  it('should return false for objects with different attribute names', () => {
    const objA = { name: 'John', age: 30, city: 'New York' };
    const objB = { age: 30, country: 'USA', city: 'New York' };

    const result = areAttributeNamesEqual(objA, objB);

    expect(result).toBe(false);
  });

  it('should return true for both undefined objects', () => {
    const objA = undefined;
    const objB = undefined;

    const result = areAttributeNamesEqual(objA, objB);

    expect(result).toBe(true);
  });
  it('should return false if only one of the objects are undefined', () => {
    const objA = undefined;
    const objB = { test: 'SOMETHING' };

    const result = areAttributeNamesEqual(objA, objB);

    expect(result).toBe(false);
  });

  it('should return false for one undefined object', () => {
    const objA = { name: 'John', age: 30, city: 'New York' };
    const objB = undefined;

    const result = areAttributeNamesEqual(objA, objB);

    expect(result).toBe(false);
  });
});

describe('normalizeCorsConfigurationValues', () => {
  const corsConfiguration: APICorsConfiguration = {
    accessControlAllowOrigins: ['*'],
    accessControlAllowHeaders: [
      'Authorization',
      'Access-Control-Allow-Origin',
      'Content-Type',
      'x-amzn-trace-id',
    ],
    accessControlAllowMethods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    corsConfigurationEnabled: true,
    accessControlAllowCredentials: false,
  };

  const normalizedCorsConfiguration = {
    ...corsConfiguration,
    corsConfigurationEnabled: 'true',
    accessControlAllowCredentials: 'false',
  };

  it('should normalize the CORS values', () => {
    const result = normalizeCorsConfigurationValues(corsConfiguration);
    expect(result).toEqual(normalizedCorsConfiguration);
  });

  it('should not normalize the values if not present', () => {
    const { corsConfigurationEnabled, accessControlAllowCredentials, ...restConfiguration } =
      corsConfiguration;

    const result = normalizeCorsConfigurationValues(restConfiguration);
    expect(result).toEqual(restConfiguration);
  });

  it('should return undefined if configuration is undefined', () => {
    const result = normalizeCorsConfigurationValues(undefined);
    expect(result).toBeUndefined();
  });
});
