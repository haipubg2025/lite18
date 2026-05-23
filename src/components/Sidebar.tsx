import React from 'react';
import { motion } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  PlusCircle, 
  Settings, 
  PlayCircle, 
  FolderOpen,
  Gamepad2,
  ChevronRight,
  ImageIcon,
  Database,
  Monitor,
  Smartphone,
  MonitorSmartphone
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { toast } from 'sonner';
import StreamStatsPanel from './StreamStatsPanel';

interface SidebarProps {
  onMobileSelect?: () => void;
}

const MENU_ITEMS = [
  { id: 'main', label: 'GALLERY', icon: ImageIcon, path: '/' },
  { id: 'world-creation', label: 'Tạo Mới', icon: PlusCircle, path: '/world-creation' },
  { id: 'resume', label: 'Tiếp Tục', icon: PlayCircle, path: '/resume' },
  { id: 'saves', label: 'Lưu Trữ', icon: FolderOpen, path: '/saves' },
  { id: 'settings', label: 'Cấu Hình', icon: Settings, path: '/settings' },
] as const;

export default function Sidebar({ onMobileSelect }: SidebarProps) {
  const { theme, resumeLatestGame, uiMode, setUiMode } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSetView = async (path: string) => {
    if (path === '/resume') {
      if (await resumeLatestGame()) {
        toast.success('Tiếp tục trò chơi gần nhất!');
        navigate('/gameplay', { state: { fromMenu: true } });
      } else {
        toast.error('Không tìm thấy tệp lưu nào.');
      }
    } else {
      navigate(path, { state: { fromMenu: true } });
    }
    if (onMobileSelect) onMobileSelect();
  };

  return (
    <div className={`h-full w-full flex flex-col ${theme.sidebarClass}`}>
      <div className="p-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 mb-12"
        >
          <div className={`p-2 rounded-lg border ${theme.accentClass}`}>
            <Gamepad2 className="w-6 h-6" />
          </div>
          <h1 className={`text-xl font-bold tracking-tighter ${theme.textPrimary}`}>
            MATRIX <span className={(theme.accentClass || 'text-white border-white').split(' ')[0]}>LITE v1</span>
          </h1>
        </motion.div>

        <nav className="space-y-2">
          {MENU_ITEMS.map((item, index) => {
            const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/main');
            const Icon = item.icon;
            
            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleSetView(item.path)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 group cursor-pointer ${
                  isActive 
                    ? `${(theme.accentClass || 'text-white border-white').split(' ')[0].replace('text-', 'bg-')}/10 ${(theme.accentClass || 'text-white border-white').split(' ')[0]}` 
                    : `${theme.textSecondary} hover:bg-white/5`
                }`}
              >
                <div className="flex items-center gap-4">
                  <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="font-medium">{item.label}</span>
                </div>
                {isActive && (
                  <motion.div layoutId="active-indicator">
                    <ChevronRight className="w-4 h-4" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </nav>
        
        {/* Bảng chỉ số AI Streaming chi tiết bên dưới Cấu Hình */}
        <StreamStatsPanel />
      </div>

      <div className="mt-auto p-8 border-t border-white/5 space-y-4">
        {/* Lựa chọn giao diện */}
        <div className="flex p-1 rounded-xl bg-white/5 border border-white/10">
          <button 
            onClick={() => setUiMode('auto')}
            className={`flex-1 flex justify-center items-center py-2 rounded-lg transition-all ${uiMode === 'auto' ? 'bg-white/20 text-white shadow' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
            title="Auto Detect"
          >
            <MonitorSmartphone className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setUiMode('pc')}
            className={`flex-1 flex justify-center items-center py-2 rounded-lg transition-all ${uiMode === 'pc' ? 'bg-white/20 text-white shadow' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
            title="PC Mode"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setUiMode('mobile')}
            className={`flex-1 flex justify-center items-center py-2 rounded-lg transition-all ${uiMode === 'mobile' ? 'bg-white/20 text-white shadow' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
            title="Mobile Mode"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
