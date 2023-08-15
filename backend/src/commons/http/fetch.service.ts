import { Inject, Injectable } from '@nestjs/common';
import { FetchModuleConfig } from './fetch.module';
import fetch, { RequestInit, Response } from 'node-fetch';
import { URL } from 'url';
import { FETCH_CONFIG } from './fetch.constants';

export interface FetchResponse<T> {
  response: Response;
  data: T;
}

@Injectable()
export class FetchService {
  constructor(@Inject(FETCH_CONFIG) private fetchConfig: FetchModuleConfig) {}

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
