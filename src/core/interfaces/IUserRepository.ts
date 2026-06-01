import type { UserRow, NewUserRow } from '../../infrastructure/db/schema.js';

export interface IUserRepository {
  findByTelegramId(telegramId: number): Promise<UserRow | undefined>;
  upsert(data: NewUserRow): Promise<UserRow>;
}
