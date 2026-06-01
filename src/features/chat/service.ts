import type { IAIProvider } from '../../core/interfaces/IAIProvider.js';
import type { ILogger } from '../../core/interfaces/ILogger.js';
import type { IMessageRepository } from '../../core/interfaces/IMessageRepository.js';
import type { IUserRepository } from '../../core/interfaces/IUserRepository.js';
import type { Config } from '../../config/index.js';
import type { ChatContext } from './types.js';

interface ChatServiceDeps {
  userRepo: IUserRepository;
  messageRepo: IMessageRepository;
  aiProvider: IAIProvider;
  logger: ILogger;
  config: Pick<Config, 'MAX_HISTORY_MESSAGES'>;
}

export class ChatService {
  constructor(private readonly deps: ChatServiceDeps) {}

  private async getOrCreateUser(ctx: ChatContext) {
    const existing = await this.deps.userRepo.findByTelegramId(ctx.telegramId);
    if (existing) return existing;
    return this.deps.userRepo.upsert({
      telegramId: ctx.telegramId,
      username: ctx.username ?? null,
      firstName: ctx.firstName ?? null,
    });
  }

  async chat(ctx: ChatContext): Promise<string> {
    const user = await this.getOrCreateUser(ctx);
    const history = await this.deps.messageRepo.findByUserId(
      user.id,
      this.deps.config.MAX_HISTORY_MESSAGES,
    );

    const response = await this.deps.aiProvider.chat(
      history.map((r) => ({ role: r.role, content: r.content })),
      ctx.userMessage,
    );

    await this.deps.messageRepo.insertMany([
      { userId: user.id, role: 'user', content: ctx.userMessage },
      { userId: user.id, role: 'model', content: response },
    ]);

    return response;
  }

  async *chatStream(ctx: ChatContext): AsyncGenerator<string> {
    const user = await this.getOrCreateUser(ctx);
    const history = await this.deps.messageRepo.findByUserId(
      user.id,
      this.deps.config.MAX_HISTORY_MESSAGES,
    );

    let fullResponse = '';

    const stream = this.deps.aiProvider.chatStream(
      history.map((r) => ({ role: r.role, content: r.content })),
      ctx.userMessage,
    );

    for await (const chunk of stream) {
      fullResponse += chunk;
      yield chunk;
    }

    await this.deps.messageRepo.insertMany([
      { userId: user.id, role: 'user', content: ctx.userMessage },
      { userId: user.id, role: 'model', content: fullResponse },
    ]);

    this.deps.logger.debug('chat stream complete', {
      userId: user.id,
      responseLength: fullResponse.length,
    });
  }
}
