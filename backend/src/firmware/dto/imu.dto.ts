import { ImuType } from '@prisma/client';

/**
 * List of the imus types and informations about int pins
 * this is used as display information, so we can hide
 * the int pin field if the imu does not have one
 */
export const IMUS: IMUDTO[] = [
  {
    type: ImuType.IMU_MPU9250,
    hasIntPin: false,
    imuStartAddress: 0x68,
    addressIncrement: 1,
  },
  {
    type: ImuType.IMU_MPU6500,
    hasIntPin: false,
    imuStartAddress: 0x68,
    addressIncrement: 1,
  },
  {
    type: ImuType.IMU_BNO080,
    hasIntPin: true,
    imuStartAddress: 0x4a,
    addressIncrement: 1,
  },
  {
    type: ImuType.IMU_BNO085,
    hasIntPin: true,
    imuStartAddress: 0x4a,
    addressIncrement: 1,
  },
  {
    type: ImuType.IMU_BNO055,
    hasIntPin: true,
    imuStartAddress: 0x29,
    addressIncrement: -1,
  },
  {
    type: ImuType.IMU_BNO086,
    hasIntPin: true,
    imuStartAddress: 0x4a,
    addressIncrement: 1,
  },
  {
    type: ImuType.IMU_MPU6050,
    hasIntPin: false,
    imuStartAddress: 0x68,
    addressIncrement: 1,
  },
  {
    type: ImuType.IMU_BMI160,
    hasIntPin: false,
    imuStartAddress: 0x68,
    addressIncrement: 1,
  },
  {
    type: ImuType.IMU_ICM20948,
    hasIntPin: false,
    imuStartAddress: 0x68,
    addressIncrement: 1,
  },
  {
    type: ImuType.IMU_BMI270,
    hasIntPin: false,
    imuStartAddress: 0x68,
    addressIncrement: 1,
  },
];

export class IMUDTO {
  /**
   * Type of the imu
   * @see {ImuType}
   */
  public type: ImuType;

  /**
   * Does that imu type require a int pin
   */
  public hasIntPin: boolean;

  /**
   * First address of the imu
   */
  public imuStartAddress: number;

  /**
   * Increment of the address for each new imus
   */
  public addressIncrement: number;
}
