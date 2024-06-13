import { HttpException, HttpStatus } from '@nestjs/common';

export const VersionNotFoundError = 'Version not found';
export const VersionNotFoundStatus = HttpStatus.BAD_REQUEST;
export class VersionNotFoundExeption extends HttpException {
  constructor() {
    super(VersionNotFoundError, VersionNotFoundStatus);
  }
}
