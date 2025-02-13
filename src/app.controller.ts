import { TypedParam, TypedRoute } from '@nestia/core';
import { Controller, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import semver from 'semver';

interface VerionCheckResponse {
  success: boolean;
  reason?: {
    message: string;
    versions: string;
  };
}

@ApiTags('app')
@Controller()
export class AppController {
  /**
   * Is this api compatible with the server version given
   */
  @TypedRoute.Get('/is-compatible/:version')
  @Header('Cache-Control', 'public, max-age=7200')
  isCompatible(@TypedParam('version') version: string): VerionCheckResponse {
    const versions = '>=0.13.0';
    const success = semver.satisfies(semver.coerce(version), versions);
    return {
      success,
      reason: !success
        ? {
          message: `The current version of the server does not satisfies the following versions requirement: ${version}`,
          versions,
        }
        : undefined,
    };
  }
}
