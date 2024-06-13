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
   * Is this file the main firmware
   */
  isFirmware!: boolean;

  /**
   * Id of the linked firmware
   *
   * @format uuid
   */
  firmwareId: string;
}
