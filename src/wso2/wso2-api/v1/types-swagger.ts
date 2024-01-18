/**
 * These types were derived from the swagger schema of WSO2 3.2.0
 * (we manually converted a few interfaces from wso2apim-sdk lib to types here)
 * Lots of docs and type tweaks were done manually, so this is not strictly derived from the generated schema code
 */

/** API object */
export type API = {
  /**
   * @description UUID of the api registry artifact
   *
   * @example 01234567-0123-0123-0123-012345678901
   */
  id?: string;
  /**
   * Name of the API. Use a simple name without spaces
   * @example PizzaShackAPI
   * */
  name: string;
  /** @example This is a simple API for Pizza Shack online pizza delivery store. */
  description?: string;
  /**
   * URL context of this API in WSO2 server. Will be used as a prefix in the URL
   * @example pizza
   * */
  context: string;
  /**
   * Version of the API
   * @example v1
   * */
  version: string;
  /**
   * @description If the provider value is not given user invoking the api will be used as the provider.
   *
   * @example admin
   */
  provider?: string;
  /**
   * @example CREATED
   * @default CREATED
   * */
  lifeCycleStatus?: string;
  wsdlInfo?: WSDLInfo;
  /** @example /apimgt/applicationdata/wsdls/admin--soap1.wsdl */
  wsdlUrl?: string;
  /** @example 8swdwj9080edejhj */
  testKey?: string;
  /** @example true */
  responseCachingEnabled?: boolean;
  /** @example 300 */
  cacheTimeout?: number;
  /** @example Disabled */
  destinationStatsEnabled?: string;
  /** @example false */
  hasThumbnail?: boolean;
  /**
   * @example false
   * @default true */
  isDefaultVersion?: boolean;
  /**
   * Enable schema validation of API calls
   * @example false
   */
  enableSchemaValidation?: boolean;
  /**
   * @example true
   * @default true
   */
  enableStore?: boolean;
  /**
   * @description The api creation type to be used. Accepted values are HTTP, WS, SOAPTOREST, GRAPHQL
   * @default HTTP
   * @example HTTP
   * @enum {string}
   */
  type?: 'HTTP' | 'WS' | 'SOAPTOREST' | 'SOAP' | 'GRAPHQL';
  /**
   * @description Supported transports for the API (http and/or https).
   *
   * @example [
   *   "http",
   *   "https"
   * ]
   * @default ['https']
   */
  transport?: string[];
  /**
   * @example [
   *   "pizza",
   *   "food"
   * ]
   */
  tags?: string[];
  /**
   * @example [
   *   "Unlimited"
   * ]
   * @default ['Unlimited']
   */
  policies?: string[];
  /**
   * @description The API level throttling policy selected for the particular API
   * @example Unlimited
   * @default Unlimited
   */
  apiThrottlingPolicy?: string;
  /**
   * @description Name of the Authorization header used for invoking the API. If it is not set, Authorization header name specified
   * in tenant or system level will be used.
   *
   * @example Authorization
   */
  authorizationHeader?: string;
  /**
   * @description Types of API security, the current API secured with. It can be either OAuth2 or mutual SSL or both. If
   * it is not set OAuth2 will be set as the security for the current API.
   *
   * @example [
   *   "oauth2",
   *   "basic",
   *   "mutualssl",
   *   "mutualssl_mandatory"
   * ]
   * Defaults to ["oauth2"]
   */
  securityScheme?: string[];
  maxTps?: APIMaxTps;
  /**
   * @description The visibility level of the API. Accepts one of the following. PUBLIC, PRIVATE, RESTRICTED.
   * @default PUBLIC
   * @example PUBLIC
   * @enum {string}
   */
  visibility?: 'PUBLIC' | 'PRIVATE' | 'RESTRICTED';
  /**
   * @description The user roles that are able to access the API in Store
   * @example []
   */
  visibleRoles?: string[];
  /** @example [] */
  visibleTenants?: string[];
  endpointSecurity?: APIEndpointSecurity;
  /**
   * @description List of gateway environments the API is available
   *
   * @example [
   *   "Production and Sandbox"
   * ]
   */
  gatewayEnvironments?: string[];
  /** @description List of selected deployment environments and clusters */
  deploymentEnvironments?: DeploymentEnvironments[];
  /**
   * @description Labels of micro-gateway environments attached to the API.
   *
   * @example []
   */
  labels?: string[];
  /**
   * @example [
   *   {
   *     "name": "json_to_xml_in_message",
   *     "type": "in"
   *   },
   *   {
   *     "name": "xml_to_json_out_message",
   *     "type": "out"
   *   },
   *   {
   *     "name": "json_fault",
   *     "type": "fault"
   *   }
   * ]
   */
  mediationPolicies?: MediationPolicy[];
  /**
   * @description The subscription availability. Accepts one of the following. CURRENT_TENANT, ALL_TENANTS or SPECIFIC_TENANTS.
   * @default CURRENT_TENANT
   * @example CURRENT_TENANT
   * @enum {string}
   */
  subscriptionAvailability?: 'CURRENT_TENANT' | 'ALL_TENANTS' | 'SPECIFIC_TENANTS';
  /** @example [] */
  subscriptionAvailableTenants?: string[];
  /** @description Map of custom properties of API */
  additionalProperties?: { [key: string]: string };
  monetization?: APIMonetizationInfo;
  /**
   * @description Is the API is restricted to certain set of publishers or creators or is it visible to all the
   * publishers and creators. If the accessControl restriction is none, this API can be modified by all the
   * publishers and creators, if not it can only be viewable/modifiable by certain set of publishers and creators,
   *  based on the restriction.
   *
   * @default NONE
   * @enum {string}
   */
  accessControl?: 'NONE' | 'RESTRICTED';
  /**
   * @description The user roles that are able to view/modify as API publisher or creator.
   * @example []
   */
  accessControlRoles?: string[];
  businessInformation?: APIBusinessInformation;
  corsConfiguration?: APICorsConfiguration;
  /** @example APPROVED */
  workflowStatus?: string;
  /** @example 2017-02-20T13:57:16.229Z */
  createdTime?: string;
  /** @example 2017-02-20T13:57:16.229Z */
  lastUpdatedTime?: string;
  /**
   * @description Endpoint configuration of the API. This can be used to provide different types of endpoints including Simple REST Endpoints, Loadbalanced and Failover.
   *
   * `Simple REST Endpoint`
   *   {
   *     "endpoint_type": "http",
   *     "sandbox_endpoints":       {
   *        "url": "https://localhost:9443/am/sample/pizzashack/v1/api/"
   *     },
   *     "production_endpoints":       {
   *        "url": "https://localhost:9443/am/sample/pizzashack/v1/api/"
   *     }
   *   }
   *
   * `Loadbalanced Endpoint`
   *
   *   {
   *     "endpoint_type": "load_balance",
   *     "algoCombo": "org.apache.synapse.endpoints.algorithms.RoundRobin",
   *     "sessionManagement": "",
   *     "sandbox_endpoints":       [
   *                 {
   *           "url": "https://localhost:9443/am/sample/pizzashack/v1/api/1"
   *        },
   *                 {
   *           "endpoint_type": "http",
   *           "template_not_supported": false,
   *           "url": "https://localhost:9443/am/sample/pizzashack/v1/api/2"
   *        }
   *     ],
   *     "production_endpoints":       [
   *                 {
   *           "url": "https://localhost:9443/am/sample/pizzashack/v1/api/3"
   *        },
   *                 {
   *           "endpoint_type": "http",
   *           "template_not_supported": false,
   *           "url": "https://localhost:9443/am/sample/pizzashack/v1/api/4"
   *        }
   *     ],
   *     "sessionTimeOut": "",
   *     "algoClassName": "org.apache.synapse.endpoints.algorithms.RoundRobin"
   *   }
   *
   * `Failover Endpoint`
   *
   *   {
   *     "production_failovers":[
   *        {
   *           "endpoint_type":"http",
   *           "template_not_supported":false,
   *           "url":"https://localhost:9443/am/sample/pizzashack/v1/api/1"
   *        }
   *     ],
   *     "endpoint_type":"failover",
   *     "sandbox_endpoints":{
   *        "url":"https://localhost:9443/am/sample/pizzashack/v1/api/2"
   *     },
   *     "production_endpoints":{
   *        "url":"https://localhost:9443/am/sample/pizzashack/v1/api/3"
   *     },
   *     "sandbox_failovers":[
   *        {
   *           "endpoint_type":"http",
   *           "template_not_supported":false,
   *           "url":"https://localhost:9443/am/sample/pizzashack/v1/api/4"
   *        }
   *     ]
   *   }
   *
   * `Default Endpoint`
   *
   *   {
   *     "endpoint_type":"default",
   *     "sandbox_endpoints":{
   *        "url":"default"
   *     },
   *     "production_endpoints":{
   *        "url":"default"
   *     }
   *   }
   *
   * `Endpoint from Endpoint Registry`
   *   {
   *     "endpoint_type": "Registry",
   *     "endpoint_id": "{registry-name:entry-name:version}",
   *   }
   *
   * @example {
   *   "endpoint_type": "http",
   *   "sandbox_endpoints": {
   *     "url": "https://localhost:9443/am/sample/pizzashack/v1/api/"
   *   },
   *   "production_endpoints": {
   *     "url": "https://localhost:9443/am/sample/pizzashack/v1/api/"
   *   },
   *   "endpoint_security": {
   *     "sandbox": {
   *       "password": null,
   *       "tokenUrl": "http://localhost:9443/token",
   *       "clientId": "cid123",
   *       "clientSecret": "cs123",
   *       "customParameters": {},
   *       "type": "OAUTH",
   *       "grantType": "CLIENT_CREDENTIALS",
   *       "enabled": true,
   *       "username": null
   *     },
   *     "production": {
   *       "password": null,
   *       "tokenUrl": "http://localhost:9443/token",
   *       "clientId": "cid123",
   *       "clientSecret": "cs123",
   *       "customParameters": {},
   *       "type": "OAUTH",
   *       "grantType": "CLIENT_CREDENTIALS",
   *       "enabled": true,
   *       "username": null
   *     }
   *   }
   * }
   */
  endpointConfig?:
    | ({ endpoint_type: 'http' } & EndpointHttp)
    | ({ endpoint_type: 'load_balance' } & EndpointLoadBalance)
    | ({ endpoint_type: 'failover' } & EndpointFailover)
    | ({ endpoint_type: 'default' } & EndpointHttp);

  /**
   * @default ENDPOINT
   * @example INLINE
   * @enum {string}
   */
  endpointImplementationType?: 'INLINE' | 'ENDPOINT';
  scopes?: APIScope[];
  /**
   * @example [
   *   {
   *     "target": "/order/{orderId}",
   *     "verb": "POST",
   *     "authType": "Application & Application User",
   *     "throttlingPolicy": "Unlimited"
   *   },
   *   {
   *     "target": "/menu",
   *     "verb": "GET",
   *     "authType": "Application & Application User",
   *     "throttlingPolicy": "Unlimited"
   *   }
   * ]
   */
  operations?: APIOperations[];
  threatProtectionPolicies?: {
    list?: {
      policyId?: string;
      priority?: number;
    }[];
  };
  /**
   * @description API categories
   *
   * @example []
   */
  categories?: string[];
  /** @description API Key Managers */
  keyManagers?: { [key: string]: unknown };
};

