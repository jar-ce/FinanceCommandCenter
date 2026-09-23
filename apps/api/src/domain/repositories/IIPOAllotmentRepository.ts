import { IPOAllotmentResultSelect, IPOAllotmentResultInsert } from '../../db/schema/ipo-allotments.js';

export interface EnrichedIPOAllotmentResult extends IPOAllotmentResultSelect {
  ipoName?: string;
  issuerName?: string;
  symbol?: string | null;
  applicationDate?: Date;
  accountDisplayName?: string;
  maskedApplicationNumber?: string | null;
}

export interface IPOAllotmentSearchFilters {
  userId: string;
  status?: string;
  verificationStatus?: string;
  search?: string;
  ipoId?: string;
  applicationId?: string;
  page?: number;
  limit?: number;
}

export interface IPOAllotmentSummaryData {
  total: number;
  verified: number;
  unverified: number;
  stale: number;
  manualRequired: number;
  unavailable: number;
  allottedCount: number;
  partiallyAllottedCount: number;
  notAllottedCount: number;
}

export interface IIPOAllotmentRepository {
  list(filters: IPOAllotmentSearchFilters): Promise<{ allotments: EnrichedIPOAllotmentResult[]; totalCount: number }>;
  getById(id: string, userId: string): Promise<EnrichedIPOAllotmentResult | null>;
  getByApplicationId(applicationId: string, userId: string): Promise<EnrichedIPOAllotmentResult | null>;
  upsert(result: IPOAllotmentResultInsert): Promise<IPOAllotmentResultSelect>;
  getSummary(userId: string): Promise<IPOAllotmentSummaryData>;
}
