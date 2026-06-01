import pino, { type Logger as PinoInstance } from 'pino';
import type { ILogger, LogContext } from '../../core/interfaces/ILogger.js';
import type { Config } from '../../config/index.js';

export class PinoLogger implements ILogger {
  private readonly logger: PinoInstance;

  constructor(config: Pick<Config, 'NODE_ENV' | 'LOG_LEVEL'>, existingLogger?: PinoInstance) {
    if (existingLogger) {
      this.logger = existingLogger;
      return;
    }

    if (config.NODE_ENV !== 'production') {
      this.logger = pino({
        level: config.LOG_LEVEL,
        transport: { target: 'pino-pretty', options: { colorize: true } },
      });
    } else {
      this.logger = pino({ level: config.LOG_LEVEL });
    }
  }

  debug(msg: string, ctx?: LogContext): void {
    this.logger.debug(ctx ?? {}, msg);
  }

  info(msg: string, ctx?: LogContext): void {
    this.logger.info(ctx ?? {}, msg);
  }

  warn(msg: string, ctx?: LogContext): void {
    this.logger.warn(ctx ?? {}, msg);
  }

  error(msg: string, ctx?: LogContext): void {
    this.logger.error(ctx ?? {}, msg);
  }

  fatal(msg: string, ctx?: LogContext): void {
    this.logger.fatal(ctx ?? {}, msg);
  }

  child(bindings: LogContext): ILogger {
    return new PinoLogger(
      // Config is not needed when wrapping an existing pino instance
      { NODE_ENV: 'production', LOG_LEVEL: 'info' },
      this.logger.child(bindings),
    );
  }
}
