import { publisher } from 'wso2apim-sdk';
import type { oas30 } from 'openapi3-ts';

export type Wso2ApiProps = {
  /**
   * Entry in Secret Manager with secret json with contents "{ user: 'myuser', pwd: 'mypass' }"
   */
  wso2CredentialsSecretManagerArn: string;
  wso2BaseUrl: string;
  wso2ApiDefinition: Wso2ApiDefinition;
  openapiDocument: oas30.OpenAPIObject;
};

export type API = publisher.definitions['API'];

export type Wso2ApiDefinition = API & {
  subscriberVisibility?: 'RESTRICTED' | 'PRIVATE' | 'PUBLIC';
  subscriberVisibilityRoles?: string[];
  publisherVisibility?: 'RESTRICTED' | 'PRIVATE';
  publisherVisibilityRoles?: string[];
};
