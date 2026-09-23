CREATE TABLE IF NOT EXISTS "ipo_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ipo_id" uuid NOT NULL,
	"application_account_id" uuid NOT NULL,
	"application_date" timestamp with time zone NOT NULL,
	"lots_applied" integer NOT NULL,
	"quantity_applied" integer NOT NULL,
	"application_amount" numeric(18, 4) NOT NULL,
	"status" varchar(50) DEFAULT 'SUBMITTED' NOT NULL,
	"payment_reference" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD CONSTRAINT "ipo_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD CONSTRAINT "ipo_applications_ipo_id_ipos_id_fk" FOREIGN KEY ("ipo_id") REFERENCES "ipos"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD CONSTRAINT "ipo_applications_application_account_id_khata_accounts_id_fk" FOREIGN KEY ("application_account_id") REFERENCES "khata_accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ipo_apps_user_id" ON "ipo_applications" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ipo_apps_ipo_id" ON "ipo_applications" ("ipo_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ipo_apps_account_id" ON "ipo_applications" ("application_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ipo_apps_status" ON "ipo_applications" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ipo_apps_date" ON "ipo_applications" ("application_date");
