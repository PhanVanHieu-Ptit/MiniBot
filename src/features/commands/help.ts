import type { Context } from 'grammy';

export async function helpCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    'MiniBot — AI Assistant\n\n' +
      '/start — start or restart the bot\n' +
      '/help — show this message\n' +
      '/reset — clear your conversation history\n\n' +
      'Send any message to chat with Gemini AI.',
  );
}
