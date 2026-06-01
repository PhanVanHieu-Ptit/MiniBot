import { config } from './config/index.js';
import { buildContainer } from './container/index.js';
import { createBot } from './bot/index.js';

async function main() {
  const container = buildContainer(config);
  const { logger } = container;

  const bot = createBot(container);

  process.once('SIGINT', () => {
    logger.info('SIGINT received, stopping bot');
    void bot.stop();
  });
  process.once('SIGTERM', () => {
    logger.info('SIGTERM received, stopping bot');
    void bot.stop();
  });

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
