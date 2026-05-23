/**
 * Tiện ích làm sạch và sửa chữa lỗi JSON / Văn bản dòng stream của game Matrix Lite v1
 * Đảm bảo người chơi không bao giờ nhìn thấy các thẻ hệ thống, ngoặc nhọn hoặc JSON thô.
 */

interface GameplayParsedData {
  worldTime?: string;
  mcLocation?: string;
  npcLocations?: Array<{ id: string; location: string }>;
  mcUpdates?: any;
  npcUpdates?: any[];
  newNPCs?: any[];
  outline?: string;
  mainText?: string;
  suggestedActions?: Array<{ action: string; details?: string; timeCost?: string }>;
  worldStateUpdate?: string;
  worldState?: string;
}

/**
 * 1. Sửa lỗi xuống dòng thực tế (literal newline) bên trong các chuỗi bọc bởi dấu ngoặc kép của JSON.
 * Đây là lỗi phổ biến nhất làm JSON.parse bị sập do các trình proxy hoặc model sinh ra xuống dòng thực mà không escape thành \n.
 */
export function escapeLiteralNewlinesInJson(jsonStr: string): string {
  let result = "";
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (char === '\n' && inString) {
      // Thay thế xuống dòng thực tế bằng chuỗi \\n hợp lệ cho JSON
      result += "\\n";
      continue;
    }

    if (char === '\r' && inString) {
      // Bỏ qua carriage return bên trong chuỗi
      continue;
    }

    result += char;
  }

  return result;
}

/**
 * 2. Sửa lỗi JSON bị đứt đoạn / truncated đột ngột (do hết token hoặc gián đoạn mạng)
 * Tự động đóng các chuỗi ngoặc còn thiếu ở cuối chuỗi.
 */
export function repairTruncatedJson(jsonStr: string): string {
  let trimmed = jsonStr.trim();
  if (!trimmed) return "{}";

  // Thử parse trước, nếu được thì trả về luôn
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch (e) {}

  // Thực hiện sửa chữa
  let inString = false;
  let escapeNext = false;
  const stack: string[] = [];

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        stack.push('{');
      } else if (char === '[') {
        stack.push('[');
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }
  }

  let repaired = trimmed;

  // Nếu kết thúc mà vẫn đang ở trong chuỗi string, hãy đóng dấu ngoặc kép
  if (inString) {
    repaired += '"';
  }

  // Loại bỏ các dấu phẩy cô đơn ở cuối (trailing commas) phát sinh do bị đứt đoạn
  repaired = repaired.replace(/,\s*$/, "");

  // Đóng các ngoặc nhọn / ngoặc vuông từ trong ra ngoài theo stack
  while (stack.length > 0) {
    const last = stack.pop();
    if (last === '{') {
      repaired += '}';
    } else if (last === '[') {
      repaired += ']';
    }
  }

  // Thử kiểm định lần cuối sau khi sửa chữa
  try {
    JSON.parse(repaired);
    return repaired;
  } catch (err) {
    // Nếu vẫn lỗi, thử chắp vá mạnh hơn: tìm xem lỗi nằm ở cấu trúc suggestedActions dở dang hay phần tử dở dang
    // Tìm cách cắt bỏ phần bị lỗi ở cuối cho đến dấu dính líu hợp lệ trước đó
    try {
      // Tìm vị trí của dấu phẩy cuối cùng phân tách key-value hợp lệ, thử cắt từ đó
      const lastCommaIdx = repaired.lastIndexOf(",");
      if (lastCommaIdx !== -1) {
        let fallbackRepaired = repaired.substring(0, lastCommaIdx).trim();
        // Tìm lại stack cho chuỗi fallbackRepaired
        let fInString = false;
        let fEscapeNext = false;
        const fStack: string[] = [];
        for (let j = 0; j < fallbackRepaired.length; j++) {
          const c = fallbackRepaired[j];
          if (fEscapeNext) { fEscapeNext = false; continue; }
          if (c === '\\') { fEscapeNext = true; continue; }
          if (c === '"') { fInString = !fInString; continue; }
          if (!fInString) {
            if (c === '{') fStack.push('{');
            else if (c === '[') fStack.push('[');
            else if (c === '}') { if (fStack[fStack.length-1] === '{') fStack.pop(); }
            else if (c === ']') { if (fStack[fStack.length-1] === '[') fStack.pop(); }
          }
        }
        if (fInString) fallbackRepaired += '"';
        while (fStack.length > 0) {
          const l = fStack.pop();
          if (l === '{') fallbackRepaired += '}';
          else if (l === '[') fallbackRepaired += ']';
        }
        JSON.parse(fallbackRepaired);
        return fallbackRepaired;
      }
    } catch(e2) {}

    return repaired; // Trả về phương án tốt nhất
  }
}

