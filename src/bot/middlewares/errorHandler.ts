import type { BotError } from 'grammy';
import type { ILogger } from '../../core/interfaces/ILogger.js';

export function createErrorHandler(logger: ILogger) {
  const log = logger.child({ middleware: 'errorHandler' });

  return async (err: BotError): Promise<void> => {
    const { ctx, error } = err;
    log.error('unhandled bot error', {
      updateId: ctx.update.update_id,
      userId: ctx.from?.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    try {
      await ctx.reply('An error occurred. Please try again.');
    } catch {
      // Swallow — reply may fail if the original message was deleted
    }
  };
}
