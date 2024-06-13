// In the format of [owner, [repo, [branches]]]
import firmares from './firmwares.json';
import boards from './boards-infos.json';
import { DefaultBuildConfigDTO } from './dto/default-config.dto';
export const AVAILABLE_FIRMWARE_REPOS = firmares;

export type BoardDefault = {
  defaults: Omit<
    DefaultBuildConfigDTO['boardConfig'],
    'type' | 'batteryType' | 'intPin'
  > & { batteryType: string }; // OOF
  imuPins: DefaultBuildConfigDTO['imuPins'];
};

export const AVAILABLE_BOARDS: {
  [key: string]: BoardDefault;
} = boards;
