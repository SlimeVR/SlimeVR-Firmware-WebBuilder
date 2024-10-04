// In the format of [owner, [repo, [branches]]]
import firmares from './firmwares.json';
import boards from './boards-infos.json';
import { DefaultBuildConfigDTO } from './dto/default-config.dto';
import { validate } from 'typia';
import { type BoardType } from '@prisma/client';
export const AVAILABLE_FIRMWARE_REPOS = firmares;

export type BoardDefault = {
  boardConfig: Omit<DefaultBuildConfigDTO['boardConfig'], 'type' | 'intPin'>;
} & Omit<DefaultBuildConfigDTO, 'boardConfig'>;

const a = validate<Record<BoardType, BoardDefault>>(boards);

if (a.errors.length > 0 || !a.success) {
  console.log(a.errors);
  throw new Error('CHOTTO MATTE!');
}

export const AVAILABLE_BOARDS = a.data;