export type WSDLInfo = {
  /**
   * @description Indicates whether the WSDL is a single WSDL or an archive in ZIP format
   * @enum {string}
   */
  type?: 'WSDL' | 'ZIP';
};

/** Operation */
export type APIOperations = {
  /** @example postapiresource */
  id?: string;
  /** @example /order/{orderId} */
  target?: string;
  /** @example POST */
  verb?: string;
  /**
   * @default Any
   * @example Application & Application User
   */
  authType?: string;
  /** @example Unlimited */
  throttlingPolicy?: string;
  /** @example [] */
  scopes?: string[];
  /** @example [] */
  usedProductIds?: string[];
  /** @example */
  amznResourceName?: string;
  amznResourceTimeout?: number;
};

/**
 * Max API invocations per second
 */
export type APIMaxTps = {
  /**
   * @example 1000
   * @default 300
   */
  production?: number;
  /**
   * Max API invocations per second in sandbox
   * Format: int64
   * @example 1000
   * @default 10
   */
  sandbox?: number;
};

/** APIScope */
export type APIScope = {
  scope: Scope;
  /**
   * @description States whether scope is shared. This will not be honored when updating/adding scopes to APIs or when
   * adding/updating Shared Scopes.
   *
   * @example true
   */
  shared?: boolean;
};

