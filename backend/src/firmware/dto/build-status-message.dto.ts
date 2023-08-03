import { BuildStatus } from '../entity/firmware.entity';
import { FirmwareFile } from './firmware-files.dto';

export class BuildStatusMessage {
  public id: string;
  public buildStatus: BuildStatus;
  public message: string;

  public firmwareFiles?: FirmwareFile[];
}
