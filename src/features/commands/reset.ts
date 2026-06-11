import type { Context } from 'grammy';
import type { IUserRepository } from '../../core/interfaces/IUserRepository.js';
import type { IMessageRepository } from '../../core/interfaces/IMessageRepository.js';

export function createResetCommand(userRepo: IUserRepository, messageRepo: IMessageRepository) {
  return async (ctx: Context): Promise<void> => {
    const from = ctx.from;
    if (!from) return;

    const user = await userRepo.findByTelegramId(from.id);
    if (user) {
      await messageRepo.deleteByUserId(user.id);
    }

    await ctx.reply('Em đã xoá lịch sử trò chuyện rồi ạ! Mình bắt đầu lại từ đầu nhé sếp!');
  };
}
