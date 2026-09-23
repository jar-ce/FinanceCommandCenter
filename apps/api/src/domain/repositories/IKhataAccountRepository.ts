import { KhataAccountRow, NewKhataAccountRow } from '../../db/schema/khata-accounts.js';

export interface AccountFilter {
  userId: string;
  search?: string;
  accountType?: string;
  status?: string;
}

export interface IKhataAccountRepository {
  create(data: NewKhataAccountRow): Promise<KhataAccountRow>;
  findById(id: string, userId: string): Promise<KhataAccountRow | null>;
  list(filter: AccountFilter): Promise<KhataAccountRow[]>;
  update(id: string, userId: string, data: Partial<NewKhataAccountRow>): Promise<KhataAccountRow | null>;
  archive(id: string, userId: string): Promise<KhataAccountRow | null>;
}
