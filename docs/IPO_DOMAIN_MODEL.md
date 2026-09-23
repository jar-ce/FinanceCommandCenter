# APEX OS — IPO Domain Model Specification

## 1. Domain Entities

### `IPOMasterRecord` (`ipos`)
The canonical master record for an Initial Public Offering in APEX OS.

| Field | Type | Description |
|---|---|---|
| `id` | UUID v4 (PK) | System canonical identifier |
| `external_id` | VARCHAR(255) | Provider-assigned unique ID |
| `provider` | VARCHAR(50) | Provider identifier (`DEVELOPMENT_STUB`, `NSE_PUBLIC`, etc.) |
| `source` | VARCHAR(255) | Data source disclosure text |
| `issuer_name` | VARCHAR(255) | Full corporate issuer name |
| `ipo_name` | VARCHAR(255) | Official issue name |
| `symbol` | VARCHAR(50) | Exchange trading symbol |
| `exchange` | VARCHAR(50) | `NSE`, `BSE`, `NSE_BSE`, `UNKNOWN` |
| `security_type` | VARCHAR(50) | `EQUITY`, `DEBT` |
| `issue_type` | VARCHAR(50) | `MAINBOARD`, `SME`, `UNKNOWN` |
| `status` | VARCHAR(50) | `UPCOMING`, `OPEN`, `CLOSED`, `LISTED`, `CANCELLED`, `POSTPONED` |
| `open_date` | TIMESTAMPTZ | Issue opening date |
| `close_date` | TIMESTAMPTZ | Issue closing date |
| `listing_date` | TIMESTAMPTZ | Expected or actual listing date |
| `face_value` | NUMERIC(18, 4) | Face value per share |
| `price_band_low` | NUMERIC(18, 4) | Floor price |
| `price_band_high` | NUMERIC(18, 4) | Cap price |
| `lot_size` | INTEGER | Minimum application lot size |
| `issue_size` | NUMERIC(18, 4) | Total issue size |
| `fresh_issue_size` | NUMERIC(18, 4) | Fresh capital component |
| `offer_for_sale_size` | NUMERIC(18, 4) | Offer for sale component |
| `retrieved_at` | TIMESTAMPTZ | Provider synchronization timestamp |

---

## 2. Derived Calculations
- **Maximum Application Lot Cost**: Derived dynamically in `IPOService` using `Decimal.js` fixed-precision arithmetic (`priceBandHigh * lotSize`). Never calculated with floating-point math.

---

## 3. Database Constraints
- Unique index on `(provider, external_id)` guarantees duplicate prevention across provider synchronization runs.
- Shared application dataset (not tied to specific user IDs; user-specific application data belongs strictly to Phase 7).
