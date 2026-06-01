import type { ChatMessage } from '../../types/index.js';

export interface IAIProvider {
  chat(history: ChatMessage[], userMessage: string): Promise<string>;
  chatStream(history: ChatMessage[], userMessage: string): AsyncGenerator<string>;
}
