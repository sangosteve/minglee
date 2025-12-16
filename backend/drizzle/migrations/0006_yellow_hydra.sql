CREATE TABLE "quick_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"topics" varchar(255) DEFAULT 'General',
	"user_id" uuid NOT NULL,
	"media_attachment_ids" uuid[] DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "quick_replies" ADD CONSTRAINT "quick_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;