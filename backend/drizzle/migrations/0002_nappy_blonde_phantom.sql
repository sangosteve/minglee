CREATE TABLE "media_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid,
	"public_id" varchar(255) NOT NULL,
	"resource_type" varchar(20) DEFAULT 'image',
	"format" varchar(10),
	"version" varchar(20),
	"original_filename" varchar(255),
	"mime_type" varchar(100),
	"file_size" integer,
	"width" integer,
	"height" integer,
	"duration" integer,
	"secure_url" text NOT NULL,
	"thumbnail_url" text,
	"caption" text,
	"tags" text[] DEFAULT '{}',
	"status" varchar(20) DEFAULT 'active',
	"uploaded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;