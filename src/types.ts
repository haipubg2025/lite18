export type ThemeType = 
  | 'cyberpunk' | 'luxury' | 'deepsea' | 'volcano' | 'midnight' 
  | 'forest_night' | 'space' | 'dracula' | 'nordic_dark' | 'matrix'
  | 'minimal' | 'nature' | 'sakura' | 'ocean' | 'desert' 
  | 'lavender' | 'mint' | 'sunset' | 'coffee' | 'cloud';

export type ViewType = 'main' | 'characters' | 'settings' | 'history' | 'shop';

export interface ThemeConfig {
  id: ThemeType;
  name: string;
  group: 'Dark' | 'Light';
  bgClass: string;
  sidebarClass: string;
  accentClass: string;
  accentHex: string;
  textPrimary: string;
  textSecondary: string;
}

export const THEMES: ThemeConfig[] = [
  // --- DARK GROUP (10) ---
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    group: 'Dark',
    bgClass: 'bg-[#050505]',
    sidebarClass: 'bg-black/80 backdrop-blur-xl border-r border-[#00FF00]/20',
    accentClass: 'text-[#00FF00] border-[#00FF00]',
    accentHex: '#00FF00',
    textPrimary: 'text-white',
    textSecondary: 'text-green-500/70',
  },
  {
    id: 'luxury',
    name: 'Luxury Gold',
    group: 'Dark',
    bgClass: 'bg-[#0a0a0a]',
    sidebarClass: 'bg-[#1a1a1a]/90 backdrop-blur-md border-r border-yellow-600/30',
    accentClass: 'text-yellow-500 border-yellow-500',
    accentHex: '#eab308',
    textPrimary: 'text-white',
    textSecondary: 'text-gray-400',
  },
  {
    id: 'deepsea',
    name: 'Deep Sea Blue',
    group: 'Dark',
    bgClass: 'bg-[#000814]',
    sidebarClass: 'bg-[#001d3d]/80 backdrop-blur-xl border-r border-blue-500/20',
    accentClass: 'text-blue-400 border-blue-400',
    accentHex: '#60a5fa',
    textPrimary: 'text-white',
    textSecondary: 'text-blue-200/60',
  },
  {
    id: 'volcano',
    name: 'Volcanic Ash',
    group: 'Dark',
    bgClass: 'bg-[#120000]',
    sidebarClass: 'bg-[#2a0000]/80 backdrop-blur-xl border-r border-red-500/20',
    accentClass: 'text-red-500 border-red-500',
    accentHex: '#ef4444',
    textPrimary: 'text-white',
    textSecondary: 'text-red-300/60',
  },
  {
    id: 'midnight',
    name: 'Midnight Purple',
    group: 'Dark',
    bgClass: 'bg-[#0a001a]',
    sidebarClass: 'bg-[#1a0033]/80 backdrop-blur-xl border-r border-purple-500/20',
    accentClass: 'text-purple-400 border-purple-400',
    accentHex: '#c084fc',
    textPrimary: 'text-white',
    textSecondary: 'text-purple-200/60',
  },
  {
    id: 'forest_night',
    name: 'Emerald Night',
    group: 'Dark',
    bgClass: 'bg-[#03120e]',
    sidebarClass: 'bg-[#062c21]/80 backdrop-blur-xl border-r border-emerald-500/20',
    accentClass: 'text-emerald-400 border-emerald-400',
    accentHex: '#34d399',
    textPrimary: 'text-white',
    textSecondary: 'text-emerald-200/60',
  },
  {
    id: 'space',
    name: 'Space Silver',
    group: 'Dark',
    bgClass: 'bg-[#0f172a]',
    sidebarClass: 'bg-[#1e293b]/80 backdrop-blur-xl border-r border-slate-400/20',
    accentClass: 'text-slate-200 border-slate-200',
    accentHex: '#e2e8f0',
    textPrimary: 'text-white',
    textSecondary: 'text-slate-400',
  },
  {
    id: 'dracula',
    name: 'Dracula Pink',
    group: 'Dark',
    bgClass: 'bg-[#282a36]',
    sidebarClass: 'bg-[#44475a]/80 backdrop-blur-xl border-r border-[#ff79c6]/20',
    accentClass: 'text-[#ff79c6] border-[#ff79c6]',
    accentHex: '#ff79c6',
    textPrimary: 'text-[#f8f8f2]',
    textSecondary: 'text-[#6272a4]',
  },
  {
    id: 'nordic_dark',
    name: 'Nordic Storm',
    group: 'Dark',
    bgClass: 'bg-[#181a1b]',
    sidebarClass: 'bg-[#222426]/80 backdrop-blur-xl border-r border-cyan-500/20',
    accentClass: 'text-cyan-400 border-cyan-400',
    accentHex: '#22d3ee',
    textPrimary: 'text-gray-200',
    textSecondary: 'text-gray-500',
  },
  {
    id: 'matrix',
    name: 'Digital Oasis',
    group: 'Dark',
    bgClass: 'bg-[#000a00]',
    sidebarClass: 'bg-black/90 backdrop-blur-xl border-r border-green-600/40',
    accentClass: 'text-[#00FF41] border-[#00FF41]',
    accentHex: '#00FF41',
    textPrimary: 'text-white',
    textSecondary: 'text-green-900',
  },

  // --- LIGHT GROUP (10) ---
  {
    id: 'minimal',
    name: 'Minimal Clean',
    group: 'Light',
    bgClass: 'bg-[#f8fafc]',
    sidebarClass: 'bg-white/90 backdrop-blur-md border-r border-slate-200',
    accentClass: 'text-blue-600 border-blue-600',
    accentHex: '#2563eb',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-500',
  },
  {
    id: 'nature',
    name: 'Nature Earth',
    group: 'Light',
    bgClass: 'bg-[#f5f5f0]',
    sidebarClass: 'bg-[#5A5A40]/5 backdrop-blur-lg border-r border-[#5A5A40]/10',
    accentClass: 'text-[#5A5A40] border-[#5A5A40]',
    accentHex: '#5A5A40',
    textPrimary: 'text-[#2C2C1E]',
    textSecondary: 'text-[#5A5A40]/60',
  },
  {
    id: 'sakura',
    name: 'Sakura Petal',
    group: 'Light',
    bgClass: 'bg-[#fff5f7]',
    sidebarClass: 'bg-white/90 backdrop-blur-md border-r border-pink-200',
    accentClass: 'text-pink-500 border-pink-500',
    accentHex: '#ec4899',
    textPrimary: 'text-pink-900',
    textSecondary: 'text-pink-400',
  },
  {
    id: 'ocean',
    name: 'Ocean Breeze',
    group: 'Light',
    bgClass: 'bg-[#f0f9ff]',
    sidebarClass: 'bg-white/90 backdrop-blur-md border-r border-sky-200',
    accentClass: 'text-sky-500 border-sky-500',
    accentHex: '#0ea5e9',
    textPrimary: 'text-sky-900',
    textSecondary: 'text-sky-400',
  },
  {
    id: 'desert',
    name: 'Desert Sand',
    group: 'Light',
    bgClass: 'bg-[#fffbeb]',
    sidebarClass: 'bg-white/90 backdrop-blur-md border-r border-amber-200',
    accentClass: 'text-amber-600 border-amber-600',
    accentHex: '#d97706',
    textPrimary: 'text-amber-900',
    textSecondary: 'text-amber-500',
  },
  {
    id: 'lavender',
    name: 'Lavender Mist',
    group: 'Light',
    bgClass: 'bg-[#f5f3ff]',
    sidebarClass: 'bg-white/90 backdrop-blur-md border-r border-violet-200',
    accentClass: 'text-violet-600 border-violet-600',
    accentHex: '#7c3aed',
    textPrimary: 'text-violet-900',
    textSecondary: 'text-violet-400',
  },
  {
    id: 'mint',
    name: 'Mint Fresh',
    group: 'Light',
    bgClass: 'bg-[#f0fdf4]',
    sidebarClass: 'bg-white/90 backdrop-blur-md border-r border-emerald-200',
    accentClass: 'text-emerald-600 border-emerald-600',
    accentHex: '#059669',
    textPrimary: 'text-emerald-900',
    textSecondary: 'text-emerald-500',
  },
  {
    id: 'sunset',
    name: 'Warm Sunset',
    group: 'Light',
    bgClass: 'bg-[#fff7ed]',
    sidebarClass: 'bg-white/90 backdrop-blur-md border-r border-orange-200',
    accentClass: 'text-orange-500 border-orange-500',
    accentHex: '#f97316',
    textPrimary: 'text-orange-900',
    textSecondary: 'text-orange-400',
  },
  {
    id: 'coffee',
    name: 'Coffee Cream',
    group: 'Light',
    bgClass: 'bg-[#fafaf9]',
    sidebarClass: 'bg-stone-100/90 backdrop-blur-md border-r border-stone-200',
    accentClass: 'text-stone-700 border-stone-700',
    accentHex: '#44403c',
    textPrimary: 'text-stone-900',
    textSecondary: 'text-stone-500',
  },
  {
    id: 'cloud',
    name: 'Soft Cloud',
    group: 'Light',
    bgClass: 'bg-white',
    sidebarClass: 'bg-gray-50/90 backdrop-blur-md border-r border-gray-100',
    accentClass: 'text-gray-400 border-gray-400',
    accentHex: '#9ca3af',
    textPrimary: 'text-gray-800',
    textSecondary: 'text-gray-400',
  },
];

export interface ActionSuggestion {
  action: string;
  details?: string;
  timeCost?: string;
}

export interface GameMessage {
  id: string;
  sender: 'system' | 'user' | 'ai';
  content: string;
  outline?: string;
  mainText?: string;
  suggestedActions?: ActionSuggestion[] | string[];
  worldTime?: string;
  mcLocation?: string;
  npcLocations?: { id: string; location: string }[];
  isStreaming?: boolean;
  stats?: {
    processingTime: number; // ms
    wordCount: number;
    tokensIn: number;
    tokensOut: number;
    tokensTotal: number;
  };
}

export interface SaveFile {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  gameData: any;
  messages: GameMessage[];
  ragMemories?: any[];
}

export interface ProxyConfig {
  id: string;
  name: string;
  url: string;
  key: string;
  createdAt: number;
  models?: string[];
  selectedModel?: string;
  enabled?: boolean;
}

