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
      `Chào sếp ${name}! Em là MiniBot — trợ lý AI của sếp, chạy bằng Gemini ạ.\n\n` +
        'Sếp cứ nhắn gì em cũng trả lời nhé!\n\n' +
        'Lệnh:\n' +
        '/help — xem hướng dẫn\n' +
        '/reset — xoá lịch sử trò chuyện',
    );
  };
}
