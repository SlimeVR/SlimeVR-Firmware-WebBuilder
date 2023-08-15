import { ApiProperty } from '@nestjs/swagger';
import { ImuConfig, ImuType } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'class-validator';

export class ImuConfigDTO implements ImuConfig {
  @ApiProperty({ required: true })
  id!: string;

  @ApiProperty({ enum: ImuType, required: true })
  type!: ImuType;

  @ApiProperty({ required: true })
  rotation!: number;

  @ApiProperty({ required: true })
  intPin!: string;

  @ApiProperty({ required: true })
  sclPin!: string;

  @ApiProperty({ required: true })
  sdaPin!: string;

  @ApiProperty({ required: true })
  firmwareId!: string;
}

export class CreateImuConfigDTO
  implements Omit<ImuConfigDTO, 'id' | 'firmwareId'>
{
  @ApiProperty({ enum: ImuType, required: true })
  @IsEnum(ImuType)
  type: ImuType;

  @ApiProperty({ required: true })
  @IsNumber()
  rotation: number;

  @ApiProperty({ required: true })
  @IsString()
  intPin: string;

  @ApiProperty({ required: true })
  @IsString()
  sclPin: string;

  @ApiProperty({ required: true })
  @IsString()
  sdaPin: string;
}
