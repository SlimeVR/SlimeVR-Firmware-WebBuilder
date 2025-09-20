import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { FetchService } from 'src/commons/http/fetch.service';
import { AVAILABLE_FIRMWARE_REPOS } from 'src/firmware/firmware.constants';
import { ReleaseDTO } from './dto/release.dto';
import { GithubRepositoryDTO } from './dto/repository.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import semver from 'semver';

@Injectable()
export class GithubService {
  constructor(
    private fetchSerice: FetchService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get informations about a github repository
   *
   * This function use caching, TTL 5min
   *
   * @param owner owner of the repository
   * @param repo name of the repository
   * @returns GithubRepositoryDTO informations about the requested repository
   */
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
      5 * 60 * 1000,
    );
  }

  /**
   *
   * Get the release inforamations of a repository branch
   *
   * This function use caching, TTL 5min
   *
   * @param owner owner of the repository
   * @param repo name of the repository
   * @param branch branch inside the repository
   * @returns ReleaseDTO informations about the release made with that branch
   */
  public async getBranchRelease(
    owner: string,
    repo: string,
    branch = 'main',
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
          zipball_url: `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`,
          prerelease: false,
          draft: false,
          url: `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`,
        };
      },
      5 * 60 * 1000,
    );
  }

  /**
   *
   * Get all the releases of a repository
   *
   * This function use caching, TTL 5min
   *
   *
   * @param owner owner of the repository
   * @param repo name of the repository
   * @returns An array of ReleaseDTO, the list of all the releases inside the repo
   */
  async getReleases(owner: string, repo: string): Promise<ReleaseDTO[]> {
    return this.cacheManager.wrap(
      `/repos/${owner}/${repo}/releases`,
      async () => {
        const { data } = await this.fetchSerice.get<ReleaseDTO[]>(
          `/repos/${owner}/${repo}/releases`,
          {},
        );
        const res = data
            .map(({ id, url, prerelease, draft, name, zipball_url }) => ({
              id: `${id}`,
              url,
              prerelease,
              draft,
              name: `${owner}/${name}`,
              zipball_url,
            }))
            .filter(({ name, draft }) => {
              if (draft) return false;
              if (!name.startsWith('SlimeVR/')) return true;

              const version = name.substring('SlimeVR/v'.length);

              return (
                semver.satisfies(version, '>=0.2.3') &&
                !semver.satisfies(version, '0.5.0 - 0.5.2')
              );
            })
        return [...res];
      },
      5 * 60 * 1000,
    );
  }

  /**
   *
   * Get the release information of a repository from its name
   *
   * This function use caching, TTL 5min
   *
   * @param owner owner of the repository
   * @param repo name of the repository
   * @param version version tag of the release
   * @returns ReleaseDTO the informations about the requested release
   */
  async getRelease(
    owner: string,
    repo: string,
    version: string,
  ): Promise<ReleaseDTO> {
    // TODO: Replace this with a part of the request indicating whether this is a branch or a release
    // If there's a matching owner
    const ownerRepos = AVAILABLE_FIRMWARE_REPOS[owner];
    if (ownerRepos !== undefined) {
      // And a matching repo
      const repoBranches = ownerRepos[repo];
      if (repoBranches !== undefined) {
        // And a matching branch
        if (repoBranches.includes(version)) {
          // Then return the branch release instead of looking for a version
          return this.getBranchRelease(owner, repo, version)
            .catch((e) => {
              throw new Error(
                `Unable to fetch branch release for "${owner}/${repo}/${version}"`,
                { cause: e },
              );
            });
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
        return {
          id: `${id}`,
          url,
          prerelease,
          draft,
          name: `${owner}/${name}`,
          zipball_url,
        };
      },
      5 * 60 * 1000,
    );
  }
}
