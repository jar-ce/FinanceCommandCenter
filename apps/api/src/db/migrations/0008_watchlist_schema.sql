CREATE TABLE IF NOT EXISTS "watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchlist_id" uuid NOT NULL REFERENCES "watchlists"("id") ON DELETE cascade,
	"instrument_id" uuid NOT NULL REFERENCES "market_instruments"("id") ON DELETE restrict,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_watchlists_user" ON "watchlists" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_watchlists_user_status" ON "watchlists" ("user_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_watchlist_items_unique" ON "watchlist_items" ("watchlist_id", "instrument_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_watchlist_items_watchlist" ON "watchlist_items" ("watchlist_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_watchlist_items_instrument" ON "watchlist_items" ("instrument_id");

