import { API } from './types-swagger';

export type PublisherPortalAPIv1 = API;

export type Wso2ApiDefinitionV1 = Omit<PublisherPortalAPIv1, 'createdTime' | 'lastUpdatedTime'>;

// used for queries in publisher and devportal apis
export type DevPortalAPIv1 = PublisherPortalAPIv1 & {
  endpointURLs: [
    {
      environmentName: string;
      environmentType: string;
      URLs?: {
        http: string;
        https: string;
        ws: string;
        wss: string;
      };
      defaultVersionURLs?: {
        http: string;
        https: string;
        ws: string;
        wss: string;
      };
    },
  ];
};

export type Wso2ApiListV1 = {
  count: number;
  list: Array<ApiFromListV1>;
};

export type ApiFromListV1 = Pick<
  PublisherPortalAPIv1,
  'id' | 'name' | 'type' | 'context' | 'version' | 'provider' | 'lifeCycleStatus'
>;
