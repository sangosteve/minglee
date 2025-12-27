CREATE TYPE "public"."automation_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."automation_trigger" AS ENUM('manual', 'message_received', 'keyword', 'tag_added', 'campaign_reply', 'time_delay', 'contact_created', 'contact_updated', 'webhook');--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"contact_id" uuid,
	"user_id" uuid,
	"trigger_data" jsonb DEFAULT '{}'::jsonb,
	"execution_data" jsonb DEFAULT '{}'::jsonb,
	"node_executions" jsonb DEFAULT '[]'::jsonb,
	"error" text,
	"status" varchar(50) DEFAULT 'pending',
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"user_id" uuid NOT NULL,
	"trigger_type" "automation_trigger" DEFAULT 'manual',
	"trigger_config" jsonb DEFAULT '{}'::jsonb,
	"flow_data" jsonb DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
	"status" "automation_status" DEFAULT 'draft',
	"total_runs" integer DEFAULT 0,
	"successful_runs" integer DEFAULT 0,
	"failed_runs" integer DEFAULT 0,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_automation_runs_automation_id" ON "automation_runs" USING btree ("automation_id");--> statement-breakpoint
CREATE INDEX "idx_automation_runs_contact_id" ON "automation_runs" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_automation_runs_status" ON "automation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_automation_runs_created_at" ON "automation_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_automations_user_id" ON "automations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_automations_status" ON "automations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_automations_trigger_type" ON "automations" USING btree ("trigger_type");