export type APICorsConfiguration = {
  /** @default false */
  corsConfigurationEnabled?: boolean;
  accessControlAllowOrigins?: string[];
  /** @default false */
  accessControlAllowCredentials?: boolean;
  accessControlAllowHeaders?: string[];
  accessControlAllowMethods?: string[];
};

/** Scope */
export type Scope = {
  /**
   * @description UUID of the Scope. Valid only for shared scopes.
   *
   * @example 01234567-0123-0123-0123-012345678901
   */
  id?: string;
  /**
   * @description name of Scope
   *
   * @example apim:api_view
   */
  name: string;
  /**
   * @description display name of Scope
   *
   * @example api_view
   */
  displayName?: string;
  /**
   * @description description of Scope
   *
   * @example This Scope can used to view Apis
   */
  description?: string;
  /**
   * @description role bindings list of the Scope
   *
   * @example [
   *   "admin",
   *   "Internal/creator",
   *   "Internal/publisher"
   * ]
   */
  bindings?: string[];
  /**
   * @description usage count of Scope
   *
   * @example 3
   */
  usageCount?: number;
};

export type APIBusinessInformation = {
  /** @example businessowner */
  businessOwner?: string;
  /** @example businessowner@wso2.com */
  businessOwnerEmail?: string;
  /** @example technicalowner */
  technicalOwner?: string;
  /** @example technicalowner@wso2.com */
  technicalOwnerEmail?: string;
};

