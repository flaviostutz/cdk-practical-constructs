import { petstoreOpenapi } from '../__tests__/petstore';
import { petstoreOpenapiReturnedWso2v1 } from '../__tests__/petstore-wso2';

import { openapiSimilarWso2 } from './wso2-v1';

describe('wso2 v1', () => {
  it('openapi is similar', async () => {
    expect(openapiSimilarWso2(petstoreOpenapi, petstoreOpenapiReturnedWso2v1)).toBeTruthy();
  });
});
