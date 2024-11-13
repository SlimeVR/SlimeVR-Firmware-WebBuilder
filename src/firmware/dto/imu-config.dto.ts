import { ImuConfig, ImuType } from '@prisma/client';

export interface ImuConfigDTO extends ImuConfig {
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
   * Is this imu optionnal
   * Allows for extensions to be unplugged
   */
  optional: boolean;

  /**
   * id of the linked firmware, used for relations
   *
   * @format uuid
   */
  firmwareId: string;
}

export type CreateImuConfigDTO = Omit<ImuConfigDTO, 'firmwareId' | 'id'>;

type MakeFieldsOptional<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

export type IMUDefaultDTO = Omit<
  MakeFieldsOptional<ImuConfigDTO, 'rotation' | 'type'>,
  'firmwareId' | 'id'
>;