export type APIMonetizationInfo = {
  /**
   * @description Flag to indicate the monetization status
   * @example true
   */
  enabled: boolean;
  /** @description Map of custom properties related to monetization */
  properties?: { [key: string]: string };
};

export type APIEndpointSecurity = {
  /**
   * @description Accepts one of the following, basic or digest.
   * @example BASIC
   * @enum {string}
   */
  type?: 'BASIC' | 'DIGEST';
  /** @example admin */
  username?: string;
  /** @example password */
  password?: string;
};

/** DeploymentEnvironments */
export type DeploymentEnvironments = {
  /** @example Kubernetes */
  type: string;
  /**
   * @example [
   *   "minikube"
   * ]
   */
  clusterName: string[];
};

/** Mediation Policy */
export type MediationPolicy = {
  /** @example 69ea3fa6-55c6-472e-896d-e449dd34a824 */
  id?: string;
  /** @example log_in_message */
  name: string;
  /** @example in */
  type?: string;
  /** @example true */
  shared?: boolean;
};

export type EndpointTarget = {
  endpoint_type?: string;
  template_not_supported?: boolean;
  url: string;
};

export type EndpointHttp = {
  endpoint_type: 'http';
  sandbox_endpoints: {
    url: string;
  };
  production_endpoints: {
    url: string;
  };
};

export type EndpointFailover = {
  endpoint_type: 'failover';
  sandbox_endpoints: {
    url: string;
  };
  production_endpoints: {
    url: string;
  };
  production_failovers: [EndpointTarget];
  sandbox_failovers: [EndpointTarget];
};

export type EndpointLoadBalance = {
  endpoint_type: 'load_balance';
  algoCombo: 'org.apache.synapse.endpoints.algorithms.RoundRobin';
  sessionManagement: 'None' | 'Transport' | 'SOAP' | 'ClientID';
  sandbox_endpoints: [EndpointTarget];
  production_endpoints: [EndpointTarget];
  /**
   * Session timeout in milliseconds
   */
  sessionTimeOut: number;
  algoClassName: 'org.apache.synapse.endpoints.algorithms.RoundRobin';
};
