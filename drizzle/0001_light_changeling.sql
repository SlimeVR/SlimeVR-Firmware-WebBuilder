ALTER TABLE "firmwareFiles" RENAME COLUMN "id" TO "firmwareId";--> statement-breakpoint
ALTER TABLE "firmwares" RENAME COLUMN "commit" TO "release_id";--> statement-breakpoint
ALTER TABLE "firmwareFiles" ALTER COLUMN "filePath" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "firmwareFiles" ALTER COLUMN "isFirmware" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "firmwareFiles" ADD COLUMN "offset" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "firmwareFiles" ADD CONSTRAINT "firmwareFiles_firmwareId_firmwares_id_fk" FOREIGN KEY ("firmwareId") REFERENCES "public"."firmwares"("id") ON DELETE cascade ON UPDATE no action;