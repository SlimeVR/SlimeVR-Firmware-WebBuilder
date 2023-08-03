import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { BatteryDTO, BatteryType } from './battery.dto';
import { FirmwareBoardDTO } from './firmware-board.dto';
import { IMUConfigDTO } from './imu.dto';
import { AVAILABLE_BOARDS } from '../firmware.constants';

export class BuildFirmwareDTO {
  @ApiProperty()
  public version: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => FirmwareBoardDTO)
  public board: FirmwareBoardDTO;

  @ApiProperty({ type: [IMUConfigDTO] })
  @ValidateNested({ each: true })
  @Type(() => IMUConfigDTO)
  public imus: IMUConfigDTO[];

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => BatteryDTO)
  @IsOptional()
  public battery?: BatteryDTO;

  static completeDefaults(dto: BuildFirmwareDTO): BuildFirmwareDTO {
    const boardDefaults = AVAILABLE_BOARDS[dto.board.type].defaults;

    if (dto.imus.length === 1) {
      dto.imus.push({
        ...dto.imus[0],
        imuINT: undefined,
      });
    }

    dto.imus = dto.imus.map((imu, index) => ({
      ...imu,
      imuINT: imu.imuINT || boardDefaults.imuInts[index] || '255',
      rotation: imu.rotation || 0,
    }));

    if (!dto.board.pins) {
      dto.board.pins = {
        imuSCL: boardDefaults.imuSCL,
        imuSDA: boardDefaults.imuSDA,
        led: boardDefaults.led,
      };
    }

    if (!dto.battery) {
      dto.battery = new BatteryDTO();
      dto.battery.type = BatteryType[boardDefaults.batteryType];
      if (dto.battery.type === BatteryType.BAT_EXTERNAL) {
        dto.battery.pin = boardDefaults.batteryPin;
        dto.battery.resistance = boardDefaults.batteryResistances[0];
        dto.battery.shieldR1 = boardDefaults.batteryResistances[1];
        dto.battery.shieldR2 = boardDefaults.batteryResistances[2];
      }
    }

    if (!dto.board.enableLed) {
      dto.board.enableLed = boardDefaults.enableLed;
    }

    if (!dto.board.ledInverted) {
      dto.board.ledInverted = boardDefaults.ledInverted;
    }

    return dto;
  }
}
