import { API } from './types-swagger';

export type APIv1 = API;

export type Wso2ApiDefinitionV1 = Omit<APIv1, 'createdTime' | 'lastUpdatedTime'>;

// used for queries in publisher and devportal apis
export type APIv1DevPortal = APIv1 & {
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
  list: Array<APIv1>;
};
