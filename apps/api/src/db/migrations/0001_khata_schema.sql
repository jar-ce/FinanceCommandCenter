CREATE TABLE IF NOT EXISTS "khata_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"phone" text,
	"account_type" text DEFAULT 'CUSTOMER' NOT NULL,
	"notes" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "khata_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"running_balance" numeric(18, 4) NOT NULL,
	"transaction_date" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "khata_accounts" ADD CONSTRAINT "khata_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "khata_transactions" ADD CONSTRAINT "khata_transactions_account_id_khata_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."khata_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "khata_transactions" ADD CONSTRAINT "khata_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_khata_accounts_user_id" ON "khata_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_khata_accounts_name" ON "khata_accounts" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_khata_accounts_status" ON "khata_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_khata_tx_account_id" ON "khata_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_khata_tx_user_id" ON "khata_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_khata_tx_date" ON "khata_transactions" USING btree ("transaction_date");
