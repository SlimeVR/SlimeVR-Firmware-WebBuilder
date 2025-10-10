import { Controller, Header } from '@nestjs/common';
import { TypedParam, TypedRoute } from '@nestia/core';
import semver from 'semver';
import { ApiTags } from '@nestjs/swagger';
import { SUPPORTED_VERSIONS } from './env';

type VerionCheckResponse =
  | { success: true }
  | {
      success: false;
      reason: {
        message: string;
        versions: string;
      };
    };

@ApiTags('app')
@Controller()
export class AppController {
  /**
   * Is this api compatible with the server version given
   */
  @TypedRoute.Get('/is-compatible/:version')
  @Header('Cache-Control', 'public, max-age=7200')
  isCompatible(@TypedParam('version') version: string): VerionCheckResponse {
    const versions = SUPPORTED_VERSIONS;
    const formated = semver.coerce(version);
    if (!formated)
      return {
        success: false,
        reason: { message: 'Unknown version format', versions },
      };

    const success = semver.satisfies(formated, versions);
    if (success) return { success: true };

    return {
      success: false,
      reason: {
        message: `The current version of the server does not satisfies the following versions requirement: ${versions}`,
        versions,
      },
    };
  }

  /**
   * Gives the status of the api
   * this endpoint will always return true
   *
   * @returns Boolean, is the api healty or not
   */
  @TypedRoute.Get('/health')
  getHealth(): boolean {
    return true;
  }
}
