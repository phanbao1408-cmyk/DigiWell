import { Home, BarChart2, Trophy, Rss, User } from 'lucide-react';

export type TabType = 'home' | 'insight' | 'league' | 'feed' | 'profile';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const BottomNav = (props: BottomNavProps) => {
  const navItems: { id: TabType; icon: any; label: string }[] = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'insight', icon: BarChart2, label: 'Insight' },
    { id: 'league', icon: Trophy, label: 'League' },
    { id: 'feed', icon: Rss, label: 'Feed' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 pt-4" style={{ background: 'linear-gradient(to top, #0f172a 70%, transparent)' }}>
      <div className="flex items-center justify-between bg-slate-800/95 backdrop-blur-xl border border-slate-700/60 rounded-3xl px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => props.setActiveTab(id)}
            className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all duration-300 ${
              props.activeTab === id ? 'scale-110 bg-slate-700/50' : 'opacity-50'
            }`}
          >
            <Icon size={22} style={{ color: props.activeTab === id ? '#22d3ee' : '#94a3b8' }} />
            <span
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: props.activeTab === id ? '#22d3ee' : '#64748b' }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BottomNav;