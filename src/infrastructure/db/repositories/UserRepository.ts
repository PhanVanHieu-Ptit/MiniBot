import { eq } from 'drizzle-orm';
import type { IUserRepository } from '../../../core/interfaces/IUserRepository.js';
import type { ILogger } from '../../../core/interfaces/ILogger.js';
import type { DB } from '../client.js';
import { users, type NewUserRow, type UserRow } from '../schema.js';
import { withRetry } from '../../retry/withRetry.js';

export class UserRepository implements IUserRepository {
  constructor(
    private readonly db: DB,
    private readonly logger: ILogger,
  ) {}

  async findByTelegramId(telegramId: number): Promise<UserRow | undefined> {
    return withRetry(async () => {
      const rows = await this.db
        .select()
        .from(users)
        .where(eq(users.telegramId, telegramId))
        .limit(1);
      return rows[0];
    });
  }

  async upsert(data: NewUserRow): Promise<UserRow> {
    return withRetry(
      async () => {
        const [row] = await this.db
          .insert(users)
          .values(data)
          .onConflictDoUpdate({
            target: users.telegramId,
            set: {
              username: data.username,
              firstName: data.firstName,
            },
          })
          .returning();

        if (!row) throw new Error('UserRepository.upsert: no row returned');
        return row;
      },
      {
        onRetry: (err, attempt) => {
          this.logger.warn('UserRepository.upsert retry', { attempt, error: String(err) });
        },
      },
    );
  }
}
