import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { useStore } from "../store/useStore";
import { toast } from "sonner";

// Định nghĩa Schema cho nhân vật (ví dụ)
export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  description: z.string(),
  stats: z.object({
    intelligence: z.number(),
    strength: z.number(),
    agility: z.number()
  }),
  personality: z.string(),
  cot_reasoning: z.string().describe("Lý giải logic Chain-of-Thought cho việc tạo ra nhân vật này")
});

export type Character = z.infer<typeof CharacterSchema>;

class AIService {
  private apiKeysRotationIndex = 0;
  private apiKeysBlacklist = new Set<string>();

  private getNextPersonalKey(): string | null {
    const state = useStore.getState();
    const keys = state.personalApiKeys.map((k: string) => k.trim()).filter((k: string) => k.length > 0);
    if (keys.length === 0) return null;

    let validKeys = keys.filter((k: string) => !this.apiKeysBlacklist.has(k));
    if (validKeys.length === 0) {
      this.apiKeysBlacklist.clear();
      validKeys = keys;
    }

    let loopCount = 0;
    while (this.apiKeysBlacklist.has(keys[this.apiKeysRotationIndex % keys.length]) && loopCount < keys.length) {
      this.apiKeysRotationIndex = (this.apiKeysRotationIndex + 1) % keys.length;
      loopCount++;
    }

    const selectedKey = keys[this.apiKeysRotationIndex % keys.length];
    this.apiKeysRotationIndex = (this.apiKeysRotationIndex + 1) % keys.length;
    return selectedKey;
  }

  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  private async *withTelemetry(
    stream: AsyncGenerator<{ thought: string; text: string; usage: any }, any, any>,
    isUsingProxy: boolean,
    activeProxy: any,
    providedApiKey: string | null,
    model: string
  ) {
    const state = useStore.getState();
    const startTime = Date.now();
    let firstResponseTimeMs: number | null = null;
    let accumulatedText = "";
    let accumulatedThought = "";
    let inputTokens = 0;
    let outputTokens = 0;

    state.updateCurrentStreamStats({
      usedApiKey: !isUsingProxy && !!providedApiKey,
      usedProxy: isUsingProxy ? (activeProxy?.url || "Custom Proxy") : null,
      model: model,
      firstResponseTimeMs: null,
      totalTimeMs: null,
      vietnameseWordCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      timestamp: Date.now()
    });

    try {
      for await (const chunk of stream) {
        if (!firstResponseTimeMs && (chunk.text || chunk.thought)) {
          firstResponseTimeMs = Date.now() - startTime;
        }
        accumulatedText += chunk.text || "";
        accumulatedThought += chunk.thought || "";

        if (chunk.usage) {
          const u = chunk.usage;
          if (u.promptTokenCount !== undefined) inputTokens = u.promptTokenCount;
          else if (u.prompt_tokens !== undefined) inputTokens = u.prompt_tokens;
          else if (u.inputTokenCount !== undefined) inputTokens = u.inputTokenCount;

          if (u.candidatesTokenCount !== undefined) outputTokens = u.candidatesTokenCount;
          else if (u.completion_tokens !== undefined) outputTokens = u.completion_tokens;
          else if (u.outputTokenCount !== undefined) outputTokens = u.outputTokenCount;
        }

        const totalChars = accumulatedText + (accumulatedThought ? " " + accumulatedThought : "");
        const words = this.countWords(totalChars);

        state.updateCurrentStreamStats({
          firstResponseTimeMs,
          vietnameseWordCount: words,
          inputTokens,
          outputTokens,
          totalTimeMs: Date.now() - startTime
        });

        yield chunk;
      }
    } catch (err) {
      state.updateCurrentStreamStats({
        totalTimeMs: Date.now() - startTime
      });
      throw err;
    } finally {
      state.updateCurrentStreamStats({
        totalTimeMs: Date.now() - startTime
      });
    }
  }

