import { FirmwareFile } from '@prisma/client';

export interface FirmwareFileDTO extends FirmwareFile {
  /**
   * Url to the file
   */
  url: string;

  /**
   * Address of the partition
   */
  offset: number;

  /**
   * Is this file the main firmware
   */
  isFirmware: boolean;

  /**
   * Id of the linked firmware
   *
   * @format uuid
   */
  firmwareId: string;
}