/**
 * 3. Bóc tách dữ liệu trực tiếp bằng Regex (Phòng tuyến dự phòng cực mạnh khi JSON bị hỏng nát)
 * Bóc tách các thông tin: worldTime, mcLocation, outline, suggestedActions, và tất cả các trường "part" ghép lại thành cốt truyện chính.
 */
export function regexExtractGameplayData(rawText: string): GameplayParsedData | null {
  try {
    const data: GameplayParsedData = {};
    let hasData = false;

    // A. Trích xuất worldTime
    const worldTimeMatch = rawText.match(/"worldTime"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/);
    if (worldTimeMatch) {
      data.worldTime = decodeJsonEscapeSymbols(worldTimeMatch[1]);
      hasData = true;
    }

    // B. Trích xuất mcLocation
    const mcLocMatch = rawText.match(/"mcLocation"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/);
    if (mcLocMatch) {
      data.mcLocation = decodeJsonEscapeSymbols(mcLocMatch[1]);
      hasData = true;
    }

    // C. Trích xuất outline
    const outlineMatch = rawText.match(/"outline"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/);
    if (outlineMatch) {
      data.outline = decodeJsonEscapeSymbols(outlineMatch[1]);
      hasData = true;
    }

    // D. Trích xuất tất cả các trường "part..." dưới dạng danh sách và sắp xếp để ghép thành mainText
    const partsMap: { [key: string]: string } = {};
    // Regex tìm các trường "partXXX": "nội dung"
    const partPattern = /"(part[a-zA-Z0-9_]*)"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*,\s*\}|\s*\})/g;
    let partMatch;
    while ((partMatch = partPattern.exec(rawText)) !== null) {
      const key = partMatch[1];
      const val = partMatch[2];
      partsMap[key] = decodeJsonEscapeSymbols(val);
      hasData = true;
    }

    // Ghép các part truyện lại
    const sortedParts = Object.keys(partsMap)
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
      });

    if (sortedParts.length > 0) {
      data.mainText = sortedParts.map(k => partsMap[k]).join("\n\n");
    } else {
      // Nếu không tìm thấy part nào, thử tìm trường "mainText"
      const mainTextMatch = rawText.match(/"mainText"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*\})/);
      if (mainTextMatch) {
        data.mainText = decodeJsonEscapeSymbols(mainTextMatch[1]);
        hasData = true;
      }
    }

    // E. Trích xuất suggestedActions
    // Tìm mảng suggestedActions thô
    const actionsBlockMatch = rawText.match(/"suggestedActions"\s*:\s*\[([\s\S]*?)\]/);
    if (actionsBlockMatch) {
      const actionsBlock = actionsBlockMatch[1];
      // Tìm từng đối tượng { "action": "...", "details": "...", "timeCost": "..." } bên trong mảng
      const actionItemPattern = /\{\s*"action"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"details"\s*:\s*"([\s\S]*?)")?\s*(?:,\s*"timeCost"\s*:\s*"([\s\S]*?)")?\s*\}/gi;
      const actions: any[] = [];
      let itemMatch;
      while ((itemMatch = actionItemPattern.exec(actionsBlock)) !== null) {
        actions.push({
          action: decodeJsonEscapeSymbols(itemMatch[1]),
          details: itemMatch[2] ? decodeJsonEscapeSymbols(itemMatch[2]) : undefined,
          timeCost: itemMatch[3] ? decodeJsonEscapeSymbols(itemMatch[3]) : undefined
        });
      }
      if (actions.length > 0) {
        data.suggestedActions = actions;
        hasData = true;
      }
    }

    return hasData ? data : null;
  } catch (e) {
    console.error("Lỗi khi trích xuất Regex dự phòng:", e);
    return null;
  }
}

