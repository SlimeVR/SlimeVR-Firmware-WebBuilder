import { DynamicModule, Module } from '@nestjs/common';
import { FETCH_CONFIG } from './fetch.constants';
import { FetchService } from './fetch.service';

export interface FetchModuleConfig {
  baseUrl: string;
  headers?: { [key: string]: string };
}

/**
 * Utitity module to do fetch requests, each api we use to fetch things
 * should have its own module with utility functions, and use this module
 * with the right config. You can look at the github module
 */
@Module({})
export class FetchModule {
  static config(config: FetchModuleConfig): DynamicModule {
    return {
      module: FetchModule,
      providers: [
        {
          provide: FETCH_CONFIG,
          useValue: config,
        },
        FetchService,
      ],
      exports: [FetchService],
    };
  }
}
