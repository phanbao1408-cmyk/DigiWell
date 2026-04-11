import { Share2, Plus, Users, RefreshCw, Rss, Heart, Zap, Target } from 'lucide-react';
import { getRelativeTimeLabel, type SocialFeedPost } from './lib/social';

interface FeedTabProps {
  profile: any;
  socialStories: SocialFeedPost[];
  socialPosts: SocialFeedPost[];
  socialError: string;
  isSocialLoading: boolean;
  socialFollowingIds: string[];
  openSocialComposer: (kind: 'status' | 'progress' | 'story') => void;
  setShowSocialProfile: (show: boolean) => void;
  setShowDiscoverPeople: (show: boolean) => void;
  handleToggleLikePost: (post: SocialFeedPost) => void;
}

const card = "bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl";

export default function FeedTab({
  profile,
  socialStories,
  socialPosts,
  socialError,
  isSocialLoading,
  socialFollowingIds,
  openSocialComposer,
  setShowSocialProfile,
  setShowDiscoverPeople,
  handleToggleLikePost,
}: FeedTabProps) {
  return (
    <div className="animate-in slide-in-from-right duration-300 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Cộng đồng</p>
          <h2 className="text-2xl font-black text-white mt-1">Feed</h2>
        </div>
        <button
          onClick={() => setShowSocialProfile(true)}
          className="w-11 h-11 rounded-2xl border border-cyan-500/25 bg-slate-900/80 flex items-center justify-center shadow-[0_0_16px_rgba(34,211,238,0.12)] active:scale-95 transition-all"
          title="Hồ sơ mạng xã hội"
        >
          <span className="text-sm font-black text-cyan-300">{(profile?.nickname || 'U')[0].toUpperCase()}</span>
        </button>
      </div>

      <div className={`${card} p-4 border border-cyan-500/15`}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white shadow-inner flex-shrink-0" style={{ background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)' }}>
            {(profile?.nickname || 'U')[0].toUpperCase()}
          </div>
          <button onClick={() => openSocialComposer('status')} className="flex-1 h-11 rounded-2xl bg-slate-900/80 border border-slate-700 text-slate-300 text-sm font-semibold text-left px-4 active:scale-[0.99] transition-all">
            Hôm nay bạn muốn chia sẻ gì?
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <button onClick={() => openSocialComposer('progress')} className="py-3 rounded-xl bg-indigo-500/12 border border-indigo-500/25 text-indigo-300 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Share2 size={14} /> Tiến độ
          </button>
          <button onClick={() => openSocialComposer('story')} className="py-3 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/25 text-fuchsia-300 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Plus size={14} /> Story
          </button>
          <button onClick={() => setShowDiscoverPeople(true)} className="py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Users size={14} /> Khám phá
          </button>
        </div>
      </div>

      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white text-sm font-semibold">Stories</p>
          </div>
          <button onClick={() => openSocialComposer('story')} className="px-3 py-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all">
            <Plus size={12} /> Story
          </button>
        </div>

        {socialStories.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory">
            {socialStories.map(story => (
              <div key={story.id} className="min-w-[132px] rounded-2xl border border-fuchsia-500/20 bg-slate-900/60 p-3 snap-start">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-inner" style={{ background: 'linear-gradient(135deg, rgba(217,70,239,0.45), rgba(34,211,238,0.35))' }}>
                  <span className="text-lg font-black text-white">{(story.author?.nickname || 'D').charAt(0).toUpperCase()}</span>
                </div>
                <p className="text-white text-sm font-bold truncate">{story.author.nickname}</p>
                <p className="text-slate-400 text-[10px] uppercase tracking-wider mt-1">{getRelativeTimeLabel(story.created_at)}</p>
                <p className="text-fuchsia-300 text-[10px] mt-2 font-semibold">{story.hydration_ml || 0}ml · streak {story.streak_snapshot || 0}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center">
            <p className="text-white text-sm font-semibold mb-4">Chưa có story nào.</p>
            <button onClick={() => openSocialComposer('story')} className="px-4 py-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-bold active:scale-95 transition-all">
              Đăng story đầu tiên
            </button>
          </div>
        )}
      </div>

      {socialError && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-amber-300 text-xs font-bold uppercase tracking-widest mb-2">Thiết lập</p>
          <p className="text-slate-200 text-sm leading-relaxed">{socialError}</p>
        </div>
      )}

      {!socialError && isSocialLoading && (
        <div className={`${card} p-8 text-center`}>
          <RefreshCw size={28} className="text-cyan-400 mx-auto mb-4 animate-spin" />
          <p className="text-white font-semibold">Đang tải feed cộng đồng...</p>
        </div>
      )}

      {!socialError && !isSocialLoading && socialPosts.length === 0 && (
        <div className={`${card} p-6 text-center`}>
          <Rss size={34} className="text-cyan-400 mx-auto mb-4" />
          <p className="text-white text-lg font-black mb-2">Feed của bạn còn rất mới</p>
          <div className="flex gap-3">
            <button onClick={() => setShowDiscoverPeople(true)} className="flex-1 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-bold active:scale-95 transition-all">
              Tìm người để follow
            </button>
            <button onClick={() => openSocialComposer('progress')} className="flex-1 py-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm font-bold active:scale-95 transition-all">
              Đăng progress
            </button>
          </div>
        </div>
      )}

      {!socialError && !isSocialLoading && socialPosts.length > 0 && socialPosts.map(post => (
        <div key={post.id} className={`${card} p-5`}>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner" style={{ background: post.post_kind === 'progress' ? 'linear-gradient(135deg, rgba(34,211,238,0.35), rgba(59,130,246,0.35))' : 'linear-gradient(135deg, rgba(16,185,129,0.35), rgba(6,182,212,0.25))' }}>
              <span className="text-lg font-black text-white">{(post.author?.nickname || 'D').charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-black truncate">{post.author.nickname}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${post.post_kind === 'progress' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>
                      {post.post_kind === 'progress' ? 'Tiến độ' : 'Bài viết'}
                    </span>
                    <span className="text-slate-500 text-[10px] uppercase tracking-wider">{post.visibility === 'followers' ? 'Chỉ follower' : 'Công khai'}</span>
                  </div>
                </div>
                <p className="text-slate-500 text-[10px] uppercase tracking-wider flex-shrink-0">{getRelativeTimeLabel(post.created_at)}</p>
              </div>
              {post.content && <p className="text-slate-300 text-sm leading-relaxed mt-4 whitespace-pre-wrap">{post.content}</p>}
              {post.image_url && <div className="mt-4 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900"><img src={post.image_url} alt={`Bài đăng của ${post.author.nickname}`} className="w-full h-56 object-cover" /></div>}
              <div className="mt-4 flex items-center gap-2 flex-wrap"><div className="px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-700 text-[11px] text-cyan-300 font-semibold">{post.hydration_ml || 0}ml hôm nay</div><div className="px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-700 text-[11px] text-orange-300 font-semibold">Streak {post.streak_snapshot || 0} ngày</div>{post.author.id !== profile?.id && socialFollowingIds.includes(post.author.id) && (<div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 font-semibold">Đang theo dõi</div>)}</div>
              <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => handleToggleLikePost(post)} className={`py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all ${post.likedByMe ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' : 'bg-slate-900/70 text-slate-300 border-slate-700'}`}><Heart size={14} className={post.likedByMe ? 'fill-rose-400' : ''} />{post.like_count || 0} thích</button><button onClick={() => openSocialComposer('progress')} className="py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"><Share2 size={14} /> Đăng kiểu này</button></div>
            </div>
          </div>
        </div>
      ))}
      <div className="space-y-3">{[ { icon: Zap, color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)', title: 'Giao thức buổi sáng', body: 'Sau khi ngủ dậy, hãy ưu tiên 250-300ml nước trước cà phê để kéo hydration level về trạng thái ổn định.' }, { icon: Target, color: '#22d3ee', bg: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.3)', title: 'Thử thách 7 ngày', body: 'Theo dõi vài người bạn thân và cùng nhau hoàn thành 100% mục tiêu nước trong 7 ngày liên tiếp.' } ].map(({ icon: Icon, color, bg, border, title, body }) => (<div key={title} className={`${card} p-4`} style={{ borderColor: border }}><div className="flex items-start gap-4"><div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: bg, border: `1px solid ${border}` }}><Icon size={18} style={{ color }} /></div><div className="flex-1"><p className="text-white font-bold text-sm mb-1">{title}</p><p className="text-slate-400 text-xs leading-relaxed">{body}</p></div></div></div>))}</div>
    </div>
  );
}