export type MessageRole = 'user' | 'model';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface User {
  id: number;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  createdAt: Date;
}
