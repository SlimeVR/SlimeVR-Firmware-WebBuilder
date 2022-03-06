import { CacheModule, Module } from '@nestjs/common';
import { FetchModule } from 'src/commons/http/fetch.module';
import { GithubService } from './github.service';

@Module({
  imports: [
    CacheModule.register(),
    FetchModule.config({ baseUrl: 'https://api.github.com' }),
  ],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
