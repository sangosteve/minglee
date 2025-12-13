CREATE TYPE "public"."contact_source" AS ENUM('manual', 'whatsapp', 'import', 'website', 'api');--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('active', 'inactive', 'archived', 'blocked', 'lead', 'customer');--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "address" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "city" varchar(100) DEFAULT '';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "state" varchar(100) DEFAULT '';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "country" varchar(100) DEFAULT '';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "postal_code" varchar(20) DEFAULT '';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "status" "contact_status" DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "source" "contact_source" DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "opt_in" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "last_contacted_at" timestamp;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb;