import { Wso2ApiProps } from './types';

export const validateAndPrepareProps = (props: Wso2ApiProps): Wso2ApiProps => {
  if (!props.wso2ApiBaseUrl) throw new Error('wso2ApiBaseUrl is required');
  if (!props.wso2CredentialsSecretManagerArn) {
    throw new Error('wso2CredentialsSecretManagerArn is required');
  }

  const apiDef = props.apiDefinition;
  if (!apiDef.context) {
    throw new Error('context is required (is used in api url formation)');
  }
  if (!apiDef.name) {
    throw new Error('name is required');
  }
  if (!apiDef.gatewayEnvironments || apiDef.gatewayEnvironments.length === 0) {
    throw new Error('gatewayEnvironments must have at least one element');
  }

  // If cors was defined only with "origins", use a default configuration for the rest of the definition
  // this is to make it easier to define an api with default cors configurations
  const corsConfig = apiDef.corsConfiguration;
  if (corsConfig) {
    if (corsConfig.accessControlAllowOrigins) {
      corsConfig.accessControlAllowCredentials = corsConfig.accessControlAllowCredentials ?? false;
      // default WSO2 cors config
      corsConfig.accessControlAllowHeaders = corsConfig.accessControlAllowHeaders ?? [
        'Authorization',
        'Access-Control-Allow-Origin',
        'Content-Type',
        'SOAPAction',
      ];
      // default WSO2 cors config
      corsConfig.accessControlAllowMethods = corsConfig.accessControlAllowMethods ?? [
        'GET',
        'PUT',
        'POST',
        'DELETE',
        'PATCH',
        'OPTIONS',
      ];
      corsConfig.corsConfigurationEnabled =
        typeof corsConfig.corsConfigurationEnabled === 'boolean'
          ? corsConfig.corsConfigurationEnabled
          : true;
    }
  }

  validateVisibility(apiDef);

  return props;
};

const validateVisibility = (apiDef: Wso2ApiDefinition): void => {
  if (apiDef.subscriberVisibility) {
    if (!['RESTRICTED', 'PRIVATE', 'PUBLIC'].includes(apiDef.subscriberVisibility)) {
      throw new Error('subscriberVisibility must be RESTRICTED, PRIVATE or PUBLIC');
    }
    if (apiDef.subscriberVisibility === 'RESTRICTED') {
      if (
        !Array.isArray(apiDef.subscriberVisibilityRoles) ||
        apiDef.subscriberVisibilityRoles.length === 0
      ) {
        throw new Error(
          'subscriberVisibilityRoles must be defined when subscriberVisibility is RESTRICTED',
        );
      }
    }
  }

  if (apiDef.publisherVisibility) {
    if (!['RESTRICTED', 'PRIVATE'].includes(apiDef.publisherVisibility)) {
      throw new Error('publisherVisibility must be RESTRICTED or PRIVATE');
    }
    if (apiDef.publisherVisibility === 'RESTRICTED') {
      if (
        !Array.isArray(apiDef.publisherVisibilityRoles) ||
        apiDef.publisherVisibilityRoles.length === 0
      ) {
        throw new Error(
          'publisherVisibilityRoles must be defined when publisherVisibility is RESTRICTED',
        );
      }
    }
  }
};
