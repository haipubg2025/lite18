import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Plus, Trash2, Edit3, Image as ImageIcon, Link as LinkIcon, Folder, FolderPlus, Check, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { toast } from 'sonner';
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import "yet-another-react-lightbox/styles.css";

import { DEV_IMAGES, DEV_TABS } from '../constants/devImages';
import LazyImage from './LazyImage';

interface GalleryModalProps {
  onClose: () => void;
  isSelectMode?: boolean;
  onSelect?: (url: string) => void;
}

export default function GalleryModal({ onClose, isSelectMode, onSelect }: GalleryModalProps) {
  const { gameData, setGameData } = useStore();
  const theme = useStore((state) => state.theme);

  // Selector mode state
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>('');

  // Initialize gallery data if not exists
  useEffect(() => {
    if (gameData && !gameData.gallery) {
      setGameData({
        ...gameData,
        gallery: {
          devImages: DEV_IMAGES,
          playerTabs: [
            { id: 'default-player-tab', name: 'Chung' }
          ],
          playerImages: []
        }
      });
    }
  }, []);

  if (!gameData) return null;

  const gallery = {
    devImages: gameData.gallery?.devImages || DEV_IMAGES,
    playerTabs: gameData.gallery?.playerTabs || [{ id: 'default-player-tab', name: 'Chung' }],
    playerImages: gameData.gallery?.playerImages || []
  };

  const [selectedCategory, setSelectedCategory] = useState<'all' | 'dev' | 'player'>('all');
  const [selectedTabId, setSelectedTabId] = useState<string>(gallery.playerTabs?.[0]?.id || 'default-player-tab');
  const [selectedDevTabId, setSelectedDevTabId] = useState<string>(DEV_TABS[0].id);
  
  // Editing tab
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTabName, setEditTabName] = useState('');

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // URL Input
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddTab = () => {
    const newTabId = 'tab-' + Date.now();
    const updatedTabs = [...gallery.playerTabs, { id: newTabId, name: 'Tab Mới' }];
    setGameData({
      ...gameData,
      gallery: { ...gallery, playerTabs: updatedTabs }
    });
    setSelectedTabId(newTabId);
    setEditingTabId(newTabId);
    setEditTabName('Tab Mới');
  };

  const handleSaveTabName = (tabId: string) => {
    if (!editTabName.trim()) return;
    const updatedTabs = gallery.playerTabs.map((t: any) => t.id === tabId ? { ...t, name: editTabName } : t);
    setGameData({
      ...gameData,
      gallery: { ...gallery, playerTabs: updatedTabs }
    });
    setEditingTabId(null);
  };

  const handleDeleteTab = (tabId: string) => {
    if (gallery.playerTabs.length <= 1) {
      toast.error('Phải giữ lại ít nhất 1 tab!');
      return;
    }
    const updatedTabs = gallery.playerTabs.filter((t: any) => t.id !== tabId);
    // Move images from this tab to the first available tab? Or delete them?
    const updatedImages = gallery.playerImages.filter((img: any) => img.tabId !== tabId);
    setGameData({
      ...gameData,
      gallery: { ...gallery, playerTabs: updatedTabs, playerImages: updatedImages }
    });
    if (selectedTabId === tabId) {
      setSelectedTabId(updatedTabs[0]?.id || 'default-player-tab');
    }
    toast.success('Đã xóa tab và các ảnh bên trong');
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const url = event.target?.result as string;
            const newImg = {
              id: 'img-' + Date.now(),
              tabId: selectedCategory === 'player' ? selectedTabId : undefined,
              groupId: selectedCategory === 'dev' ? selectedDevTabId : 'gallery',
              url,
              name: file.name
            };
            
            if (selectedCategory === 'dev') {
              setGameData((prev: any) => {
                if (!prev) return prev;
                const currentGallery = prev.gallery || {};
                return {
                  ...prev,
                  gallery: { ...currentGallery, devImages: [...(currentGallery.devImages || []), newImg] }
                };
              });
            } else {
              setGameData((prev: any) => {
                if (!prev) return prev;
                const currentGallery = prev.gallery || {};
                return {
                  ...prev,
                  gallery: { ...currentGallery, playerImages: [...(currentGallery.playerImages || []), newImg] }
                };
              });
            }
            toast.success('Đã thêm ảnh');
          } catch (err) {
            console.error(err);
          }
        };
        reader.readAsDataURL(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddFromUrl = () => {
    setShowUrlInput(true);
    setUrlInputValue('');
  };

  const submitUrl = () => {
    if (!urlInputValue.trim()) return;
    const url = urlInputValue.trim();
    const newImg = {
      id: 'img-' + Date.now(),
      tabId: selectedCategory === 'player' ? selectedTabId : undefined,
      groupId: selectedCategory === 'dev' ? selectedDevTabId : 'gallery',
      url,
      name: 'Ảnh từ URL'
    };
    
    if (selectedCategory === 'dev') {
      setGameData({
        ...gameData,
        gallery: { ...gallery, devImages: [...(gallery.devImages || []), newImg] }
      });
    } else {
      setGameData({
        ...gameData,
        gallery: { ...gallery, playerImages: [...(gallery.playerImages || []), newImg] }
      });
    }
    toast.success('Đã thêm ảnh từ URL');
    setShowUrlInput(false);
  };

  const handleDeleteImage = (imgId: string) => {
    // Check if it's in devImages
    if (gallery.devImages?.some((img: any) => img.id === imgId)) {
      const updatedImages = gallery.devImages.filter((img: any) => img.id !== imgId);
      setGameData({
        ...gameData,
        gallery: { ...gallery, devImages: updatedImages }
      });
    } else {
      const updatedImages = gallery.playerImages.filter((img: any) => img.id !== imgId);
      setGameData({
        ...gameData,
        gallery: { ...gallery, playerImages: updatedImages }
      });
    }
  };

  const getDisplayedImages = () => {
    if (selectedCategory === 'all') {
      return [...gallery.devImages, ...gallery.playerImages];
    } else if (selectedCategory === 'dev') {
      return gallery.devImages.filter((img: any) => img.groupId === selectedDevTabId || (!img.groupId && selectedDevTabId === 'gallery'));
    } else {
      return gallery.playerImages.filter((img: any) => img.tabId === selectedTabId);
    }
  };

  const displayedImages = getDisplayedImages();

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.98 }} 
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      <div 
        className="bg-[#050505] w-full max-w-7xl h-full flex flex-col rounded-2xl md:rounded-3xl border border-white/10 overflow-hidden relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-pink-900/10 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="p-4 md:p-6 flex items-center justify-end shrink-0 relative z-10 border-b border-white/5">
        <div className="flex items-center gap-3">
          {isSelectMode && selectedAvatarUrl && onSelect && (
            <button
               onClick={() => { onSelect(selectedAvatarUrl); onClose(); }}
               className="px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold transition-all text-sm tracking-wider shadow-lg shadow-pink-500/20"
            >
               XONG
            </button>
          )}

          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="w-48 bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white/80 outline-none focus:border-pink-500/50 hover:bg-white/10 transition-colors cursor-pointer appearance-none [&>option]:bg-black [&>option]:text-white"
          >
            <option value="all">Mặc định (Tất cả)</option>
            <option value="dev">Ảnh của DEV</option>
            <option value="player">Ảnh của người chơi</option>
          </select>

          <button 
            onClick={onClose} 
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer backdrop-blur-md"
            title="Đóng (Phím Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-0 relative z-10">
        {/* Sidebar / Topbar filter */}
        {(selectedCategory === 'player' || selectedCategory === 'dev') && (
        <div className="w-full md:w-64 bg-black/20 border-b md:border-b-0 md:border-r border-white/5 shrink-0 flex flex-col min-h-[300px]">
          <div className="flex flex-col h-full p-4">
            <div className="flex items-center justify-between text-[10px] font-black tracking-widest text-white/30 uppercase mb-3 shrink-0">
              <span>{selectedCategory === 'player' ? 'Tabs Phân Loại' : 'Nhóm Ảnh DEV'}</span>
              {selectedCategory === 'player' && (
                <button onClick={handleAddTab} className="hover:text-pink-400 cursor-pointer p-1"><FolderPlus size={14} /></button>
              )}
            </div>
            <div className="space-y-1.5 overflow-y-auto custom-scrollbar flex-1 pr-2">
              {selectedCategory === 'player' ? gallery.playerTabs.map((tab: any) => (
                <div 
                  key={tab.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                    selectedTabId === tab.id ? 'bg-pink-500/20 border-pink-500/30 text-pink-300' : 'bg-transparent border-transparent text-white/60 hover:bg-white/5'
                  }`}
                  onClick={() => setSelectedTabId(tab.id)}
                >
                  {editingTabId === tab.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        autoFocus
                        value={editTabName}
                        onChange={(e) => setEditTabName(e.target.value)}
                        onBlur={() => handleSaveTabName(tab.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTabName(tab.id)}
                        className="bg-black/50 border border-white/20 rounded px-2 py-1 text-xs w-full outline-none focus:border-pink-500/50 text-white"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button onClick={(e) => { e.stopPropagation(); handleSaveTabName(tab.id); }} className="text-white/50 hover:text-green-400 shrink-0">
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 truncate text-sm">
                        <Folder size={14} className={selectedTabId === tab.id ? 'text-pink-400' : 'opacity-50'} />
                        <span className="truncate">{tab.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setEditingTabId(tab.id); setEditTabName(tab.name); }} className="p-1 hover:text-white shrink-0">
                          <Edit3 size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTab(tab.id); }} className="p-1 hover:text-red-400 shrink-0">
                          <X size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )) : DEV_TABS.map((tab: any) => (
                <div 
                  key={tab.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                    selectedDevTabId === tab.id ? 'bg-pink-500/20 border-pink-500/30 text-pink-300' : 'bg-transparent border-transparent text-white/60 hover:bg-white/5'
                  }`}
                  onClick={() => setSelectedDevTabId(tab.id)}
                >
                  <div className="flex items-center gap-2 truncate text-sm">
                    <Folder size={14} className={selectedDevTabId === tab.id ? 'text-pink-400' : 'opacity-50'} />
                    <span className="truncate">{tab.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col relative min-h-[500px]">
          {/* Actions */}
          {selectedCategory === 'player' && !isSelectMode && (
            <div className="p-4 border-b border-white/5 flex items-center justify-end gap-3 bg-black/20 shrink-0">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUploadImage} />
              
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer text-xs font-bold tracking-wider border border-white/10">
                <Upload size={14} /> TẢI ẢNH TỪ MÁY
              </button>
              
              <button onClick={handleAddFromUrl} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 hover:text-pink-300 transition-all cursor-pointer text-xs font-bold tracking-wider border border-pink-500/30">
                <LinkIcon size={14} /> THÊM TỪ URL
              </button>
            </div>
          )}

          {/* Grid */}
          <div className="flex-1 p-6">
            {displayedImages.length === 0 ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-white/30 gap-4">
                <ImageIcon size={48} className="opacity-20" />
                <p className="text-sm">Chưa có ảnh nào trong danh mục này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {displayedImages.map((img: any) => (
                  <div 
                    key={img.id} 
                    className={`group relative aspect-[2/3] rounded-xl overflow-hidden bg-black/40 border cursor-pointer flex-shrink-0 min-h-[150px] transition-all ${isSelectMode && selectedAvatarUrl === img.url ? 'border-pink-500 ring-2 ring-pink-500/50 scale-[0.98]' : 'border-white/10 hover:border-white/30'}`}
                    onClick={() => {
                      if (isSelectMode) {
                        setSelectedAvatarUrl(img.url);
                      } else {
                        setLightboxIndex(displayedImages.findIndex((d: any) => d.id === img.id));
                        setLightboxOpen(true);
                      }
                    }}
                  >
                    <LazyImage src={img.url} alt={img.name} className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 pointer-events-none">
                      <p className="text-xs text-white truncate drop-shadow-md relative z-10">{img.name}</p>
                    </div>
                    {isSelectMode && selectedAvatarUrl === img.url && (
                      <div className="absolute top-2 left-2 bg-pink-500 text-white rounded-full p-1 shadow-lg z-10 animate-in zoom-in">
                        <CheckCircle2 size={20} />
                      </div>
                    )}
                    {/* Xóa ảnh - Only show for player images */}
                    {!isSelectMode && !gallery.devImages?.some((d: any) => d.id === img.id) && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(img.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:scale-110 shadow-lg cursor-pointer z-10"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          index={lightboxIndex}
          slides={displayedImages.map((img: any) => ({ src: img.url }))}
          plugins={[Zoom, Fullscreen]}
          carousel={{ finite: displayedImages.length <= 1 }}
          render={{
             buttonPrev: displayedImages.length <= 1 ? () => null : undefined,
             buttonNext: displayedImages.length <= 1 ? () => null : undefined,
          }}
        />
      )}

      {showUrlInput && (
        <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowUrlInput(false)}>
          <div 
            className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">
              Nhập Link URL Ảnh
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                placeholder="https://example.com/image.jpg"
                value={urlInputValue}
                onChange={(e) => setUrlInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitUrl()}
                className="flex-1 bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-pink-500/50"
              />
              <button
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    setUrlInputValue(text);
                  } catch (err) {
                    toast.error("Không thể dán tự động, vui lòng dán thủ công.");
                  }
                }}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/70 hover:text-white transition-all text-sm"
                title="Dán từ Clipboard"
              >
                Dán
              </button>
            </div>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                onClick={() => setShowUrlInput(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all text-sm font-bold"
              >
                HỦY
              </button>
              <button
                onClick={submitUrl}
                className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white transition-all text-sm font-bold"
              >
                XÁC NHẬN
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </motion.div>
  );
}
