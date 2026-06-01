import type { Context } from 'grammy';
import type { ChatService } from './service.js';
import type { Config } from '../../config/index.js';
import { splitMessage } from '../../utils/message.js';
import { rateLimiter } from '../../utils/rateLimit.js';

export function createChatHandler(
  chatService: ChatService,
  config: Pick<Config, 'STREAM_THROTTLE_MS'>,
) {
  return async (ctx: Context): Promise<void> => {
    const text = ctx.message?.text;
    const from = ctx.from;

    if (!text || !from) return;

    if (!rateLimiter.isAllowed(from.id)) {
      await ctx.reply("You're sending messages too fast. Please wait a moment.");
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const placeholderMsg = await ctx.reply('...');
    const messageId = placeholderMsg.message_id;

    let accumulated = '';
    let lastEditAt = Date.now();

    try {
      const stream = chatService.chatStream({
        telegramId: from.id,
        username: from.username,
        firstName: from.first_name,
        userMessage: text,
      });

      for await (const chunk of stream) {
        accumulated += chunk;
        const elapsed = Date.now() - lastEditAt;
        if (elapsed >= config.STREAM_THROTTLE_MS) {
          try {
            await ctx.api.editMessageText(chatId, messageId, accumulated);
            lastEditAt = Date.now();
          } catch {
            // Ignore edit failures (race conditions, identical content)
          }
        }
      }

      // Final update with full response
      if (accumulated.length === 0) {
        await ctx.api.editMessageText(chatId, messageId, "I couldn't generate a response.");
        return;
      }

      if (accumulated.length > 4096) {
        await ctx.api.deleteMessage(chatId, messageId);
        const chunks = splitMessage(accumulated);
        for (const chunk of chunks) {
          await ctx.reply(chunk, { parse_mode: 'Markdown' });
        }
      } else {
        await ctx.api.editMessageText(chatId, messageId, accumulated, {
          parse_mode: 'Markdown',
        });
      }
    } catch {
      await ctx.api
        .editMessageText(chatId, messageId, 'An error occurred. Please try again.')
        .catch(() => ctx.reply('An error occurred. Please try again.'));
    }
  };
}
