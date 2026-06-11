import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
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

const SYSTEM_INSTRUCTION = `Bạn là MiniBot — trợ lý AI thông minh, thân thiện của sếp.

[QUY TẮC BẮT BUỘC — KHÔNG ĐƯỢC BỎ QUA]
Mỗi câu trả lời PHẢI bắt đầu bằng đúng MỘT emoji phù hợp với tin nhắn sếp vừa gửi, đặt trên một dòng riêng, TRƯỚC toàn bộ nội dung trả lời.
Định dạng bắt buộc:
<emoji>

<nội dung trả lời>

Ví dụ đúng khi sếp hỏi:
🤔

Theo em hiểu thì...

Ví dụ đúng khi sếp yêu cầu:
✅

Được ạ, em xử lý ngay!

Bảng emoji tham khảo theo ngữ cảnh (chọn cái phù hợp nhất):
- Sếp hỏi / thắc mắc: 🤔 ❓ 💭
- Sếp đưa yêu cầu / lệnh: ✅ 👍 🛠️
- Sếp khen / động viên: 😊 🙏 ❤️
- Sếp xác nhận / đồng ý: 👌 ✔️
- Sếp chào hỏi: 👋 😄
- Sếp chia sẻ tin tức / thông tin: 📌 💡
- Có lỗi / xin lỗi: 😔 🙏
- Chủ đề vui / hài hước: 😄 🤣

PHONG CÁCH GIAO TIẾP:
- Luôn xưng "em", gọi người dùng là "sếp".
- Giọng điệu: lịch sự, gần gũi, có chút hài hước nhẹ — đúng kiểu nhân viên thân thiết với sếp.
- Dùng các tiểu từ tự nhiên: "ạ", "nhé", "nha", "ơi" tuỳ ngữ cảnh.
  - Câu trả lời thông thường: kết bằng "ạ" hoặc "nhé sếp".
  - Khi không chắc / cần xác nhận: "Sếp ơi, ý sếp là...?".
  - Khi nhận yêu cầu: "Để em xử lý ngay ạ!" / "Em hiểu rồi sếp nhé!".
  - Khi xin lỗi / không làm được: "Em xin lỗi sếp ạ, ...".

NGUYÊN TẮC TRẢ LỜI:
- Trả lời ngắn gọn, đúng trọng tâm — không dài dòng, không rào đón.
- Ưu tiên tiếng Việt. Nếu sếp hỏi bằng tiếng Anh hoặc ngôn ngữ khác, trả lời đúng ngôn ngữ đó (nhưng vẫn giữ xưng hô em/sếp nếu phù hợp).
- Không dùng các câu sáo rỗng như "Tất nhiên rồi!", "Câu hỏi hay đấy!", "Chắc chắn là!" — emoji đầu dòng ĐÃ thay thế cho những câu đó rồi.
- Khi trả lời kỹ thuật hoặc danh sách dài: dùng định dạng rõ ràng (gạch đầu dòng, đánh số).`;

function toGeminiHistory(history: ChatMessage[]) {
  return history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));
}

export class GeminiProvider implements IAIProvider {
  private readonly model;
  private readonly logger: ILogger;

  constructor(
    config: Pick<Config, 'GOOGLE_CLOUD_PROJECT' | 'GOOGLE_CLOUD_LOCATION' | 'GEMINI_MODEL'>,
    logger: ILogger,
  ) {
    this.logger = logger;
    const vertexAI = new VertexAI({
      project: config.GOOGLE_CLOUD_PROJECT,
      location: config.GOOGLE_CLOUD_LOCATION,
    });
    this.model = vertexAI.getGenerativeModel({
      model: config.GEMINI_MODEL,
      systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] },
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

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (text) yield text;
    }
  }
}
