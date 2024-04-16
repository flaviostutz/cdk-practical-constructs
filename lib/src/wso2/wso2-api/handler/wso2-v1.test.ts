/* eslint-disable camelcase */
import { petstoreOpenapi, wso2ConstructApiDefinition } from '../__tests__/petstore';
import {
  petstoreFetchDataWso2Api,
  petstoreOpenapiReturnedWso2v1,
} from '../__tests__/petstore-wso2';
import { normalizeCorsConfigurationValues } from '../utils';
import type { PublisherPortalAPIv1, Wso2ApiDefinitionV1 } from '../v1/types';

import { openapiSimilarWso2, checkWSO2Equivalence } from './wso2-v1';

describe('wso2 v1', () => {
  describe('openapiSimilarWso2', () => {
    it('openapi is similar', async () => {
      expect(openapiSimilarWso2(petstoreOpenapi, petstoreOpenapiReturnedWso2v1)).toBeTruthy();
    });

    it('openapi is similar without wso2 server', async () => {
      const { servers, ...restPetstoreOpenapiReturnedWso2v1 } = petstoreOpenapiReturnedWso2v1;
      expect(openapiSimilarWso2(petstoreOpenapi, restPetstoreOpenapiReturnedWso2v1)).toBeTruthy();
    });
  });

  describe('checkWSO2Equivalence', () => {
    it('should check the equivalence', () => {
      const result = checkWSO2Equivalence(petstoreFetchDataWso2Api, wso2ConstructApiDefinition);
      expect(result.isEquivalent).toBeTruthy();
    });

    it.each<{
      testName: string;
      propertyName: keyof PublisherPortalAPIv1;
      constructData: Wso2ApiDefinitionV1;
    }>([
      {
        testName: 'businessInformation is different',
        propertyName: 'businessInformation',
        constructData: {
          ...wso2ConstructApiDefinition,
          businessInformation: {
            ...wso2ConstructApiDefinition.businessInformation,
            businessOwner: 'new businees owner',
          },
        },
      },
      {
        testName: 'endpointConfig is different',
        propertyName: 'endpointConfig',
        constructData: {
          ...wso2ConstructApiDefinition,
          endpointConfig: {
            production_endpoints: {
              url: 'http://newserver.com',
            },
            endpoint_type: 'http',
          },
        },
      },
      {
        testName: 'additionalProperties is different',
        propertyName: 'additionalProperties',
        constructData: {
          ...wso2ConstructApiDefinition,
          additionalProperties: {
            extraProperty: 'updated property',
          },
        },
      },
      {
        testName: 'additionalProperties has new properties',
        propertyName: 'additionalProperties',
        constructData: {
          ...wso2ConstructApiDefinition,
          additionalProperties: {
            ...wso2ConstructApiDefinition.additionalProperties,
            newProperty: 'new property',
          },
        },
      },
      {
        testName: 'additionalProperties is different',
        propertyName: 'additionalProperties',
        constructData: {
          ...wso2ConstructApiDefinition,
          additionalProperties: {
            extraProperty: 'updated property',
          },
        },
      },
    ])(
      'should return not equivalent when $testName is different',
      ({ propertyName, constructData }) => {
        const result = checkWSO2Equivalence(petstoreFetchDataWso2Api, constructData);
        expect(result.isEquivalent).toBeFalsy();
        expect(result.failedChecks).toEqual([
          {
            name: propertyName,
            data: {
              inWso2: petstoreFetchDataWso2Api[propertyName],
              toBeDeployed: constructData[propertyName as keyof Wso2ApiDefinitionV1],
            },
          },
        ]);
      },
    );

    it('should return not equivalent for cors configuration', () => {
      const constructData = {
        ...wso2ConstructApiDefinition,
        corsConfiguration: {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ...wso2ConstructApiDefinition.corsConfiguration!,
          accessControlAllowHeaders: [
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            ...wso2ConstructApiDefinition.corsConfiguration!.accessControlAllowHeaders!,
            'x-custom-header',
          ],
        },
      };

      const result = checkWSO2Equivalence(petstoreFetchDataWso2Api, constructData);
      expect(result.isEquivalent).toBeFalsy();
      expect(result.failedChecks).toEqual([
        {
          name: 'corsConfiguration',
          data: {
            inWso2: normalizeCorsConfigurationValues(petstoreFetchDataWso2Api.corsConfiguration),
            toBeDeployed: constructData.corsConfiguration,
          },
        },
      ]);
    });
  });
});
