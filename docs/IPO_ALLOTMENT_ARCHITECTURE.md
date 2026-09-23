# APEX OS — IPO Allotment Architecture Specification

## 1. Provider Abstraction Contract (`IIPOAllotmentProvider`)

Domain and service layers interact with external allotment sources exclusively through the `IIPOAllotmentProvider` interface:

```typescript
export interface IPOAllotmentCheckRequest {
  applicationId: string;
  ipoSymbol?: string | null;
  issuerName?: string;
  applicationNumber?: string | null;
  appliedQuantity: number;
}

export interface IPOAllotmentProviderResultDTO {
  allotmentStatus: 'UNKNOWN' | 'PENDING' | 'ALLOTTED' | 'PARTIALLY_ALLOTTED' | 'NOT_ALLOTTED' | 'REJECTED';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'STALE' | 'UNAVAILABLE' | 'MANUAL_REQUIRED';
  verificationMethod: 'PROVIDER_API' | 'PUBLIC_OFFICIAL' | 'MANUAL';
  appliedQuantity: number;
  allottedQuantity: number;
  provider: string;
  source: string;
  externalReference?: string | null;
  retrievedAt?: Date;
  verifiedAt?: Date;
  notes?: string | null;
}

export interface IIPOAllotmentProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly capabilities: {
    canCheckAutomated: boolean;
    requiresManualWorkflow: boolean;
  };
  checkAllotment(request: IPOAllotmentCheckRequest): Promise<IPOAllotmentProviderResultDTO>;
}
```

---

## 2. Infrastructure Provider Implementations

### `DevelopmentIPOAllotmentProvider`
- Standard development provider boundary.
- **Zero Fake Data Policy**: Returns `verificationStatus: 'MANUAL_REQUIRED'` or `'UNAVAILABLE'` with `allotmentStatus: 'UNKNOWN'`. Does not fabricate fake allotment outcomes or fake quantities.

---

## 3. Data Normalization & Validation Flow

```
External Official API / Public Feed
                 │
                 ▼
    IPOAllotmentProviderResultDTO
                 │
                 ▼
      State Protection Check (Preserve existing VERIFIED if provider is UNAVAILABLE)
                 │
                 ▼
      Quantity & Status Validation (`appliedQuantity > 0`, `0 <= allottedQuantity <= appliedQuantity`)
                 │
                 ▼
      Decimal.js Ratio Calculation (`allottedQuantity / appliedQuantity`)
                 │
                 ▼
    DrizzleIPOAllotmentRepository (`upsert` via `application_id`)
                 │
                 ▼
    Canonical `ipo_allotment_results` Database Table
```
