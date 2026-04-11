import { Droplet, Coffee, Activity, Zap, Camera, History, Share2, Grid, Plus, LogOut, Settings } from 'lucide-react';

// Define the types and values that App.tsx expects
export type DrinkPreset = {
  id: string;
  name: string;
  amount: number;
  factor: number;
  icon: string;
  color: string;
};

export const renderIcon = (iconName: string, props?: any): React.ReactNode => {
  if (iconName === 'Droplet') return <Droplet {...props} />;
  if (iconName === 'Coffee') return <Coffee {...props} />;
  if (iconName === 'Activity') return <Activity {...props} />;
  if (iconName === 'Zap') return <Zap {...props} />;
  return <Droplet {...props} />;
};

export const presetStyles: Record<string, { bg: string; border: string; text: string; hover: string }> = {
  cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', hover: 'hover:bg-cyan-500/30' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', hover: 'hover:bg-orange-500/30' },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', hover: 'hover:bg-emerald-500/30' },
  red: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', hover: 'hover:bg-red-500/30' }
};

interface HomeTabProps {
  profile: any;
  nowText: { date: string; time: string };
  hasPendingCloudSync: boolean;
  waterIntake: number;
  waterGoal: number;
  remainingWater: number;
  progress: number;
  completionPercent: number;
  streak: number;
  assistantFace: string;
  assistantStatus: string;
  assistantTone: string;
  primaryDrinkPreset: DrinkPreset;
  secondaryDrinkPresets: DrinkPreset[];
  drinkPresets: DrinkPreset[];
  isScanning: boolean;
  handleAddWater: (amount: number, factor: number, name: string) => Promise<number>;
  handleScan: () => void;
  handleLogout: () => void;
  setShowSmartHub: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  openSocialComposer: (kind: 'status' | 'progress' | 'story') => void;
  setShowPresetManager: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCustomDrink: React.Dispatch<React.SetStateAction<boolean>>;
  setCustomDrinkForm: React.Dispatch<React.SetStateAction<{ name: string; amount: number | string; factor: number }>>;
  customDrinkForm: { name: string; amount: number | string; factor: number };
  setEditingPresets: (presets: DrinkPreset[]) => void;
}

const card = "bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl";

