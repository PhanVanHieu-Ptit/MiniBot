import { desc, eq } from 'drizzle-orm';
import type { IMessageRepository } from '../../../core/interfaces/IMessageRepository.js';
import type { ILogger } from '../../../core/interfaces/ILogger.js';
import type { DB } from '../client.js';
import { messages, type MessageRow, type NewMessageRow } from '../schema.js';
import { withRetry } from '../../retry/withRetry.js';

export class MessageRepository implements IMessageRepository {
  constructor(
    private readonly db: DB,
    private readonly logger: ILogger,
  ) {}

  async findByUserId(userId: number, limit: number): Promise<MessageRow[]> {
    return withRetry(async () => {
      const rows = await this.db
        .select()
        .from(messages)
        .where(eq(messages.userId, userId))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
      return rows.reverse();
    });
  }

  async insertMany(rows: NewMessageRow[]): Promise<void> {
    if (rows.length === 0) return;
    await withRetry(
      async () => {
        await this.db.insert(messages).values(rows);
      },
      {
        onRetry: (err, attempt) => {
          this.logger.warn('MessageRepository.insertMany retry', { attempt, error: String(err) });
        },
      },
    );
  }

  async deleteByUserId(userId: number): Promise<void> {
    await withRetry(
      async () => {
        await this.db.delete(messages).where(eq(messages.userId, userId));
      },
      {
        onRetry: (err, attempt) => {
          this.logger.warn('MessageRepository.deleteByUserId retry', {
            attempt,
            error: String(err),
          });
        },
      },
    );
  }
}
