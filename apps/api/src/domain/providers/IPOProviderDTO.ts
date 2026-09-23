export interface IPOProviderDTO {
  externalId: string;
  provider: string;
  source: string;
  issuerName: string;
  ipoName: string;
  symbol?: string;
  exchange?: 'NSE' | 'BSE' | 'NSE_BSE' | 'UNKNOWN';
  securityType?: string;
  issueType?: 'MAINBOARD' | 'SME' | 'UNKNOWN';
  status: 'UPCOMING' | 'OPEN' | 'CLOSED' | 'LISTED' | 'CANCELLED' | 'POSTPONED';
  openDate?: string;   // ISO string or date
  closeDate?: string;  // ISO string or date
  listingDate?: string;// ISO string or date
  faceValue?: string;
  priceBandLow?: string;
  priceBandHigh?: string;
  lotSize?: number;
  issueSize?: string;
  freshIssueSize?: string;
  offerForSaleSize?: string;
  retrievedAt?: string;
}
