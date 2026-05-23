import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { User, X, Shield, Activity, Fingerprint, BookOpen, Star, Info, Crown, Key, Edit3, Save, Flame, Users, FileText } from 'lucide-react';
import { useStore } from '../store/useStore';
import { DEV_IMAGES } from '../constants/devImages';
import LazyImage from './LazyImage';
import { toast } from 'sonner';
import GalleryModal from './GalleryModal';

interface CharacterModalProps {
  type: 'mc' | 'npc';
  npcIndex?: number;
  onClose: () => void;
}

interface EditableFieldProps {
  label: string;
  field: string;
  value: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  multiline?: boolean;
  className?: string;
}

function EditableField({ label, field, value, isEditing, onChange, multiline = false, className = '' }: EditableFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <span className="text-[10px] uppercase tracking-widest text-white/40">{label}</span>}
      {isEditing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-black/40 border border-white/20 rounded-lg p-2 text-sm text-white/90 outline-none focus:border-blue-500/50 resize-y min-h-[80px]"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-black/40 border border-white/20 rounded-lg p-2 text-sm text-white/90 outline-none focus:border-blue-500/50"
          />
        )
      ) : (
        <span className={`text-sm ${multiline ? 'leading-relaxed whitespace-pre-wrap' : 'font-medium'} text-white/${multiline ? '80' : '90'} ${!value && 'italic opacity-30'}`}>
          {value || 'Không có dữ liệu.'}
        </span>
      )}
    </div>
  );
}

