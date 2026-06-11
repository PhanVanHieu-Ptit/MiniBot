import type { Context } from 'grammy';
import type { ChatService } from './service.js';
import type { Config } from '../../config/index.js';
import type { ILogger } from '../../core/interfaces/ILogger.js';
import { splitMessage } from '../../utils/message.js';
import { rateLimiter } from '../../utils/rateLimit.js';

// Maps the initial "processing" reaction to a "done" reaction
const COMPLETION_EMOJI: Record<string, string> = {
  '👋': '🥰',   // greeted → warm response
  '🤔': '👌',   // was thinking → answered
  '👨‍💻': '✍️',  // coding request → wrote it
  '🔥': '💯',   // urgent → handled
  '🥰': '❤️',   // gratitude → love back
  '🤯': '🙏',   // error/shock → helped out
  '🏆': '😁',   // praise → happy
  '😂': '😁',   // funny → laughed along
  '❤️': '😍',   // love → adore
  '😱': '🤗',   // surprise → reassured
  '😢': '🤗',   // sad → comforted
  '🎉': '🎉',   // celebrate → celebrate together
  '👌': '👍',   // ok → confirmed done
  '👍': '✍️',   // default → wrote a response
};

function pickCompletionEmoji(initial: string): string {
  return COMPLETION_EMOJI[initial] ?? '✍️';
}

// Telegram only supports a fixed set of reaction emojis
function pickReactionEmoji(message: string): string {
  const lower = message.toLowerCase();

  // Greetings
  if (/^(hi\b|hello\b|hey\b|chào|xin chào|alo|good morning|good night|ngủ ngon)/.test(lower)) return '👋';

  // Gratitude
  if (/(cảm ơn|thanks|thank you|tks|thx|trân trọng)/.test(lower)) return '🥰';

  // Errors / bugs / broken
  if (/(lỗi|error|bug|crash|exception|không chạy|không được|broken|failed|fail|sai rồi)/.test(lower)) return '🤯';

  // Code / technical requests
  if (/(code|viết|implement|function|class|api|database|deploy|fix|refactor|review|typescript|javascript|python)/.test(lower)) return '👨‍💻';

  // Praise / compliments
  if (/(giỏi|hay|tuyệt|xuất sắc|ngon|đỉnh|pro|perfect|awesome|great|good job|well done)/.test(lower)) return '🏆';

  // Funny / jokes
  if (/(haha|hihi|hehe|lol|funny|vui|buồn cười|😂|🤣)/.test(lower)) return '😂';

  // Urgent / hot
  if (/(gấp|urgent|asap|khẩn|ngay|nhanh|immediately)/.test(lower)) return '🔥';

  // Thinking / asking
  if (/(tại sao|vì sao|why|how|như thế nào|làm sao|giải thích|explain|\?)/.test(lower)) return '🤔';

  // Love / like
  if (/(thích|love|yêu|❤️|cute|dễ thương)/.test(lower)) return '❤️';

  // Surprise / wow
  if (/(wow|ồ|ơ|thật không|really|seriously|không tin|ảo|thật ra|omg)/.test(lower)) return '😱';

  // Sad / bad news
  if (/(buồn|sad|tệ|chán|thất bại|mất|không ổn|tiếc)/.test(lower)) return '😢';

  // Celebrate / good news
  if (/(xong|done|hoàn thành|thành công|success|🎉|party|ship|release|merge)/.test(lower)) return '🎉';

  // Agreement / confirmation
  if (/^(ok\b|okay|oke|được|đồng ý|yes\b|đúng|right|correct|vâng|ừ\b)/.test(lower)) return '👌';

  return '👍';
}

export function createChatHandler(
  chatService: ChatService,
  config: Pick<Config, 'STREAM_THROTTLE_MS'>,
  logger: ILogger,
) {
  return async (ctx: Context): Promise<void> => {
    const text = ctx.message?.text;
    const from = ctx.from;

    if (!text || !from) return;

    if (!rateLimiter.isAllowed(from.id)) {
      await ctx.reply('⏳ Sếp nhắn nhanh quá, sếp chờ em một chút nhé!');
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const userMessageId = ctx.message?.message_id;
    const initialEmoji = pickReactionEmoji(text);

    const updateReaction = (emoji: string) => {
      if (!userMessageId) return;
      ctx.api
        .setMessageReaction(chatId, userMessageId, [{ type: 'emoji', emoji }])
        .catch(() => {});
    };

    // React to user's message with emoji immediately
    updateReaction(initialEmoji);

    // Show typing indicator and keep it alive during processing
    await ctx.api.sendChatAction(chatId, 'typing').catch(() => {});
    const typingInterval = setInterval(() => {
      ctx.api.sendChatAction(chatId, 'typing').catch(() => {});
    }, 4000);

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
        await ctx.api.editMessageText(chatId, messageId, '😔 Em xin lỗi sếp ạ, em không tạo được câu trả lời. Sếp thử lại nhé!');
        return;
      }

      if (accumulated.length > 4096) {
        await ctx.api.deleteMessage(chatId, messageId);
        const chunks = splitMessage(accumulated);
        for (const chunk of chunks) {
          await ctx.reply(chunk, { parse_mode: 'Markdown' }).catch(() =>
            ctx.reply(chunk),
          );
        }
      } else {
        await ctx.api
          .editMessageText(chatId, messageId, accumulated, { parse_mode: 'Markdown' })
          .catch(() => ctx.api.editMessageText(chatId, messageId, accumulated));
      }

      // Update reaction to "done" state after response is sent
      updateReaction(pickCompletionEmoji(initialEmoji));
    } catch (err) {
      logger.error('chat handler error', {
        userId: from.id,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      updateReaction('😔');
      await ctx.api
        .editMessageText(chatId, messageId, '😔 Em xin lỗi sếp ạ, có lỗi xảy ra rồi. Sếp thử lại nhé!')
        .catch(() => ctx.reply('😔 Em xin lỗi sếp ạ, có lỗi xảy ra rồi. Sếp thử lại nhé!'));
    } finally {
      clearInterval(typingInterval);
    }
  };
}
