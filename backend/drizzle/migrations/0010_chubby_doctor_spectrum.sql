ALTER TABLE "automation_runs" DROP CONSTRAINT "automation_runs_automation_id_automations_id_fk";
--> statement-breakpoint
ALTER TABLE "automation_runs" DROP CONSTRAINT "automation_runs_contact_id_contacts_id_fk";
--> statement-breakpoint
ALTER TABLE "automation_runs" DROP CONSTRAINT "automation_runs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "automations" DROP CONSTRAINT "automations_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "quick_replies" DROP CONSTRAINT "quick_replies_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "team_invitations" DROP CONSTRAINT "team_invitations_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "team_invitations" DROP CONSTRAINT "team_invitations_invited_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "team_members" DROP CONSTRAINT "team_members_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "team_members" DROP CONSTRAINT "team_members_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "team_members" DROP CONSTRAINT "team_members_invited_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "idx_automation_runs_automation_id";--> statement-breakpoint
DROP INDEX "idx_automation_runs_contact_id";--> statement-breakpoint
DROP INDEX "idx_automation_runs_status";--> statement-breakpoint
DROP INDEX "idx_automation_runs_created_at";--> statement-breakpoint
DROP INDEX "idx_automations_user_id";--> statement-breakpoint
DROP INDEX "idx_automations_status";--> statement-breakpoint
DROP INDEX "idx_automations_trigger_type";--> statement-breakpoint
DROP INDEX "idx_contacts_tag_ids";--> statement-breakpoint
DROP INDEX "idx_conversations_tag_ids";--> statement-breakpoint
DROP INDEX "idx_quick_replies_media_attachment_ids";--> statement-breakpoint
DROP INDEX "idx_team_invitations_team_id";--> statement-breakpoint
DROP INDEX "idx_team_invitations_email";--> statement-breakpoint
DROP INDEX "idx_team_invitations_token";--> statement-breakpoint
DROP INDEX "idx_team_invitations_status";--> statement-breakpoint
DROP INDEX "idx_team_members_team_id";--> statement-breakpoint
DROP INDEX "idx_team_members_user_id";--> statement-breakpoint
DROP INDEX "idx_team_members_role";--> statement-breakpoint
DROP INDEX "idx_team_members_status";--> statement-breakpoint
DROP INDEX "idx_teams_owner_id";--> statement-breakpoint
DROP INDEX "idx_teams_status";--> statement-breakpoint
DROP INDEX "idx_user_permissions_user_id";--> statement-breakpoint
DROP INDEX "idx_user_permissions_resource_action";--> statement-breakpoint
DROP INDEX "idx_quick_replies_user_id";--> statement-breakpoint
DROP INDEX "idx_quick_replies_is_active";--> statement-breakpoint
DROP INDEX "idx_tags_user_id";--> statement-breakpoint
ALTER TABLE "automations" ALTER COLUMN "flow_data" SET DEFAULT '{"edges":[],"nodes":[]}'::jsonb;--> statement-breakpoint
ALTER TABLE "media_attachments" ALTER COLUMN "message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "settings" SET DEFAULT '{"maxMembers":10,"defaultRole":"member","canInviteMembers":true,"allowMemberDeletion":false}'::jsonb;--> statement-breakpoint
CREATE INDEX "idx_quick_replies_user_id" ON "quick_replies" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_quick_replies_is_active" ON "quick_replies" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_tags_user_id" ON "tags" USING btree ("user_id" uuid_ops);