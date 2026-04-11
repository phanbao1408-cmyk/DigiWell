import { Trophy, UserPlus, Zap, Crown, Medal } from 'lucide-react';

interface LeagueTabProps {
  leagueMode: 'public' | 'friends';
  setLeagueMode: (mode: 'public' | 'friends') => void;
  setShowAddFriend: (show: boolean) => void;
  getLeagueData: () => any[];
  getRankInfo: (wp: number) => { name: string; color: string; bg: string; border: string; };
}

export default function LeagueTab({
  leagueMode, setLeagueMode, setShowAddFriend, getLeagueData, getRankInfo
}: LeagueTabProps) {
  const sortedData = getLeagueData().sort((a, b) => b.wp - a.wp);

  return (
    <div className="animate-in slide-in-from-right duration-300 space-y-5 pb-8">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Bảng vinh danh</p>
          <h2 className="text-3xl font-black text-white flex items-center gap-3 mt-1">
            Xếp hạng <Trophy size={28} className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
          </h2>
        </div>
      </div>

      {/* Toggle Bảng Xếp Hạng */}
      <div className="flex p-1 bg-slate-900/80 rounded-xl border border-slate-700 shadow-inner">
        <button onClick={() => setLeagueMode('public')} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${leagueMode === 'public' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-slate-400 hover:text-slate-300'}`}>Trường</button>
        <button onClick={() => setLeagueMode('friends')} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${leagueMode === 'friends' ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'text-slate-400 hover:text-slate-300'}`}>Bạn bè</button>
      </div>

      {leagueMode === 'friends' && (
        <button onClick={() => setShowAddFriend(true)} className="w-full py-3.5 rounded-xl border border-dashed border-emerald-500/50 text-emerald-400 bg-emerald-500/10 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-emerald-500/20">
          <UserPlus size={16} /> Tìm và thách đấu bạn bè
        </button>
      )}

      {/* Danh sách người chơi dạng Card */}
      <div className="space-y-3 mt-6">
        {sortedData.map((item, i) => {
          const rankInfo = getRankInfo(item.wp);
          const isFirst = i === 0;
          const isSecond = i === 1;
          const isThird = i === 2;

          let rankStyle = {
            wrapper: "bg-slate-800/60 border-slate-700/50",
            rankText: "text-slate-500",
            avatarBg: "linear-gradient(135deg, #334155, #475569)",
            icon: null as any
          };

          if (isFirst) {
            rankStyle = {
              wrapper: "bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border-yellow-500/40 shadow-[0_0_20px_rgba(234,179,8,0.15)]",
              rankText: "text-yellow-400 drop-shadow-md",
              avatarBg: "linear-gradient(135deg, #f59e0b, #fbbf24)",
              icon: <Crown size={18} className="text-yellow-400 absolute -top-3 -right-2 drop-shadow-md transform rotate-12" />
            };
          } else if (isSecond) {
            rankStyle = {
              wrapper: "bg-gradient-to-r from-slate-300/10 to-slate-400/5 border-slate-400/40",
              rankText: "text-slate-300",
              avatarBg: "linear-gradient(135deg, #94a3b8, #cbd5e1)",
              icon: <Medal size={16} className="text-slate-300 absolute -top-2 -right-2 drop-shadow-md" />
            };
          } else if (isThird) {
            rankStyle = {
              wrapper: "bg-gradient-to-r from-orange-500/10 to-orange-400/5 border-orange-500/30",
              rankText: "text-orange-400",
              avatarBg: "linear-gradient(135deg, #b45309, #d97706)",
              icon: <Medal size={16} className="text-orange-400 absolute -top-2 -right-2 drop-shadow-md" />
            };
          }

          return (
            <div key={i} className={`relative flex items-center p-4 rounded-2xl backdrop-blur-sm border transition-all ${rankStyle.wrapper} ${item.isMe ? 'ring-2 ring-cyan-500/50 scale-[1.02]' : ''}`}>
              <div className={`w-8 font-black text-xl italic text-center mr-2 ${rankStyle.rankText}`}>
                {i + 1}
              </div>

              <div className="relative">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-slate-900 shadow-inner text-lg" style={{ background: rankStyle.avatarBg }}>
                  {item.name.charAt(0).toUpperCase()}
                </div>
                {rankStyle.icon}
              </div>

              <div className="flex-1 ml-4 min-w-0">
                <p className={`font-black text-base truncate ${item.isMe ? 'text-cyan-300' : 'text-white'}`}>
                  {item.name} {item.isMe && <span className="text-[10px] text-cyan-400 ml-1 uppercase tracking-widest">(Bạn)</span>}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-slate-400 text-xs truncate">{item.dept}</p>
                  <span className="text-slate-600 text-xs">•</span>
                  <div className="flex items-center gap-1 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                    <Zap size={10} className="fill-orange-400 text-orange-400" />
                    <span className="text-orange-400 text-[10px] font-bold">{item.streak}</span>
                  </div>
                </div>
              </div>

              <div className="text-right ml-2 flex flex-col items-end">
                <p className={`font-black text-xl tracking-tight ${isFirst ? 'text-yellow-400' : item.isMe ? 'text-cyan-400' : 'text-slate-200'}`}>
                  {item.wp.toLocaleString()}
                </p>
                <p className="text-slate-500 text-[9px] uppercase font-bold tracking-widest mb-1">Điểm WP</p>
                <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${rankInfo.bg} ${rankInfo.color} ${rankInfo.border} border`}>
                  {rankInfo.name}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}