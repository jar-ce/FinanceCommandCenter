# APEX OS — IPO Provider Architecture Specification

## 1. Provider Abstraction Contract (`IIPODataProvider`)

The domain and application service layers interact with external data providers exclusively through the `IIPODataProvider` contract:

```typescript
export interface IIPODataProvider {
  readonly providerId: string;
  readonly providerName: string;
  fetchIPOs(): Promise<IPOProviderDTO[]>;
  fetchIPOByExternalId(externalId: string): Promise<IPOProviderDTO | null>;
}
```

---

## 2. Infrastructure Provider Implementations

### `DevelopmentIPOProvider`
- Standard development provider boundary.
- **Zero Fake Data Policy**: Returns `[]` (empty list) when no external provider URL (`IPO_DATA_PROVIDER_URL`) is defined in the environment.
- Does not contain fabricated IPOs, fake dates, or invented financial figures.

---

## 3. Data Normalization & Validation Flow

```
External Provider API / Disclosure Feed
                 │
                 ▼
          IPOProviderDTO
                 │
                 ▼
       Zod Schema Validation (`ipoProviderDtoSchema`)
                 │
                 ▼
          IPOService Normalization
                 │
                 ▼
      DrizzleIPORepository (Upsert via `(provider, external_id)`)
                 │
                 ▼
      Canonical `ipos` Database Table
```

---

## 4. Provenance & Freshness Metadata
Every canonical record tracks:
- `provider`: Identification string of data source.
- `source`: Descriptive text of data feed.
- `retrievedAt`: Timestamp of fetch operation.
- `updatedAt`: Timestamp of database record modification.
