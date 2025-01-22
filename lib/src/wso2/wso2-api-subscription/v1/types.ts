import { ApiFromListV1 } from '../../wso2-api/v1/types';
import { Wso2ApplicationInfo } from '../../wso2-application/v1/types';

export type Subscription = {
  /**
   * The UUID of the subscription
   */
  subscriptionId?: string;

  /**
   * The UUID of the application
   */
  applicationId: string;

  /**
   * The unique identifier of the API.
   */
  apiId?: string;

  apiInfo?: ApiFromListV1;

  applicationInfo?: Wso2ApplicationInfo;

  throttlingPolicy: string;

  requestedThrottlingPolicy?: string;

  status?:
    | 'BLOCKED'
    | 'PROD_ONLY_BLOCKED'
    | 'UNBLOCKED'
    | 'ON_HOLD'
    | 'REJECTED'
    | 'TIER_UPDATE_PENDING';

  /**
   * A url and other parameters the subscriber can be redirected.
   */
  redirectionParams?: string;
};

export type SubscriptionList = {
  /**
   * Number of Subscriptions returned.
   */
  count?: number;
  list?: Array<Subscription>;
  pagination?: Pagination;
};

export type Pagination = {
  offset?: number;
  limit?: number;
  total?: number;
  /**
   * Link to the next subset of resources qualified. Empty if no more resources are to be returned.
   */
  next?: string;
  /**
   * Link to the previous subset of resources qualified. Empty if current subset is the first subset returned.
   */
  previous?: string;
};
