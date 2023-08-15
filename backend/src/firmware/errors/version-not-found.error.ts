import { HttpException, HttpStatus } from '@nestjs/common';

export const VersionNotFoundError = 'Version not found';
// export const VersionNotFoundExeption = new HttpException(
//   VersionNotFoundError,
//   HttpStatus.BAD_REQUEST,
// );

export class VersionNotFoundExeption extends HttpException {
  constructor() {
    super(VersionNotFoundError, HttpStatus.BAD_REQUEST);
  }
}
