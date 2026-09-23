CREATE TABLE IF NOT EXISTS "ipo_allotment_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"allotment_status" varchar(50) DEFAULT 'UNKNOWN' NOT NULL,
	"verification_status" varchar(50) DEFAULT 'UNAVAILABLE' NOT NULL,
	"verification_method" varchar(50) DEFAULT 'PROVIDER_API' NOT NULL,
	"applied_quantity" integer NOT NULL,
	"allotted_quantity" integer DEFAULT 0 NOT NULL,
	"allotment_ratio" numeric(18, 4),
	"provider" varchar(50) DEFAULT 'DEVELOPMENT_STUB' NOT NULL,
	"source" varchar(255) DEFAULT 'Official Provider API' NOT NULL,
	"external_reference" varchar(255),
	"retrieved_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ipo_allotment_results" ADD CONSTRAINT "ipo_allotment_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ipo_allotment_results" ADD CONSTRAINT "ipo_allotment_results_application_id_ipo_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."ipo_applications"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ipo_allotment_app_unique" ON "ipo_allotment_results" ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ipo_allotment_user_id" ON "ipo_allotment_results" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ipo_allotment_app_id" ON "ipo_allotment_results" ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ipo_allotment_status" ON "ipo_allotment_results" ("allotment_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ipo_allotment_verification" ON "ipo_allotment_results" ("verification_status");
