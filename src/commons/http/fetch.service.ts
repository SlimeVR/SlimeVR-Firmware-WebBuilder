import { Inject, Injectable } from '@nestjs/common';
import { FetchModuleConfig } from './fetch.module';
import { URL } from 'url';
import { FETCH_CONFIG } from './fetch.constants';

export interface FetchResponse<T> {
  response: Response;
  data: T;
}

@Injectable()
export class FetchService {
  constructor(@Inject(FETCH_CONFIG) private fetchConfig: FetchModuleConfig) {}

  /**
   * Perform a fetch requests with to a specific path and http headers informations
   * if the response payload is JSON it will parse it and return it as an object directly
   *
   * Warning this is not validating the response payload, you should do it yourself
   */
  public async request<T>(
    url: string,
    options: RequestInit,
  ): Promise<FetchResponse<T>> {
    const response = await fetch(url, {
      ...options,
      headers: { ...this.fetchConfig.headers, ...options.headers },
    });

    const data = response.headers
      ?.get('Content-Type')
      ?.includes('application/json')
      ? ((await response.json()) as T)
      : ((await response.text()) as any);

    if (response.status !== 200) throw data;

    return {
      response,
      data,
    };
  }

  /**
   * Perform a post request
   */
  public post<T>(
    url: string,
    params: { [key: string]: string },
    options?: RequestInit,
  ): Promise<FetchResponse<T>> {
    return this.request(new URL(url, this.fetchConfig.baseUrl).toString(), {
      method: 'POST',
      body: new URLSearchParams(params),
      ...options,
    });
  }

  /**
   * Perform a put request
   */
  public put<T>(
    url: string,
    params: { [key: string]: string },
    options?: RequestInit,
  ): Promise<FetchResponse<T>> {
    return this.request(new URL(url, this.fetchConfig.baseUrl).toString(), {
      method: 'PUT',
      body: new URLSearchParams(params),
      ...options,
    });
  }

  /**
   * Perform a get request
   */
  public get<T>(
    url: string,
    params: { [key: string]: string },
    options?: RequestInit,
  ): Promise<FetchResponse<T>> {
    const reqUrl = new URL(url, this.fetchConfig.baseUrl);
    reqUrl.search = new URLSearchParams(params).toString();

    return this.request(reqUrl.toString(), {
      method: 'GET',
      ...options,
    });
  }
}
