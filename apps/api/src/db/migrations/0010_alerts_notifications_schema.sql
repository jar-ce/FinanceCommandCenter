CREATE TABLE IF NOT EXISTS "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
	"name" varchar(255) NOT NULL,
	"description" text,
	"alert_type" varchar(64) NOT NULL,
	"target_type" varchar(32) NOT NULL,
	"target_id" uuid NOT NULL,
	"condition_operator" varchar(16) NOT NULL,
	"threshold_value" numeric(18, 4),
	"threshold_percent" numeric(18, 4),
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"last_evaluated_at" timestamp with time zone,
	"last_evaluated_value" numeric(18, 4),
	"last_evaluated_state" varchar(16) DEFAULT 'UNKNOWN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_rule_id" uuid NOT NULL REFERENCES "alert_rules"("id") ON DELETE RESTRICT,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger_value" numeric(18, 4),
	"threshold_value" numeric(18, 4),
	"evaluation_snapshot" jsonb,
	"deduplication_key" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
	"alert_event_id" uuid NOT NULL REFERENCES "alert_events"("id") ON DELETE RESTRICT,
	"alert_rule_id" uuid NOT NULL REFERENCES "alert_rules"("id") ON DELETE RESTRICT,
	"notification_type" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(16) DEFAULT 'UNREAD' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_rules_user_idx" ON "alert_rules" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_rules_status_idx" ON "alert_rules" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_rules_target_idx" ON "alert_rules" ("target_type", "target_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_events_user_idx" ON "alert_events" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_events_rule_idx" ON "alert_events" ("alert_rule_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "alert_events_dedup_idx" ON "alert_events" ("deduplication_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "notifications" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_created_idx" ON "notifications" ("created_at");