  public async *generateStreamingContent(prompt: string, schema?: any, systemInstruction?: string) {
    const state = useStore.getState();
    let activeProxy = null;
    if (state.globalProxyEnabled) {
      activeProxy = state.proxies.find(p => p.id === state.activeProxyId) || (state.proxies.length > 0 ? state.proxies[0] : null);
    }
    const providedApiKey = this.getNextPersonalKey();
    const isUsingProxy = !!activeProxy;
    const model = isUsingProxy 
      ? (activeProxy.selectedModel || "gemini-3.1-pro-preview")
      : (state.selectedAIModel || "gemini-3.1-pro-preview");

    const rawStream = this.generateStreamingContentRaw(prompt, schema, systemInstruction);
    yield* this.withTelemetry(rawStream, isUsingProxy, activeProxy, providedApiKey, model);
  }

  /**
   * Cập nhật Streaming sử dụng backend proxy; nếu gặp 404 (Web Tĩnh không có backend)
   * hệ thống sẽ tự động chuyển mạch thông minh sang Gọi trực tiếp từ trình duyệt (Direct Client-Side Request).
   */
  private async *generateStreamingContentRaw(prompt: string, schema?: any, systemInstruction?: string) {
    const state = useStore.getState();
    let activeProxy = null;
    if (state.globalProxyEnabled) {
      activeProxy = state.proxies.find(p => p.id === state.activeProxyId) || (state.proxies.length > 0 ? state.proxies[0] : null);
    }
    
    // Key người dùng nhập
    const providedApiKey = this.getNextPersonalKey();
      
    let combinedSystemInstruction = systemInstruction || "";
    const isUsingProxy = !!activeProxy;
    const temperature = state.temperature;

    try {
      // 1. THỬ GỌI BACKEND TRUYỀN THỐNG (Khuyên dùng khi chạy trên AI Studio/máy chủ thật)
      const fetchUrl = '/api/generate-stream';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const bodyPayload: any = {
        prompt, schema, activeProxy, providedApiKey,
        systemInstruction: combinedSystemInstruction, temperature,
        selectedAIModel: state.selectedAIModel
      };

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload)
      });

      // Nếu gặp lỗi 404, tức là website được deploy tĩnh (Netlify, GitHub Pages...) không có server Node.js chạy ngầm!
      if (response.status === 404) {
        console.warn("[AI Service] Phát hiện lỗi 404 tại /api/generate-stream. Tự động chuyển mạch sang chế độ Gọi trực tiếp từ Trình duyệt (Direct Client-Side Fallback)...");
        yield* this.generateDirectClientStream(prompt, schema, combinedSystemInstruction, providedApiKey, activeProxy, temperature);
        return;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Mạng hoặc server lỗi: ${response.status} ${response.statusText}. Chi tiết: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Luồng stream bị rỗng');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        let boundary = buffer.indexOf('\n');
        while (boundary !== -1) {
          let chunkText = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 1);
          boundary = buffer.indexOf('\n');

          if (!chunkText) continue;

          if (chunkText.startsWith("data: ")) {
            const dataStr = chunkText.slice(6).trim();
            if (dataStr === "[DONE]") {
              return;
            }
            try {
              const parsed = JSON.parse(dataStr);
              yield {
                thought: parsed.thought || "",
                text: parsed.text || "",
                usage: parsed.usage || null
              };
            } catch (e) {
              // Bỏ qua lỗi parse lỗi nhỏ của proxy
            }
          } else if (chunkText.startsWith("event: error")) {
            let errorMsg = "Có lỗi báo về từ server API";
            const nextNewline = buffer.indexOf('\n');
            if (nextNewline !== -1) {
              const nextLine = buffer.slice(0, nextNewline).trim();
              if (nextLine.startsWith("data: ")) {
                try {
                  const errJson = JSON.parse(nextLine.slice(6).trim());
                  if (errJson.error) errorMsg = errJson.error;
                } catch(e){}
              }
            }
            throw new Error(errorMsg);
          }
        }
      }

      if (buffer.trim()) {
        try {
          let possibleData = buffer.trim();
          if (possibleData.startsWith("data: ")) possibleData = possibleData.slice(6).trim();
          if (possibleData && possibleData !== "[DONE]") {
            const parsed = JSON.parse(possibleData);
            if (parsed.text || parsed.thought) {
              yield { thought: parsed.thought || "", text: parsed.text || "", usage: parsed.usage || null };
            }
          }
        } catch(e) {}
      }

    } catch (error: any) {
      if (providedApiKey) {
        console.warn(`[AI Service] API Key lỗi, thêm vào blacklist: ${providedApiKey.substring(0, 8)}...`);
        this.apiKeysBlacklist.add(providedApiKey);
      }
      // Nếu gặp lỗi mạng "Failed to fetch" (thường do server backend không hoạt động hoặc sập), tự động chuyển sang gọi trực tiếp luôn
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        console.warn("[AI Service] Không thể kết nối tới server backend (Failed to fetch). Tự động chuyển mạch sang chế độ Gọi trực tiếp từ Trình duyệt (Direct Client-Side Fallback)...");
        yield* this.generateDirectClientStream(prompt, schema, combinedSystemInstruction, providedApiKey, activeProxy, temperature);
        return;
      }
      
      console.error("AI Streaming Error:", error);
      throw error;
    }
  }

  /**
   * Chức năng tự trị: Thực hiện gọi API trực tiếp từ Trình duyệt lên Google Gemini hoặc Custom Proxy
   * Giúp game hoạt động 100% không cần backend khi phát hành trên Web Tĩnh (Netlify, Vercel, v.v.)
   */
  private async *generateDirectClientStream(
    prompt: string, 
    schema: any, 
    systemInstruction: string,
    providedApiKey: string | null,
    activeProxy: any,
    temperature: number
  ) {
    const state = useStore.getState();
    const isUsingProxy = !!activeProxy;
    const model = isUsingProxy 
      ? "gemini-3.1-pro-preview"
      : (state.selectedAIModel || "gemini-3.1-pro-preview");

    // Đảm bảo có thông tin chứng thực
    if (!providedApiKey && !isUsingProxy) {
      toast.error("Phát hiện bạn đang chạy Game trên Web Tĩnh không có server! Xin vui lòng mở Cài đặt (Settings) -> Nhập API Key cá nhân của bạn hoặc Proxy để kích hoạt trí tuệ nhân tạo.");
      throw new Error("Chào bạn! Game đang chạy ở chế độ Web Tĩnh (Serverless). Vui lòng cấu hình API Key cá nhân hoặc Proxy cá nhân trong mục Cài đặt để tiếp tục trải nghiệm.");
    }

    yield {
      thought: `[SYSTEM - CHUYỂN MẠCH THÀNH CÔNG] Đang chạy trực tiếp từ trình duyệt (Client-Side) | Mode: ${isUsingProxy ? "Proxy" : "Direct API Key"} | Model: ${model}\n`,
      text: "",
      usage: null
    };

    let targetUrl = "";
    let headers: Record<string, string> = { "Content-Type": "application/json" };
    let reqBody: any = {};

    if (isUsingProxy) {
      let proxyBaseUrl = activeProxy.url;
      if (proxyBaseUrl.endsWith('/')) proxyBaseUrl = proxyBaseUrl.slice(0, -1);
      
      headers["Authorization"] = `Bearer ${activeProxy.key}`;
      headers["x-goog-api-key"] = activeProxy.key;

      let isOAI = !activeProxy.key.startsWith("AIza"); // Nếu không bắt đầu bằng AIza thì thường là chuẩn OpenAI
      if (proxyBaseUrl.includes("generativelanguage.googleapis.com")) isOAI = false;

      if (isOAI) {
        if (!proxyBaseUrl.includes("chat/completions")) {
          if (!proxyBaseUrl.includes("/v1")) proxyBaseUrl += "/v1";
          targetUrl = `${proxyBaseUrl}/chat/completions`;
        } else {
          targetUrl = proxyBaseUrl;
        }

        reqBody = {
          model: model,
          messages: [],
          temperature: temperature,
          stream: true
        };

        if (systemInstruction) {
          reqBody.messages.push({ role: "system", content: systemInstruction });
        }
        reqBody.messages.push({ role: "user", content: prompt });

        if (schema) {
          reqBody.response_format = { type: "json_object" };
          reqBody.messages.push({ role: "system", content: "You MUST return a valid JSON object matching the requested schema structure." });
        }
      } else {
        if (!proxyBaseUrl.includes('/v1beta') && !proxyBaseUrl.includes('/v1alpha') && !proxyBaseUrl.includes('/v1')) {
          proxyBaseUrl += '/v1beta';
        }
        targetUrl = `${proxyBaseUrl}/models/${model}:streamGenerateContent?alt=sse`;

        reqBody = {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: temperature,
            maxOutputTokens: 65536,
          }
        };
        if (schema) {
          reqBody.generationConfig.responseMimeType = "application/json";
          reqBody.generationConfig.responseSchema = schema;
        }
        if (systemInstruction) {
          reqBody.systemInstruction = { parts: [{ text: systemInstruction }] };
        }
      }
    } else {
      // GỌI TRỰC TIẾP LÊN MÁY CHỦ GOOGLE GEMINI TỪ CLIENT
      const apiKey = providedApiKey!;
      targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

      reqBody = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: 65536,
        }
      };
      if (schema) {
        reqBody.generationConfig.responseMimeType = "application/json";
        reqBody.generationConfig.responseSchema = schema;
      }
      if (systemInstruction) {
        reqBody.systemInstruction = { parts: [{ text: systemInstruction }] };
      }
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody)
    });

    if (!response.ok) {
      if (providedApiKey && !isUsingProxy) {
        console.warn(`[AI Service] API Key lỗi (Direct), thêm vào blacklist: ${providedApiKey.substring(0, 8)}...`);
        this.apiKeysBlacklist.add(providedApiKey);
      }
      const errText = await response.text().catch(() => "");
      throw new Error(`Lỗi kết nối trực tiếp (${response.status}): ${errText || response.statusText}`);
    }

    if (!response.body) {
      throw new Error("Không có luồng dữ liệu trả về từ máy chủ AI.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n');

      while (boundary !== -1) {
        let line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        boundary = buffer.indexOf('\n');

        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          if (!dataStr || dataStr === "[DONE]") continue;

          try {
            const parsedObj = JSON.parse(dataStr);
            const items = Array.isArray(parsedObj) ? parsedObj : [parsedObj];

            for (const chunkData of items) {
              let textPart = "";
              let thoughtPart = "";
              let usage = chunkData.usageMetadata || chunkData.usage || null;

              // Định dạng Gemini chính thức
              if (chunkData.candidates && chunkData.candidates[0]) {
                const candidate = chunkData.candidates[0];
                if (candidate.content && candidate.content.parts) {
                  candidate.content.parts.forEach((p: any) => {
                    if (p.text) textPart += p.text;
                    if (p.thought) thoughtPart += p.thought;
                  });
                }
              }
              // Định dạng OpenAI
              else if (chunkData.choices && chunkData.choices[0] && chunkData.choices[0].delta) {
                const delta = chunkData.choices[0].delta;
                if (delta.content) textPart += delta.content;
                if (delta.reasoning_content) thoughtPart += delta.reasoning_content;
              }

              if (textPart || thoughtPart || usage) {
                yield { thought: thoughtPart, text: textPart, usage };
              }
            }
          } catch (e) {
            // Thử hiển thị text thô nếu không parse được json
          }
        }
      }
    }

    // XỬ LÝ KHỐI BUFFER CUỐI CÙNG (Thường chứa usageMetadata ở chunk cuối từ SSE API)
    if (buffer.trim()) {
      let line = buffer.trim();
      if (line.startsWith("data: ")) {
        line = line.slice(6).trim();
      }
      if (line && line !== "[DONE]") {
        try {
          const parsedObj = JSON.parse(line);
          const items = Array.isArray(parsedObj) ? parsedObj : [parsedObj];
          
          for (const chunkData of items) {
            let textPart = "";
            let thoughtPart = "";
            let usage = chunkData.usageMetadata || chunkData.usage || null;

            if (chunkData.candidates && chunkData.candidates[0]) {
              const candidate = chunkData.candidates[0];
              if (candidate.content && candidate.content.parts) {
                candidate.content.parts.forEach((p: any) => {
                  if (p.text) textPart += p.text;
                  if (p.thought) thoughtPart += p.thought;
                });
              }
            } else if (chunkData.choices && chunkData.choices[0] && chunkData.choices[0].delta) {
              const delta = chunkData.choices[0].delta;
              if (delta.content) textPart += delta.content;
              if (delta.reasoning_content) thoughtPart += delta.reasoning_content;
            }

            if (textPart || thoughtPart || usage) {
              yield { thought: thoughtPart, text: textPart, usage };
            }
          }
        } catch (e) {
          // Bỏ qua lỗi chunk thừa
        }
      }
    }

  }

  /**
   * Tạo nhân vật mới thông qua CoT Streaming
   */
  async *createCharacterStream(theme: string) {
    const systemInstruction = `Bạn là một chuyên gia thiết kế nhân vật game xuất sắc. TẤT CẢ PHẢN HỒI PHẢI VIẾT BẰNG TIẾNG VIỆT 100%. Hãy suy nghĩ thật sâu và chi tiết trước khi đưa ra kết quả.`;
    const prompt = `Hãy tạo một nhân vật nữ độc đáo cho game thế giới mở, chủ đề "${theme}".
Sử dụng Chain-of-Thought để giải thích tại sao các chỉ số và tính cách này lại phù hợp với bối cảnh "${theme}".
Kết quả cuối cùng phải là JSON hợp lệ khớp với schema nhân vật.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        name: { type: Type.STRING },
        role: { type: Type.STRING },
        description: { type: Type.STRING },
        personality: { type: Type.STRING },
        stats: {
          type: Type.OBJECT,
          properties: {
            intelligence: { type: Type.NUMBER },
            strength: { type: Type.NUMBER },
            agility: { type: Type.NUMBER }
          },
          required: ["intelligence", "strength", "agility"]
        },
        cot_reasoning: { type: Type.STRING }
      },
      required: ["id", "name", "role", "description", "personality", "stats", "cot_reasoning"]
    };

    yield* this.generateStreamingContent(prompt, schema, systemInstruction);
  }

  async *summarizeWorldStateStream(logs: string) {
    const systemInstruction = `Bạn là một chuyên gia quản lý trạng thái trò chơi. Hãy tóm tắt cuốn chiếu các sự kiện đã diễn ra và trích xuất thành một đoạn miêu tả Trạng Thái Thế Giới (worldState) ngắn gọn nhưng đầy đủ thông số.`;
    const prompt = `Dưới đây là lịch sử tóm tắt các sự kiện đã diễn ra:\n\n${logs}\n\nHãy tổng hợp lại và cho biết trạng thái mới nhất của MC và Thế Giới xung quanh (đồ đạc đang cầm, tình trạng cơ thể, vị trí đứng, những NPC nào đang ở cạnh, diễn biến cuối). Đầu ra của bạn BẮT BUỘC theo cấu trúc JSON định dạng:\n\`\`\`json\n{\n  "worldState": "Nội dung tóm tắt trạng thái ở đây..."\n}\n\`\`\``;

    yield* this.generateStreamingContentRaw(prompt, undefined, systemInstruction);
  }
}

export const aiService = new AIService();
