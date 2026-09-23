CREATE TABLE IF NOT EXISTS "ipos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"provider" varchar(50) DEFAULT 'DEVELOPMENT_STUB' NOT NULL,
	"source" varchar(255) DEFAULT 'System Default Feed' NOT NULL,
	"issuer_name" varchar(255) NOT NULL,
	"ipo_name" varchar(255) NOT NULL,
	"symbol" varchar(50),
	"exchange" varchar(50) DEFAULT 'UNKNOWN' NOT NULL,
	"security_type" varchar(50) DEFAULT 'EQUITY' NOT NULL,
	"issue_type" varchar(50) DEFAULT 'MAINBOARD' NOT NULL,
	"status" varchar(50) DEFAULT 'UPCOMING' NOT NULL,
	"open_date" timestamp with time zone,
	"close_date" timestamp with time zone,
	"listing_date" timestamp with time zone,
	"face_value" numeric(18, 4),
	"price_band_low" numeric(18, 4),
	"price_band_high" numeric(18, 4),
	"lot_size" integer,
	"issue_size" numeric(18, 4),
	"fresh_issue_size" numeric(18, 4),
	"offer_for_sale_size" numeric(18, 4),
	"retrieved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ipos_provider_external_id_idx" ON "ipos" ("provider", "external_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ipos_status_idx" ON "ipos" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ipos_exchange_idx" ON "ipos" ("exchange");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ipos_issue_type_idx" ON "ipos" ("issue_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ipos_open_date_idx" ON "ipos" ("open_date");
