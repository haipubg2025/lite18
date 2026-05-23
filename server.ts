import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API route for health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API route for proxying Hugging Face models to prevent CORS issues on client-side
  app.get("/api/model-proxy/*", async (req, res) => {
    try {
      const subPath = req.params[0];
      if (!subPath) {
        res.status(400).send("Thiếu đường dẫn mô hình");
        return;
      }
      
      const targetUrl = `https://huggingface.co/${subPath}`;
      console.log(`[Model Proxy] Fetching from HuggingFace to bypass CORS: ${targetUrl}`);
      
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        res.status(response.status).send(`Không thể tải từ HuggingFace: ${response.statusText}`);
        return;
      }
      
      // Copy headers cần thiết
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      
      // Hỗ trợ browser cache 1 năm đối với các file mô hình tĩnh
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error("Lỗi Proxy Mô hình:", error);
      res.status(500).send(`Lỗi Proxy Mô hình: ${error.message}`);
    }
  });

  // API route for fetching models from a given proxy URL
  app.post("/api/proxy-models", async (req, res) => {
    try {
      const { baseUrl, key } = req.body;
      let url = `${baseUrl}/models`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (key) {
        headers['Authorization'] = `Bearer ${key}`;
      }

      // Nếu là proxy chính thức của Google hoặc có dạng domain generativelanguage
      if (baseUrl.includes("generativelanguage.googleapis.com")) {
        url = `${baseUrl}/models?key=${key}`;
      }

      const response = await fetch(url, {
        headers
      });

      if (!response.ok) {
        // Dự phòng cho một số proxy yêu cầu truyền key thông qua query parameter thay vì header Bearer
        if (key && !url.includes('?key=')) {
          const altResponse = await fetch(`${baseUrl}/models?key=${key}`);
          if (altResponse.ok) {
            const data = await altResponse.json();
            return res.json(data);
          }
        }
        throw new Error("Không thể tải models từ proxy");
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Lỗi khi load models proxy:", error);
      // Trả về danh sách model mặc định đầy đủ thay vì báo lỗi 500 để tương thích với mọi loại proxy
      res.json({ 
        data: [
          { id: "gemini-3.1-pro-preview" }, 
          { id: "gemini-3.5-flash" }
        ] 
      });
    }
  });

  // Helper function to format AI error messages nicely (specifically 429 Quota limits)
  function formatAiErrorMessage(error: any): string {
    const errMsg = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
    const lower = errMsg.toLowerCase();
    
    if (
      lower.includes("resource_exhausted") || 
      lower.includes("429") || 
      lower.includes("quota exceeded") ||
      lower.includes("quota") ||
      lower.includes("rate limit") ||
      lower.includes("too many requests")
    ) {
      return "Hạn ngạch thử nghiệm của mô hình hiện tại đã hết! Bạn hãy vào mục Cài đặt -> tab Chung để đổi sang dòng Flash (như 'gemini-3.5-flash' hoặc 'gemini-3.1-flash-lite') để cuộc chơi không bị gián đoạn nhé.";
    }
    
    if (lower.includes("api key") || lower.includes("api_key") || lower.includes("key not found") || lower.includes("invalid key")) {
      return "API Key của bạn không hợp lệ hoặc thiếu. Vui lòng mở Cài đặt -> tab Chung để cập nhật.";
    }

    if (errMsg.includes("ApiError:") || errMsg.includes("throwErrorIfNotOK") || errMsg.includes("{\n") || errMsg.includes("error\":{")) {
      return "Lỗi kết nối máy chủ AI gặp sự cố hoặc hết tài nguyên. Vui lòng đổi mô hình hoặc thử lại sau vài giây.";
    }

    return errMsg;
  }

  // API route for generating content with stream
  app.post("/api/generate-stream", async (req, res) => {
    try {
      const { prompt, schema, activeProxy, providedApiKey, systemInstruction, temperature, selectedAIModel } = req.body;

      let model = selectedAIModel || "gemini-3.1-pro-preview";
      let aiClient: GoogleGenAI;

      if (activeProxy && activeProxy.url && activeProxy.key) {
        if (activeProxy.selectedModel) {
          model = activeProxy.selectedModel;
        }
        aiClient = new GoogleGenAI({ 
          apiKey: activeProxy.key, 
          httpOptions: { baseUrl: activeProxy.url }
        });
        console.log(`[Proxy enabled] Using custom proxy: ${activeProxy.url}`);
      } else {
        const apiKey = providedApiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) {
          res.status(400).json({ error: "Không tìm thấy API Key cấu hình." });
          return;
        }
        aiClient = new GoogleGenAI({ apiKey });
        console.log(`[API Key enabled] Using standard API Key`);
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      // PING CƠ CHẾ GIỮ KẾT NỐI KHÔNG BỊ TIMEOUT
      const pingInterval = setInterval(() => {
        res.write(":\n\n");
      }, 10000);
      
      req.on('close', () => clearInterval(pingInterval));

      const sysInstruction = systemInstruction || "";


      const authType = (activeProxy && activeProxy.url && activeProxy.key) ? "Proxy" : "API Key";
      const initPayload = JSON.stringify({
        thought: `[SYSTEM] Đang xử lý bằng ${authType} | Model: ${model}\n`,
        text: "",
        usage: null
      });
      res.write(`data: ${initPayload}\n\n`);

      if (authType === "Proxy") {
        await handleProxyGeneration(req, res, activeProxy, model, prompt, schema, sysInstruction, temperature);
      } else {
        await handleApiKeyGeneration(req, res, aiClient!, model, prompt, schema, sysInstruction, temperature);
      }

      res.write("data: [DONE]\n\n");
      res.end();

    } catch (error: any) {
      console.error("Lỗi tạo nội dung từ AI:", error);
      const friendlyError = formatAiErrorMessage(error);
      res.write(`event: error\ndata: ${JSON.stringify({ error: friendlyError })}\n\n`);
      res.end();
    }
  });

  async function handleProxyGeneration(req: any, res: any, activeProxy: any, model: string, prompt: string, schema: any, sysInstruction: string, temperature: number) {
        let isClientDisconnected = false;
        req.on('close', () => { isClientDisconnected = true; });

        // BỘ GIẢI MÃ MẠNG CHO PROXY (TỰ ĐỘNG XỬ LÝ FORMAT RƠI RỚT CỦA CÁC ĐẦU PROXY)
        let proxyBaseUrl = activeProxy.url;
        if (proxyBaseUrl.endsWith('/')) proxyBaseUrl = proxyBaseUrl.slice(0, -1);
        
        let isOAI = !activeProxy.key.startsWith("AIza"); // Nếu không phải key Google gốc thì 99% dùng chuẩn OpenAI
        if (proxyBaseUrl.includes("generativelanguage.googleapis.com")) isOAI = false;
        
        let targetUrl = "";
        let reqBody: any = {};

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
              temperature: typeof temperature === 'number' ? temperature : 0.7,
              max_tokens: 65536,
              stream: true,
              stream_options: { include_usage: true }
           };
           
           if (sysInstruction) {
              reqBody.messages.push({ role: "system", content: sysInstruction });
           }
           reqBody.messages.push({ role: "user", content: prompt });
           
           // Cho OpenAI format, schema phức tạp có thể truyền qua response_format JSON
           if (schema) {
              reqBody.response_format = { type: "json_object" };
              reqBody.messages.push({ role: "system", content: "You MUST return a valid JSON object."});
           }
        } else {
            if (!proxyBaseUrl.includes('/v1beta') && !proxyBaseUrl.includes('/v1alpha') && !proxyBaseUrl.includes('/v1')) {
              proxyBaseUrl += '/v1beta';
            }
            targetUrl = `${proxyBaseUrl}/models/${model}:streamGenerateContent?alt=sse`;
            
            reqBody = {
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: typeof temperature === 'number' ? temperature : 0.7,
                maxOutputTokens: 65536,
              }
            };
            if (schema) {
              reqBody.generationConfig.responseMimeType = "application/json";
              reqBody.generationConfig.responseSchema = schema;
            }
            if (sysInstruction) {
              reqBody.systemInstruction = { parts: [{ text: sysInstruction }] };
            }
        }
        
        let retryCount = 0;

        while (!isClientDisconnected) {
          try {
             const proxyStreamRes = await fetch(targetUrl, {
               method: 'POST',
               headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${activeProxy.key}`,
                 'x-goog-api-key': activeProxy.key // Fallback param
               },
               body: JSON.stringify(reqBody)
             });
             
             if (!proxyStreamRes.ok) {
               const errText = await proxyStreamRes.text().catch(()=>'');
               throw new Error(`Proxy error: ${proxyStreamRes.status} - ${errText}`);
             }
             if (!proxyStreamRes.body) throw new Error('Proxy returned empty body');

             const reader = proxyStreamRes.body.getReader();
             const decoder = new TextDecoder("utf-8");
             let buffer = "";

             while (!isClientDisconnected) {
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
                   if (!dataStr) continue;
                   if (dataStr === "[DONE]") continue; // Ignore proxy's own done
                   try {
                     const parsedObj = JSON.parse(dataStr);
                     const items = Array.isArray(parsedObj) ? parsedObj : [parsedObj];
                     
                     for (const chunkData of items) {
                         let textPart = "";
                         let thoughtPart = "";
                         let usage = null;
                         
                         if (chunkData.usageMetadata || chunkData.usage) {
                            usage = chunkData.usageMetadata || chunkData.usage;
                         }
                         
                         // Gemini Format
                         if (chunkData.candidates && chunkData.candidates[0]) {
                            const candidate = chunkData.candidates[0];
                            if (candidate.content && candidate.content.parts) {
                                Object.values(candidate.content.parts).forEach((p: any) => {
                                   if (p.text) textPart += p.text;
                                   if (p.thought) thoughtPart += p.thought;
                                });
                            }
                         } 
                         // OpenAI Format (fallback)
                         else if (chunkData.choices && chunkData.choices[0] && chunkData.choices[0].delta) {
                            if (chunkData.choices[0].delta.content) {
                               textPart += chunkData.choices[0].delta.content;
                            }
                            if (chunkData.choices[0].delta.reasoning_content) {
                               thoughtPart += chunkData.choices[0].delta.reasoning_content;
                            }
                         }
                         // If neither, just dump raw
                         else if (!chunkData.usageMetadata && !chunkData.usage) {
                            textPart = `\n[UNRECOGNIZED PROXY FORMAT]: ${JSON.stringify(chunkData)}\n`;
                         }

                         if (textPart || thoughtPart || usage) {
                             const payload = JSON.stringify({ thought: thoughtPart, text: textPart, usage });
                             res.write(`data: ${payload}\n\n`);
                         }
                     }
                   } catch(e) {
                     const payload = JSON.stringify({ thought: "", text: `\n[RAW PROXY CHUNK]: ${dataStr}\n`, usage: null });
                     res.write(`data: ${payload}\n\n`);
                   }
                 } else {
                    try {
                      const rawJson = JSON.parse(line);
                      if (rawJson.error) {
                        throw new Error(rawJson.error.message || "Lỗi Proxy");
                      } else if (rawJson.candidates) {
                         let textPart = "";
                         let thoughtPart = "";
                         rawJson.candidates[0]?.content?.parts?.forEach((p: any) => {
                            if (p.text) textPart += p.text;
                            if (p.thought) thoughtPart += p.thought;
                         });
                         const payload = JSON.stringify({ thought: thoughtPart, text: textPart, usage: rawJson.usageMetadata || null });
                         res.write(`data: ${payload}\n\n`);
                      }
                    } catch (err) {
                      if (line.trim() && line !== "[DONE]" && line !== "]" && line !== "[") {
                          const payload = JSON.stringify({ thought: "", text: `\n[NON-JSON RAW TEXT]: ${line}\n`, usage: null });
                          res.write(`data: ${payload}\n\n`);
                      }
                    }
                 }
               }
             }
             
             // PROCESS REMAINING BUFFER IF ANY
             if (!isClientDisconnected && buffer.trim()) {
                let line = buffer.trim();
                if (line.startsWith("data: ")) {
                   const dataStr = line.slice(6).trim();
                   if (dataStr && dataStr !== "[DONE]") {
                     try {
                       const chunkData = JSON.parse(dataStr);
                       let textPart = "";
                       let thoughtPart = "";
                       let usage = null;
                       if (chunkData.usageMetadata || chunkData.usage) {
                          usage = chunkData.usageMetadata || chunkData.usage;
                       }
                       if (chunkData.candidates && chunkData.candidates[0]?.content?.parts) {
                          chunkData.candidates[0].content.parts.forEach((p: any) => {
                             if (p.text) textPart += p.text;
                             if (p.thought) thoughtPart += p.thought;
                          });
                       }
                       const payload = JSON.stringify({ thought: thoughtPart, text: textPart, usage });
                       res.write(`data: ${payload}\n\n`);
                     } catch(e) { }
                   }
                } else if (line.startsWith("{")) {
                    try {
                      const rawJson = JSON.parse(line);
                      if (rawJson.error) {
                        throw new Error(rawJson.error.message || "Lỗi Proxy");
                      } else if (rawJson.candidates) {
                         let textPart = "";
                         let thoughtPart = "";
                         rawJson.candidates[0]?.content?.parts?.forEach((p: any) => {
                            if (p.text) textPart += p.text;
                            if (p.thought) thoughtPart += p.thought;
                         });
                         const payload = JSON.stringify({ thought: thoughtPart, text: textPart, usage: rawJson.usageMetadata || null });
                         res.write(`data: ${payload}\n\n`);
                      }
                    } catch (err) { }
                }
             }

             // If loop exits gracefully without error, break infinite retry
             break;
          } catch (err: any) {
             if (isClientDisconnected) break;
             retryCount++;
             const retryMsg = JSON.stringify({ 
                 thought: `\n[HỆ THỐNG] Lỗi Proxy: ${err.message}. Đang tự động thử lại sau 1.5s rảnh tay (Lần ${retryCount})...\n`, 
                 text: "", 
                 usage: null 
             });
             res.write(`data: ${retryMsg}\n\n`);
             // Chờ 1.5s trước khi thử lại
             await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
  }

  async function handleApiKeyGeneration(req: any, res: any, aiClient: GoogleGenAI, model: string, prompt: string, schema: any, sysInstruction: string, temperature: number) {
        try {
          const isProModel = model.toLowerCase().includes("pro");
          const supportsThinking = model.toLowerCase().includes("thinking");

          let config: any = {
            temperature: typeof temperature === 'number' ? temperature : 0.7,
            systemInstruction: sysInstruction
          };

          if (isProModel) {
            // Cấu trúc riêng cho dòng Pro
            config = {
               ...config,
               maxOutputTokens: 65536,
               topP: 0.95,
               topK: 40,
            };
            if (supportsThinking && !schema) {
               config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
            }
          } else {
            // Cấu trúc riêng cho dòng Flash
            config = {
               ...config,
               maxOutputTokens: 65536, // Các dòng flash thường hỗ trợ output token ít hơn hoặc muốn tốc độ nhanh nhất
            };
          }

          if (schema) {
             config.responseMimeType = "application/json";
             config.responseSchema = schema;
          }

          const responseStream = await aiClient.models.generateContentStream({
            model,
            contents: prompt,
            config
          });

          for await (const chunk of responseStream as any) {
            let thoughtPart = "";
            let textPart = "";
            let chunkThoughtSafe = "";
            let chunkTextSafe = "";
            
            try { chunkThoughtSafe = chunk.thought || ""; } catch(e){}
            try { chunkTextSafe = chunk.text || ""; } catch(e){}
            
            if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
              for (const part of chunk.candidates[0].content.parts) {
                if ('thought' in part && part.thought) {
                  thoughtPart += (typeof part.thought === 'string') ? part.thought : (part.text || "");
                } else if (part.text) {
                  textPart += part.text;
                }
              }
            }
            
            const payload = JSON.stringify({
              thought: thoughtPart || chunkThoughtSafe,
              text: textPart || chunkTextSafe,
              usage: chunk.usageMetadata || null
            });
            res.write(`data: ${payload}\n\n`);
          }
        } catch (err: any) {
          console.error("Lỗi Bộ giải mã API Key:", err);
          const friendlyError = formatAiErrorMessage(err);
          res.write(`event: error\ndata: ${JSON.stringify({ error: friendlyError })}\n\n`);
        }
  }

  // Catch-all for AI Studio internal routes to prevent SPA fallback returning HTML
  app.use('/__aistudio_internal_control_plane', (req, res) => {
    res.status(404).end();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
