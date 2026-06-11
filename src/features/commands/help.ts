import type { Context } from 'grammy';

export async function helpCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    'MiniBot — Trợ lý AI của sếp ạ!\n\n' +
      '/start — khởi động lại bot\n' +
      '/help — xem tin nhắn này\n' +
      '/reset — xoá lịch sử trò chuyện\n\n' +
      'Sếp nhắn bất cứ điều gì, em sẽ hỗ trợ ngay nhé!',
  );
}
