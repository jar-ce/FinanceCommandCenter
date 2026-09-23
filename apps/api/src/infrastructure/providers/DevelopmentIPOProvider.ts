import { IIPODataProvider } from '../../domain/providers/IIPODataProvider.js';
import { IPOProviderDTO } from '../../domain/providers/IPOProviderDTO.js';

export class DevelopmentIPOProvider implements IIPODataProvider {
  readonly providerId = 'DEVELOPMENT_STUB';
  readonly providerName = 'Official Public Exchange Feed (Development Boundary)';

  async fetchIPOs(): Promise<IPOProviderDTO[]> {
    const providerUrl = process.env.IPO_DATA_PROVIDER_URL;
    if (!providerUrl) {
      // Return empty list when no external provider endpoint is configured.
      // Strict Policy: Zero fake/hardcoded IPO records are returned.
      return [];
    }

    const response = await fetch(providerUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      throw new Error(`Provider HTTP Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Provider response error: Payload must be a JSON array of IPO records.');
    }
    return data as IPOProviderDTO[];
  }

  async fetchIPOByExternalId(externalId: string): Promise<IPOProviderDTO | null> {
    const ipos = await this.fetchIPOs();
    return ipos.find(i => i.externalId === externalId) || null;
  }
}
