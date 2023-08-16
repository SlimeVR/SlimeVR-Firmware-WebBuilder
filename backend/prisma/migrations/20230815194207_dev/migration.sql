-- DropForeignKey
ALTER TABLE "BoardConfig" DROP CONSTRAINT "BoardConfig_firmwareId_fkey";

-- DropForeignKey
ALTER TABLE "FirmwareFile" DROP CONSTRAINT "FirmwareFile_firmwareId_fkey";

-- DropForeignKey
ALTER TABLE "ImuConfig" DROP CONSTRAINT "ImuConfig_firmwareId_fkey";

-- AddForeignKey
ALTER TABLE "BoardConfig" ADD CONSTRAINT "BoardConfig_firmwareId_fkey" FOREIGN KEY ("firmwareId") REFERENCES "Firmware"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImuConfig" ADD CONSTRAINT "ImuConfig_firmwareId_fkey" FOREIGN KEY ("firmwareId") REFERENCES "Firmware"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmwareFile" ADD CONSTRAINT "FirmwareFile_firmwareId_fkey" FOREIGN KEY ("firmwareId") REFERENCES "Firmware"("id") ON DELETE CASCADE ON UPDATE CASCADE;
