import type { MessageRow, NewMessageRow } from '../../infrastructure/db/schema.js';

export interface IMessageRepository {
  findByUserId(userId: number, limit: number): Promise<MessageRow[]>;
  insertMany(rows: NewMessageRow[]): Promise<void>;
  deleteByUserId(userId: number): Promise<void>;
}
