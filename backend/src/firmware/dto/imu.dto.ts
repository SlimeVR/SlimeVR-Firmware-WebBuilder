import { ApiProperty } from '@nestjs/swagger';
import { ImuType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export const IMUS: IMUDTO[] = [
  {
    type: ImuType.IMU_MPU9250,
    hasIntPin: false,
  },
  {
    type: ImuType.IMU_MPU6500,
    hasIntPin: false,
  },
  {
    type: ImuType.IMU_BNO080,
    hasIntPin: true,
  },
  {
    type: ImuType.IMU_BNO085,
    hasIntPin: true,
  },
  {
    type: ImuType.IMU_BNO055,
    hasIntPin: true,
  },
  {
    type: ImuType.IMU_BNO086,
    hasIntPin: true,
  },
  {
    type: ImuType.IMU_MPU6050,
    hasIntPin: false,
  },
  {
    type: ImuType.IMU_BMI160,
    hasIntPin: false,
  },
  {
    type: ImuType.IMU_ICM20948,
    hasIntPin: false,
  },
  {
    type: ImuType.IMU_BMI270,
    hasIntPin: false,
  },
];

export class IMUDTO {
  @ApiProperty({ enum: ImuType })
  @IsEnum(ImuType)
  public type: ImuType;

  @ApiProperty()
  public hasIntPin: boolean;
}