/**
 * Giải mã các ký tự escape trong JSON thô (như \" -> ", \n -> xuống dòng...)
 */
function decodeJsonEscapeSymbols(str: string): string {
  return str
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
}

/**
 * Trích xuất tất cả các trường cốt truyện từ JSON thô một cách an toàn nhất, tránh lún sâu vào các regex dọn dẹp làm mất dấu câu
 */
export function extractAllStoryTextsRobust(rawText: string): string {
  if (!rawText) return "";
  
  // Danh sách lưu trữ các phần truyện tìm thấy kèm vị trí để giữ đúng thứ tự xuất hiện
  const storyParts: Array<{ key: string; index: number; text: string }> = [];
  
  // Regex tìm các nhãn key chứa văn bản chính của truyện
  const keyPattern = /"(mainText|content|outline|part[a-zA-Z0-9_]*)"\s*:\s*"/g;
  let match;
  
  while ((match = keyPattern.exec(rawText)) !== null) {
    const key = match[1];
    const matchStart = match.index;
    const startIdx = keyPattern.lastIndex;
    
    let val = "";
    let escapeNext = false;
    let i = startIdx;
    
    for (; i < rawText.length; i++) {
      const char = rawText[i];
      if (escapeNext) {
        val += char;
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        val += char;
        continue;
      }
      if (char === '"') {
        // Gặp dấu nháy kép đóng thực tế
        break;
      }
      val += char;
    }
    
    const decodedVal = decodeJsonEscapeSymbols(val).trim();
    if (decodedVal) {
      storyParts.push({
        key,
        index: matchStart,
        text: decodedVal
      });
    }
  }

  if (storyParts.length === 0) {
    return "";
  }

  // Phân loại và sắp xếp các phần cốt truyện
  // Thường cốt truyện thế hệ mới sẽ được chia nhỏ thành "part1", "part2", "part3"...
  const parts = storyParts.filter(p => p.key.startsWith("part"));
  if (parts.length > 0) {
    parts.sort((a, b) => {
      const numA = parseInt(a.key.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.key.replace(/\D/g, '')) || 0;
      if (numA !== numB) return numA - numB;
      return a.index - b.index;
    });
    return parts.map(p => p.text).join("\n\n");
  }

  // Nếu không chia nhỏ thành "part", ưu tiên lấy "mainText" hoặc "content"
  const mainTexts = storyParts.filter(p => p.key === "mainText" || p.key === "content");
  if (mainTexts.length > 0) {
    mainTexts.sort((a, b) => a.index - b.index);
    return mainTexts.map(p => p.text).join("\n\n");
  }

  // Cuối cùng là trường "outline"
  const outlines = storyParts.filter(p => p.key === "outline");
  if (outlines.length > 0) {
    return outlines.map(p => p.text).join("\n\n");
  }

  return "";
}

/**
 * 4. Hàm làm sạch thô (Lọc sạch 100% rác rưởi lập trình)
 * Khi không thể phân tích cấu trúc được nữa, lọc bỏ các thẻ bọc, dấu ngoặc, biến JSON
 * để biến kết quả thô thành bài văn truyện sạch bong hoàn mỹ.
 */
