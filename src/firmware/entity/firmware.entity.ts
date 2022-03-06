import { ApiProperty } from '@nestjs/swagger';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BuildFirmwareDTO } from '../dto/build-firmware.dto';
import { BoardPins, BoardType } from '../dto/firmware-board.dto';

export enum BuildStatus {
  BUILDING = 'BUILDING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

@Entity()
export class Firmware extends BaseEntity {
  @ApiProperty()
  @PrimaryColumn()
  @Generated('uuid')
  public id: string;

  @ApiProperty({ enum: BuildStatus })
  @Column({ enum: BuildStatus })
  public buildStatus: BuildStatus;

  @ApiProperty()
  @Column({ type: 'simple-json' })
  public buildConfig: BuildFirmwareDTO;

  @ApiProperty()
  @CreateDateColumn()
  public creationDate: Date;

  @ApiProperty()
  @UpdateDateColumn()
  public updateDate: Date;

  static fromDTO(dto: BuildFirmwareDTO): Firmware {
    const firmware = new Firmware();
    firmware.buildStatus = BuildStatus.BUILDING;
    firmware.buildConfig = dto;

    return firmware;
  }
}
