CREATE TABLE "firmwareFiles" (
	"id" varchar(42) PRIMARY KEY NOT NULL,
	"filePath" varchar(255),
	"isFirmware" boolean
);
--> statement-breakpoint
CREATE TABLE "firmwares" (
	"id" varchar(42) PRIMARY KEY NOT NULL,
	"commit" varchar(64),
	"status" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "firmwares_id_unique" UNIQUE("id")
);
