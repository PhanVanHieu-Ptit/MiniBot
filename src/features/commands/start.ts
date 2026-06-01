import type { Context } from 'grammy';
import type { IUserRepository } from '../../core/interfaces/IUserRepository.js';

export function createStartCommand(userRepo: IUserRepository) {
  return async (ctx: Context): Promise<void> => {
    const from = ctx.from;
    if (!from) return;

    await userRepo.upsert({
      telegramId: from.id,
      username: from.username ?? null,
      firstName: from.first_name,
    });

    const name = from.first_name;
    await ctx.reply(
      `Hi ${name}! I'm MiniBot, your AI assistant powered by Gemini.\n\n` +
        'Just send me a message to chat.\n\n' +
        'Commands:\n' +
        '/help — show this help\n' +
        '/reset — clear conversation history',
    );
  };
}
