/* eslint-disable no-console */
import axios, { AxiosError, AxiosInstance } from 'axios';

export const prepareAxiosLogs = (client: AxiosInstance): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client.interceptors.request.use((config: any) => {
    // eslint-disable-next-line no-param-reassign
    config.metadata = { startTime: new Date().getTime() };
    console.log(`> REQUEST: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    console.log(
      JSON.stringify({
        baseURL: config.baseURL,
        url: config.url,
        params: config.params,
        method: config.method,
        headers: config.headers,
        status: config.status,
        data: config.data,
      }),
    );
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const elapsedTime = new Date().getTime() - response.config.metadata.startTime;
      console.log(`> RESPONSE: ${response.status} (${elapsedTime}ms)`);
      console.log(
        JSON.stringify({
          status: response.status,
          headers: response.headers,
          data: response.data,
        }),
      );
      return response;
    },
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    (error: Error | AxiosError) => {
      if (axios.isAxiosError(error)) {
        console.log(`RESPONSE ERROR: status=${error.response?.status}`);
        console.log(
          JSON.stringify({
            status: error.response?.status,
            headers: error.response?.headers,
            data: error.response?.data,
          }),
        );
      }
      throw error;
    },
  );
};
