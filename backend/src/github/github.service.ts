import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { FetchService } from 'src/commons/http/fetch.service';
import { AVAILABLE_FIRMWARE_REPOS } from 'src/firmware/firmware.constants';
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
    return this.cacheManager.wrap(
      `/repos/${owner}/${repo}`,
      async () => {
        const { data } = await this.fetchSerice.get<GithubRepositoryDTO>(
          `/repos/${owner}/${repo}`,
          {},
        );
        return data;
      },
      { ttl: 5 * 60 },
    );
  }

  private async getBranchRelease(
    owner: string,
    repo: string,
    branch: string = 'main',
  ): Promise<ReleaseDTO> {
    return this.cacheManager.wrap(
      `/repos/${owner}/${repo}/branches/${branch}`,
      async () => {
        const {
          data: {
            commit: { sha },
          },
        } = await this.fetchSerice.get<{ commit: { sha: string } }>(
          `/repos/${owner}/${repo}/branches/${branch}`,
          {},
        );

        return {
          id: sha,
          name: `${owner}/${branch}`,
          zipball_url:
            `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`,
          prerelease: false,
          draft: false,
          url: `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`,
        };
      },
      { ttl: 5 * 60 },
    );
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
          ...data
            .map(({ id, url, prerelease, draft, name, zipball_url }) => ({
              id: `${id}`,
              url,
              prerelease,
              draft,
              name: `${owner}/${name}`,
              zipball_url,
            }))
            .filter(
              ({ name }) => !['SlimeVR/v0.2.0', 'SlimeVR/v0.2.1', 'SlimeVR/v0.2.2'].includes(name),
            ),
        ];
      },
      { ttl: 5 * 60 },
    );
  }

  async getAllReleases(): Promise<ReleaseDTO[]> {
    const releases: ReleaseDTO[] = [];

    
    for (let [owner, repos] of Object.entries(AVAILABLE_FIRMWARE_REPOS)) {
      for (let [repo, branches] of Object.entries(repos)) {
        // Get all repo releases
        releases.push(...await this.getReleases(owner, repo));

        // Get each branch as a release version
        for (let branch of branches) {
          releases.push(await this.getBranchRelease(owner, repo, branch));
        }
      }
    }

    return releases;
  }

  async getRelease(
    owner: string,
    repo: string,
    version: string,
  ): Promise<ReleaseDTO> {
    // TODO: Replace this with a part of the request indicating whether this is a branch or a release
    // If there's a matching owner
    let ownerRepos = AVAILABLE_FIRMWARE_REPOS[owner];
    if (ownerRepos !== undefined) {
      // And a matching repo
      let repoBranches = ownerRepos[repo];
      if (repoBranches !== undefined) {
        // And a matching branch
        if (repoBranches.includes(version)) {
          // Then return the branch release instead of looking for a version
          return this.getBranchRelease(owner, repo, version);
        }
      }
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
        return { id: `${id}`, url, prerelease, draft, name: `${owner}/${name}`, zipball_url }; //TODO: complete this
      },
      { ttl: 5 * 60 },
    );
  }
}