const HomeTab = (props: HomeTabProps) => {
  return (
    <div className="space-y-5 animate-in fade-in zoom-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">{props.nowText.date}</p>
          <h1 className="text-2xl font-black text-white mt-0.5">
            Chào, <span className="text-cyan-400">{props.profile?.nickname || 'bạn'}</span> 👋
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-white font-mono text-sm font-bold">{props.nowText.time}</p>
            <p className={`text-[10px] font-black uppercase tracking-widest ${props.hasPendingCloudSync ? 'text-amber-400' : 'text-emerald-400'}`}>
              {props.hasPendingCloudSync ? 'Chờ đồng bộ' : 'Đã đồng bộ'}
            </p>
          </div>
          <button onClick={() => props.setShowSmartHub(true)} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center relative shadow-[0_0_10px_rgba(6,182,212,0.2)] hover:bg-slate-700 transition-all">
            <Settings size={16} className="text-cyan-400" />
          </button>
          <button onClick={props.handleLogout} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
            <LogOut size={16} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="relative overflow-hidden rounded-[2rem] border border-cyan-500/20 p-5 shadow-[0_22px_60px_rgba(8,47,73,0.35)]" style={{ background: 'linear-gradient(145deg, rgba(8,47,73,0.96), rgba(21,94,117,0.92))' }}>
        <div className="absolute -top-10 -right-6 h-28 w-28 rounded-full bg-cyan-300/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-sky-200/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-slate-950/35 border border-white/10 text-[10px] font-black uppercase tracking-widest text-cyan-100">
                Hôm nay
              </div>
              <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${props.hasPendingCloudSync ? 'bg-amber-500/10 text-amber-200 border-amber-400/20' : 'bg-emerald-500/10 text-emerald-100 border-emerald-400/20'}`}>
                {props.hasPendingCloudSync ? 'Chờ đồng bộ' : 'Đã đồng bộ'}
              </div>
            </div>
            <button onClick={props.handleScan} disabled={props.isScanning} className="px-3 py-2 rounded-xl bg-white/90 text-slate-900 text-[11px] font-black flex items-center gap-2 active:scale-95 transition-all disabled:opacity-60">
              <Camera size={14} /> {props.isScanning ? 'Đang quét' : 'AI Scan'}
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-cyan-100/70 text-xs uppercase tracking-widest font-bold">Lượng nước</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-6xl font-black text-white tracking-tighter">{props.waterIntake}</span>
                <span className="text-cyan-100/80 text-lg font-semibold">/ {props.waterGoal} ml</span>
              </div>
              <p className="text-cyan-100/70 text-sm mt-2">Còn thiếu {props.remainingWater} ml để hoàn thành mục tiêu.</p>
            </div>

            <div className="relative h-24 w-24 rounded-full flex-shrink-0" style={{ background: `conic-gradient(#67e8f9 ${3.6 * Math.max(props.progress, 2)}deg, rgba(15,23,42,0.35) 0deg)` }}>
              <div className="absolute inset-[7px] rounded-full bg-slate-950/80 border border-white/10 flex flex-col items-center justify-center">
                <span className="text-white text-xl font-black">{props.completionPercent}%</span>
                <span className="text-cyan-100/60 text-[9px] font-bold uppercase tracking-widest">mục tiêu</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-5">
            {[
              { label: "Streak", value: `${props.streak} ngày`, tone: "text-orange-200" },
              { label: "Còn thiếu", value: `${props.remainingWater} ml`, tone: "text-cyan-100" },
              { label: "Mục tiêu", value: `${props.waterGoal} ml`, tone: "text-emerald-100" }
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/25 px-3 py-3">
                <p className="text-[10px] uppercase tracking-widest font-bold text-cyan-100/50">{item.label}</p>
                <p className={`mt-1 text-sm font-black ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/25 p-4 flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border flex-shrink-0 ${props.progress < 30 ? 'bg-red-500/10 border-red-500/20' : props.progress < 70 ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
              <span className="text-2xl font-mono text-white font-black">{props.assistantFace}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-black ${props.assistantTone}`}>{props.assistantStatus}</p>
              <p className="text-cyan-100/60 text-xs mt-1">Holo-Pet</p>
            </div>
            <button onClick={() => props.setShowHistory(true)} className="px-3 py-2 rounded-xl bg-slate-900/70 border border-white/10 text-white text-[11px] font-bold flex items-center gap-2 active:scale-95 transition-all">
              <History size={14} /> Lịch sử
            </button>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={() => props.setShowSmartHub(true)} className="flex-1 py-3 rounded-xl bg-slate-950/35 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Grid size={14} /> Tiện ích
            </button>
            <button onClick={() => props.openSocialComposer('progress')} className="flex-1 py-3 rounded-xl bg-white/90 text-slate-900 text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Share2 size={14} /> Chia sẻ
            </button>
          </div>
        </div>
      </div>

      {/* Đồ uống nhanh */}
      <div className={`${card} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-black">Đồ uống nhanh</h3>
          <button onClick={() => { props.setEditingPresets(props.drinkPresets); props.setShowPresetManager(true); }} className="px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-bold flex items-center gap-2 active:scale-95 transition-all">
            <Settings size={12} /> Cài đặt
          </button>
        </div>

        {props.primaryDrinkPreset && (() => {
          const style = presetStyles[props.primaryDrinkPreset.color] || presetStyles.cyan;
          return (
            <button onClick={() => props.handleAddWater(props.primaryDrinkPreset.amount, props.primaryDrinkPreset.factor, props.primaryDrinkPreset.name)} className={`w-full p-5 rounded-[1.75rem] ${style.bg} border ${style.border} active:scale-[0.99] transition-all text-left ${style.hover}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-slate-200/70 text-[10px] uppercase tracking-widest font-bold">Nút chính</p>
                  <p className="text-white text-xl font-black mt-2">{props.primaryDrinkPreset.name}</p>
                  <p className={`${style.text} text-sm mt-2 font-bold`}>{props.primaryDrinkPreset.amount}ml · {props.primaryDrinkPreset.factor < 0 ? '' : '+'}{Math.round(props.primaryDrinkPreset.amount * props.primaryDrinkPreset.factor)}ml hydration</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-slate-950/25 border border-white/10 flex items-center justify-center flex-shrink-0">
                  {renderIcon(props.primaryDrinkPreset.icon, { size: 24, className: style.text })}
                </div>
              </div>
            </button>
          );
        })()}

        <div className="grid grid-cols-2 gap-3 mt-3">
          {props.secondaryDrinkPresets.map(preset => {
            const style = presetStyles[preset.color] || presetStyles.cyan;
            return (
              <button key={preset.id} onClick={() => props.handleAddWater(preset.amount, preset.factor, preset.name)} className={`p-4 rounded-2xl ${style.bg} border ${style.border} active:scale-95 transition-all text-left ${style.hover}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-white text-sm font-black">{preset.name}</p>
                    <p className={`${style.text} text-xs mt-1`}>{preset.factor < 0 ? '' : '+'}{Math.round(preset.amount * preset.factor)}ml</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-950/25 border border-white/10 flex items-center justify-center flex-shrink-0">
                    {renderIcon(preset.icon, { size: 18, className: style.text })}
                  </div>
                </div>
              </button>
            );
          })}
          
          <button onClick={() => props.setShowCustomDrink(true)} className="p-4 rounded-2xl bg-slate-900/70 border border-slate-700 active:scale-95 transition-all text-left hover:bg-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white text-sm font-black">Tùy chỉnh</p>
                <p className="text-slate-400 text-xs mt-1">Thêm đồ uống mới</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                <Plus size={18} className="text-slate-300" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomeTab;