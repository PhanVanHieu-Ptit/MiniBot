import type { Context, NextFunction } from 'grammy';
import type { ILogger } from '../../core/interfaces/ILogger.js';

export function createLoggerMiddleware(logger: ILogger) {
  const log = logger.child({ middleware: 'request' });

  return async (ctx: Context, next: NextFunction): Promise<void> => {
    const start = Date.now();
    await next();
    log.info('update handled', {
      userId: ctx.from?.id,
      username: ctx.from?.username,
      updateId: ctx.update.update_id,
      text: ctx.message?.text?.slice(0, 80),
      durationMs: Date.now() - start,
    });
  };
}
