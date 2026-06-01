import type { Context, NextFunction } from 'grammy';
import type { Config } from '../../config/index.js';
import type { ILogger } from '../../core/interfaces/ILogger.js';

export function createAuthMiddleware(config: Pick<Config, 'ALLOWED_USER_IDS'>, logger: ILogger) {
  const log = logger.child({ middleware: 'auth' });

  return async (ctx: Context, next: NextFunction): Promise<void> => {
    if (config.ALLOWED_USER_IDS.length === 0) {
      return next();
    }

    const userId = ctx.from?.id;
    if (!userId || !config.ALLOWED_USER_IDS.includes(userId)) {
      log.warn('unauthorized access attempt', {
        userId,
        username: ctx.from?.username,
      });
      await ctx.reply('You are not authorized to use this bot.');
      return;
    }

    return next();
  };
}
