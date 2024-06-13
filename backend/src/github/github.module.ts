import { Module } from '@nestjs/common';
import { FetchModule } from 'src/commons/http/fetch.module';
import { GithubService } from './github.service';
import { configProvider, configService } from 'src/config/config.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register(),
    FetchModule.config({
      baseUrl: 'https://api.github.com',
      headers: { Authorization: `Basic ${configService.getGitHubAuth()}` },
    }),
  ],
  providers: [GithubService, configProvider],
  exports: [GithubService],
})
export class GithubModule {}
