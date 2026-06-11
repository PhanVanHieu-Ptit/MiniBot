import { config } from './config/index.js';
import { buildContainer } from './container/index.js';
import { createBot } from './bot/index.js';

async function main() {
  const container = await buildContainer(config);
  const { logger } = container;

  const bot = createBot(container);

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, stopping bot`);
    // Force exit after 5s if graceful stop hangs
    const timer = setTimeout(() => process.exit(1), 5000);
    timer.unref();
    bot
      .stop()
      .then(() => container.close())
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };

  process.once('SIGINT', () => { shutdown('SIGINT'); });
  process.once('SIGTERM', () => { shutdown('SIGTERM'); });

  logger.info('Starting MiniBot...');
  await bot.start({
    onStart: (info) => {
      logger.info('Bot ready', { username: info.username });
    },
  });
}

main().catch((err: unknown) => {
  // Logger may not exist yet if container failed to build
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
