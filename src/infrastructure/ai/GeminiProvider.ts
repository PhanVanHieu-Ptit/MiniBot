import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import type { IAIProvider } from '../../core/interfaces/IAIProvider.js';
import type { ILogger } from '../../core/interfaces/ILogger.js';
import type { Config } from '../../config/index.js';
import type { ChatMessage } from '../../types/index.js';
import { withRetry } from '../retry/withRetry.js';

const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

const SYSTEM_INSTRUCTION = `You are a helpful, concise AI assistant.
Respond in the same language the user writes in.
Be direct and avoid unnecessary filler phrases.`;

function toGeminiHistory(history: ChatMessage[]) {
  return history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));
}

export class GeminiProvider implements IAIProvider {
  private readonly model;
  private readonly logger: ILogger;

  constructor(config: Pick<Config, 'GEMINI_API_KEY' | 'GEMINI_MODEL'>, logger: ILogger) {
    this.logger = logger;
    const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    this.model = genAI.getGenerativeModel({
      model: config.GEMINI_MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      safetySettings: SAFETY_SETTINGS,
    });
  }

  async chat(history: ChatMessage[], userMessage: string): Promise<string> {
    return withRetry(
      async () => {
        const chat = this.model.startChat({ history: toGeminiHistory(history) });
        const result = await chat.sendMessage(userMessage);
        const response = result.response;

        if (response.promptFeedback?.blockReason) {
          this.logger.warn('Gemini blocked content', {
            reason: response.promptFeedback.blockReason,
          });
          return `I can't respond to that (blocked: ${response.promptFeedback.blockReason}).`;
        }

        const text = response.text();
        return text || "I couldn't generate a response. Please try again.";
      },
      {
        onRetry: (err, attempt) => {
          this.logger.warn('GeminiProvider.chat retry', { attempt, error: String(err) });
        },
      },
    );
  }

  async *chatStream(history: ChatMessage[], userMessage: string): AsyncGenerator<string> {
    const chat = this.model.startChat({ history: toGeminiHistory(history) });

    const result = await withRetry(() => chat.sendMessageStream(userMessage), {
      onRetry: (err, attempt) => {
        this.logger.warn('GeminiProvider.chatStream retry', { attempt, error: String(err) });
      },
    });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }
}
