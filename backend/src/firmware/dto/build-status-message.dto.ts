import { BuildStatus } from '@prisma/client';
import { FirmwareFileDTO } from './firmware-file.dto';

export class BuildStatusMessage {
  public id: string;
  public buildStatus: BuildStatus;
  public message: string;

  public firmwareFiles?: FirmwareFileDTO[];
}
