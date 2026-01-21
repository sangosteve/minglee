CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100),
	"language" varchar(10) DEFAULT 'en',
	"status" varchar(50) DEFAULT 'pending',
	"components" jsonb DEFAULT '[]'::jsonb,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"whatsapp_template_id" varchar(255),
	"whatsapp_category" varchar(100),
	"whatsapp_language" varchar(10),
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_message_templates_status" ON "message_templates" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_message_templates_user_id" ON "message_templates" USING btree ("user_id" uuid_ops);