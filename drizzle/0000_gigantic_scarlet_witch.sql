CREATE TABLE "firmwareFiles" (
	"filePath" varchar(255) NOT NULL,
	"offset" numeric NOT NULL,
	"isFirmware" boolean NOT NULL,
	"firmwareId" varchar(42) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firmwares" (
	"id" varchar(42) PRIMARY KEY NOT NULL,
	"release_id" varchar(64) NOT NULL,
	"status" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "firmwares_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "firmwareFiles" ADD CONSTRAINT "firmwareFiles_firmwareId_firmwares_id_fk" FOREIGN KEY ("firmwareId") REFERENCES "public"."firmwares"("id") ON DELETE cascade ON UPDATE no action;