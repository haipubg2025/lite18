import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Home, Trash2, FolderOpen, Save, ArrowLeft, Clock, Upload, Trash, Download } from 'lucide-react';
import { useStore } from '../store/useStore';
import { toast } from 'sonner';
import { SaveFile } from '../types';
import { ragService } from '../services/ragService';

export default function Saves() {
  const { theme, saves, loadSave, deleteSave, clearSaves, importSaves } = useStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoad = async (id: string, name: string) => {
    if (await loadSave(id)) {
      toast.success(`Đã tải game: ${name}`);
      navigate('/gameplay');
    } else {
      toast.error('Không thể tải tệp lưu này.');
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSave(id);
    ragService.clearMemories(id);
    toast.success('Đã xóa tệp lưu.');
  };

  const handleClearAll = () => {
    saves.forEach(save => ragService.clearMemories(save.id));
    clearSaves();
    toast.success('Đã xóa toàn bộ tệp lưu.');
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    let successCount = 0;
    const imported: SaveFile[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        const data = JSON.parse(text) as SaveFile;
        if (data && data.name && data.gameData) {
          imported.push(data);
          successCount++;
        }
      } catch (err) {
        console.error("Lỗi khi đọc file tệp lưu:", err);
      }
    }

    if (successCount > 0) {
      importSaves(imported);
      toast.success(`Đã tải lên ${successCount} tệp lưu thành công!`);
    } else {
      toast.error('Không tìm thấy tệp lưu hợp lệ.');
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset input
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleString('vi-VN');
  };

  return (
    <div className={`w-full h-full flex flex-col ${theme.bgClass} relative overflow-hidden`}>
      <header className={`h-16 shrink-0 border-b border-white/10 flex items-center justify-between px-4 md:px-8 z-20 backdrop-blur-md bg-black/40`}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className={`p-2.5 rounded-xl hover:bg-white/10 transition-colors text-white cursor-pointer group`}
            title="Quay lại"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <h1 className={`text-xl md:text-2xl font-black uppercase tracking-widest ${theme.textPrimary}`}>
            Lưu Trữ
          </h1>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".json" 
            multiple 
            className="hidden" 
          />
          <button
            onClick={handleUploadClick}
            className={`flex items-center gap-2 p-2.5 px-4 rounded-xl border border-white/20 hover:bg-white/10 transition-colors text-white cursor-pointer`}
            title="Tải lên tệp lưu"
          >
            <Upload size={18} />
            <span className="hidden md:inline text-sm font-bold tracking-widest">TẢI</span>
          </button>
          
          {saves.length > 0 && (
            <button
              onClick={handleClearAll}
              className={`flex items-center gap-2 p-2.5 px-4 rounded-xl border border-red-500/50 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer`}
              title="Xóa tất cả tệp lưu"
            >
              <Trash size={18} />
              <span className="hidden md:inline text-sm font-bold tracking-widest">XÓA SẠCH</span>
            </button>
          )}

          <div className="w-px h-6 bg-white/20 mx-2 hidden md:block"></div>

          <button
            onClick={() => navigate('/')}
            className={`p-2.5 rounded-xl hover:bg-white/10 transition-colors text-white cursor-pointer group`}
            title="Trang Chủ"
          >
            <Home size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          {saves.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 opacity-50 space-y-6">
              <FolderOpen size={64} className="text-white" />
              <p className="text-white text-lg lg:text-xl font-bold tracking-widest uppercase text-center">Chưa có tệp lưu nào</p>
            </div>
          ) : (
             <div className="flex flex-col gap-4">
               <AnimatePresence>
                 {saves.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((save, idx) => (
                   <motion.div
                     key={save.id}
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.9 }}
                     transition={{ delay: idx * 0.05 }}
                     onClick={() => handleLoad(save.id, save.name)}
                     className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-white/10 transition-all cursor-pointer group relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                   >
                     {/* Background Glow */}
                     <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                     
                     <div className="relative z-10 flex-1 min-w-0">
                       <h3 className={`text-lg md:text-xl font-bold break-words text-white`}>
                         {save.name}
                       </h3>
                       <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-xs md:text-sm text-white/50 opacity-80">
                         <div className="flex items-center gap-2">
                           <Clock size={14} />
                           <span>Cập nhật: {formatDate(save.updatedAt)}</span>
                         </div>
                         <span>Tạo từ: {formatDate(save.createdAt)}</span>
                         <span>Số lượt: {Math.max(0, save.messages.filter(m => m.sender === 'ai' || m.sender === 'system').length - 1)}</span>
                       </div>
                     </div>

                     <div className="relative z-10 flex items-center justify-between w-full md:w-auto gap-4 md:gap-6 mt-2 md:mt-0">
                       <span className="text-sm font-bold text-blue-400 tracking-wider">CHƠI TIẾP</span>
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           const blob = new Blob([JSON.stringify(save, null, 2)], { type: "application/json" });
                           const url = URL.createObjectURL(blob);
                           const a = document.createElement('a');
                           a.href = url;
                           a.download = save.name + ".json";
                           document.body.appendChild(a);
                           a.click();
                           document.body.removeChild(a);
                           URL.revokeObjectURL(url);
                           toast.success("Đã tải tệp lưu về máy!");
                         }}
                         className="p-2.5 rounded-lg text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                         title="Tải về máy"
                       >
                         <Download size={20} />
                       </button>
                       <button
                         onClick={(e) => handleDelete(save.id, e)}
                         className="p-2.5 rounded-lg text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                         title="Xóa tệp lưu"
                       >
                         <Trash2 size={20} />
                       </button>
                     </div>
                   </motion.div>
                 ))}
               </AnimatePresence>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
