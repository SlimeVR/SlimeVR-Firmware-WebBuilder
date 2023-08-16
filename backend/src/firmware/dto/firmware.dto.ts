import { ApiProperty } from '@nestjs/swagger';
import { BuildStatus, Firmware } from '@prisma/client';
import { IsEnum, IsString, IsUUID } from 'class-validator';

/**
 * Root object declaring a built firmware
 * this object contains:
 *  - the status of the build
 *  - the the repository and commit used as source
 */
export class FirmwareDTO implements Firmware {
  /**
   * UUID of the firmware
   */
  @ApiProperty({
    required: true,
    format: 'uuid',
    description: 'UUID of the firmware',
  })
  @IsUUID()
  id!: string;

  /**
   * Id of the firmware version used.
   * Usually the commit id of the source
   * used to build the firmware
   */
  @ApiProperty({
    required: true,
    description:
      'Id of the firmware version used. Usually the commit id of the source used to build the firmware',
  })
  @IsString()
  releaseId!: string;

  /**
   * Current status of the build
   * this value will change during the build
   * process
   *
   * BUILDING -> DONE \\ the firmwrare is build and ready
   *          -> FAILED  \\ the build failled and be garbage collected
   */
  @ApiProperty({
    enum: BuildStatus,
    required: true,
    description: 'Current status of the build',
  })
  @IsEnum(BuildStatus)
  buildStatus!: BuildStatus;

  /**
   * The repository and branch used as source of the firmware
   */
  @ApiProperty({ required: true })
  @IsString()
  buildVersion!: string;

  /**
   * The date of creation of this firmware build
   */
  @ApiProperty({ required: true })
  @IsString()
  createdAt!: Date;
}
