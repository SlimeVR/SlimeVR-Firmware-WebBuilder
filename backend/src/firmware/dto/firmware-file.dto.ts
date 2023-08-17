import { FirmwareFile } from '@prisma/client';

export class FirmwareFileDTO implements FirmwareFile {
  /**
   * Url to the file
   */
  url!: string;

  /**
   * Address of the partition
   */
  offset!: number;

  /**
   * Id of the linked firmware
   *
   * @format uuid
   */
  firmwareId: string;
}
