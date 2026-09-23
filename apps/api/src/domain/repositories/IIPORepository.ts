import { IPOSelect, IPOInsert } from '../../db/schema/ipos.js';

export interface IPOSearchFilters {
  search?: string;
  status?: string;
  exchange?: string;
  issueType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface IPOListResult {
  ipos: IPOSelect[];
  totalCount: number;
}

export interface IPOPipelineCountSummary {
  upcoming: number;
  open: number;
  closed: number;
  listed: number;
  total: number;
}

export interface IIPORepository {
  list(filters: IPOSearchFilters): Promise<IPOListResult>;
  getById(id: string): Promise<IPOSelect | null>;
  getByExternalId(provider: string, externalId: string): Promise<IPOSelect | null>;
  upsert(ipo: IPOInsert, txContext?: any): Promise<IPOSelect>;
  getPipelineSummary(): Promise<IPOPipelineCountSummary>;
}
