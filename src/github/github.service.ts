import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { FetchService } from 'src/commons/http/fetch.service';
import { ReleaseDTO } from './dto/release.dto';
import { GithubRepositoryDTO } from './dto/repository.dto';

@Injectable()
export class GithubService {
  constructor(
    private fetchSerice: FetchService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getRepository(
    owner: string,
    repo: string,
  ): Promise<GithubRepositoryDTO> {
    return this.cacheManager.wrap(`/repos/${owner}/${repo}`, async () => {
      const { data } = await this.fetchSerice.get<GithubRepositoryDTO>(
        `/repos/${owner}/${repo}`,
        {},
      );
      return data;
    });
  }

  private getMainRelease(): ReleaseDTO {
    return {
      name: 'main',
      zipball_url:
        'https://github.com/SlimeVR/SlimeVR-Tracker-ESP/archive/refs/heads/main.zip',
      prerelease: false,
      draft: false,
      url: 'https://github.com/SlimeVR/SlimeVR-Tracker-ESP/archive/refs/heads/main.zip',
    };
  }

  async getReleases(owner: string, repo: string): Promise<ReleaseDTO[]> {
    return this.cacheManager.wrap(
      `/repos/${owner}/${repo}/releases`,
      async () => {
        const { data } = await this.fetchSerice.get<ReleaseDTO[]>(
          `/repos/${owner}/${repo}/releases`,
          {},
        );
        return [this.getMainRelease(), ...data];
      },
    );
  }

  async getRelease(
    owner: string,
    repo: string,
    version: string,
  ): Promise<ReleaseDTO> {
    if (version === 'main') {
      return this.getMainRelease();
    }

    return this.cacheManager.wrap(
      `/repos/${owner}/${repo}/releases/tags/${version}`,
      async () => {
        const { data } = await this.fetchSerice.get<ReleaseDTO>(
          `/repos/${owner}/${repo}/releases/tags/${version}`,
          {},
        );
        return data;
      },
      { ttl: 1000 * 60 * 5 },
    );
  }
}
