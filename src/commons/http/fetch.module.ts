import { DynamicModule, Module } from '@nestjs/common';
import { FETCH_CONFIG } from './fetch.constants';
import { FetchService } from './fetch.service';

export interface FetchModuleConfig {
  baseUrl: string;
  headers?: { [key: string]: string };
}

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
