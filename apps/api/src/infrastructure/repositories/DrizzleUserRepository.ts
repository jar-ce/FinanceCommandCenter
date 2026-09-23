import { IUserRepository } from '../../domain/repositories/IUserRepository.js';
import { users, UserRow, NewUserRow } from '../../db/schema/users.js';
import { getDb } from '../../db/index.js';
import { eq } from 'drizzle-orm';

export class DrizzleUserRepository implements IUserRepository {
  async findById(id: string): Promise<UserRow | null> {
    const db = await getDb();
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const db = await getDb();
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  }

  async create(newUser: NewUserRow): Promise<UserRow> {
    const db = await getDb();
    const result = await db.insert(users).values(newUser).returning();
    return result[0];
  }

  async listAll(): Promise<UserRow[]> {
    const db = await getDb();
    return await db.select().from(users);
  }
}
