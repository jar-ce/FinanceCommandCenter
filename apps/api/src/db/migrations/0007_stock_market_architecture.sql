CREATE TABLE IF NOT EXISTS "market_instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(50) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"exchange" varchar(50) NOT NULL,
	"market" varchar(50) DEFAULT 'IN' NOT NULL,
	"security_type" varchar(50) DEFAULT 'EQUITY' NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"provider" varchar(50) DEFAULT 'DEVELOPMENT_STUB' NOT NULL,
	"provider_instrument_id" varchar(255),
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "market_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_id" uuid NOT NULL,
	"last_price" numeric(18, 4),
	"previous_close" numeric(18, 4),
	"open" numeric(18, 4),
	"high" numeric(18, 4),
	"low" numeric(18, 4),
	"close" numeric(18, 4),
	"volume" bigint DEFAULT 0 NOT NULL,
	"change" numeric(18, 4) DEFAULT '0.0000' NOT NULL,
	"change_percent" numeric(8, 4) DEFAULT '0.0000' NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"market_status" varchar(50) DEFAULT 'CLOSED' NOT NULL,
	"data_freshness" varchar(50) DEFAULT 'EOD' NOT NULL,
	"as_of" timestamp with time zone,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" varchar(50) DEFAULT 'DEVELOPMENT_STUB' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_quotes" ADD CONSTRAINT "market_quotes_instrument_id_market_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."market_instruments"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_market_instruments_exch_sym" ON "market_instruments" ("exchange","symbol");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_market_instruments_symbol" ON "market_instruments" ("symbol");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_market_instruments_type" ON "market_instruments" ("security_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_market_instruments_status" ON "market_instruments" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_market_instruments_provider" ON "market_instruments" ("provider");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_market_quotes_instrument" ON "market_quotes" ("instrument_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_market_quotes_freshness" ON "market_quotes" ("data_freshness");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_market_quotes_provider" ON "market_quotes" ("provider");
