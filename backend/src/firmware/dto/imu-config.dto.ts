import { ApiProperty, OmitType } from '@nestjs/swagger';
import { ImuConfig, ImuType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class ImuConfigDTO implements ImuConfig {
  /**
   * Unique id of the config
   * this probably will never be shown to the user as it is moslty use for relations
   */
  @ApiProperty({
    required: true,
    description:
      'Unique id of the config. this probably will never be shown to the user as it is moslty use for relations',
  })
  @IsString()
  id!: string;

  /**
   * Type of the imu
   * @see {ImuType}
   */
  @ApiProperty({
    enum: ImuType,
    required: true,
    description: 'Type of the imu',
  })
  @IsEnum(ImuType)
  type!: ImuType;

  /**
   * Rotation of the imu in degrees
   */
  @ApiProperty({
    required: true,
    description: 'Rotation of the imu in degrees',
  })
  @IsNumber()
  rotation!: number;

  /**
   * Pin address of the imu int pin
   * not all imus use it
   */
  @ApiProperty({
    required: false,
    type: () => String,
    nullable: true,
    description: 'Pin address of the imu int pin. Not all imus use it',
  })
  @IsString()
  @IsOptional()
  intPin: string | null;

  /**
   * Pin address of the scl pin
   */
  @ApiProperty({ required: true, description: 'Pin address of the scl pin' })
  @IsString()
  sclPin!: string;

  /**
   * Pin address of the sda pin
   */
  @ApiProperty({ required: true, description: 'Pin address of the sda pin' })
  @IsString()
  sdaPin!: string;

  /**
   * id of the linked firmware, used for relations
   */
  @ApiProperty({
    required: true,
    description: 'Id of the linked firmware, used for relations',
  })
  @IsString()
  firmwareId!: string;
}

export class CreateImuConfigDTO extends OmitType(ImuConfigDTO, [
  'firmwareId',
  'id',
]) {}

export class IMUDefaultPinsDTO extends OmitType(ImuConfigDTO, [
  'firmwareId',
  'id',
  'rotation',
  'type',
]) {}
