export function cleanErrorMessage(msg: string): string {
  if (!msg) return "";
  const lower = msg.toLowerCase();
  if (
    lower.includes("resource_exhausted") ||
    lower.includes("quota exceeded") ||
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("exhausted")
  ) {
    return "Hạn ngạch thử nghiệm của dòng Pro hiện tại đã hết! Bạn hãy đổi sang dòng Flash (như 'gemini-3.5-flash' hoặc 'gemini-3.1-flash-lite') trong mục Cài đặt -> tab Chung để tiếp tục chơi ngay nhé.";
  }
  
  if (lower.includes("api key") || lower.includes("api_key") || lower.includes("key not found")) {
    return "API Key của bạn không hợp lệ hoặc thiếu. Vui lòng mở Cài đặt -> tab Chung để cập nhật.";
  }

  // Rút gọn các lỗi chứa stack trace hoặc JSON rườm rà
  if (msg.includes("throwErrorIfNotOK") || msg.includes("ApiError:") || msg.includes("node_modules") || msg.includes("{\n")) {
    return "Lỗi kết nối máy chủ AI (Yêu cầu bị từ chối hoặc hết tài nguyên). Vui lòng đổi mô hình hoặc thử lại sau ít giây.";
  }
  
  return msg;
}

export function formatErrorMessage(error: any): { type: string; message: string; solution: string } {
  const rawMsg = error?.message || String(error);
  const cleanedMsg = cleanErrorMessage(rawMsg);
  const errStr = rawMsg.toLowerCase();
  
  if (errStr.includes("fetch") || errStr.includes("network") || errStr.includes("internet") || errStr.includes("failed to fetch")) {
    return {
      type: "Lỗi Mạng (Network/Internet)",
      message: cleanedMsg,
      solution: "- Kiểm tra lại kết nối Wifi/3G/4G của cá nhân bạn.\n- Máy chủ trung gian có thể bị sập, hoặc bị tường lửa chặn chặn.\n- Thử tải lại (F5) tab trình duyệt."
    };
  }
  if (errStr.includes("api key") || errStr.includes("401") || errStr.includes("unauthorized") || errStr.includes("forbidden") || errStr.includes("403")) {
    return {
      type: "Lỗi API Key (Xác nhận quyền)",
      message: cleanedMsg,
      solution: "- Vào phần Cài đặt (Settings), kiểm tra xem API Key của bạn nhập có chính xác không.\n- Chú ý có thể vô tình bao gồm khoảng trắng phía trước/sau Key.\n- Đảm bảo API Key vẫn còn thời hạn hoặc không bị khóa."
    };
  }
  if (errStr.includes("429") || errStr.includes("quota") || errStr.includes("rate limit") || errStr.includes("too many") || errStr.includes("exhausted")) {
    return {
      type: "Lỗi Giới Hạn Quota (Quá tải)",
      message: cleanedMsg,
      solution: "- Tài khoản API của bạn đã cạn kiệt số lượt tạo miễn phí, hãy đổi sang dùng mô hình Flash (như 'gemini-3.5-flash' hoặc 'gemini-3.1-flash-lite').\n- Quá trình phản hồi quá nhanh, hãy chờ vài giây trước khi thực hiện hành động tiếp theo."
    };
  }
  if (errStr.includes("proxy") || errStr.includes("502") || errStr.includes("504") || errStr.includes("gateway") || errStr.includes("503") || errStr.includes("500") || errStr.includes("timeout")) {
    return {
      type: "Lỗi Máy Chủ Phía Sau (Server / Proxy)",
      message: cleanedMsg,
      solution: "- Sự cố này từ bên phía Server hệ thống chứ không phải từ mạng cục bộ.\n- Thử nhấn tạo lại, hoặc chờ vài phút sau đó thử lại."
    };
  }
  if (errStr.includes("cors")) {
    return {
      type: "Lỗi CORS (Bảo mật trình duyệt)",
      message: cleanedMsg,
      solution: "- Trình rà soát quảng cáo/bảo vệ của trình duyệt (ví dụ Adblock, Brave Shield) đang chặn kết nối. Hãy tắt tạm thời.\n- API không hỗ trợ kết nối trực tiếp, phải qua Proxy."
    };
  }
  if (errStr.includes("json") || errStr.includes("parse") || errStr.includes("end of json")) {
    return {
      type: "Lỗi Đọc Dữ Liệu Đầu Vào (Parse)",
      message: cleanedMsg,
      solution: "- Máy chủ AI trả về dữ liệu bất bình thường (hoặc kết nối rớt dọc đường).\n- Xin vui lòng thử nhấp hành động tiếp theo lần nữa."
    };
  }
  
  return {
    type: "Kiểu Lỗi Chung (Không xác định)",
    message: cleanedMsg,
    solution: "- Hãy thử tải lại trang hoặc tạo lại game mới nếu tình trạng cứ tiếp diễn."
  };
}

export function generateSysLog(error: any): string {
  const formatted = formatErrorMessage(error);
  const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
  return `[${timeStr}] 🔴 LOẠI LỖI: ${formatted.type}\n📌 MÔ TẢ: ${formatted.message}\n💡 CÁCH KHẮC PHỤC: \n${formatted.solution}\n----------------------------------------\n`;
}

export function normalizeUsage(u: any) {
  if (!u) return { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
  
  const promptTokenCount = u.promptTokenCount ?? u.prompt_tokens ?? u.inputTokenCount ?? 0;
  const candidatesTokenCount = u.candidatesTokenCount ?? u.completion_tokens ?? u.outputTokenCount ?? 0;
  const totalTokenCount = u.totalTokenCount ?? u.total_tokens ?? u.totalTokenCount ?? (promptTokenCount + candidatesTokenCount);
  
  return {
    promptTokenCount,
    candidatesTokenCount,
    totalTokenCount
  };
}
