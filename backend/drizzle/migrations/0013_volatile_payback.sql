CREATE TYPE "public"."broadcast_audience_type" AS ENUM('all', 'tags', 'segments', 'contacts');--> statement-breakpoint
CREATE TYPE "public"."broadcast_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'failed', 'paused');--> statement-breakpoint
CREATE TABLE "broadcast_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcast_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"message_id" uuid,
	"status" varchar(50) DEFAULT 'pending',
	"whatsapp_message_id" varchar(255),
	"whatsapp_status" varchar(50),
	"error" text,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"template_id" uuid,
	"audienceType" "broadcast_audience_type" DEFAULT 'all',
	"audience_filter" jsonb DEFAULT '{}'::jsonb,
	"audience_count" integer DEFAULT 0,
	"variables" jsonb DEFAULT '{}'::jsonb,
	"media_url" text,
	"message" text,
	"media_attachment_id" uuid,
	"status" "broadcast_status" DEFAULT 'draft',
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"stats" jsonb DEFAULT '{"total":0,"sent":0,"delivered":0,"read":0,"failed":0}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_media_attachment_id_fkey" FOREIGN KEY ("media_attachment_id") REFERENCES "public"."media_attachments"("id") ON DELETE set null ON UPDATE no action;