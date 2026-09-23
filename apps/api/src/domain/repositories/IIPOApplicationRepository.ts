import { IPOApplicationSelect, IPOApplicationInsert } from '../../db/schema/ipo-applications.js';

export interface IPOApplicationSearchFilters {
  userId: string;
  search?: string;
  status?: string;
  ipoId?: string;
  accountId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface EnrichedIPOApplication extends IPOApplicationSelect {
  ipoName?: string;
  issuerName?: string;
  symbol?: string | null;
  accountDisplayName?: string;
  estimatedAmount?: string | null;
}

export interface IPOApplicationListResult {
  applications: EnrichedIPOApplication[];
  totalCount: number;
}

export interface IPOApplicationSummaryCounts {
  total: number;
  draft: number;
  submitted: number;
  paymentPending: number;
  paymentConfirmed: number;
  completed: number;
  cancelled: number;
}

export interface IIPOApplicationRepository {
  list(filters: IPOApplicationSearchFilters): Promise<IPOApplicationListResult>;
  getById(id: string, userId: string): Promise<EnrichedIPOApplication | null>;
  create(data: IPOApplicationInsert, txContext?: any): Promise<IPOApplicationSelect>;
  update(id: string, userId: string, data: Partial<IPOApplicationInsert>, txContext?: any): Promise<IPOApplicationSelect | null>;
  updateStatus(id: string, userId: string, status: string, txContext?: any): Promise<IPOApplicationSelect | null>;
  getSummary(userId: string): Promise<IPOApplicationSummaryCounts>;
}
