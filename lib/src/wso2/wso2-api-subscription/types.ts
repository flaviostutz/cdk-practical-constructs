import { Wso2BaseProperties } from '../types';

export type Wso2ApiSubscriptionProps = Wso2BaseProperties & {
  apiId?: string;
  apiSearchParameters?: {
    name: string;
    version: string;
    context: string;
  };
  applicationId?: string;
  applicationSearchParameters?: {
    name: string;
  };
  throttlingPolicy: 'Unlimited' | 'Gold' | 'Silver' | 'Bronze';
};
