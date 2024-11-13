-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM(
    'CREATING_BUILD_FOLDER',
    'DOWNLOADING_FIRMWARE',
    'EXTRACTING_FIRMWARE',
    'SETTING_UP_DEFINES',
    'BUILDING',
    'SAVING',
    'DONE',
    'ERROR'
);

-- CreateEnum
CREATE TYPE "BoardType" AS ENUM(
    'BOARD_SLIMEVR',
    'BOARD_NODEMCU',
    'BOARD_WROOM32',
    'BOARD_WEMOSD1MINI',
    'BOARD_TTGO_TBASE',
    'BOARD_ESP01',
    'BOARD_LOLIN_C3_MINI',
    'BOARD_BEETLE32C3',
    'BOARD_ES32C3DEVKITM1'
);

-- CreateEnum
CREATE TYPE "BatteryType" AS ENUM(
    'BAT_EXTERNAL',
    'BAT_INTERNAL',
    'BAT_MCP3021',
    'BAT_INTERNAL_MCP3021'
);

-- CreateEnum
CREATE TYPE "ImuType" AS ENUM(
    'IMU_MPU9250',
    'IMU_MPU6500',
    'IMU_BNO080',
    'IMU_BNO085',
    'IMU_BNO055',
    'IMU_BNO086',
    'IMU_MPU6050',
    'IMU_BMI160',
    'IMU_ICM20948',
    'IMU_BMI270'
);

-- CreateTable
CREATE TABLE "BoardConfig" (
    "id" TEXT NOT NULL,
    "type" "BoardType" NOT NULL,
    "ledPin" TEXT NOT NULL,
    "enableLed" BOOLEAN NOT NULL,
    "ledInverted" BOOLEAN NOT NULL,
    "batteryPin" TEXT NOT NULL,
    "batteryType" "BatteryType" NOT NULL,
    "batteryResistances" INTEGER[],
    "firmwareId" TEXT NOT NULL,


CONSTRAINT "BoardConfig_pkey" PRIMARY KEY ("id") );

-- CreateTable
CREATE TABLE "ImuConfig" (
    "id" TEXT NOT NULL,
    "type" "ImuType" NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL,
    "intPin" TEXT,
    "sclPin" TEXT NOT NULL,
    "sdaPin" TEXT NOT NULL,
    "optional" BOOLEAN NOT NULL,
    "firmwareId" TEXT NOT NULL,


CONSTRAINT "ImuConfig_pkey" PRIMARY KEY ("id") );

-- CreateTable
CREATE TABLE "FirmwareFile" (
    "url" TEXT NOT NULL,
    "offset" INTEGER NOT NULL,
    "isFirmware" BOOLEAN NOT NULL,
    "firmwareId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Firmware" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "buildStatus" "BuildStatus" NOT NULL,
    "buildVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,


CONSTRAINT "Firmware_pkey" PRIMARY KEY ("id") );

-- CreateIndex
CREATE UNIQUE INDEX "BoardConfig_id_key" ON "BoardConfig" ("id");

-- CreateIndex
CREATE UNIQUE INDEX "BoardConfig_firmwareId_key" ON "BoardConfig" ("firmwareId");

-- CreateIndex
CREATE UNIQUE INDEX "ImuConfig_id_key" ON "ImuConfig" ("id");

-- CreateIndex
CREATE UNIQUE INDEX "FirmwareFile_url_key" ON "FirmwareFile" ("url");

-- CreateIndex
CREATE UNIQUE INDEX "Firmware_id_key" ON "Firmware" ("id");

-- AddForeignKey
ALTER TABLE "BoardConfig"
ADD CONSTRAINT "BoardConfig_firmwareId_fkey" FOREIGN KEY ("firmwareId") REFERENCES "Firmware" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImuConfig"
ADD CONSTRAINT "ImuConfig_firmwareId_fkey" FOREIGN KEY ("firmwareId") REFERENCES "Firmware" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmwareFile"
ADD CONSTRAINT "FirmwareFile_firmwareId_fkey" FOREIGN KEY ("firmwareId") REFERENCES "Firmware" ("id") ON DELETE CASCADE ON UPDATE CASCADE;