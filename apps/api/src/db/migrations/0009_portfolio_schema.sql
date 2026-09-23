CREATE TABLE IF NOT EXISTS "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "chk_portfolios_status" CHECK ("status" IN ('ACTIVE', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portfolio_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL REFERENCES "portfolios"("id") ON DELETE restrict,
	"instrument_id" uuid NOT NULL REFERENCES "market_instruments"("id") ON DELETE restrict,
	"transaction_type" varchar(20) NOT NULL,
	"transaction_date" timestamp with time zone NOT NULL,
	"quantity" numeric(18, 4) NOT NULL,
	"price" numeric(18, 4) NOT NULL,
	"gross_amount" numeric(18, 4) NOT NULL,
	"charges" numeric(18, 4) DEFAULT '0.0000' NOT NULL,
	"taxes" numeric(18, 4) DEFAULT '0.0000' NOT NULL,
	"total_amount" numeric(18, 4) NOT NULL,
	"external_reference" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_portfolio_tx_type" CHECK ("transaction_type" IN ('BUY', 'SELL')),
	CONSTRAINT "chk_portfolio_tx_qty" CHECK ("quantity" > 0),
	CONSTRAINT "chk_portfolio_tx_price" CHECK ("price" >= 0),
	CONSTRAINT "chk_portfolio_tx_charges" CHECK ("charges" >= 0),
	CONSTRAINT "chk_portfolio_tx_taxes" CHECK ("taxes" >= 0),
	CONSTRAINT "chk_portfolio_tx_gross" CHECK ("gross_amount" >= 0),
	CONSTRAINT "chk_portfolio_tx_total" CHECK ("total_amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portfolios_user_status" ON "portfolios" ("user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portfolio_tx_portfolio" ON "portfolio_transactions" ("portfolio_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portfolio_tx_instrument" ON "portfolio_transactions" ("instrument_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portfolio_tx_date" ON "portfolio_transactions" ("transaction_date");
