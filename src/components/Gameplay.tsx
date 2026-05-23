import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  PanelLeft,
  PanelRight,
  Send,
  ArrowUp,
  ArrowDown,
  User,
  Sparkles,
  Loader2,
  Copy,
  Save,
  Download,
  ImageIcon,
  Book,
  BrainCircuit,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  X,
  ListTodo,
  Edit3,
  Clock,
  MapPin,
  Maximize2,
  Trash2,
  RotateCcw,
  Activity,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { useDeviceMode } from "../hooks/useDeviceMode";
import { toast } from "sonner";
import { aiService } from "../services/aiService";
import { ragService } from "../services/ragService";
import Settings from "./Settings";
import { generateSysLog, cleanErrorMessage, normalizeUsage } from "../utils/errorHandler";
import CharacterModal from "./CharacterModal";
import CodexModal from "./CodexModal";
import GalleryModal from "./GalleryModal";
import LazyImage from "./LazyImage";
import { getGameplaySystemInstruction } from "../utils/gameplaySystemInstruction";
import {
  robustParseGameplayJSON,
  cleanRawOutputText,
} from "../utils/jsonRepair";

const formatCodexData = (obj: any, excludeKeys: string[] = []) => {
  if (!obj) return "Không có thông tin.";
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (excludeKeys.includes(key)) continue;
    if (value && typeof value === "string" && value.trim() !== "") {
      const formattedKey = key
        .replace(/([A-Z])/g, " $1")
        .trim()
        .toUpperCase();
      lines.push(`- ${formattedKey}: ${value.trim()}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : "Không có thông tin.";
};

const formatNPCsCodex = (npcs: any[]) => {
  if (!npcs || !npcs.length) return "Không có NPC nào.";
  return npcs
    .map((npc, idx) => {
      const lines = [`NPC ${idx + 1}:`];
      for (const [key, value] of Object.entries(npc)) {
        if (["id", "avatar"].includes(key)) continue;
        if (value && typeof value === "string" && value.trim() !== "") {
          const formattedKey = key
            .replace(/([A-Z])/g, " $1")
            .trim()
            .toUpperCase();
          lines.push(`  + ${formattedKey}: ${value.trim()}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n\n");
};

export default function Gameplay() {
  const {
    theme,
    gameData,
    fullScreenStreamData,
    updateStreamData,
    setIsGeneratingStream,
    messages,
    setMessages,
    saveCurrentGame,
    autoSaveCurrentGame,
    resumeLatestGame,
    targetWordCount,
    temperature,
    playerRules,
    setPlayerRules,
    systemLogs,
    setSystemLogs,
    memoryFullTurnsCount,
    memoryLogsCount,
    setMemoryFullTurnsCount,
    setMemoryLogsCount,
  } = useStore();
  const navigate = useNavigate();
  const isMobile = useDeviceMode();
  const [leftOpen, setLeftOpen] = useState(!isMobile);
  const [rightOpen, setRightOpen] = useState(!isMobile);
  const [expandedLog, setExpandedLog] = useState<"reasoning" | "error" | null>(
    null,
  );

  // Update panel states when device mode changes
  useEffect(() => {
    setLeftOpen(!isMobile);
    setRightOpen(!isMobile);
  }, [isMobile]);
  const [inputAction, setInputAction] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeDuration, setSummarizeDuration] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isSummarizing) {
      setSummarizeDuration(0);
      interval = setInterval(() => {
        setSummarizeDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setSummarizeDuration(0);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isSummarizing]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamScrollRef = useRef<HTMLDivElement>(null);

  // Init RAG
  useEffect(() => {
    let isMounted = true;
    toast.promise(ragService.init(), {
      loading: "Đang tải bộ nhớ RAG (chạy AI Local)...",
      success: "Khởi tạo bộ nhớ RAG cục bộ thành công!",
      error: "Lỗi tải mô hình RAG.",
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // States for new modals
  const [showCodex, setShowCodex] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [memoryActiveTab, setMemoryActiveTab] = useState<'settings' | 'logs' | 'state'>('settings');
  const [showGallery, setShowGallery] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMC, setShowMC] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [selectedNPCIndex, setSelectedNPCIndex] = useState<number | null>(null);

  // Stats & Timers
  const [currentStats, setCurrentStats] = useState({
    processingTime: 0,
    wordCount: 0,
    tokensIn: 0,
    tokensOut: 0,
    tokensTotal: 0,
  });
  const [timer, setTimer] = useState(0);

  // Format Time Helper
  const formatTimeStr = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    let animationFrameId: number;
    let startTime: number;

    const updateTimer = () => {
      setTimer(performance.now() - startTime);
      animationFrameId = requestAnimationFrame(updateTimer);
    };

    if (isGenerating) {
      startTime = performance.now();
      setTimer(0);
      animationFrameId = requestAnimationFrame(updateTimer);
    } else {
      setTimer(0);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isGenerating]);

  const lastAiMsg = React.useMemo(() => {
    const aiMsgs = messages.filter((m: any) => m.sender === "ai");
    return aiMsgs[aiMsgs.length - 1];
  }, [messages]);

  useEffect(() => {
    if (!isGenerating && lastAiMsg?.stats) {
      setCurrentStats(lastAiMsg.stats);
    }
  }, [isGenerating, lastAiMsg]);

  // Turns
  const turns = React.useMemo(() => {
    const list: any[] = [];
    let currentTurn: any = {};
    let turnIndex = 0;

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.sender === "user") {
        currentTurn.userMsg = m;
      } else if (m.sender === "ai" || m.sender === "system") {
        currentTurn.aiMsg = m;
        currentTurn.index = turnIndex++;
        currentTurn.id = m.id;
        list.push({ ...currentTurn });
        currentTurn = {};
      }
    }
    // Handle waiting state
    if (currentTurn.userMsg && !currentTurn.aiMsg) {
      currentTurn.index = turnIndex;
      currentTurn.id = currentTurn.userMsg.id;
      list.push({ ...currentTurn });
    }
    return list;
  }, [messages]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const totalPages = Math.max(1, turns.length);

  useEffect(() => {
    setCurrentPage(Math.max(1, turns.length));
  }, [turns.length]);

  const getPageTurns = (page: number) => {
    const idx = page - 1;
    if (idx >= 0 && idx < turns.length) {
      return [turns[idx]];
    }
    return [];
  };

  // Modals
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!gameData) {
      toast.error("Không tìm thấy dữ liệu trò chơi, vui lòng tạo mới!");
      navigate("/world-creation");
      return;
    }

    // Nếu chưa có tin nhắn nào, tự động sinh lượt đầu tiên
    // Chỉ chạy đúng 1 lần nhờ hasInitialized
    if (messages.length === 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      generateTurn(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // scroll to bottom stream whenever fullScreenStreamData changes
    if (streamScrollRef.current) {
      streamScrollRef.current.scrollTop = streamScrollRef.current.scrollHeight;
    }
  }, [fullScreenStreamData]);

  const scrollToBottom = (behavior: ScrollBehavior = "instant") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior,
      });
    }
  };

  const scrollToTop = (behavior: ScrollBehavior = "instant") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior });
    }
  };

  const scrollToTurn = (id: string, behavior: ScrollBehavior = "instant") => {
    setTimeout(() => {
      const el = document.getElementById(`turn-${id}`);
      if (el && scrollRef.current) {
        const elOffset = el.offsetTop;
        scrollRef.current.scrollTo({
          top: Math.max(0, elOffset - 20),
          behavior,
        });
      }
    }, 100);
  };

  const generateTurn = async (userAction: string | null) => {
    if (isGenerating) return;
    setIsGenerating(true);
    setIsGeneratingStream(true);
    setRightOpen(true); // Tự động mở khung stream

    const isFirstTurn = userAction === null;
    const aiMsgId = Date.now().toString();

    // Reset stream
    updateStreamData(() =>
      isFirstTurn
        ? ">>> KHỞI TẠO MA TRẬN LUÂN HỒI BẮT ĐẦU...\n"
        : ">>> ĐANG XỬ LÝ HÀNH ĐỘNG CỦA NGƯỜI CHƠI...\n",
    );

    const excludedKeys = [
      "narrativePerspective",
      "writingStyle",
      "genre",
      "mainMood",
      "pacing",
      "powerSystem",
      "logicControl",
    ];
    let contextStr = "";
    if (isFirstTurn) {
      contextStr = `===[ HƯỚNG DẪN QUAN TRỌNG VỀ NGÔI KỂ & VĂN PHONG ]===
- Ngôi kể (Narrative Perspective): ${gameData.worldData?.narrativePerspective || "Không có"}
- Văn phong (Writing Style): ${gameData.worldData?.writingStyle || "Không có"}
===[ YÊU CẦU: ÁP DỤNG NGHIÊM NGẶT NGÔI KỂ VÀ VĂN PHONG NÀY CHO TOÀN BỘ CÂU CHUYỆN ]===

Ý TƯỞNG SƠ KHAI:
${gameData.initialIdea || "Không có"}

Ý TƯỞNG ĐÃ PHÁT TRIỂN:
${gameData.developedIdea || "Không có"}

THÔNG TIN THẾ GIỚI (Lấy từ bảng Tạo Mới Thế Giới):
${formatCodexData(gameData.worldData, excludedKeys)}

QUY TẮC & SÁNG TẠO DO NGƯỜI CHƠI BỔ SUNG:
${gameData.creativeRules || "Không có"}

THÔNG TIN ĐỊA DANH & VẬT PHẨM (Lấy từ bảng Tạo Mới Địa Danh/Vật Phẩm):
${formatCodexData(gameData.worldDetails)}

THÔNG TIN NHÂN VẬT CHÍNH - MC (BẢN HIỆN HÀNH / SỐ 2 - ĐƯỢC PHÉP CẬP NHẬT & DÙNG LÀM CHUẨN: BẠN CẦN LƯU VÀ CẬP NHẬT MỌI SỰ THAY ĐỔI VÀO ĐÂY):
${formatCodexData(gameData.mcData)}

THÔNG TIN NHÂN VẬT CHÍNH - MC (BẢN GỐC / SỐ 1 - CHỈ ĐỌC. TUYỆT ĐỐI NGHIÊM CẤM VIỆC CẬP NHẬT/THAY ĐỔI DỮ LIỆU NÀY DƯỚI MỌI HÌNH THỨC):
${formatCodexData(gameData.originalMcData || gameData.mcData)}

DANH SÁCH NPCs (BẢN HIỆN HÀNH / SỐ 2 - ĐƯỢC PHÉP CẬP NHẬT):
${formatNPCsCodex(gameData.npcs)}

DANH SÁCH NPCs (BẢN GỐC / SỐ 1 - CHỈ ĐỌC. TUYỆT ĐỐI NGHIÊM CẤM SỬA ĐỔI):
${formatNPCsCodex(gameData.originalNpcs || gameData.npcs)}

NHIỆM VỤ CỦA BẠN: HÃY TẠO RA LƯỢT CHƠI ĐẦU TIÊN (MỞ MÀN) - LƯỢT 0000. 
Cực kỳ quan trọng: Bắt buộc xác lập và tạo lập chuẩn xác, hợp logic các trường báo cáo về THỜI GIAN THẾ GIỚI KHỞI ĐIỂM, VỊ TRÍ CỦA MC, VỊ TRÍ CỦA NPC để thiết lập mốc sinh tồn vững chắc cho cốt truyện.
Suy luận sâu (Deep Reasoning) về yếu tố Thời Gian và Vị Trí Không Gian để kịch bản khởi đầu thật lôi cuốn, logic với bối cảnh, và phản ánh đúng TÍNH CÁCH cốt lõi của MC. Đưa MC vào một tình huống cụ thể ngay lúc này.
LƯU Ý NGHIÊM KHẮC CHO LƯỢT 0000: Có thể do khởi đầu có quá nhiều Data JSON nên AI thường có xu hướng bỏ qua hoặc viết rất ngắn phần THINKING_PROCESS, AI cũng hay bỏ quên việc khai báo THỜI GIAN VÀ VỊ TRÍ. BẠN TUYỆT ĐỐI KHÔNG ĐƯỢC MẮC SAI LẦM NÀY NỮA! BẮT BUỘC PHẢI KHAI TRIỂN CHUỖI SUY NGHĨ (THINKING_PROCESS) VÔ CÙNG CHI TIẾT VÀ TÍNH TOÁN KỸ VỀ THỜI GIAN VÀ KHÔNG GIAN TƯƠNG TỰ NHƯ CÁC LƯỢT SAU!`;
    } else {
      const recentTurns = turns.slice(-memoryFullTurnsCount);
      const historyText = recentTurns
        .map(
          (t: any) => `[LƯỢT ${t.index}]
THỜI GIAN THẾ GIỚI MỚI NHẤT MÀ HỆ THỐNG GHI NHẬN ĐƯỢC: ${t.aiMsg?.worldTime || "Vô định"}
VỊ TRÍ CỦA MC MÀ HỆ THỐNG GHI NHẬN ĐƯỢC: ${t.aiMsg?.mcLocation || "Vô định"}
VỊ TRÍ CỦA NPC MÀ HỆ THỐNG GHI NHẬN ĐƯỢC: ${JSON.stringify(t.aiMsg?.npcLocations || [])}

DÀN Ý / TÓM TẮT:
${t.aiMsg?.outline || ""}

DIỄN BIẾN CHÍNH VĂN (FULL TEXT):
${t.aiMsg?.mainText || t.aiMsg?.content || ""}

HÀNH ĐỘNG CỦA MC (NGƯỜI CHƠI) XUẤT PHÁT TỪ NHỮNG DỮ LIỆU ĐÓ:
${t.userMsg?.content || ""}

---KẾT THÚC LƯỢT ${t.index}---
`,
        )
        .join("\n\n");

      const memTurnsLength = turns.length - memoryFullTurnsCount;
      const memStartIndex = Math.max(0, memTurnsLength - memoryLogsCount);
      const memoryTurns =
        memTurnsLength > 0 ? turns.slice(memStartIndex, memTurnsLength) : [];

      let memoryText = "";
      try {
        const q = userAction ? String(userAction) : "khởi đầu";
        console.log("Tìm kiếm ký ức RAG với:", q);
        // Lấy số lượng kết quả liên quan từ RAG theo tỉ lệ của memoryLogsCount (khoảng 10%) để tránh tràn token nhưng vẫn tối ưu, tối thiểu 2 và tối đa 10
        const searchLimit = Math.max(2, Math.min(10, Math.round(memoryLogsCount / 10)));
        const searchRes = await ragService.searchMemory(gameData.id, q, searchLimit, 0.1);

        let memorySections = [];
        if (searchRes.core && searchRes.core.length > 0) {
          memorySections.push(
            "[CORE MEMORY - KÝ ỨC CỐT LÕI (BẮT BUỘC NHỚ)]\n" +
              searchRes.core
                .map((m: any, idx: number) => `* ${m.text}`)
                .join("\n"),
          );
        }
        if (searchRes.standard && searchRes.standard.length > 0) {
          memorySections.push(
            "[RECENT MEMORY - KÝ ỨC NGẮN HẠN LIÊN QUAN]\n" +
              searchRes.standard
                .map((m: any, idx: number) => `(${idx + 1}): ${m.text}`)
                .join("\n\n"),
          );
        }

        if (memorySections.length > 0) {
          memoryText = memorySections.join("\n\n") + "\n\n";
        }
      } catch (err) {
        console.error("Lỗi khi lấy ký ức từ RAG:", err);
      }

      // Dự phòng nếu RAG chưa lấy được hoặc lỗi, có thể dùng kiểu cũ
      if (!memoryText && memoryTurns.length > 0) {
        // memoryText = "[MEMORY - KÝ ỨC CỦA TỐI ĐA 200 LƯỢT CHƠI TRƯỚC ĐÓ DẠNG TÓM TẮT]\n" +
        //  memoryTurns.map((t: any) => `Lượt ${t.index}: ${t.aiMsg?.outline || 'Không có tóm tắt. Hành động của MC: ' + (t.userMsg?.content || 'Chưa rõ')}`).join("\n") + "\n\n";
      }

      contextStr = `===[ HƯỚNG DẪN QUAN TRỌNG VỀ NGÔI KỂ & VĂN PHONG ]===
- Ngôi kể: ${gameData.worldData?.narrativePerspective || "Không có"}
- Văn phong: ${gameData.worldData?.writingStyle || "Không có"}

===[ ĐỊNH HƯỚNG THỂ LOẠI & NHỊP ĐỘ (PHẢI TUÂN THỦ TỪNG LƯỢT) ]===
- Thể loại (Genre): ${gameData.worldData?.genre || "Không có"}
- Âm hưởng chủ đạo (Main Mood): ${gameData.worldData?.mainMood || "Không có"}
- Nhịp độ (Pacing): ${gameData.worldData?.pacing || "Không có"}

===[ QUY TẮC THẾ GIỚI & LOGIC BAN ĐẦU ]===
- Hệ thống sức mạnh/phân bậc: ${gameData.worldData?.powerSystem || "Không có"}
- Kiểm soát logic & Loại trừ: ${gameData.worldData?.logicControl || "Không có"}

[THÔNG TIN TỪ CODEX - CẬP NHẬT GẦN NHẤT]
CỐT TRUYỆN CHÍNH: ${gameData.developedIdea || gameData.initialIdea || ""}

[THÔNG TIN THẾ GIỚI (TỪ CODEX)]
TRẠNG THÁI CUỐN CHIẾU HIỆN TẠI (WORLD STATE): ${gameData.worldData?.worldState || "Chưa có cập nhật trạng thái cuốn chiếu nào."}
${formatCodexData(gameData.worldData, excludedKeys)}

[QUY TẮC & SÁNG TẠO DO NGƯỜI CHƠI BỔ SUNG]
${gameData.creativeRules || "Không có"}

[ĐỊA DANH & VẬT PHẨM (TỪ CODEX)]
${formatCodexData(gameData.worldDetails)}

[THÔNG TIN NHÂN VẬT CHÍNH - MC (BẢN HIỆN HÀNH / SỐ 2 - ĐƯỢC PHÉP CẬP NHẬT & DÙNG LÀM CHUẨN: BẠN CẦN LƯU VÀ CẬP NHẬT MỌI SỰ THAY ĐỔI VÀO ĐÂY)]
${formatCodexData(gameData.mcData)}

[THÔNG TIN NHÂN VẬT CHÍNH - MC (BẢN GỐC / SỐ 1 - CHỈ ĐỌC. TUYỆT ĐỐI NGHIÊM CẤM VIỆC CẬP NHẬT/THAY ĐỔI DỮ LIỆU NÀY DƯỚI MỌI HÌNH THỨC)]
${formatCodexData(gameData.originalMcData || gameData.mcData)}

[DANH SÁCH NPCs VÀ BẢNG THÔNG TIN RIÊNG CHI TIẾT (BẢN HIỆN HÀNH / SỐ 2 - ĐƯỢC PHÉP CẬP NHẬT)]
${formatNPCsCodex(gameData.npcs)}

[DANH SÁCH NPCs (BẢN GỐC / SỐ 1 - CHỈ ĐỌC. TUYỆT ĐỐI NGHIÊM CẤM SỬA ĐỔI)]
${formatNPCsCodex(gameData.originalNpcs || gameData.npcs)}

${memoryText}[QUAN TRỌNG] TOÀN BỘ DIỄN BIẾN CHI TIẾT CỦA ${memoryFullTurnsCount} LƯỢT CHƠI GẦN ĐÂY NHẤT ĐỂ AI LIÊN KẾT LIỀN MẠCH KHÔNG GIAN/THỜI GIAN:
${historyText}

BẠN ĐANG XỬ LÝ LƯỢT CHƠI THỨ: ${turns.length}

Hành động tiếp theo của người chơi: ${userAction}`;
    }

    const systemInstruction = getGameplaySystemInstruction(
      isFirstTurn,
      targetWordCount,
      temperature,
      playerRules,
    );

    const prompt = `Đây là dữ liệu của lượt chơi này:\n\n${contextStr}\n\nHãy tiến hành BƯỚC 1 (THINKING_PROCESS) sau đó kết xuất BƯỚC 2 (JSON Đầu ra) nhé.`;

    // Thêm tin nhắn tạm thời của AI
    setMessages((prev) => [
      ...prev,
      {
        id: aiMsgId,
        sender: "ai",
        content: "",
        isStreaming: true,
      },
    ]);

    scrollToTurn(aiMsgId, "instant");

    try {
      let fullText = "";
      let lastUsage: any = null;
      const startTime = performance.now();
      const stream = aiService.generateStreamingContent(
        prompt,
        undefined,
        systemInstruction,
      );

      for await (const chunk of stream) {
        if (chunk.thought) {
          updateStreamData((prev) => prev + chunk.thought);
        }
        if (chunk.text) {
          fullText += chunk.text;
          updateStreamData((prev) => prev + chunk.text);
        }
        if (chunk.usage) {
          lastUsage = chunk.usage;
          const norm = normalizeUsage(lastUsage);
          setCurrentStats((prev) => ({
            ...prev,
            tokensIn: norm.promptTokenCount,
            tokensOut: norm.candidatesTokenCount,
            tokensTotal: norm.totalTokenCount,
          }));
        }
      }

      const pTime = performance.now() - startTime;

      // Xử lý JSON bằng Parser kiên cường của Matrix Lite
      const { parsedData } = robustParseGameplayJSON(fullText);

      let statsObj: any = null;
      if (parsedData) {
        // Handle MC & NPC Updates
        let currentState = useStore.getState();
        if (currentState.gameData) {
          let newData = JSON.parse(JSON.stringify(currentState.gameData)); // deep clone
          let hasUpdate = false;

          // MC Updates
          if (
            parsedData.mcUpdates &&
            typeof parsedData.mcUpdates === "object"
          ) {
            const cMc = { ...parsedData.mcUpdates };
            delete cMc.ghi_chu;
            if (Object.keys(cMc).length > 0) {
              newData.mcData = { ...newData.mcData, ...cMc };
              hasUpdate = true;
            }
          }

          // NPC Updates
          if (parsedData.npcUpdates && Array.isArray(parsedData.npcUpdates)) {
            parsedData.npcUpdates.forEach((upd: any) => {
              if (upd.id && upd.updates && typeof upd.updates === "object") {
                const idx = (newData.npcs || []).findIndex(
                  (n: any) => n.name === upd.id || n.fullName === upd.id,
                );
                if (idx !== -1) {
                  newData.npcs[idx] = { ...newData.npcs[idx], ...upd.updates };
                  hasUpdate = true;
                }
              }
            });
          }

          // New NPCs Registration
          if (parsedData.newNPCs && Array.isArray(parsedData.newNPCs)) {
            if (!newData.npcs) newData.npcs = [];
            parsedData.newNPCs.forEach((npc: any) => {
              if (npc.name || npc.fullName) {
                const targetName = npc.name || npc.fullName;
                const targetFullName = npc.fullName || npc.name;
                const exist = newData.npcs.some(
                  (n: any) =>
                    n.name === targetName || n.fullName === targetFullName,
                );
                if (!exist) {
                  const defaultNpc = {
                    name: "",
                    fullName: "",
                    titles: "",
                    occupation: "",
                    gender: "",
                    age: "",
                    dob: "",
                    height: "",
                    weight: "",
                    measurements: "",
                    appearance: "",
                    background: "",
                    rank: "",
                    powers: "",
                    skills: "",
                    role: "",
                    relation: "",
                    personality: "",
                    personalityCore: "",
                    philosophy: "",
                    distinguishingFeatures: "",
                    innerSecret: "",
                    relationships: "",
                    loveViews: "",
                    experience: "",
                    nsfwPersonality: "",
                    nsfwReactions: "",
                    literaryDescription: "",
                    goal: "",
                  };
                  newData.npcs.push({ ...defaultNpc, ...npc });
                  hasUpdate = true;
                  toast.success(`Nhân vật mới xuất hiện:\n${targetName}`);
                }
              }
            });
          }

          // World State Updates
          if (parsedData.worldStateUpdate && typeof parsedData.worldStateUpdate === "string") {
            if (!newData.worldData) newData.worldData = {};
            newData.worldData.worldState = parsedData.worldStateUpdate;
            hasUpdate = true;
          }

          if (hasUpdate) {
            useStore.getState().setGameData(newData);
          }
        }

        // Fallback for older saves or if the model ignored the split request
        let assembledText = parsedData.mainText || "";
        if (!assembledText) {
          const parts = Object.keys(parsedData)
            .filter((k) => k.startsWith("part"))
            .sort((a, b) => {
              const numA = parseInt(a.replace(/\D/g, "")) || 0;
              const numB = parseInt(b.replace(/\D/g, "")) || 0;
              return numA - numB;
            })
            .map((k) => (parsedData as any)[k]);

          if (parts.length > 0) {
            assembledText = parts
              .filter(Boolean)
              .map((t: any) =>
                typeof t === "string" ? t.replace(/\\n/g, "\n") : t,
              )
              .join("\n\n");
          }
        }

        const wordCount = assembledText
          ? (assembledText.match(/[\p{L}\p{N}_]+/gu) || []).length
          : 0;
        const norm = normalizeUsage(lastUsage);
        statsObj = {
          processingTime: pTime,
          wordCount: wordCount,
          tokensIn: norm.promptTokenCount,
          tokensOut: norm.candidatesTokenCount,
          tokensTotal: norm.totalTokenCount,
        };
        setCurrentStats(statsObj);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId
              ? {
                  ...msg,
                  isStreaming: false,
                  outline: parsedData.outline,
                  mainText: assembledText,
                  suggestedActions: parsedData.suggestedActions,
                  worldTime: parsedData.worldTime,
                  mcLocation: parsedData.mcLocation,
                  npcLocations: parsedData.npcLocations,
                  stats: statsObj,
                }
              : msg,
          ),
        );

        // Thêm vào RAG DB (Ghi nhớ vector)
        try {
          const logMsg = `Lượt ${turns.length}:\nBối cảnh: ${parsedData.mcLocation || "Không xác định"} lúc ${parsedData.worldTime || ""}\nHành động MC: ${userAction || "Bắt đầu"}\nKhái quát: ${parsedData.outline || ""}\nChi tiết: ${assembledText.substring(0, 1000)}`;
          await ragService.addMemory(gameData.id, logMsg, false);
        } catch (e) {
          console.error("Lỗi khi thêm bộ nhớ RAG:", e);
        }

        // Tự động lưu game
        try {
          autoSaveCurrentGame();
        } catch (e) {
          console.error("Lỗi tự động lưu game (Chế độ Parse):", e);
        }
      } else {
        const cleanText = cleanRawOutputText(fullText);
        const wordCount = (cleanText.match(/[\p{L}\p{N}_]+/gu) || []).length;
        const norm = normalizeUsage(lastUsage);
        statsObj = {
          processingTime: pTime,
          wordCount: wordCount,
          tokensIn: norm.promptTokenCount,
          tokensOut: norm.candidatesTokenCount,
          tokensTotal: norm.totalTokenCount,
        };
        setCurrentStats(statsObj);

        // Fallback
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId
              ? {
                  ...msg,
                  isStreaming: false,
                  content:
                    cleanText ||
                    "Có lỗi xảy ra khi tạo luồng, không thu được kịch bản hoàn chỉnh.",
                  stats: statsObj,
                }
              : msg,
          ),
        );

        // Thêm vào RAG DB (Ghi nhớ vector)
        try {
          const logMsg = `Lượt ${turns.length}:\nHành động MC: ${userAction || "Bắt đầu"}\nChi tiết: ${cleanText.substring(0, 1500)}`;
          await ragService.addMemory(gameData.id, logMsg, false);
        } catch (e) {
          console.error("Lỗi khi thêm bộ nhớ RAG:", e);
        }

        // Tự động lưu game
        try {
          autoSaveCurrentGame();
        } catch (e) {
          console.error("Lỗi tự động lưu game (Chế độ Fallback):", e);
        }
      }
    } catch (error: any) {
      const errorMsg = cleanErrorMessage(error?.message || String(error));
      const newSysLog = generateSysLog(error);
      setSystemLogs((prev) => newSysLog + prev);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId
            ? {
                ...msg,
                isStreaming: false,
                content:
                  "Matrix Lite v1 bị nhiễu loạn băng thông, quá trình tính toán bị ngắt quãng. Vui lòng thử lại.\nLỗi hệ thống: " +
                  errorMsg,
              }
            : msg,
        ),
      );
    } finally {
      setIsGenerating(false);
      setIsGeneratingStream(false);
      scrollToTurn(aiMsgId, "instant");
    }
  };

  const handleSend = () => {
    if (!inputAction.trim() || isGenerating) return;
    const actionText = inputAction.trim();
    setInputAction("");

    // Thêm User message
    const userMsgId = Date.now().toString() + "_u";
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: "user", content: actionText },
    ]);

    generateTurn(actionText);
  };

  const handleSendSummarize = async () => {
    if (isGenerating || isSummarizing) return;
    setIsGenerating(true);
    setIsSummarizing(true);
    
    try {
      const outlineMessages = messages.filter((m) => m.outline);
      const lastSummarizedTurnIndex = gameData.worldData?.lastSummarizedTurnIndex || 0;
      
      const newMessages = outlineMessages.slice(lastSummarizedTurnIndex);
      if (newMessages.length === 0) {
        toast.info("Chưa có lượt chơi mới nào để tóm tắt.");
        setIsGenerating(false);
        setIsSummarizing(false);
        return;
      }

      const newLogsStr = newMessages
        .map((m, idx) => `[LƯỢT ${lastSummarizedTurnIndex + idx + 1}]\n- Tóm tắt: ${m.outline}\n- Diễn biến chi tiết: ${m.mainText}`)
        .join("\n\n");
        
      const oldWorldState = gameData.worldData?.worldState || "Chưa có trạng thái thế giới cũ.";
      
      const promptText = `TRẠNG THÁI THẾ GIỚI CŨ LƯU TRONG NÃO BỘ AI:\n"""\n${oldWorldState}\n"""\n\nDIỄN BIẾN MỚI CẦN CẬP NHẬT (TỪ LƯỢT ${lastSummarizedTurnIndex + 1} ĐẾN CHUỖI TƯƠNG TÁC HIỆN TẠI):\n"""\n${newLogsStr}\n"""\n\nYÊU CẦU: Hãy đọc kỹ Trạng thái thế giới cũ và kết hợp với các Diễn biến mới để ĐÚC KẾT & CẬP NHẬT lại một TRẠNG THÁI THẾ GIỚI MỚI NHẤT. Hãy cập nhật lại tình trạng chung của cảnh vật, trạng thái sinh lý/tâm lý, đồ đạc của Nhân Vật Chính và các NPC đang tương tác, những thay đổi quan trọng nếu có. Bỏ bớt các nội dung đã cũ không còn phù hợp. Chỉ trả lời MỘT bảng tóm tắt súc tích, hoàn chỉnh và cô đọng. Định dạng JSON output với key là "worldState".`;

      const stream = aiService.summarizeWorldStateStream(promptText);
      let fullText = "";
      for await (const chunk of stream) {
        if (chunk.text) {
          fullText += chunk.text;
        }
      }
      
      let finalWorldState = "";
      let cleanOutput = fullText.trim();
      
      // Attempt 1: Raw JSON extraction
      try {
        const startIdx = cleanOutput.indexOf("{");
        const endIdx = cleanOutput.lastIndexOf("}");
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          const jsonStr = cleanOutput.substring(startIdx, endIdx + 1);
          const parsed = JSON.parse(jsonStr);
          if (parsed.worldState) {
            finalWorldState = parsed.worldState;
          }
        }
      } catch (e) {}

      // Attempt 2: Fallback to robust parser
      if (!finalWorldState) {
        const { parsedData } = robustParseGameplayJSON(fullText);
        if (parsedData && parsedData.worldState) {
          finalWorldState = parsedData.worldState;
        }
      }
      
      // Attempt 3: If AI just printed markdown or string
      if (!finalWorldState && fullText.length > 10) {
        finalWorldState = fullText.replace(/```json/g, "").replace(/```/g, "").trim();
        // If it still looks like an object, try removing opening brackets
        if (finalWorldState.startsWith("{") && finalWorldState.endsWith("}")) {
            finalWorldState = finalWorldState.slice(1, -1).trim();
        }
      }

      if (finalWorldState) {
        let currentState = useStore.getState();
        if (currentState.gameData && currentState.gameData.worldData) {
          let newData = JSON.parse(JSON.stringify(currentState.gameData));
          newData.worldData.worldState = finalWorldState;
          newData.worldData.lastSummarizedTurnIndex = outlineMessages.length; // Update the index
          currentState.setGameData(newData);
          toast.success(`Trí nhớ AI (World State) đã cập nhật ${newMessages.length} lượt thành công!`);
          
          // Thêm worldState vào RAG để AI tương lai có thể recall được
          await ragService.addMemory(newData.id, "[CẬP NHẬT TRẠNG THÁI CUỐN CHIẾU]: " + finalWorldState, true);
        }
      } else {
        toast.error("Không tìm thấy thông tin worldState trong nội dung trả về.");
      }
    } catch (e: any) {
      toast.error("Quá trình tạo tóm tắt gặp lỗi: " + cleanErrorMessage(e?.message || String(e)));
    } finally {
      setIsGenerating(false);
      setIsSummarizing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã copy hành động!");
  };

  const handleDownloadSave = async () => {
    const state = useStore.getState();
    if (!state.gameData) return;

    const gameName = "Matrix Lite v1";
    const worldName = state.gameData.worldData?.name || "Untitled World";
    const mcName = state.gameData.mcData?.name || "MC";
    const aiMsgsCount = state.messages.filter((m) => m.sender === "ai" || m.sender === "system").length;
    const turnCount = Math.max(0, aiMsgsCount - 1);

    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, "0")}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getFullYear()}`;
    const saveName = `${gameName} - ${worldName} - Lượt ${turnCount} - ${mcName} - ${dateStr}`;

    const currentId = state.gameData.id || Date.now().toString();
    const ragMemories = await ragService.getMemories(currentId);

    const saveObj = {
      id: currentId,
      name: saveName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: state.messages,
      gameData: state.gameData,
      ragMemories: ragMemories,
    };

    const blob = new Blob([JSON.stringify(saveObj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = saveName + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Đã tải tệp tiến trình về máy!");
  };

  if (!gameData) return null;

  const currentTurnsArr = getPageTurns(currentPage);

  const latestAiMsg = messages
    .slice()
    .reverse()
    .find((m) => m.sender === "ai" && !m.isStreaming);
  const currentWorldTime = latestAiMsg?.worldTime || "N/A";
  const currentLoc = latestAiMsg?.mcLocation || "N/A";

  return (
    <div className="w-full h-full flex flex-col bg-transparent relative overflow-hidden">
      {/* Header */}
      <header className="min-h-[64px] py-2 relative shrink-0 border-b border-white/10 flex items-center justify-between px-4 z-40 backdrop-blur-md bg-black/40 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white cursor-pointer"
            title="Đóng/Mở danh sách NPCs"
          >
            <PanelLeft size={18} />
          </button>
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white cursor-pointer"
            title="Trang Chủ"
          >
            <Home size={18} />
          </button>

          <div className="hidden md:flex items-center gap-1.5 md:gap-2 px-2 ml-2 border-l border-white/10">
            <button
              onClick={async () => {
                await saveCurrentGame();
                toast.success("Đã lưu tiến trình!");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors cursor-pointer text-xs font-bold tracking-wider"
            >
              <Save size={14} /> <span>LƯU</span>
            </button>
            <button
              onClick={async () => {
                const success = await resumeLatestGame();
                if (success) {
                  toast.success("Đã tải nhanh tệp lưu mới nhất!");
                } else {
                  toast.error("Không tìm thấy tệp lưu nào để tải!");
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors cursor-pointer text-xs font-bold tracking-wider"
              title="Tải tiến trình mới nhất"
            >
              <RotateCcw size={14} /> <span>LOAD</span>
            </button>
            <button
              onClick={handleDownloadSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors cursor-pointer text-xs font-bold tracking-wider"
            >
              <Download size={14} /> <span>SAVE</span>
            </button>
            <button
              onClick={() => setShowMC(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer text-xs font-bold tracking-wider"
            >
              <User size={14} /> <span>MC</span>
            </button>
            <button
              onClick={() => setShowRules(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors cursor-pointer text-xs font-bold tracking-wider"
            >
              <ListTodo size={14} /> <span>RULES</span>
            </button>
            <button
              onClick={() => setShowStatus(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 transition-colors cursor-pointer text-xs font-bold tracking-wider"
            >
              <Activity size={14} /> <span>STATUS</span>
            </button>
            <button
              onClick={() => setShowGallery(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition-colors cursor-pointer text-xs font-bold tracking-wider"
            >
              <ImageIcon size={14} /> <span>ẢNH</span>
            </button>
            <button
              onClick={() => setShowCodex(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors cursor-pointer text-xs font-bold tracking-wider"
            >
              <Book size={14} /> <span>CODEX</span>
            </button>
            <button
              onClick={() => setShowMemory(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors cursor-pointer text-xs font-bold tracking-wider"
            >
              <BrainCircuit size={14} /> <span>MEMORY</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors cursor-pointer text-xs font-bold tracking-wider"
            >
              <SettingsIcon size={14} /> <span>CẤU HÌNH</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0 ml-auto py-1">
          <button
            onClick={() => setRightOpen(!rightOpen)}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white cursor-pointer relative"
            title="Đóng/Mở Streaming"
          >
            <PanelRight
              size={18}
              className={isGenerating ? "text-purple-400" : ""}
            />
            {isGenerating && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Overlay for Sidebars */}
        <AnimatePresence>
          {(leftOpen || rightOpen) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setLeftOpen(false);
                setRightOpen(false);
              }}
              className="md:hidden absolute inset-0 bg-black/60 backdrop-blur-sm z-20"
            />
          )}
        </AnimatePresence>

        {/* Left Sidebar - NPCs */}
        <AnimatePresence>
          {leftOpen && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute md:relative left-0 top-0 bottom-0 w-72 md:w-80 border-r border-white/10 bg-black/60 backdrop-blur-2xl z-30 flex flex-col"
            >
              <div className="p-4 border-b border-white/10 shrink-0">
                <h3
                  className={
                    "text-sm font-bold uppercase tracking-widest opacity-50 " +
                    theme.textPrimary
                  }
                >
                  NPCs ({gameData.npcs?.length || 0})
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {gameData.npcs?.map((npc: any, index: number) => {
                  const currentNpcLoc = latestAiMsg?.npcLocations?.find(
                    (loc: any) =>
                      loc.id === npc.name || loc.id === npc.fullName,
                  )?.location;
                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedNPCIndex(index)}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        {npc.avatar ? (
                          <div className="w-16 shrink-0 overflow-hidden rounded-md border border-white/20 aspect-[2/3]">
                            <LazyImage
                              src={npc.avatar}
                              alt="Avatar"
                              className="w-full h-full"
                            />
                          </div>
                        ) : (
                          <div className="w-16 shrink-0 bg-blue-500/20 flex items-center justify-center rounded-md border border-blue-500/30 aspect-[2/3]">
                            <User size={32} className="text-blue-400" />
                          </div>
                        )}
                        <div className="flex flex-col gap-1 items-start flex-1 min-w-0">
                          <h4
                            className={
                              "font-bold leading-tight break-words whitespace-pre-wrap " +
                              theme.textPrimary
                            }
                          >
                            {npc.fullName || npc.name || "Chưa đặt tên"}
                          </h4>
                          <div className="flex items-start gap-1 text-[10px] text-white/70 bg-white/5 px-2 py-1.5 rounded-md border border-white/10 w-full mt-0.5">
                            <MapPin
                              size={12}
                              className="text-green-400/70 shrink-0 mt-0.5"
                            />
                            <span className="whitespace-pre-wrap break-words leading-tight line-clamp-3">
                              {currentNpcLoc || "Vị trí chưa rõ"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(!gameData.npcs || gameData.npcs.length === 0) && (
                  <div className="text-center p-8 opacity-50 text-sm">
                    Chưa có NPC nào
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center - Gameplay Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div
            className="flex-1 overflow-y-auto py-4 md:py-8 px-4 md:px-0 space-y-8 custom-scrollbar"
            ref={scrollRef}
          >
            {currentTurnsArr.map((turn: any) => (
              <div
                key={turn.id}
                id={`turn-${turn.id}`}
                className="w-full relative mb-12 flex flex-col gap-6"
              >
                {turn.userMsg && (
                  // USER MESSAGE (Full width)
                  <div className="w-full rounded-2xl bg-blue-900/10 border border-blue-500/20 p-5 md:p-6 shadow-lg backdrop-blur-md relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
                    <div className="flex items-center gap-2 mb-3">
                      <User size={16} className="text-blue-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-400/80">
                        Người chơi hành động:
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed text-base md:text-lg font-medium text-blue-50 opacity-90">
                      {turn.userMsg.content}
                    </div>
                  </div>
                )}

                {turn.aiMsg && (
                  // AI/SYSTEM MESSAGE (Full width)
                  <div className="w-full rounded-2xl bg-black/60 border border-white/10 text-white/90 shadow-xl backdrop-blur-md overflow-hidden flex flex-col">
                    {/* Header AI Message */}
                    <div className="flex items-center gap-2 p-3 bg-white/5 border-b border-white/5">
                      <Sparkles
                        size={16}
                        className={
                          turn.aiMsg.isStreaming
                            ? "text-purple-400 animate-pulse"
                            : "text-purple-500"
                        }
                      />
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-400/80">
                        {turn.aiMsg.isStreaming
                          ? "Matrix Lite v1 đang kiến tạo..."
                          : "Lượt " + String(turn.index).padStart(4, "0")}
                      </span>
                      <div className="flex-1" />
                      {!turn.aiMsg.isStreaming && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              if (editingTurnId === turn.aiMsg.id) {
                                setMessages((prev) =>
                                  prev.map((m) =>
                                    m.id === turn.aiMsg.id
                                      ? {
                                          ...m,
                                          mainText: editingContent,
                                          content: editingContent,
                                        }
                                      : m,
                                  ),
                                );
                                setEditingTurnId(null);
                              } else {
                                setEditingTurnId(turn.aiMsg.id);
                                setEditingContent(
                                  turn.aiMsg.mainText || turn.aiMsg.content || "",
                                );
                              }
                            }}
                            className="px-3 py-1.5 flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all text-[10px] font-bold tracking-wider"
                            title={
                              editingTurnId === turn.aiMsg.id
                                ? "Lưu"
                                : "Chỉnh sửa lượt (Edit Draw)"
                            }
                          >
                            {editingTurnId === turn.aiMsg.id ? (
                              <>
                                <Save size={12} /> LƯU DIỄN BIẾN
                              </>
                            ) : (
                              <>
                                <Edit3 size={12} /> EDIT DRAW
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              // Xóa ngay lập tức không cần xác nhận rườm rà nhưng có thông báo ngắn gọn.
                              // Nếu turn có userMsg tương ứng (hành động trước đó), ta xóa cả userMsg và aiMsg
                              // để tránh rỗng dở dang gây kẹt trò chơi. Nếu không có userMsg (lượt 0000), ta chỉ xóa aiMsg.
                              const idsToDelete = [turn.aiMsg.id];
                              if (turn.userMsg?.id) {
                                idsToDelete.push(turn.userMsg.id);
                              }
                              setMessages((prev) => prev.filter((m) => !idsToDelete.includes(m.id)));
                              toast.success("Đã xóa phản hồi và quay lại lượt trước thành công!");
                            }}
                            className="px-3 py-1.5 flex items-center gap-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all text-[10px] font-bold tracking-wider border border-red-500/10 hover:border-red-500/20 cursor-pointer"
                            title="Xóa phản hồi này ngay lập tức"
                          >
                            <Trash2 size={12} /> XÓA
                          </button>
                        </div>
                      )}
                      {turn.aiMsg.isStreaming && (
                        <Loader2
                          size={12}
                          className="ml-auto flex animate-spin text-purple-400"
                        />
                      )}
                    </div>

                    <div className="p-5 md:p-6 space-y-6">
                      {turn.aiMsg.isStreaming ? (
                        <div className="text-sm text-white/50 italic animate-pulse">
                          Đang thu thập dữ liệu luân hồi... (Xem chi tiết ở cột
                          bên phải)
                        </div>
                      ) : (
                        <>
                          {/* Outline */}
                          {turn.aiMsg.outline && (
                            <div className="hidden">
                              <span className="absolute -top-2.5 left-4 px-2 bg-black uppercase tracking-widest text-[10px] font-black text-emerald-400">
                                Dàn ý & Tóm tắt
                              </span>
                              {turn.aiMsg.outline}
                            </div>
                          )}

                          {/* Main Text */}
                          {editingTurnId === turn.aiMsg.id ? (
                            <textarea
                              value={editingContent}
                              onChange={(e) =>
                                setEditingContent(e.target.value)
                              }
                              className="w-full h-80 bg-black/40 border border-blue-500/30 rounded-xl p-4 text-base md:text-lg text-white/90 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 resize-y custom-scrollbar leading-loose"
                            />
                          ) : (
                            (turn.aiMsg.mainText || turn.aiMsg.content) && (
                              <div className="whitespace-pre-wrap leading-loose text-base md:text-lg opacity-90 font-medium">
                                {turn.aiMsg.mainText || turn.aiMsg.content}
                              </div>
                            )
                          )}

                          {/* Suggested Actions */}
                          {turn.aiMsg.suggestedActions &&
                            turn.aiMsg.suggestedActions.length > 0 && (
                              <div className="pt-4 mt-6 border-t border-white/10">
                                <h4 className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-4 opacity-80">
                                  Gợi ý hành động:
                                </h4>
                                <div className="grid grid-cols-1 gap-0 -mx-5 md:-mx-6 border-t border-white/5">
                                  {turn.aiMsg.suggestedActions.map(
                                    (actionItem: any, idx: number) => {
                                      const actionTitle =
                                        typeof actionItem === "string"
                                          ? actionItem
                                          : actionItem.action;
                                      const details =
                                        typeof actionItem === "object"
                                          ? actionItem.details
                                          : null;
                                      const timeCost =
                                        typeof actionItem === "object"
                                          ? actionItem.timeCost
                                          : null;

                                      let actionText = actionTitle;
                                      if (details && timeCost) {
                                        actionText += `\n${details}\n[Thời gian dự kiến: ${timeCost}]`;
                                      } else if (details) {
                                        actionText += `\n${details}`;
                                      } else if (timeCost) {
                                        actionText += `\n[Thời gian dự kiến: ${timeCost}]`;
                                      }

                                      return (
                                        <div
                                          key={idx}
                                          className="relative group flex items-start"
                                        >
                                          <button
                                            onClick={() => {
                                              if (!isGenerating) {
                                                setInputAction("");
                                                const userMsgId =
                                                  Date.now().toString() + "_u";
                                                setMessages((prev) => [
                                                  ...prev,
                                                  {
                                                    id: userMsgId,
                                                    sender: "user",
                                                    content: actionText,
                                                  },
                                                ]);
                                                generateTurn(actionText);
                                              }
                                            }}
                                            disabled={isGenerating}
                                            className="w-full text-left px-5 md:px-6 py-4 bg-transparent border-b border-white/5 hover:bg-white/5 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex flex-col relative overflow-hidden"
                                          >
                                            <div className="flex flex-col items-start w-full md:pr-10">
                                              <div className="flex items-start">
                                                <span className="font-bold text-white/95 leading-tight text-base">
                                                  {actionTitle}
                                                </span>
                                              </div>
                                              {details && (
                                                <div className="text-white/60 text-sm mt-1.5 leading-relaxed">
                                                  {details}
                                                </div>
                                              )}
                                              {timeCost && (
                                                <div className="mt-2 text-left">
                                                  <span className="text-[11px] font-mono text-white/40 border border-white/10 px-2 py-1 rounded inline-flex items-center gap-1.5 bg-black/20">
                                                    <Clock className="w-3 h-3 opacity-70" />
                                                    Tiêu tốn {timeCost}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              copyToClipboard(actionText);
                                            }}
                                            className="absolute top-4 right-5 md:right-6 p-2 rounded-lg bg-white/10 border border-white/10 hover:bg-white/20 transition-all text-white/70 hover:text-white"
                                            title="Copy hành động"
                                          >
                                            <Copy size={14} />
                                          </button>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {currentTurnsArr.length === 0 && (
              <div className="flex items-center justify-center h-full opacity-50">
                <p>Đang chờ luồng luân hồi...</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="shrink-0 border-t border-white/10 bg-black/60 backdrop-blur-2xl z-20 flex flex-col gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="w-full max-w-5xl mx-auto relative group">
              <textarea
                value={inputAction}
                onChange={(e) => setInputAction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  isGenerating
                    ? "Matrix Lite v1 đang vận hành..."
                    : "Hành động tiếp theo của bạn (hỗ trợ xuống dòng bằng Shift+Enter)..."
                }
                className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 focus:bg-black/60 rounded-xl py-4 pl-4 pr-14 text-white placeholder-white/30 outline-none resize-none min-h-[60px] max-h-[150px] custom-scrollbar focus:ring-1 focus:ring-blue-500/30 transition-all font-medium disabled:opacity-50"
                rows={
                  inputAction.split("\n").length > 1
                    ? Math.min(inputAction.split("\n").length, 5)
                    : 1
                }
                disabled={isGenerating}
              />
              <button
                onClick={handleSend}
                disabled={!inputAction.trim() || isGenerating}
                className="absolute right-2 bottom-2 p-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <Send
                  size={18}
                  className={
                    "translate-x-0.5 " + (isGenerating ? "opacity-50" : "")
                  }
                />
              </button>
            </div>

            <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
              {/* Pagination */}
              <div className="flex items-center gap-1.5 md:gap-3 bg-white/5 rounded-lg p-1 border border-white/5">
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/50 px-2 pl-3">
                  TRANG
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 md:p-2 rounded hover:bg-white/10 disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="text-xs md:text-sm font-black w-12 text-center text-blue-400">
                  {currentPage}{" "}
                  <span className="text-white/30 font-normal">
                    / {totalPages}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="p-1.5 md:p-2 rounded hover:bg-white/10 disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Scroll Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scrollToTop("auto")}
                  className="p-2 md:p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                  title="Lên đầu"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => scrollToBottom("auto")}
                  className="p-2 md:p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                  title="Xuống cuối"
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            </div>
          </footer>
        </div>

        {/* Right Sidebar - Streaming & Stats */}
        <AnimatePresence>
          {rightOpen && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute md:relative right-0 top-0 bottom-0 w-72 md:w-96 border-l border-white/10 bg-black/80 backdrop-blur-2xl z-30 flex flex-col shadow-2xl overflow-y-auto custom-scrollbar"
            >
              {/* Phần 1: Các nút thao tác trên mobile */}
              <div className="md:hidden p-4 border-b border-white/10 shrink-0 bg-[#0a0a0a]">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={async () => {
                      await saveCurrentGame();
                      toast.success("Đã lưu tiến trình!");
                    }}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer text-[10px] font-bold tracking-wider"
                  >
                    <Save size={16} /> <span>LƯU</span>
                  </button>
                  <button
                    onClick={async () => {
                      const success = await resumeLatestGame();
                      if (success) {
                        toast.success("Đã tải nhanh tệp lưu mới nhất!");
                      } else {
                        toast.error("Không tìm thấy tệp lưu nào để tải!");
                      }
                    }}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer text-[10px] font-bold tracking-wider"
                    title="Tải tiến trình mới nhất"
                  >
                    <RotateCcw size={16} /> <span>LOAD</span>
                  </button>
                  <button
                    onClick={handleDownloadSave}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer text-[10px] font-bold tracking-wider"
                  >
                    <Download size={16} /> <span>SAVE</span>
                  </button>
                  <button
                    onClick={() => setShowMC(true)}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer text-[10px] font-bold tracking-wider"
                  >
                    <User size={16} /> <span>MC</span>
                  </button>
                  <button
                    onClick={() => setShowRules(true)}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors cursor-pointer text-[10px] font-bold tracking-wider"
                  >
                    <ListTodo size={16} /> <span>RULES</span>
                  </button>
                  <button
                    onClick={() => setShowStatus(true)}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors cursor-pointer text-[10px] font-bold tracking-wider"
                  >
                    <Activity size={16} /> <span>STATUS</span>
                  </button>
                  <button
                    onClick={() => setShowGallery(true)}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 transition-colors cursor-pointer text-[10px] font-bold tracking-wider"
                  >
                    <ImageIcon size={16} /> <span>ẢNH</span>
                  </button>
                  <button
                    onClick={() => setShowCodex(true)}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer text-[10px] font-bold tracking-wider"
                  >
                    <Book size={16} /> <span>CODEX</span>
                  </button>
                  <button
                    onClick={() => setShowMemory(true)}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors cursor-pointer text-[10px] font-bold tracking-wider"
                  >
                    <BrainCircuit size={16} /> <span>MEMORY</span>
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg bg-white/5 text-white/80 hover:bg-white/10 transition-colors cursor-pointer text-[10px] font-bold tracking-wider"
                  >
                    <SettingsIcon size={16} /> <span>CẤU HÌNH</span>
                  </button>
                </div>
              </div>

              {/* Tên Thế Giới */}
              <div className="p-4 border-b border-white/10 shrink-0 bg-[#050505] flex flex-col gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase text-white/50 tracking-widest mb-1">
                    THẾ GIỚI HIỆN TẠI
                  </div>
                  <div className="text-sm font-bold text-white drop-shadow-md">
                    {gameData.worldData?.name || "Thế giới vô danh"}
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
                  <div className="flex gap-2">
                    <Clock
                      size={14}
                      className="text-blue-400 shrink-0 mt-0.5"
                    />
                    <span className="text-[11px] font-mono text-white/70 whitespace-pre-wrap break-words leading-tight">
                      {currentWorldTime}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <MapPin
                      size={14}
                      className="text-green-400 shrink-0 mt-0.5"
                    />
                    <span className="text-[11px] font-mono text-white/70 whitespace-pre-wrap break-words leading-tight">
                      {currentLoc}
                    </span>
                  </div>
                </div>
              </div>

              {/* Phần 2: Màn Hình Stats */}
              <div className="p-4 border-b border-white/10 shrink-0 bg-[#050505] relative">
                {isGenerating && (
                  <Loader2
                    size={16}
                    className="absolute top-4 right-4 animate-spin text-purple-400"
                  />
                )}
                <h4 className="text-[10px] font-black uppercase text-blue-400 mb-3 tracking-widest">
                  Màn Hình Stats
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 border border-white/10 p-2 rounded-lg">
                    <div className="text-[10px] text-white/50 mb-1">
                      THỜI GIAN NGAY LÚC NÀY
                    </div>
                    <div className="text-sm font-mono text-white">
                      {formatTimeStr(
                        isGenerating ? timer : currentStats.processingTime,
                      )}
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-2 rounded-lg">
                    <div className="text-[10px] text-white/50 mb-1">
                      SỐ CHỮ (VĂN BẢN)
                    </div>
                    <div className="text-sm font-mono text-white">
                      {currentStats.wordCount} chữ
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-2 rounded-lg col-span-2">
                    <div className="text-[10px] text-white/50 mb-1">
                      TOKENS (IN / OUT / TỔNG)
                    </div>
                    <div className="text-sm font-mono text-white flex gap-1">
                      <span>{currentStats.tokensIn}</span> /{" "}
                      <span>{currentStats.tokensOut}</span> /{" "}
                      <span className="text-purple-400 font-bold">
                        {currentStats.tokensTotal}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phần 3: Deep Reasoning */}
              <div className="p-3 border-b flex justify-between items-center border-white/10 shrink-0">
                <h4 className="text-[10px] font-black uppercase text-purple-400 tracking-widest">
                  Deep Reasoning Log
                </h4>
                <button
                  onClick={() => setExpandedLog("reasoning")}
                  className="p-1 hover:bg-white/10 rounded text-white/50 hover:text-white transition-colors"
                >
                  <Maximize2 size={12} />
                </button>
              </div>
              <div
                ref={streamScrollRef}
                className="flex-1 min-h-[200px] shrink-0 p-4 overflow-y-auto custom-scrollbar scroll-smooth bg-[#0a0a0a]"
              >
                <div className="font-mono text-[11px] leading-relaxed text-green-400/80 break-words whitespace-pre-wrap">
                  {fullScreenStreamData ||
                    "Matrix Lite x Annie xin chào cou nhé dấu<3"}
                </div>
              </div>

              {/* Phần 4: Error & Diagnostic */}
              <div className="p-3 border-y flex justify-between items-center border-white/10 shrink-0">
                <h4 className="text-[10px] font-black uppercase text-red-400 tracking-widest flex items-center gap-2">
                  Error & Diagnostics Log
                  {systemLogs && (
                    <button
                      onClick={() => setSystemLogs("")}
                      className="p-[2px] ml-1 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded transition-colors"
                      title="Xóa logs"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </h4>
                <button
                  onClick={() => setExpandedLog("error")}
                  className="p-1 hover:bg-white/10 rounded text-white/50 hover:text-white transition-colors"
                >
                  <Maximize2 size={12} />
                </button>
              </div>
              <div className="h-48 shrink-0 p-4 overflow-y-auto custom-scrollbar scroll-smooth bg-[#110000]">
                <div className="font-mono text-[11px] leading-relaxed text-red-400/80 break-words whitespace-pre-wrap">
                  {systemLogs || "> Hệ thống bình thường..."}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals placeholders */}
      <AnimatePresence>
        {showMC && (
          <CharacterModal type="mc" onClose={() => setShowMC(false)} />
        )}

        {selectedNPCIndex !== null && (
          <CharacterModal
            type="npc"
            npcIndex={selectedNPCIndex}
            onClose={() => setSelectedNPCIndex(null)}
          />
        )}

        {showStatus && (
          <StatusModal onClose={() => setShowStatus(false)} />
        )}

        {showRules && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col w-screen h-screen p-0 m-0 overflow-hidden"
            onClick={() => setShowRules(false)}
          >
            <div 
              className="bg-[#0a0a0a] w-full h-full flex flex-col rounded-none border-0 shadow-none overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                  <ListTodo size={20} /> PLAYER RULES
                </h2>
                <button
                  onClick={() => setShowRules(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-white/80 flex flex-col">
                <p className="text-sm text-white/50">
                  Thêm các quy tắc bối cảnh, hành vi hoặc phong cách kể chuyện
                  mà AI phải tuân thủ trong suốt quá trình chơi.
                </p>
                <textarea
                  className="w-full flex-1 min-h-[300px] bg-black/50 border border-white/10 rounded-xl p-4 text-white/90 placeholder-white/30 focus:outline-none focus:border-indigo-500/50 resize-none font-mono text-sm leading-relaxed"
                  placeholder={`Mô tả các quy tắc theo dạng gạch đầu dòng:\n- Không được sử dụng phép thuật trong 5 lượt tới.\n- AI phải viết dài hơn bình thường.\n- ...`}
                  value={playerRules}
                  onChange={(e) => setPlayerRules(e.target.value)}
                />
              </div>
            </div>
          </motion.div>
        )}

        {showCodex && <CodexModal onClose={() => setShowCodex(false)} />}

        {showMemory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col w-screen h-screen p-0 m-0 overflow-hidden"
            onClick={() => setShowMemory(false)}
          >
            <div 
              className="w-full h-full flex flex-col bg-[#050505] rounded-none border-0 overflow-hidden shadow-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 md:p-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-black/40 px-6 md:px-8">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
                    <BrainCircuit size={22} className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-widest text-white leading-none">
                      TRÍ NHỚ AI
                    </h2>
                    <span className="text-[10px] text-white/40 tracking-wider uppercase font-mono mt-1 block">
                      AI Memory Matrix & Context Config
                    </span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 uppercase font-bold text-xs">
                  <button
                    onClick={() => setMemoryActiveTab('settings')}
                    className={`px-4 py-2 rounded-lg tracking-wider transition-all cursor-pointer ${
                      memoryActiveTab === 'settings'
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Thiết Lập
                  </button>
                  <button
                    onClick={() => setMemoryActiveTab('state')}
                    className={`px-4 py-2 rounded-lg tracking-wider transition-all cursor-pointer ${
                      memoryActiveTab === 'state'
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Trí nhớ Cuốn chiếu
                  </button>
                  <button
                    onClick={() => setMemoryActiveTab('logs')}
                    className={`px-4 py-2 rounded-lg tracking-wider transition-all cursor-pointer ${
                      memoryActiveTab === 'logs'
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Log Ký Ức ({messages.filter((m) => m.outline).length})
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setMemoryFullTurnsCount(10);
                      setMemoryLogsCount(50);
                      toast.success("Đã khôi phục cài đặt gốc bộ nhớ");
                    }}
                    className="px-3.5 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white font-bold text-xs transition-colors cursor-pointer tracking-wider uppercase"
                  >
                    Mặc Định
                  </button>
                  <button
                    onClick={() => setShowMemory(false)}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer tracking-wider uppercase"
                  >
                    Đóng
                  </button>
                </div>
              </div>

              {/* Main space */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-[#0a0a0a]">
                {memoryActiveTab === 'settings' && (
                  <div className="w-full space-y-8 py-4 px-4 md:px-8">
                    {/* Intro card */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20">
                      <p className="text-white/80 text-sm leading-relaxed">
                        Chào mừng bạn đến với <strong className="text-purple-400 font-bold">Ma Trận Trí Nhớ AI</strong>. Game Matrix Lite v1 sử dụng hệ thống RAG (Retrieval-Augmented Generation) kết hợp với cửa sổ lịch sử trích xuất động để gửi dữ liệu tối ưu nhất cho mô hình <strong className="text-purple-400 font-bold">Gemini 3.1 Pro</strong>. Tại đây, bạn hoàn toàn có thể tinh chỉnh cách AI lưu giữ ký ức hoàn toàn miễn phí mà không lo tốn kém tài nguyên.
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Config 1 */}
                      <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between space-y-4">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                Số lượng lượt chơi đầy đủ gửi cho AI
                              </h3>
                              <p className="text-xs text-white/50">
                                (Full Turns Context Size)
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-lg font-black font-mono">
                              {memoryFullTurnsCount}
                            </span>
                          </div>
                          <p className="text-xs text-white/70 leading-relaxed">
                            Số lượt trò chơi mới nhất được gửi <strong>toàn văn (full text)</strong> bao gồm cả dàn ý, bối cảnh diễn biến và hành động người chơi. Giúp AI hiểu rõ nét nhất văn phong, diễn biến cực kỳ mượt mà và trực tiếp tại khung bối cảnh hiện tại.
                          </p>
                        </div>
                        <div className="flex items-center gap-4 pt-2">
                          <input
                            type="range"
                            min="2"
                            max="30"
                            step="1"
                            value={memoryFullTurnsCount}
                            onChange={(e) => setMemoryFullTurnsCount(Number(e.target.value))}
                            className="flex-1 accent-purple-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => setMemoryFullTurnsCount(Math.max(2, memoryFullTurnsCount - 1))}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 cursor-pointer"
                            >
                              -
                            </button>
                            <button
                              onClick={() => setMemoryFullTurnsCount(Math.min(30, memoryFullTurnsCount + 1))}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Config 2 */}
                      <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col justify-between space-y-4">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                Số lượng Log ký ức gửi cho AI
                              </h3>
                              <p className="text-xs text-white/50">
                                (Memory Summary Retrieval Limit)
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-lg font-black font-mono">
                              {memoryLogsCount}
                            </span>
                          </div>
                          <p className="text-xs text-white/70 leading-relaxed">
                            Số lượng log tóm tắt tối đa trong quá khứ được RAG tìm kiếm thông minh từ cơ sở dữ liệu ký ức dựa trên ngữ cảnh phát ngôn hiện tại, hoặc truyền nén lịch sử để AI nhớ lại các hành trình sâu trong ký ức. Tối ưu trí nhớ vĩnh viễn không giới hạn.
                          </p>
                        </div>
                        <div className="flex items-center gap-4 pt-2">
                          <input
                            type="range"
                            min="5"
                            max="300"
                            step="5"
                            value={memoryLogsCount}
                            onChange={(e) => setMemoryLogsCount(Number(e.target.value))}
                            className="flex-1 accent-purple-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => setMemoryLogsCount(Math.max(5, memoryLogsCount - 5))}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 cursor-pointer"
                            >
                              -
                            </button>
                            <button
                              onClick={() => setMemoryLogsCount(Math.min(300, memoryLogsCount + 5))}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pro Tip logic */}
                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 text-amber-300 text-xs rounded-xl flex items-start gap-2.5 leading-relaxed bg-black/40">
                      <span className="font-bold text-base shrink-0 mt-[-3px]">💡</span>
                      <p>
                        <strong>Gợi ý cài đặt hoàn hảo:</strong> Đặt số lượng lượt chơi full từ <strong>8 - 15 lượt</strong> giúp AI giữ được bối cảnh mượt mà có liên kết chặt chẽ nhất. Đặt số log ký ức từ <strong>30 - 80 tóm tắt</strong> giúp AI tìm kiếm hoặc lội dòng lịch sử một cách thông minh, không lo tràn token mà vẫn đảm bảo ký ức dài hạn tuyệt đối bền vững!
                      </p>
                    </div>
                  </div>
                )}

                {memoryActiveTab === 'state' && (
                  <div className="w-full space-y-6 px-4 md:px-8 py-4">
                     <div className="flex items-center justify-between">
                       <h3 className="text-sm font-black uppercase text-purple-400 tracking-wider">
                         Trí nhớ Cuốn chiếu (World State)
                       </h3>
                     </div>
                     <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col space-y-4 text-white/80 leading-relaxed text-sm">
                       <p>
                         <strong>Tóm tắt cuốn chiếu là gì?</strong> Ký ức AI sẽ dần bị phai nhạt và dẫn tới nhầm lẫn chi tiết theo thời gian (VD: Quên MC đã cởi áo, quên mất NPC đã bị thương...). Việc tóm tắt Cuốn Chiếu sẽ yêu cầu AI tự đọc lại các lượt chơi kết hợp với Trạng thái cũ để cập nhật một bộ não mới.
                       </p>
                       <p>
                         <strong>Khi nào nên bấm?</strong> Kể từ <strong>lượt thứ 10</strong> trở đi, hoặc sau bất cứ sự kiện lớn nào (đổi map, chuyển cảnh, kết thúc một trận chiến/vấn đề), bạn nên bấm để cập nhật trí nhớ cho hệ thống.
                       </p>
                       <div className="pt-2">
                         <button
                           onClick={async () => {
                             if (isGenerating) return;
                             toast.info("Yêu cầu AI phân tích và tóm tắt cuốn chiếu... đang xử lý!");
                             handleSendSummarize();
                           }}
                           disabled={isGenerating || isSummarizing || messages.filter((m) => m.outline).length === (gameData.worldData?.lastSummarizedTurnIndex || 0)}
                           className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 w-full disabled:opacity-50"
                         >
                           {isSummarizing ? <Loader2 size={18} className="animate-spin text-amber-300" /> : <Sparkles size={18} className="animate-pulse" />}{isSummarizing ? " ĐANG TỐM TẮT CUỐN CHIẾU... (" + formatDuration(summarizeDuration) + ")" : " THỰC HIỆN TÓM TẮT CUỐN CHIẾU LỊCH SỬ THẾ GIỚI"}
                         </button>
                       </div>
                       
                       <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                         <div className="flex gap-4">
                           <div className="flex-1 bg-black/40 p-3 rounded-lg text-center">
                              <p className="text-xs text-white/50 mb-1 tracking-wider uppercase">ĐÃ LƯU KÝ ỨC</p>
                              <p className="text-xl font-bold text-white">{gameData.worldData?.lastSummarizedTurnIndex || 0}</p>
                           </div>
                           <div className="flex-1 bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg text-center">
                              <p className="text-xs text-purple-400 mb-1 tracking-wider uppercase">LƯỢT CHỜ TÓM TẮT</p>
                              <p className="text-xl font-bold text-purple-300">{messages.filter(m => m.outline).length - (gameData.worldData?.lastSummarizedTurnIndex || 0)}</p>
                           </div>
                         </div>
                         <p className="font-bold text-purple-300 mt-4">Dữ liệu World State mới nhất đang lưu trong não bộ AI:</p>
                         <div className="p-4 bg-black/40 rounded-xl font-mono text-xs text-purple-300 whitespace-pre-wrap border border-purple-500/10 min-h-24">
                           {gameData.worldData?.worldState || "Chưa có dữ liệu thống kê cuốn chiếu nào. Hãy tạo những lượt chơi đầu tiên và nhấn nút phía trên để bắt đầu!"}
                         </div>
                       </div>
                     </div>
                  </div>
                )}

                {memoryActiveTab === 'logs' && (
                  <div className="w-full space-y-6 px-4 md:px-8 py-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase text-purple-400 tracking-wider">
                        Danh sách các đoạn tóm tắt dòng chảy thời gian
                      </h3>
                      <div className="flex gap-2">
                        {messages.filter((m) => m.outline).length > 0 && (
                          <button
                            onClick={() => {
                              const textToExport = messages
                                .filter((m) => m.outline)
                                .map((m, idx) => `Lượt ${idx + 1}: ${m.outline}`)
                                .join("\n\n");
                              const blob = new Blob([textToExport], { type: "text/plain;charset=utf-8" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `AI_Memory_Logs_${gameData.mcData?.name || "MC"}.txt`;
                              a.click();
                              toast.success("Đã tải về tệp ký ức!");
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            TẢI LOG (.TXT)
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                      {messages
                        .filter((m) => m.outline)
                        .map((m, idx) => (
                          <div
                            key={idx}
                            className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-purple-500/30 transition-all flex flex-col gap-2 relative group overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-full pointer-events-none group-hover:scale-110 transition-transform"></div>
                            <div className="flex items-center justify-between shrink-0">
                              <span className="px-2.5 py-0.5 bg-purple-500/15 text-purple-400 rounded-md text-[10px] font-black uppercase tracking-widest border border-purple-500/10">
                                Lượt {idx + 1}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await ragService.addMemory(gameData.id, `[CORE MEMORY - Người dùng GHIM]\nLượt ${idx + 1}:\n${m.outline}`, true);
                                    toast.success(`Đã GHIM Lượt ${idx + 1} thành KÝ ỨC CỐT LÕI (Core Memory)!`);
                                  }}
                                  className="px-2 py-0.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 rounded-md text-[10px] font-bold uppercase transition-colors cursor-pointer"
                                  title="Đánh dấu Ký ức này là Sổ Tay Ghim để AI không bao giờ quên"
                                >
                                  GHIM CORE
                                </button>
                                {m.worldTime && (
                                  <span className="text-[10px] text-white/40 font-mono">
                                    {m.worldTime}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-white/80 text-xs md:text-sm leading-relaxed whitespace-pre-line bg-transparent">
                              {m.outline}
                            </p>
                          </div>
                        ))}
                    </div>

                    {messages.filter((m) => m.outline).length === 0 && (
                      <div className="text-center opacity-40 py-20 border border-dashed border-white/10 rounded-2xl bg-white/5 flex flex-col items-center justify-center gap-3">
                        <BrainCircuit size={48} className="text-purple-400 stroke-[1.5] opacity-50" />
                        <div>
                          <p className="font-bold text-sm text-white">Chưa ghi nhận ký ức hệ thống</p>
                          <p className="text-xs text-white/50 mt-1 max-w-sm">
                            Khi bạn tiến hành chơi lượt tiếp theo, trí tuệ nhân tạo sẽ tự động phân tích và ghi nhận dàn ý tóm tắt câu chuyện vào đây!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {showGallery && <GalleryModal onClose={() => setShowGallery(false)} />}

        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col w-screen h-screen p-0 m-0 overflow-hidden"
            onClick={() => setShowSettings(false)}
          >
            <div 
              className="w-full h-full flex flex-col bg-[#050505] border-0 rounded-none overflow-hidden shadow-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 md:p-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-black/40">
                <h2 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <SettingsIcon size={20} /> CẤU HÌNH IN-GAME
                </h2>
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <button
                    onClick={() => {
                      useStore.getState().resetSettings();
                      toast.success("Đã khôi phục cài đặt gốc");
                    }}
                    className="px-4 py-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-bold text-sm transition-colors cursor-pointer tracking-wider"
                  >
                    RESET
                  </button>
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      toast.success("Đã lưu cấu hình hiện tại");
                    }}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors cursor-pointer tracking-wider shadow-lg shadow-blue-500/20"
                  >
                    LƯU CẤU HÌNH
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto relative bg-[#0a0a0a]">
                <Settings />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expandedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            onClick={() => setExpandedLog(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] w-full max-w-5xl h-[80vh] rounded-xl border border-white/10 flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <h4
                    className={`text-sm font-black uppercase tracking-widest ${expandedLog === "error" ? "text-red-400" : "text-purple-400"}`}
                  >
                    {expandedLog === "reasoning"
                      ? "Deep Reasoning Log"
                      : "Error & Diagnostics Log"}
                  </h4>
                  {expandedLog === "error" && systemLogs && (
                    <button
                      onClick={() => setSystemLogs("")}
                      className="p-1 px-2 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded transition-colors text-xs font-bold"
                      title="Xóa logs"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setExpandedLog(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div
                className={`flex-1 p-6 overflow-y-auto custom-scrollbar ${expandedLog === "error" ? "bg-[#110000]" : "bg-[#0a0a0a]"}`}
              >
                <div
                  className={`font-mono text-sm leading-relaxed break-words whitespace-pre-wrap ${expandedLog === "error" ? "text-red-400/80" : "text-green-400/80"}`}
                >
                  {expandedLog === "reasoning"
                    ? fullScreenStreamData ||
                      "Matrix Lite x Annie xin chào cou nhé dấu<3"
                    : systemLogs || "> Hệ thống bình thường..."}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
