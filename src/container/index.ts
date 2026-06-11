import type { Config } from '../config/index.js';
import { PinoLogger } from '../infrastructure/logger/PinoLogger.js';
import { createDbClient } from '../infrastructure/db/client.js';
import { UserRepository } from '../infrastructure/db/repositories/UserRepository.js';
import { MessageRepository } from '../infrastructure/db/repositories/MessageRepository.js';
import { GeminiProvider } from '../infrastructure/ai/GeminiProvider.js';
import { ChatService } from '../features/chat/service.js';
import type { ILogger } from '../core/interfaces/ILogger.js';

export interface Container {
  logger: ILogger;
  userRepo: UserRepository;
  messageRepo: MessageRepository;
  aiProvider: GeminiProvider;
  chatService: ChatService;
  config: Config;
  close: () => Promise<void>;
}

export async function buildContainer(config: Config): Promise<Container> {
  const logger = new PinoLogger(config);

  const { db, close } = await createDbClient(config);

  const userRepo = new UserRepository(db, logger.child({ service: 'UserRepository' }));
  const messageRepo = new MessageRepository(db, logger.child({ service: 'MessageRepository' }));

  const aiProvider = new GeminiProvider(config, logger.child({ service: 'GeminiProvider' }));

  const chatService = new ChatService({
    userRepo,
    messageRepo,
    aiProvider,
    logger: logger.child({ service: 'ChatService' }),
    config,
  });

  return { logger, userRepo, messageRepo, aiProvider, chatService, config, close };
}
