import { UserRow, NewUserRow } from '../../db/schema/users.js';

export interface IUserRepository {
  findById(id: string): Promise<UserRow | null>;
  findByEmail(email: string): Promise<UserRow | null>;
  create(user: NewUserRow): Promise<UserRow>;
  listAll(): Promise<UserRow[]>;
}
