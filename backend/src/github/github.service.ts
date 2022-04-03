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

  private async getMainRelease(
    owner: string,
    repo: string,
  ): Promise<ReleaseDTO> {
    //https://api.github.com/repos/SlimeVR/SlimeVR-Tracker-ESP/branches/main
    const {
      data: {
        commit: { sha },
      },
    } = await this.fetchSerice.get<{ commit: { sha: string } }>(
      `/repos/${owner}/${repo}/branches/main`,
      {},
    );

    return {
      id: sha,
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
        return [
          await this.getMainRelease(owner, repo),
          ...data.map(({ id, url, prerelease, draft, name, zipball_url }) => ({
            id: `${id}`,
            url,
            prerelease,
            draft,
            name,
            zipball_url,
          })),
        ];
      },
      // { ttl: 60 * 5 * 1000 }
    );
  }

  async getRelease(
    owner: string,
    repo: string,
    version: string,
  ): Promise<ReleaseDTO> {
    if (version === 'main') {
      return await this.getMainRelease(owner, repo);
    }

    return this.cacheManager.wrap(
      `/repos/${owner}/${repo}/releases/tags/${version}`,
      async () => {
        const {
          data: { id, url, prerelease, draft, name, zipball_url },
        } = await this.fetchSerice.get<ReleaseDTO>(
          `/repos/${owner}/${repo}/releases/tags/${version}`,
          {},
        );
        return { id: `${id}`, url, prerelease, draft, name, zipball_url }; //TODO: complete this
      },
      { ttl: 0 },
    );
  }
}
