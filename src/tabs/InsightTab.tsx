import { useMemo } from 'react';
import { BarChart2, Cpu, RefreshCw } from 'lucide-react';

interface InsightTabProps {
  isPremium: boolean;
  setShowPremiumModal: (show: boolean) => void;
  isExportingPDF: boolean;
  handleExportPDF: () => void;
  waterIntake: number;
  waterGoal: number;
  weeklyChartData: { d: string; ml: number; isToday: boolean; }[];
  progress: number;
  streak: number;
  isAiLoading: boolean;
  aiAdvice: string;
  fetchAIAdvice: () => void;
  setShowAiChat: (show: boolean) => void;
}

const card = "bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl";

export default function InsightTab({
  isPremium, setShowPremiumModal, isExportingPDF, handleExportPDF,
  waterGoal, weeklyChartData, progress, streak, isAiLoading, aiAdvice, fetchAIAdvice, setShowAiChat
}: InsightTabProps) {
  const weeklyStats = useMemo(() => {
    if (!weeklyChartData || weeklyChartData.length === 0) {
        return { avg: 0, completed: 0 };
    }
    // Không tính ngày hôm nay vào trung bình vì dữ liệu chưa hoàn chỉnh
    const pastDaysData = weeklyChartData.slice(0, 6);
    const totalIntake = pastDaysData.reduce((sum, day) => sum + day.ml, 0);
    const avg = pastDaysData.length > 0 ? totalIntake / pastDaysData.length : 0;
    
    // Tính số ngày hoàn thành mục tiêu trên cả 7 ngày
    const completed = weeklyChartData.filter(day => day.ml >= waterGoal).length;

    return {
        avg: Math.round(avg),
        completed: completed
    };
  }, [weeklyChartData, waterGoal]);

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Phân tích</p>
          <h2 className="text-3xl font-black text-white">Thống kê</h2>
        </div>
        <button onClick={handleExportPDF} className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all active:scale-95 shadow-md">
          <BarChart2 size={14} className={isPremium ? "text-cyan-400" : "text-amber-400"} />
          {isExportingPDF ? 'Đang xuất...' : 'Xuất PDF'}
        </button>
      </div>

      <div className={`${card} p-5`}>
        <div className="flex justify-between items-center mb-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">7 ngày gần nhất</p>
        </div>
        <div className="flex items-end justify-between gap-2 h-44">
          {weeklyChartData.map((item, index) => {
            const pct = Math.min(waterGoal > 0 ? (item.ml / waterGoal) * 100 : 0, 100);
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold" style={{ color: item.isToday ? '#22d3ee' : '#64748b' }}>
                  {item.ml > 0 ? `${(item.ml / 1000).toFixed(1)}L` : '0L'}
                </span>
                <div className="w-full rounded-xl relative overflow-hidden bg-slate-800 border border-slate-700" style={{ height: '120px', boxShadow: item.isToday ? '0 0 15px rgba(6,182,212,0.3)' : 'none' }}>
                  <div className="absolute bottom-0 w-full rounded-xl transition-all duration-700"
                    style={{ height: `${pct}%`, background: item.isToday ? 'linear-gradient(180deg, #06b6d4, #0ea5e9)' : 'rgba(6,182,212,0.2)' }} />
                </div>
                <span className="text-[10px] font-bold" style={{ color: item.isToday ? '#22d3ee' : '#64748b' }}>{item.d}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Trung bình/ngày', val: weeklyStats.avg.toLocaleString(), unit: 'ml', color: '#22d3ee' },
          { label: 'Hoàn thành mục tiêu', val: weeklyStats.completed.toString(), unit: '/ 7 ngày', color: '#34d399' },
          { label: 'Chuỗi liên tiếp', val: streak.toString(), unit: 'ngày', color: '#fbbf24' },
          { label: 'Tiến độ hôm nay', val: `${Math.round(progress)}`, unit: '%', color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className={`${card} p-5`}>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2 font-bold">{s.label}</p>
            <p className="text-3xl font-black" style={{ color: s.color }}>{s.val}<span className="text-sm font-normal text-slate-500 ml-1">{s.unit}</span></p>
          </div>
        ))}
      </div>

      <div className={`${card} p-6 border-l-4 ${isPremium ? 'border-l-amber-500' : 'border-l-purple-500'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Cpu size={16} className={`${isPremium ? 'text-amber-400' : 'text-purple-400'} ${isAiLoading ? 'animate-spin' : ''}`} />
            <p className="text-white text-sm font-bold uppercase tracking-widest">Gemini AI Coach {isPremium && <span className="text-amber-400 ml-1">PRO</span>}</p>
          </div>
          {isPremium ? (
            <div className="flex items-center gap-2">
              <button onClick={fetchAIAdvice} disabled={isAiLoading} className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-1 rounded font-bold flex items-center gap-1 disabled:opacity-60 active:scale-95 transition-all">
                <RefreshCw size={10} className={isAiLoading ? 'animate-spin' : ''} />
                {isAiLoading ? 'Đang phân tích' : 'Làm mới'}
              </button>
              <button onClick={() => setShowAiChat(true)} className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-1 rounded font-bold active:scale-95 transition-all">
                Chat AI
              </button>
            </div>
          ) : (
            <button onClick={() => setShowPremiumModal(true)} className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded font-bold">Nâng cấp Pro</button>
          )}
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">
          {isPremium ? 
            (isAiLoading
              ? 'Gemini đang phân tích dữ liệu của bạn...'
              : aiAdvice || 'Nhấn làm mới để nhận gợi ý cá nhân hóa từ Gemini.')
            : 'Gemini AI Coach nằm trong gói Pro với gợi ý cá nhân hóa theo lượng nước, thời tiết, lịch và hoạt động.'}
        </p>
      </div>
    </div>
  );
}