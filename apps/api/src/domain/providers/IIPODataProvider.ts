import { IPOProviderDTO } from './IPOProviderDTO.js';

export interface IIPODataProvider {
  readonly providerId: string;
  readonly providerName: string;
  fetchIPOs(): Promise<IPOProviderDTO[]>;
  fetchIPOByExternalId(externalId: string): Promise<IPOProviderDTO | null>;
}
