import { OmitType } from '@nestjs/swagger';
import { ImuConfig, ImuType } from '@prisma/client';

export class ImuConfigDTO implements ImuConfig {
  /**
   * Unique id of the config
   * this probably will never be shown to the user as it is moslty use for relations
   *
   * @format uuid
   */
  id: string;

  /**
   * Type of the imu
   * @see {ImuType}
   */
  type: ImuType;

  /**
   * Rotation of the imu in degrees
   */
  rotation: number;

  /**
   * Pin address of the imu int pin
   * not all imus use it
   */
  intPin: string | null;

  /**
   * Pin address of the scl pin
   */
  sclPin: string;

  /**
   * Pin address of the sda pin
   */
  sdaPin: string;

  /**
   * id of the linked firmware, used for relations
   *
   * @format uuid
   */
  firmwareId: string;
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
