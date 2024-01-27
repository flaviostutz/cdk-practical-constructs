/* eslint-disable no-undefined */
import { areAttributeNamesEqual } from './utils';

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
