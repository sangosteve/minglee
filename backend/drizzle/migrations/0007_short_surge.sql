ALTER TABLE "media_attachments" DROP CONSTRAINT "media_attachments_message_id_messages_id_fk";
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "tag_ids" uuid[] DEFAULT '{}';--> statement-breakpoint
CREATE INDEX "idx_contacts_tag_ids" ON "contacts" USING btree ("tag_ids");--> statement-breakpoint
CREATE INDEX "idx_conversations_tag_ids" ON "conversations" USING btree ("tag_ids");--> statement-breakpoint
CREATE INDEX "idx_quick_replies_user_id" ON "quick_replies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_quick_replies_is_active" ON "quick_replies" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_quick_replies_media_attachment_ids" ON "quick_replies" USING btree ("media_attachment_ids");--> statement-breakpoint
CREATE INDEX "idx_tags_user_id" ON "tags" USING btree ("user_id");