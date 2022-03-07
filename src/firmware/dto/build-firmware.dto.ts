import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { BatteryDTO, BatteryType } from './battery.dto';
import { BoardPins, BoardType, FirmwareBoardDTO } from './firmware-board.dto';
import { IMUDTO } from './imu.dto';

export class BuildFirmwareDTO {
  @ApiProperty()
  public version: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => FirmwareBoardDTO)
  public board: FirmwareBoardDTO;

  @ApiProperty({ type: [IMUDTO] })
  @ValidateNested({ each: true })
  @Type(() => IMUDTO)
  public imus: IMUDTO[];

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => BatteryDTO)
  @IsOptional()
  public battery?: BatteryDTO;

  static completeDefaults(dto: BuildFirmwareDTO): BuildFirmwareDTO {
    const boardInts = {
      [BoardType.BOARD_SLIMEVR]: ['10', '13'],
      [BoardType.BOARD_SLIMEVR_DEV]: ['10', '13'],
      [BoardType.BOARD_NODEMCU]: ['D5', 'D6'],
      [BoardType.BOARD_WEMOSD1MINI]: ['D5', 'D6'],
      [BoardType.BOARD_ESP01]: ['255', '255'],
      [BoardType.BOARD_TTGO_TBASE]: ['14', '13'],
      [BoardType.BOARD_WROOM32]: ['23', '25'],
    };

    if (dto.imus.length === 1) {
      dto.imus.push({
        ...dto.imus[0],
        imuINT: undefined,
      });
    }

    dto.imus = dto.imus.map((imu, index) => ({
      ...imu,
      imuINT: imu.imuINT || boardInts[dto.board.type][index] || '255',
    }));

    if (!dto.board.pins) {
      const boardsPins: { [key: string]: BoardPins } = {
        [BoardType.BOARD_SLIMEVR]: {
          imuSDA: '4',
          imuSCL: '5',
          led: '2',
        },
        [BoardType.BOARD_SLIMEVR_DEV]: {
          imuSDA: '4',
          imuSCL: '5',
          led: '2',
        },
        [BoardType.BOARD_NODEMCU]: {
          imuSDA: 'D2',
          imuSCL: 'D1',
          led: '2',
        },
        [BoardType.BOARD_WEMOSD1MINI]: {
          imuSDA: 'D2',
          imuSCL: 'D1',
          led: '2',
        },
        [BoardType.BOARD_TTGO_TBASE]: {
          imuSDA: '5',
          imuSCL: '5',
          led: '2',
        },
        [BoardType.BOARD_ESP01]: {
          imuSDA: '2',
          imuSCL: '0',
          led: '255',
        },
        [BoardType.BOARD_WROOM32]: {
          imuSDA: '2',
          imuSCL: '0',
          led: '2',
        },
      };

      dto.board.pins = boardsPins[dto.board.type];
    }

    if (!dto.battery) {
      dto.battery = new BatteryDTO();
      dto.battery.type = BatteryType.BAT_EXTERNAL;
      dto.battery.resistance = 180;
    }

    if (!dto.battery.pin) {
      const batteryPins = {
        [BoardType.BOARD_SLIMEVR]: '17',
        [BoardType.BOARD_SLIMEVR_DEV]: '17',
        [BoardType.BOARD_NODEMCU]: 'A0',
        [BoardType.BOARD_WEMOSD1MINI]: 'A0',
        [BoardType.BOARD_ESP01]: 'A0',
        [BoardType.BOARD_TTGO_TBASE]: 'A0',
        [BoardType.BOARD_WROOM32]: '36',
      };

      dto.battery.pin = batteryPins[dto.board.type];
    }

    if (!dto.board.enableLed) {
      const enableLedMap = {
        [BoardType.BOARD_SLIMEVR]: true,
        [BoardType.BOARD_SLIMEVR_DEV]: true,
        [BoardType.BOARD_NODEMCU]: true,
        [BoardType.BOARD_WEMOSD1MINI]: true,
        [BoardType.BOARD_ESP01]: false,
        [BoardType.BOARD_TTGO_TBASE]: true,
        [BoardType.BOARD_WROOM32]: true,
      };

      dto.board.enableLed = enableLedMap[dto.board.type];
    }

    return dto;
  }
}
