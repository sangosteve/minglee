ALTER TABLE "message_templates" ADD COLUMN "meta_template_id" varchar(255);--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "meta_status" varchar(50) DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "meta_review_feedback" text;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "quality_rating" varchar(50);--> statement-breakpoint
CREATE INDEX "idx_message_templates_meta_id" ON "message_templates" USING btree ("meta_template_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_message_templates_meta_status" ON "message_templates" USING btree ("meta_status" text_ops);