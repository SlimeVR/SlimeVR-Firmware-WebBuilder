import { BuildStatus, Firmware } from '@prisma/client';

/**
 * Root object declaring a built firmware
 * this object contains:
 *  - the status of the build
 *  - the the repository and commit used as source
 */
export class FirmwareDTO implements Firmware {
  /**
   * UUID of the firmware
   *
   * @format uuid
   */
  id: string;

  /**
   * Id of the firmware version used.
   * Usually the commit id of the source
   * used to build the firmware
   */
  releaseId: string;

  /**
   * Current status of the build
   * this value will change during the build
   * process
   *
   * BUILDING -> DONE \\ the firmwrare is build and ready
   *          -> FAILED  \\ the build failled and be garbage collected
   */
  buildStatus: BuildStatus;

  /**
   * The repository and branch used as source of the firmware
   */
  buildVersion: string;

  /**
   * The date of creation of this firmware build
   */
  createdAt: Date;
}