export default function CharacterModal({ type, npcIndex, onClose }: CharacterModalProps) {
  const { gameData, setGameData } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'chung' | 'tui'>('chung');
  const [showAvatarSelect, setShowAvatarSelect] = useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [activeVersion, setActiveVersion] = useState<'1' | '2'>('2');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setActiveTab('chung');
  }, [type, npcIndex]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (gameData) {
      if (type === 'mc') {
        const data = activeVersion === '1' ? (gameData.originalMcData || gameData.mcData) : gameData.mcData;
        setEditedData({ ...data });
      } else if (type === 'npc' && npcIndex !== undefined) {
        const data = activeVersion === '1' ? (gameData.originalNpcs?.[npcIndex] || gameData.npcs[npcIndex]) : gameData.npcs[npcIndex];
        setEditedData({ ...data });
      }
    }
  }, [type, npcIndex, activeVersion]);

  if (!gameData || !editedData) return null;

  const handleSave = () => {
    if (type === 'mc') {
      if (activeVersion === '1') {
        setGameData({
          ...gameData,
          originalMcData: editedData
        });
      } else {
        setGameData({
          ...gameData,
          mcData: editedData
        });
      }
    } else if (type === 'npc' && npcIndex !== undefined) {
      if (activeVersion === '1') {
        const origNpcs = gameData.originalNpcs ? [...gameData.originalNpcs] : [...gameData.npcs];
        origNpcs[npcIndex] = editedData;
        setGameData({
          ...gameData,
          originalNpcs: origNpcs
        });
      } else {
        const newNpcs = [...gameData.npcs];
        newNpcs[npcIndex] = editedData;
        setGameData({
          ...gameData,
          npcs: newNpcs
        });
      }
    }
    setIsEditing(false);
  };

  const handleAvatarChange = (url: string) => {
    handleChange('avatar', url);
    if (!isEditing) {
      if (type === 'mc') {
        if (activeVersion === '1') {
          const newMcData = { ...editedData, avatar: url };
          setGameData({ ...gameData, originalMcData: newMcData });
        } else {
          const newMcData = { ...editedData, avatar: url };
          setGameData({ ...gameData, mcData: newMcData });
        }
      } else if (type === 'npc' && npcIndex !== undefined) {
        if (activeVersion === '1') {
          const origNpcs = gameData.originalNpcs ? [...gameData.originalNpcs] : [...gameData.npcs];
          origNpcs[npcIndex] = { ...editedData, avatar: url };
          setGameData({ ...gameData, originalNpcs: origNpcs });
        } else {
          const newNpcs = [...gameData.npcs];
          newNpcs[npcIndex] = { ...editedData, avatar: url };
          setGameData({ ...gameData, npcs: newNpcs });
        }
      }
    }
  };

  const handleChange = (field: string, value: string) => {
    setEditedData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const url = event.target?.result as string;
            handleAvatarChange(url);
            
            // Add to gallery
            const newImg = {
              id: 'img-' + Date.now(),
              tabId: 'default-player-tab',
              url,
              name: file.name
            };
            
            setGameData((prev: any) => {
              if (!prev) return prev;
              const currentGallery = prev.gallery || {};
              const gallery = {
                devImages: currentGallery.devImages || DEV_IMAGES,
                playerTabs: currentGallery.playerTabs || [{ id: 'default-player-tab', name: 'Chung' }],
                playerImages: currentGallery.playerImages || []
              };
              return {
                ...prev,
                gallery: { ...gallery, playerImages: [...(gallery.playerImages || []), newImg] }
              };
            });
            toast.success("Thay ảnh thành công và đã lưu vào thư viện!");
          } catch (err) {
            console.error(err);
          }
        };
        reader.readAsDataURL(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowAvatarSelect(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAvatarClick = () => {
    setShowAvatarSelect(true);
  };

  // Group fields logically
  const basicFields = [
    { label: 'Tên đầy đủ', field: 'fullName' },
    { label: 'Tuổi', field: 'age' },
    { label: 'Giới tính', field: 'gender' },
    { label: 'Ngày sinh', field: 'dob' },
    { label: 'Chiều cao', field: 'height' },
    { label: 'Cân nặng', field: 'weight' },
    { label: 'Số đo 3 vòng', field: 'measurements' }
  ];

  const identityFields = [
    { label: 'Danh xưng', field: 'titles' },
    { label: 'Nghề nghiệp', field: 'occupation' },
    { label: 'Cấp bậc', field: 'rank' },
    ...(type === 'npc' ? [{ label: 'Vai trò', field: 'role' }, { label: 'Quan hệ với MC', field: 'relation' }] : [])
  ];

  const submitUrl = () => {
    if (!urlInputValue.trim()) return;
    const url = urlInputValue.trim();
    handleAvatarChange(url);
    
    // Add to gallery
    const newImg = {
      id: 'img-' + Date.now(),
      tabId: 'default-player-tab',
      url,
      name: 'Ảnh từ URL'
    };
    const gallery = {
      devImages: gameData.gallery?.devImages || DEV_IMAGES,
      playerTabs: gameData.gallery?.playerTabs || [{ id: 'default-player-tab', name: 'Chung' }],
      playerImages: gameData.gallery?.playerImages || []
    };
    setGameData((prev: any) => ({
      ...prev,
      gallery: { ...gallery, playerImages: [...(gallery.playerImages || []), newImg] }
    }));
    toast.success("Thay ảnh thành công và đã lưu vào thư viện!");
    
    setShowUrlInput(false);
    setShowAvatarSelect(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.98 }} 
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-7xl h-full flex flex-col shadow-2xl relative bg-[#050505] rounded-2xl md:rounded-3xl border border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />
        
        {/* Header */}
        <div className="p-2 md:p-3 flex items-center justify-between shrink-0 relative z-20 border-b border-white/5 bg-black/60 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div>
               {isEditing ? (
                 <input 
                   type="text" 
                   value={editedData.name || ''} 
                   onChange={(e) => handleChange('name', e.target.value)}
                   className="text-sm font-bold uppercase tracking-widest text-white drop-shadow-md bg-black/40 border border-white/20 rounded p-1 px-2 w-full max-w-xs outline-none focus:border-blue-500/50"
                   placeholder="TÊN NHÂN VẬT"
                 />
               ) : (
                 <h2 className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-md">
                   {editedData.name || (type === 'mc' ? 'TRUYỀN KỲ MC' : 'NHÂN VẬT KHẨN CẤP')}
                 </h2>
               )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 mr-2 bg-black/50 p-1 rounded-lg border border-white/10">
               <button
                 onClick={() => { setIsEditing(false); setActiveVersion('1'); }}
                 className={`px-3 py-1.5 rounded-md font-bold text-sm transition-all ${activeVersion === '1' ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-transparent text-white/40 hover:text-white/80 hover:bg-white/5'}`}
                 title="Bản gốc"
               >
                 1
               </button>
               <button
                 onClick={() => { setIsEditing(false); setActiveVersion('2'); }}
                 className={`px-3 py-1.5 rounded-md font-bold text-sm transition-all ${activeVersion === '2' ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-transparent text-white/40 hover:text-white/80 hover:bg-white/5'}`}
                 title="Bản hiện tại"
               >
                 2
               </button>
            </div>
            {isEditing ? (
              <button 
                onClick={handleSave} 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 transition-all cursor-pointer border border-blue-500/30"
                title="Lưu"
              >
                <Save size={16} />
                <span className="hidden md:inline font-bold tracking-wider text-xs">LƯU</span>
              </button>
            ) : (
              <button 
                onClick={() => setIsEditing(true)} 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer border border-white/10"
                title="Chỉnh sửa"
              >
                <Edit3 size={16} />
                <span className="hidden md:inline font-bold tracking-wider text-xs">SỬA</span>
              </button>
            )}
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer backdrop-blur-md"
              title="Đóng (Phím Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 w-full flex flex-col">
          <div className="flex flex-col xl:flex-row p-4 md:p-8 gap-8 w-full mx-auto flex-1">
            {/* Left Column: Avatar */}
            <div className="flex flex-col items-center xl:items-start xl:w-[420px] shrink-0">
              <div 
                className="w-64 md:w-80 xl:w-full aspect-[3/4] rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30 shadow-2xl shadow-blue-500/10 overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-blue-500/30 group relative transition-all duration-300"
                onClick={handleAvatarClick}
                title="Nhấn để đổi ảnh đại diện"
              >
                {editedData.avatar ? (
                  <LazyImage src={editedData.avatar} alt="Avatar" className="w-full h-full" />
                ) : (
                  <User size={80} className="text-blue-400/50" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                  <Edit3 size={32} className="text-white drop-shadow-md" />
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              
              {/* Tab Navigation (MC only) moved below avatar implicitly visually, or we can keep it on the right side */}
              {type === 'mc' && (
                <div className="flex items-center justify-center xl:justify-start gap-4 mt-6 w-full relative z-10 shrink-0">
                  <button
                    onClick={() => setActiveTab('chung')}
                    className={`flex-1 py-3 font-bold tracking-wider text-sm uppercase transition-colors border-2 rounded-xl ${activeTab === 'chung' ? 'text-blue-400 border-blue-500/50 bg-blue-500/10' : 'text-white/40 border-white/5 bg-white/5 hover:text-white/80 hover:bg-white/10'}`}
                  >
                    Chung
                  </button>
                  <button
                    onClick={() => setActiveTab('tui')}
                    className={`flex-1 py-3 font-bold tracking-wider text-sm uppercase transition-colors border-2 rounded-xl ${activeTab === 'tui' ? 'text-blue-400 border-blue-500/50 bg-blue-500/10' : 'text-white/40 border-white/5 bg-white/5 hover:text-white/80 hover:bg-white/10'}`}
                  >
                    Túi / Tài sản
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Content Areas */}
            <div className="w-full flex-1">
              {activeTab === 'chung' && (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 md:gap-8 w-full">
               
               {/* Cột trái: Thông tin cơ bản & Đặc điểm */}
               <div className="space-y-6 md:col-span-1">
                 
                 {/* Identity Box */}
                 <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] group-hover:bg-blue-500/10 transition-colors pointer-events-none" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-blue-400/80 flex items-center gap-2 mb-4">
                       <Crown size={16} /> Danh Tính
                    </h3>
                    <div className="flex flex-col gap-3 relative z-10">
                       {identityFields.map((item, idx) => (
                           <EditableField key={idx} label={item.label} field={item.field} value={editedData[item.field] || ''} isEditing={isEditing} onChange={(val) => handleChange(item.field, val)} />
                       ))}
                    </div>
                 </div>

                 {/* Basic Info Box */}
                 <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10">
                    <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400/80 flex items-center gap-2 mb-4">
                       <Info size={16} /> Nhận Dạng Cơ Bản
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                       {basicFields.map((item, idx) => (
                           <EditableField key={idx} label={item.label} field={item.field} value={editedData[item.field] || ''} isEditing={isEditing} onChange={(val) => handleChange(item.field, val)} />
                       ))}
                    </div>
                 </div>

                 {/* Appearance & Distinguishing Features */}
                 <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10">
                    <h3 className="text-xs font-black uppercase tracking-widest text-pink-400/80 flex items-center gap-2 mb-4">
                       <Fingerprint size={16} /> Ngoại Hình & Dấu Hiệu
                    </h3>
                    <div className="space-y-4">
                       <EditableField label="Miêu tả ngoại hình" field="appearance" value={editedData.appearance || ''} isEditing={isEditing} onChange={(val) => handleChange('appearance', val)} multiline />
                       <EditableField label="Đặc điểm nhận dạng phụ" field="distinguishingFeatures" value={editedData.distinguishingFeatures || ''} isEditing={isEditing} onChange={(val) => handleChange('distinguishingFeatures', val)} multiline />
                     </div>
                  </div>
               </div>

               {/* Cột Giữa & Phải: Sức mạnh, Kỹ năng, Tính cách & Tiểu sử */}
               <div className="space-y-6 md:col-span-2">
                  
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Powers Box */}
                    <div className="p-5 md:p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                       <h3 className="text-xs font-black uppercase tracking-widest text-red-400/80 flex items-center gap-2 mb-3">
                          <Activity size={16} /> Sức Mạnh / Năng Lực
                       </h3>
                       <EditableField label="" field="powers" value={editedData.powers || ''} isEditing={isEditing} onChange={(val) => handleChange('powers', val)} multiline />
                    </div>

                    {/* Skills Box */}
                    <div className="p-5 md:p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                       <h3 className="text-xs font-black uppercase tracking-widest text-amber-400/80 flex items-center gap-2 mb-3">
                          <Star size={16} /> Kỹ Năng Chuyên Môn
                       </h3>
                       <EditableField label="" field="skills" value={editedData.skills || ''} isEditing={isEditing} onChange={(val) => handleChange('skills', val)} multiline />
                    </div>
                 </div>

                 {/* Personal & Psychological Profile */}
                 <div className="p-5 md:p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                    <h3 className="text-xs font-black uppercase tracking-widest text-purple-400/80 flex items-center gap-2 mb-4">
                       <BookOpen size={16} /> Hồ Sơ Tâm Lý
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <EditableField label="Tính cách tổng quan" field="personality" value={editedData.personality || ''} isEditing={isEditing} onChange={(val) => handleChange('personality', val)} multiline />
                       <EditableField label="Cốt lõi tính cách (Bản ngã)" field="personalityCore" value={editedData.personalityCore || ''} isEditing={isEditing} onChange={(val) => handleChange('personalityCore', val)} multiline />
                       
                       <EditableField label="Kim chỉ nam / Lý tưởng" field="philosophy" value={editedData.philosophy || ''} isEditing={isEditing} onChange={(val) => handleChange('philosophy', val)} multiline className="col-span-1 md:col-span-2 pt-3 border-t border-white/5" />
                       <EditableField label="Mục tiêu tối thượng" field="goal" value={editedData.goal || ''} isEditing={isEditing} onChange={(val) => handleChange('goal', val)} multiline className="col-span-1 md:col-span-2 pt-3 border-t border-white/5" />
                       
                       <div className="flex flex-col gap-2 col-span-1 md:col-span-2 pt-3 border-t border-white/5">
                          <span className="text-[10px] uppercase tracking-widest text-purple-400/80 flex items-center gap-1"><Key size={12} /> Nội tâm / Suy nghĩ thầm kín</span>
                          {isEditing ? (
                            <textarea
                              value={editedData.innerSecret || ''}
                              onChange={(e) => handleChange('innerSecret', e.target.value)}
                              className="w-full bg-black/40 border border-white/20 rounded-lg p-2 text-sm text-purple-200/90 outline-none focus:border-purple-500/50 resize-y min-h-[80px]"
                            />
                          ) : (
                            <span className="text-sm leading-relaxed text-purple-200/70 whitespace-pre-wrap italic">
                               {editedData.innerSecret || <span className="italic opacity-30">Không có dữ liệu.</span>}
                            </span>
                          )}
                       </div>
                    </div>
                 </div>

                 {/* Background & Relationships */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="p-5 md:p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                      <h3 className="text-xs font-black uppercase tracking-widest text-teal-400/80 flex items-center gap-2 mb-3">
                         <BookOpen size={16} /> Nguồn gốc / Xuất thân
                      </h3>
                      <EditableField label="" field="background" value={editedData.background || ''} isEditing={isEditing} onChange={(val) => handleChange('background', val)} multiline />
                   </div>
                   
                   <div className="p-5 md:p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                      <h3 className="text-xs font-black uppercase tracking-widest text-sky-400/80 flex items-center gap-2 mb-3">
                         <Users size={16} /> Tổng quan các quan hệ
                      </h3>
                      <EditableField label="" field="relationships" value={editedData.relationships || ''} isEditing={isEditing} onChange={(val) => handleChange('relationships', val)} multiline />
                   </div>
                 </div>

                 {/* NSFW & Romance */}
                 <div className="p-5 md:p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                    <h3 className="text-xs font-black uppercase tracking-widest text-rose-400/80 flex items-center gap-2 mb-4">
                       <Flame size={16} /> Lãng mạn & Tình dục (NSFW)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <EditableField label="Quan niệm tình yêu & Tình dục" field="loveViews" value={editedData.loveViews || ''} isEditing={isEditing} onChange={(val) => handleChange('loveViews', val)} multiline />
                       <EditableField label="Trinh tiết & Kinh nghiệm NSFW" field="experience" value={editedData.experience || ''} isEditing={isEditing} onChange={(val) => handleChange('experience', val)} multiline />
                       
                       <EditableField label="Tính cách khi NSFW" field="nsfwPersonality" value={editedData.nsfwPersonality || ''} isEditing={isEditing} onChange={(val) => handleChange('nsfwPersonality', val)} multiline className="pt-3 border-t border-white/5" />
                       <EditableField label="Phản ứng đặc trưng (NSFW)" field="nsfwReactions" value={editedData.nsfwReactions || ''} isEditing={isEditing} onChange={(val) => handleChange('nsfwReactions', val)} multiline className="pt-3 border-t border-white/5" />
                    </div>
                 </div>

                 {/* Literary Description */}
                 <div className="p-5 md:p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400/80 flex items-center gap-2 mb-3">
                       <FileText size={16} /> Miêu tả văn học (Dành cho ngữ cảnh)
                    </h3>
                    <EditableField label="" field="literaryDescription" value={editedData.literaryDescription || ''} isEditing={isEditing} onChange={(val) => handleChange('literaryDescription', val)} multiline />
                 </div>
              </div>
            </div>
           )}

           {activeTab === 'tui' && type === 'mc' && (
             <div className="w-full">
               <div className="p-5 md:p-6 rounded-2xl bg-white/[0.02] border border-white/10 mt-6">
                 <h3 className="text-sm font-black uppercase tracking-widest text-yellow-400/80 flex items-center gap-2 mb-4">
                    Tài sản & Vật phẩm (Túi)
                 </h3>
                 <EditableField label="Liệt kê mọi vật phẩm, tài sản của MC (kiếm, quần áo, đan dược, tài sản...)" field="inventory" value={editedData.inventory || ''} isEditing={isEditing} onChange={(val) => handleChange('inventory', val)} multiline />
               </div>
             </div>
           )}
            </div>
          </div>
        </div>
      </div>

      {/* Avatar Selection Modal */}
      {showAvatarSelect && (
        <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAvatarSelect(false)}>
          <div 
            className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-lg w-full relative shadow-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowAvatarSelect(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white z-10"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider text-center shrink-0">
              Nguồn Ảnh Đại Diện
            </h3>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { fileInputRef.current?.click(); setShowAvatarSelect(false); }}
                className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white transition-all text-sm font-medium flex items-center justify-center gap-2 hover:border-white/10"
              >
                Tải lên từ Máy
              </button>
              <button 
                onClick={() => { 
                  setShowAvatarSelect(false);
                  setShowUrlInput(true);
                }}
                className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white transition-all text-sm font-medium flex items-center justify-center gap-2 hover:border-white/10"
              >
                Nhập Link URL
              </button>
              <button 
                onClick={() => { 
                  setShowAvatarSelect(false);
                  setShowGalleryPicker(true);
                }}
                className="p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 transition-all text-sm font-medium flex items-center justify-center gap-2"
              >
                Chọn từ nút "Ảnh"
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Picker (Full-Screen Expanded Overlay) */}
      {showGalleryPicker && (
        <div className="absolute inset-0 z-[70]">
          <GalleryModal
            isSelectMode={true}
            onSelect={(url) => {
              handleAvatarChange(url);
              setShowGalleryPicker(false);
            }}
            onClose={() => {
              setShowGalleryPicker(false);
              setShowAvatarSelect(true);
            }}
          />
        </div>
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
    </motion.div>
  );
}

