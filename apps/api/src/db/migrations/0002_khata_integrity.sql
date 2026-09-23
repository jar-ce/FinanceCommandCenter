ALTER TABLE "khata_transactions" DROP CONSTRAINT IF EXISTS "khata_transactions_account_id_khata_accounts_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "khata_transactions" ADD CONSTRAINT "khata_transactions_account_id_khata_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."khata_accounts"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "khata_transactions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'ACTIVE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "khata_transactions" ADD COLUMN IF NOT EXISTS "reversed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "khata_transactions" ADD COLUMN IF NOT EXISTS "reversed_by" uuid;
--> statement-breakpoint
ALTER TABLE "khata_transactions" ADD COLUMN IF NOT EXISTS "reversal_reason" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "khata_transactions" ADD CONSTRAINT "khata_transactions_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_khata_tx_status" ON "khata_transactions" USING btree ("status");
