import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum IMUType {
  IMU_MPU9250 = 'IMU_MPU9250',
  IMU_MPU6500 = 'IMU_MPU6500',
  IMU_BNO080 = 'IMU_BNO080',
  IMU_BNO085 = 'IMU_BNO085',
  IMU_BNO055 = 'IMU_BNO055',
  IMU_MPU6050 = 'IMU_MPU6050',
  IMU_BNO086 = 'IMU_BNO086',
  IMU_BMI160 = 'IMU_BMI160',
  IMU_ICM20948 = 'IMU_ICM20948',
}

export class IMUDTO {
  @ApiProperty({ enum: IMUType })
  @IsEnum(IMUType)
  public type: IMUType;

  @ApiProperty()
  public rotation: number;

  @ApiProperty({ required: false })
  @IsOptional()
  public imuINT?: string;
}
