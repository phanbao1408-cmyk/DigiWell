import { Sparkles, Trophy, Zap, UserPlus, Settings, Medal, Flame, Bike, Lock } from 'lucide-react';

interface ProfileTabProps {
  profile: any;
  isPremium: boolean;
  streak: number;
  socialProfileStats: any;
  waterIntake: number;
  waterGoal: number;
  weeklyHistory: { d: string; ml: number; isToday: boolean }[];
  progress: number;
  completionPercent: number;
  remainingWater: number;
  currentRank: { name: string; color: string; bg: string; border: string };
  wp: number;
  setShowPremiumModal: (show: boolean) => void;
  setShowAddFriend: (show: boolean) => void;
  setShowProfileSettings: (show: boolean) => void;
  setActiveTab: (tab: any) => void;
  handleLogout: () => void;
}

const card = "bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl";
const cardGlow = "bg-slate-800/60 backdrop-blur-sm border border-cyan-500/20 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.08)]";

export default function ProfileTab({
  profile, isPremium, streak, socialProfileStats, waterIntake, waterGoal, weeklyHistory,
  completionPercent, remainingWater, currentRank, wp,
  setShowPremiumModal, setShowAddFriend, setShowProfileSettings, setActiveTab, handleLogout
}: ProfileTabProps) {
  return (
    <div className="animate-in slide-in-from-right duration-300 space-y-5 pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black text-white">Hồ sơ</h2>
        </div>
        <div className="flex items-center gap-2">
          {!isPremium ? (
            <button onClick={() => setShowPremiumModal(true)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-95 transition-all" style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}>
              Upgrade PRO
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 flex items-center gap-1">
              <Sparkles size={12} /> PRO
            </div>
          )}
        </div>
      </div>

      <div className={`${cardGlow} overflow-hidden`}>
        <div className="relative p-6">
          <div className="absolute -top-12 -right-8 w-32 h-32 rounded-full blur-3xl bg-cyan-500/15 pointer-events-none" />
          <div className="absolute -bottom-14 -left-10 w-36 h-36 rounded-full blur-3xl bg-amber-500/10 pointer-events-none" />
          <div className="relative flex items-start gap-4">
            <div className="w-20 h-20 rounded-[1.75rem] flex items-center justify-center flex-shrink-0 shadow-lg" style={{ background: isPremium ? 'linear-gradient(135deg, #fbbf24, #d97706)' : 'linear-gradient(135deg, #06b6d4, #0ea5e9)' }}>
              <span className="text-4xl font-black text-slate-900">{(profile?.nickname || 'U').charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-2xl font-black text-white truncate">{profile?.nickname || 'Khách'}</h3>
                  <div className={`w-7 h-7 rounded-xl border flex items-center justify-center flex-shrink-0 ${currentRank.bg} ${currentRank.border}`} title={currentRank.name}>
                    <Trophy size={12} className={currentRank.color} />
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center gap-1" title={`Streak: ${streak} ngày`}>
                    <Zap size={10} className="fill-orange-400 text-orange-400" />
                    <span className="text-orange-400 text-[10px] font-bold">{streak}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 mt-4">
                <div className="text-center"><p className="text-white font-black text-sm">{socialProfileStats.followers}</p><p className="text-slate-500 text-[9px] uppercase font-bold tracking-widest mt-0.5">Follower</p></div>
                <div className="text-center"><p className="text-white font-black text-sm">{socialProfileStats.following}</p><p className="text-slate-500 text-[9px] uppercase font-bold tracking-widest mt-0.5">Đang follow</p></div>
                <div className="text-center"><p className="text-white font-black text-sm">{wp}</p><p className="text-slate-500 text-[9px] uppercase font-bold tracking-widest mt-0.5">Điểm WP</p></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5 relative z-10">
            <button onClick={() => setShowAddFriend(true)} className="py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"><UserPlus size={14} /> Thêm bạn</button>
            <button onClick={() => setShowProfileSettings(true)} className="py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"><Settings size={14} /> Cài đặt</button>
          </div>
        </div>
      </div>

      <div className={`${card} p-5`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white text-lg font-black">Tiến độ tuần này</h3>
          <button onClick={() => setActiveTab('insight')} className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20 active:scale-95 transition-all">Chi tiết</button>
        </div>
        <div className="flex items-end justify-between gap-1.5 h-24">
          {weeklyHistory.map((item, index) => {
            const pct = Math.min(waterGoal > 0 ? (item.ml / waterGoal) * 100 : 0, 100);
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-lg relative overflow-hidden bg-slate-900 border border-slate-700/50" style={{ height: '60px' }}>
                  <div className="absolute bottom-0 w-full rounded-lg transition-all duration-700" style={{ height: `${pct}%`, background: item.isToday ? 'linear-gradient(180deg, #06b6d4, #0ea5e9)' : 'rgba(6,182,212,0.2)' }} />
                </div>
                <span className="text-[9px] font-bold" style={{ color: item.isToday ? '#22d3ee' : '#64748b' }}>{item.d}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${card} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-black">Hôm nay</h3>
          <button onClick={() => setActiveTab('feed')} className="px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-bold active:scale-95 transition-all">Xem Feed</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Đã uống', value: `${waterIntake} ml`, tone: 'text-cyan-300' },
            { label: 'Hoàn thành', value: `${completionPercent}%`, tone: 'text-emerald-300' },
            { label: 'Còn thiếu', value: `${remainingWater} ml`, tone: 'text-orange-300' },
            { label: 'Hạng hiện tại', value: currentRank.name, tone: currentRank.color },
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3 flex flex-col justify-center">
              <p className="text-slate-500 text-[9px] uppercase tracking-widest font-bold">{item.label}</p>
              <p className={`mt-1 text-base font-black ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HUY HIỆU & THỬ THÁCH */}
      <div className={`${card} p-5 mt-2`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-black">Huy hiệu & Thử thách</h3>
          <button className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20 active:scale-95 transition-all">Tất cả</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/50 border border-cyan-500/20 relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent"></div><div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-2 relative z-10"><Medal size={20} className="text-cyan-400" /></div><p className="text-white text-[10px] font-bold text-center relative z-10">Kỷ luật thép</p><p className="text-cyan-400 text-[9px] mt-0.5 relative z-10">7 ngày Streak</p></div>
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/50 border border-orange-500/20 relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent"></div><div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-2 relative z-10"><Flame size={20} className="text-orange-400" /></div><p className="text-white text-[10px] font-bold text-center relative z-10">Chiến thần</p><p className="text-orange-400 text-[9px] mt-0.5 relative z-10">Hoàn thành 100%</p></div>
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/50 border border-emerald-500/20 relative overflow-hidden opacity-50 grayscale"><div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-2"><Bike size={20} className="text-emerald-400" /></div><p className="text-white text-[10px] font-bold text-center">Vận động viên</p><p className="text-emerald-400 text-[9px] mt-0.5 flex items-center justify-center gap-0.5"><Lock size={8}/> Chưa mở</p></div>
        </div>
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 mt-2">
        <button onClick={handleLogout} className="w-full py-4 rounded-2xl text-red-400 font-bold text-sm border border-red-500/30 bg-red-500/10 active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-500/20">
          <Lock size={18} /> Đăng xuất tài khoản
        </button>
      </div>
    </div>
  );
}