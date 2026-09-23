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
