import { IIPOAllotmentProvider, IPOAllotmentCheckRequest, IPOAllotmentProviderResultDTO } from '../../domain/providers/IIPOAllotmentProvider.js';

export class DevelopmentIPOAllotmentProvider implements IIPOAllotmentProvider {
  readonly providerId = 'DEVELOPMENT_STUB';
  readonly providerName = 'APEX OS Official Provider Stub';
  readonly capabilities = {
    canCheckAutomated: false,
    requiresManualWorkflow: true
  };

  async checkAllotment(request: IPOAllotmentCheckRequest): Promise<IPOAllotmentProviderResultDTO> {
    // ZERO FAKE DATA POLICY:
    // Development stub does NOT fabricate fake ALLOTTED or NOT_ALLOTTED outcomes.
    // Signals that automated access requires manual verification or is unavailable.
    return {
      allotmentStatus: 'UNKNOWN',
      verificationStatus: 'MANUAL_REQUIRED',
      verificationMethod: 'PROVIDER_API',
      appliedQuantity: request.appliedQuantity,
      allottedQuantity: 0,
      provider: this.providerId,
      source: 'Official Provider API Boundary (Automated access unavailable)',
      externalReference: null,
      retrievedAt: new Date(),
      verifiedAt: undefined,
      notes: 'Automated verification is unavailable. Perform manual verification via official registrar or exchange portal.'
    };
  }
}