export function cleanRawOutputText(text: string): string {
  if (!text) return "";

  // SỬ DỤNG CHƯƠNG TRÌNH KHAI THÁC ROBUST TRƯỚC: Nếu văn bản rỗng nát dính cấu trúc JSON,
  // hàm bóc tách robust sẽ lấy phần truyện gốc giữ chính xác 100% các ký tự dấu câu của AI.
  const robustExtractedStory = extractAllStoryTextsRobust(text);
  if (robustExtractedStory) {
    return robustExtractedStory;
  }

  let cleaned = text;

  // A. Loại bỏ khối THINKING_PROCESS đầu tiên và triệt để
  cleaned = cleaned.replace(/<THINKING_PROCESS>[\s\S]*?<\/THINKING_PROCESS>/gi, "");
  
  // Nếu thẻ chưa đóng, tìm xem phía sau có <json_output>, ```json, hoặc dấu { không để chia cắt hợp lý
  const thinkingStartIdx = cleaned.toLowerCase().indexOf("<thinking_process>");
  if (thinkingStartIdx !== -1) {
    const afterThinking = cleaned.substring(thinkingStartIdx);
    let cutTo = -1;
    const jsonOutputStart = afterThinking.toLowerCase().indexOf("<json_output>");
    const markdownJsonStart = afterThinking.toLowerCase().indexOf("```json");
    const curlyBraceStart = afterThinking.indexOf("{");
    
    if (jsonOutputStart !== -1) {
      cutTo = jsonOutputStart;
    } else if (markdownJsonStart !== -1) {
      cutTo = markdownJsonStart;
    } else if (curlyBraceStart !== -1) {
      cutTo = curlyBraceStart;
    }
    
    if (cutTo !== -1) {
      cleaned = cleaned.substring(0, thinkingStartIdx) + "\n" + afterThinking.substring(cutTo);
    } else {
      // Nếu hoàn toàn không có dấu vết cấu trúc nào, ta chỉ cắt bỏ dòng chứa thẻ và vài dòng suy nghĩ đầu tiên
      // hoặc giữ nguyên nếu không chắc chắn, tránh làm trống hoàn toàn phản hồi
      cleaned = cleaned.replace(/<THINKING_PROCESS>[\s\S]*/gi, "");
    }
  }

  // B. Loại bỏ các thẻ XML/HTML của game
  cleaned = cleaned.replace(/<\/?json_output>/gi, "");
  cleaned = cleaned.replace(/<\/?thinking_process>/gi, "");

  // C. Loại bỏ các khối code markdown
  cleaned = cleaned.replace(/```json/gi, "");
  cleaned = cleaned.replace(/```/g, "");

  // D. Loại bỏ cấu trúc ngoặc nhọn JSON bao bọc tổng thể
  // Nếu chuỗi bắt đầu với { và kết thúc bằng }, dọn dẹp nó
  cleaned = cleaned.trim();
  if (cleaned.startsWith("{")) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.endsWith("}")) {
    cleaned = cleaned.slice(0, -1);
  }

  // E. Giải mã các ký hiệu newline trong text (\n thành xuống dòng thực) và unescape ngoặc kép TỪ SỚM TRƯỚC KHI LỌC
  cleaned = cleaned.replace(/\\n/g, "\n");
  cleaned = cleaned.replace(/\\"/g, '"');
  cleaned = cleaned.replace(/\\r/g, "");

  // F. Loại bỏ các khóa JSON phổ biến và các chuỗi ngoặc kéo dính líu
  const keysToRemove = [
    /"worldTime"\s*:\s*"[^"]*",?/gi,
    /"mcLocation"\s*:\s*"[^"]*",?/gi,
    /"outline"\s*:\s*"[^"]*",?/gi,
    /"suggestedActions"\s*:\s*\[[\s\S]*?\]/gi,
    /"mcUpdates"\s*:\s*\{[\s\S]*?\}/gi,
    /"npcUpdates"\s*:\s*\[[\s\S]*?\]/gi,
    /"newNPCs"\s*:\s*\[[\s\S]*?\]/gi,
    /"ghi_chu"\s*:\s*"[^"]*",?/gi
  ];

  keysToRemove.forEach(p => {
    cleaned = cleaned.replace(p, "");
  });

  // G. Loại bỏ các tên key JSON thô sơ (như "part1": " hoặc ""part5_pacing_editor": ")
  cleaned = cleaned.replace(/"*[a-zA-Z0-9_]+"\s*:\s*"/gi, "");
  
  // H. Loại bỏ các chuỗi dính dấu ngoặc kép và dấu phẩy ở cuối dòng
  // Lưu ý sửa đổi regex để tránh lột nhầm nháy thoại hợp lệ của cốt truyện ở cuối dòng
  cleaned = cleaned.replace(/",\s*$/gm, "");
  
  // I. Loại bỏ các ký tự lập trình thừa thãi khác còn sót lại
  cleaned = cleaned.replace(/^\s*[{}[\]],?\s*$/gm, ""); // Loại bỏ các dòng chỉ có dấu đóng mở ngoặc
  
  // J. Formatting dòng
  return cleaned
    .split("\n")
    .map(line => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 5. BỘ CHUYỂN HOÀN CHỈNH: Trải qua các phòng tuyến bền bỉ để xử lý phản hồi từ AI
 */
export function robustParseGameplayJSON(rawT: string): { parsedData: GameplayParsedData | null; isFallback: boolean } {
  if (!rawT) return { parsedData: null, isFallback: true };

  // Khử thẻ tư duy bộc lộ ở đầu nếu còn dính (không phân biệt chữ hoa chữ thường)
  let cleanRaw = rawT;
  const thinkingStartRegex = /<thinking_process>/i;
  const matchThinking = cleanRaw.match(thinkingStartRegex);
  if (matchThinking && matchThinking.index !== undefined) {
    const startIdx = matchThinking.index;
    const endIdx = cleanRaw.toLowerCase().indexOf("</thinking_process>");
    if (endIdx !== -1 && endIdx > startIdx) {
      // Có thẻ đóng hợp lệ
      cleanRaw = cleanRaw.substring(0, startIdx).trim() + "\n" + cleanRaw.substring(endIdx + 19).trim();
    } else {
      // Không có thẻ đóng hợp lệ (bị đứt đoạn hoặc AI quên đóng)
      // Tìm xem có thẻ định dạng JSON hoặc dấu cấu trúc nào ở phía sau không để cắt chính xác phần suy nghĩ dở dang
      let cutTo = -1;
      const jsonOutputStart = cleanRaw.toLowerCase().indexOf("<json_output>");
      const markdownJsonStart = cleanRaw.toLowerCase().indexOf("```json");
      const firstCurlyBrace = cleanRaw.substring(startIdx).indexOf("{");
      if (jsonOutputStart !== -1 && jsonOutputStart > startIdx) {
        cutTo = jsonOutputStart;
      } else if (markdownJsonStart !== -1 && markdownJsonStart > startIdx) {
        cutTo = markdownJsonStart;
      } else if (firstCurlyBrace !== -1) {
        cutTo = startIdx + firstCurlyBrace;
      }
      if (cutTo !== -1) {
        cleanRaw = cleanRaw.substring(cutTo).trim();
      }
    }
  }

  // Tách nội dung bên trong <json_output> nếu có
  let jsonPart = cleanRaw;
  const startJ = cleanRaw.indexOf("<json_output>");
  const endJ = cleanRaw.indexOf("</json_output>");
  
  if (startJ !== -1 && endJ !== -1 && endJ > startJ) {
    jsonPart = cleanRaw.substring(startJ + 13, endJ).trim();
  } else {
    // Thử bóc theo khối markdown ```json
    const b3 = "```";
    const mIdx1 = cleanRaw.indexOf(b3 + "json");
    if (mIdx1 !== -1) {
      let afterM = cleanRaw.substring(mIdx1 + 7);
      const endM = afterM.indexOf(b3);
      if (endM !== -1) {
        jsonPart = afterM.substring(0, endM).trim();
      } else {
        jsonPart = afterM.trim();
      }
    } else {
      // Tìm khối { ... } đầu cuối cùng của chuỗi
      const idx1 = cleanRaw.indexOf("{");
      const idx2 = cleanRaw.lastIndexOf("}");
      if (idx1 !== -1 && idx2 !== -1 && idx2 > idx1) {
        jsonPart = cleanRaw.substring(idx1, idx2 + 1).trim();
      }
    }
  }

  if (!jsonPart) {
    return { parsedData: null, isFallback: true };
  }

  // Phòng tuyến 1: Sửa chữa các dòng xuống dòng thực tế (literal newlines) trong giá trị chuỗi
  let processedJson = escapeLiteralNewlinesInJson(jsonPart);

  // Phòng tuyến 2: Sửa đổi các dấu ngoặc bị đóng thiếu cực mạnh (truncated JSON)
  processedJson = repairTruncatedJson(processedJson);

  // Đưa vào JSON.parse
  try {
    const data = JSON.parse(processedJson);
    return { parsedData: data, isFallback: false };
  } catch (err) {
    console.warn("[Robust JSON Parser] Parse tiêu chuẩn lỗi, triển khai Phòng tuyến 3 (Regex)...", err);
    
    // Phòng tuyến 3: Dùng Regex trích xuất từng trường độc lập
    const regexData = regexExtractGameplayData(processedJson);
    if (regexData) {
      console.log("[Robust JSON Parser] Phòng tuyến Regex thành công bóc tách dữ liệu!");
      return { parsedData: regexData, isFallback: false };
    }
  }

  return { parsedData: null, isFallback: true };
}
