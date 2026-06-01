import { Bot } from 'grammy';
import type { Container } from '../container/index.js';
import { createAuthMiddleware } from './middlewares/auth.js';
import { createErrorHandler } from './middlewares/errorHandler.js';
import { createLoggerMiddleware } from './middlewares/logger.js';
import { helpCommand } from '../features/commands/help.js';
import { createStartCommand } from '../features/commands/start.js';
import { createResetCommand } from '../features/commands/reset.js';
import { createChatHandler } from '../features/chat/handler.js';

export function createBot(container: Container) {
  const { logger, config, chatService, userRepo, messageRepo } = container;

  const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

  bot.catch(createErrorHandler(logger));
  bot.use(createLoggerMiddleware(logger));
  bot.use(createAuthMiddleware(config, logger));

  bot.command('start', createStartCommand(userRepo));
  bot.command('help', helpCommand);
  bot.command('reset', createResetCommand(userRepo, messageRepo));
  bot.on('message:text', createChatHandler(chatService, config));

  return bot;
}
