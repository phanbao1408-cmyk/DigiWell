import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Droplet, Eye, ShieldCheck, Coffee,
  Lock, Trophy, Target, Watch, Bluetooth, RefreshCw,
  CloudSun, Calendar, Bell, Sparkles,
  Users, UserPlus, Search, Share2, Edit2, ImagePlus, UserMinus, Plus, X
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { GoogleGenAI } from '@google/genai';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Health } from '@capgo/capacitor-health';
import { LocalNotifications, type ActionPerformed } from '@capacitor/local-notifications';
import {
  DEFAULT_HYDRATION_REMINDER_SETTINGS,
  checkHydrationReminderPermission,
  getHydrationReminderPreview,
  parseHydrationNotificationAction,
  registerHydrationReminderActions,
  requestHydrationReminderPermission,
  scheduleHydrationReminders,
  scheduleHydrationSnooze,
  supportsNativeHydrationReminders,
  validateHydrationReminderSettings,
  type HydrationReminderSettings,
} from './lib/hydrationReminders';
import {
  buildProgressShareText,
  DEFAULT_SOCIAL_COMPOSER,
  DEFAULT_SOCIAL_PROFILE_STATS,
  isMissingSocialSchemaError,
  type SocialComposerState,
  type SocialDiscoverProfile,
  type SocialFeedPost,
  type SocialProfileStats,
} from './lib/social';

import { useWaterData } from './useWaterData';
import WelcomeScreen from './WelcomeScreen';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import AiChatModal from './components/modals/AiChatModal';
import BottomNav, { type TabType } from './components/layout/BottomNav';
import HomeTab, { type DrinkPreset, renderIcon, presetStyles } from './tabs/HomeTab';
import AutoActivityCard from './components/AutoActivityCard';
import FeedTab from './tabs/FeedTab';
import ProfileTab from './tabs/ProfileTab';
import InsightTab from './tabs/InsightTab';
import LeagueTab from './tabs/LeagueTab';

// ============================================================================
// DIGIWELL SMART WELLNESS - PREMIUM DARK UI (V7 FIXED)
// FIX #1: handleRegister upsert profiles sau signUp
// FIX #2: waterGoal tự động theo Calendar/Watch thay vì currentActivity thủ công
// ============================================================================

function AppContent() {

  // FIX BUG: Ref để thay thế useEffectEvent bị lỗi không tồn tại trong React 18
  const handleHydrationNotificationActionRef = useRef<((action: ActionPerformed) => Promise<void>) | null>(null);

  // Lắng nghe Deep Link để đóng In-App Browser và truyền Token cho Supabase
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const sub = CapacitorApp.addListener('appUrlOpen', (event) => {
        if (event.url.includes('login-callback')) {
          Browser.close().catch(() => {});
          // Trích xuất chuỗi token từ URL Scheme và đẩy vào window.location để Supabase tự bắt
          const urlStr = event.url;
          if (urlStr.includes('#') || urlStr.includes('?')) {
            const fragment = urlStr.substring(urlStr.indexOf(urlStr.includes('?') ? '?' : '#'));
            window.location.href = `${window.location.origin}${window.location.pathname}${fragment}`;
          }
        }
      });
      return () => { sub.then(s => s.remove()); };
    }
  }, []);

  // ==========================================================================
  // [1] QUẢN LÝ TRẠNG THÁI (STATES)
  // ==========================================================================
  const [view, setView] = useState<'welcome' | 'login' | 'register' | 'app'>('welcome');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isWatchConnected, setIsWatchConnected] = useState(false);
  const [watchData, setWatchData] = useState({ heartRate: 0, steps: 0 });
  const [isWeatherSynced, setIsWeatherSynced] = useState(false);
  const [weatherData, setWeatherData] = useState({ temp: 28, location: 'TP. Hồ Chí Minh', status: 'Nắng nhẹ' });
  const [isCalendarSynced, setIsCalendarSynced] = useState(false);
  
  const [calendarEvents, setCalendarEvents] = useState([
    { time: '09:00', title: 'Học môn Digital Citizen', location: 'Phòng A.05' },
    { time: '14:00', title: 'Họp nhóm đồ án', location: 'Café Highland' }
  ]);
  
  const [now, setNow] = useState(() => new Date());
  const [profile, setProfile] = useState<any>(null);
  
  const [loginPrefill, setLoginPrefill] = useState('');
  
  // Giữ lại để demo thuật toán thủ công khi chưa kết nối thiết bị
  const [currentActivity, setCurrentActivity] = useState<'chill' | 'light' | 'hard'>('chill');
  
  const [streak] = useState(3); // Giữ lại state để sẵn sàng cho logic tự động tăng chuỗi sau này

  const [weeklyHistory, setWeeklyHistory] = useState<{d: string, ml: number, isToday: boolean}[]>([]);
  // Lịch sử từng lần uống (lưu localStorage theo ngày)
  type PendingHydrationAction = { amount: number; name: string; timestamp: number };
  const PENDING_HYDRATION_ACTIONS_KEY = 'digiwell_pending_hydration_actions';
  const [showHistory, setShowHistory] = useState(false);

  // State cho tính năng Scan AI
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSmartHub, setShowSmartHub] = useState(false);
  const [isPrefsLoaded, setIsPrefsLoaded] = useState(false);
  const [reminderSettings, setReminderSettings] = useState<HydrationReminderSettings>({
    ...DEFAULT_HYDRATION_REMINDER_SETTINGS,
  });
  const [isReminderPermissionGranted, setIsReminderPermissionGranted] = useState(false);
  const [isApplyingReminderSettings, setIsApplyingReminderSettings] = useState(false);

  const [showCustomDrink, setShowCustomDrink] = useState(false);
  const [customDrinkForm, setCustomDrinkForm] = useState({ name: 'Trà đào', amount: 300 as number | string, factor: 1.0 });

  // State cho Menu đồ uống mặc định
  const [drinkPresets, setDrinkPresets] = useState<DrinkPreset[]>(() => {
    const saved = localStorage.getItem('digiwell_presets');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Nước lọc', amount: 250, factor: 1.0, icon: 'Droplet', color: 'cyan' },
      { id: '2', name: 'Cà phê', amount: 200, factor: 0.8, icon: 'Coffee', color: 'orange' },
      { id: '3', name: 'Bù khoáng', amount: 300, factor: 1.1, icon: 'Activity', color: 'emerald' },
      { id: '4', name: 'Bia/Rượu', amount: 330, factor: -0.5, icon: 'Zap', color: 'red' }
    ];
  });
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [editingPresets, setEditingPresets] = useState<DrinkPreset[]>(drinkPresets);

  // State cho Onboarding (Hướng dẫn tân thủ)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);

  // State cho Chat AI Premium
  const [showAiChat, setShowAiChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // ==========================================================================
  // [NEW] PREMIUM FEATURES STATES
  // ==========================================================================
  const [isPremium, setIsPremium] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [leagueMode, setLeagueMode] = useState<'public' | 'friends'>('public');
  const [isFastingMode, setIsFastingMode] = useState(() => !!localStorage.getItem('digiwell_fasting_start'));
  const [fastingStartTime, setFastingStartTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('digiwell_fasting_start');
    return saved ? parseInt(saved, 10) : null;
  });
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  // Social & Friends
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSocialComposer, setShowSocialComposer] = useState(false);
  const [showDiscoverPeople, setShowDiscoverPeople] = useState(false);
  const [showSocialProfile, setShowSocialProfile] = useState(false);
  const [socialComposer, setSocialComposer] = useState<SocialComposerState>({ ...DEFAULT_SOCIAL_COMPOSER });
  const [socialPosts, setSocialPosts] = useState<SocialFeedPost[]>([]);
  const [socialStories, setSocialStories] = useState<SocialFeedPost[]>([]);
  const [socialSearchQuery, setSocialSearchQuery] = useState('');
  const [socialSearchResults, setSocialSearchResults] = useState<SocialDiscoverProfile[]>([]);
  const [socialFollowingIds, setSocialFollowingIds] = useState<string[]>([]);
  const [socialProfileStats, setSocialProfileStats] = useState<SocialProfileStats>(DEFAULT_SOCIAL_PROFILE_STATS);
  const [socialError, setSocialError] = useState('');
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [isPublishingSocialPost, setIsPublishingSocialPost] = useState(false);
  const [isSocialSearching, setIsSocialSearching] = useState(false);
  const [socialImageFile, setSocialImageFile] = useState<File | null>(null);
  const [socialImagePreview, setSocialImagePreview] = useState('');
  const socialImageInputRef = useRef<HTMLInputElement>(null);

  // ==========================================================================
  // [NEW] CẬP NHẬT HỒ SƠ STATES
  // ==========================================================================
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState({
    nickname: '', gender: 'Nam', age: 20, height: 172, weight: 82, activity: 'active', climate: 'Nhiệt đới (Nóng)', goal: 'Giảm mỡ & Tăng cơ'
  });

  // ==========================================================================
  // [NEW] REAL AI GEMINI STATES
  // ==========================================================================
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  const availableGeminiModelsRef = useRef<string[] | null>(null);

  // ==========================================================================
  // [2] LOGIC SUPABASE CLOUD SYNC
  // ==========================================================================
  
  const loadProfileForCurrentUser = async () => {
    try {
      const { data: sessionRes, error: sessionErr } = await supabase!.auth.getSession();
      if (sessionErr || !sessionRes.session?.user.id) return null;
      const userId = sessionRes.session.user.id;
      
      const { data: p, error: pErr } = await supabase!.from('profiles').select('*').eq('id', userId).single();
      if (pErr || !p) return null;
      
      return {
        id: p.id, nickname: p.nickname, password: '', gender: p.gender,
        age: p.age, height: p.height, weight: p.weight, activity: p.activity,
        climate: p.climate, goal: p.goal, wakeUp: p.wake_up, bedTime: p.bed_time
      };
    } catch { return null; }
  };

  // Tải danh sách bạn bè thật từ Supabase
  const fetchFriendsData = async () => {
    if (!profile?.id) return;
    try {
      // 1. Lấy danh sách ID bạn bè
      const { data: fData, error: fErr } = await supabase!
        .from('friends')
        .select('friend_id')
        .eq('user_id', profile.id);
      if (fErr || !fData) return;
      
      const friendIds = fData.map((f: any) => f.friend_id);
      if (friendIds.length === 0) {
        setFriendsList([]);
        return;
      }

      // 2. Lấy thông tin Profile và lượng nước hôm nay
      const todayStr = new Date().toISOString().split('T')[0];
      
      const { data: pData } = await supabase!.from('profiles').select('id, nickname').in('id', friendIds);
      const { data: wData } = await supabase!.from('water_logs').select('user_id, intake_ml').eq('day', todayStr).in('user_id', friendIds);

      if (pData) {
        const formattedFriends = pData.map((p: any) => {
          const waterLog = wData?.find((w: any) => w.user_id === p.id);
          const intake = waterLog ? waterLog.intake_ml : 0;
          return { 
            id: p.id, 
            name: p.nickname || 'Người dùng', 
            dept: 'Bạn bè', 
            wp: intake + 200, // Tạm cộng 200 WP (streak mặc định)
            streak: 1, 
            isMe: false 
          };
        });
        setFriendsList(formattedFriends);
      }
    } catch (err) {
      console.error("Lỗi tải bạn bè:", err);
    }
  };

  // Tìm kiếm User thật theo Nickname
  const handleSearchUser = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const { data, error } = await supabase!
      .from('profiles')
      .select('id, nickname')
      .ilike('nickname', `%${query}%`)
      .neq('id', profile?.id)
      .limit(5);
    if (!error && data) setSearchResults(data.map((u: any) => ({ ...u, nickname: u.nickname || 'Người dùng' })));
    setIsSearching(false);
  };

  // Thêm vào bảng friends
  const handleAddFriend = async (friendId: string, friendName: string) => {
    const toastId = toast.loading("Đang gửi lời mời...");
    const { error } = await supabase!
      .from('friends')
      .insert({ user_id: profile?.id, friend_id: friendId });
      
    if (error) {
      if (error.code === '23505') toast.error(`Bạn và ${friendName} đã là bạn bè!`, { id: toastId });
      else toast.error("Lỗi: " + error.message, { id: toastId });
    } else {
      toast.success(`Đã thêm ${friendName} vào danh sách theo dõi!`, { id: toastId });
      setShowAddFriend(false);
      setSearchQuery('');
      setSearchResults([]);
      fetchFriendsData(); // Cập nhật lại Bảng xếp hạng
    }
  };

  // Lưu preset vào localStorage
  useEffect(() => {
    localStorage.setItem('digiwell_presets', JSON.stringify(drinkPresets));
  }, [drinkPresets]);

  // ==========================================================================
  // [3] VÒNG ĐỜI HỆ THỐNG (EFFECTS)
  // ==========================================================================
  
  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const { data: sub } = supabase!.auth.onAuthStateChange(async (event: string, session: any) => {
      if (!isMounted) return;
      try {
        if (session) {
          // Lưu lại Provider Token của Google để dùng cho Calendar API
          if (session.provider_token) {
            localStorage.setItem('google_provider_token', session.provider_token);
          }

          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(async () => {
              let p = await loadProfileForCurrentUser();
              
              // Tự động tạo Profile nếu người dùng mới đăng nhập Google chưa có
              if (!p && session.user) {
                const defaultName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User';
                await supabase!.from('profiles').upsert([{
                  id: session.user.id, nickname: defaultName, gender: 'Nam', age: 20, height: 170, weight: 60,
                  activity: 'active', climate: 'Nhiệt đới (Nóng)', goal: 'Sức khỏe tổng quát'
                }], { onConflict: 'id' });
                p = await loadProfileForCurrentUser();
              }

              if (p && isMounted) { 
                setProfile(p); 
                setView('app'); 
              }
            }, 500);
          }
        } else if (event === 'SIGNED_OUT' || !session) { 
          setProfile(null); 
          setChatMessages([]); // Dọn dẹp tin nhắn AI khi đăng xuất
          localStorage.removeItem('google_provider_token'); // Xóa token Google khi đăng xuất
          setView('welcome'); 
        }
          } catch (error) {
            console.error(error);
      }
    });
    
    return () => { 
      isMounted = false; 
      if (timeoutId) clearTimeout(timeoutId); 
      sub?.subscription.unsubscribe(); 
    };
  }, []);

  // Tự động tải dữ liệu Bạn bè khi chuyển sang Tab Bạn Bè
  useEffect(() => {
    if (leagueMode === 'friends' && activeTab === 'league') {
      fetchFriendsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueMode, activeTab, profile?.id]);

  // ==========================================================================
  // [NEW] WATER DATA HOOK
  // ==========================================================================
  const { waterIntake, waterEntries, handleAddWater, handleDeleteEntry, handleEditEntry, editingEntry, setEditingEntry, editAmount, setEditAmount, hasPendingCloudSync, waterIntakeRef, waterEntriesRef } = useWaterData(profile);

  // Tải dữ liệu nước trong tuần (REAL DATA)
  useEffect(() => {
    const fetchWeeklyHistory = async () => {
        const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const today = new Date();
        const dateList: { date: Date, dayStr: string }[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
              // FIX TIMEZONE BUG: Dùng Local format thay vì toISOString (UTC) để không bị lùi ngày
              const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              dateList.push({ date: d, dayStr: localDateStr });
        }

        if (!profile?.id) {
            const emptyHistory = dateList.map((d, index) => ({
                d: index === 6 ? 'HN' : dayLabels[d.date.getDay()],
                ml: 0,
                isToday: index === 6,
            }));
            setWeeklyHistory(emptyHistory);
            return;
        }

        const dateStrings = dateList.map(d => d.dayStr);

        try {
            const { data: cloudData, error } = await supabase!
                .from('water_logs')
                .select('day, intake_ml')
                .eq('user_id', profile.id)
                .in('day', dateStrings);

            if (error) throw error;

            const dataMap = new Map(cloudData?.map(d => [d.day, d.intake_ml]));

            const history = dateList.map((d, index) => ({
                d: index === 6 ? 'HN' : dayLabels[d.date.getDay()],
                ml: index === 6 ? waterIntake : (dataMap.get(d.dayStr) || 0),
                isToday: index === 6,
            }));
            setWeeklyHistory(history);
        } catch (err) { console.error("Lỗi tải lịch sử tuần:", err); }
    };
    fetchWeeklyHistory();
  }, [profile?.id, waterIntake]);

  // ==========================================================================
  // [3.1] PERSIST CÀI ĐẶT ĐỒNG BỘ THEO USER
  // ==========================================================================
  useEffect(() => {
    if (profile?.id) {
      const prefs = JSON.parse(localStorage.getItem(`digiwell_prefs_${profile.id}`) || '{}');
      const savedReminderSettings = JSON.parse(localStorage.getItem(`digiwell_reminders_${profile.id}`) || 'null');
      setIsWatchConnected(!!prefs.watch);
      setIsWeatherSynced(!!prefs.weather);
      setIsCalendarSynced(!!prefs.calendar);
      setReminderSettings(savedReminderSettings
        ? { ...DEFAULT_HYDRATION_REMINDER_SETTINGS, ...savedReminderSettings }
        : { ...DEFAULT_HYDRATION_REMINDER_SETTINGS });
      setIsPrefsLoaded(true);
    } else {
      setIsPrefsLoaded(false);
      setIsWatchConnected(false);
      setIsWeatherSynced(false);
      setIsCalendarSynced(false);
      setReminderSettings({ ...DEFAULT_HYDRATION_REMINDER_SETTINGS });
      setIsReminderPermissionGranted(false);
      setShowOnboarding(false);
      setShowSocialComposer(false);
      setShowDiscoverPeople(false);
      setShowSocialProfile(false);
      setShowProfileSettings(false);
      setSocialPosts([]);
      setSocialStories([]);
      setSocialSearchResults([]);
      setSocialFollowingIds([]);
      setSocialProfileStats(DEFAULT_SOCIAL_PROFILE_STATS);
      setSocialError('');
      resetSocialComposer();
    }
    
    if (profile?.id && !localStorage.getItem(`digiwell_onboarded_${profile.id}`)) {
      setShowOnboarding(true);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id && isPrefsLoaded) {
      localStorage.setItem(`digiwell_prefs_${profile.id}`, JSON.stringify({ watch: isWatchConnected, weather: isWeatherSynced, calendar: isCalendarSynced }));
    }
  }, [isWatchConnected, isWeatherSynced, isCalendarSynced, profile?.id, isPrefsLoaded]);

  useEffect(() => {
    if (profile?.id) {
      localStorage.setItem(`digiwell_reminders_${profile.id}`, JSON.stringify(reminderSettings));
    }
  }, [profile?.id, reminderSettings]);

  useEffect(() => {
    let ignore = false;

    const restoreHydrationReminders = async () => {
      if (supportsNativeHydrationReminders()) {
        await registerHydrationReminderActions().catch(error => {
          console.warn('Không thể đăng ký action cho hydration notifications:', error);
        });
      }

      const granted = await checkHydrationReminderPermission();
      if (ignore) return;

      setIsReminderPermissionGranted(granted);

      if (!profile?.id || !isPrefsLoaded || !granted) return;

      try {
        await scheduleHydrationReminders(reminderSettings, {
          dailyGoal: waterGoal,
          nickname: profile.nickname,
        });
      } catch (error) {
        console.error('Không thể khôi phục lịch nhắc uống nước:', error);
      }
    };

    void restoreHydrationReminders();

    return () => {
      ignore = true;
    };
  }, [profile?.id, isPrefsLoaded]);

  useEffect(() => {
    if (!supportsNativeHydrationReminders()) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setupNotificationActions = async () => {
      await registerHydrationReminderActions().catch(() => undefined);
      listenerHandle = await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        notificationAction => {
          if (handleHydrationNotificationActionRef.current) {
            void handleHydrationNotificationActionRef.current(notificationAction);
          }
        },
      );
    };

    void setupNotificationActions();

    return () => {
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!profile?.id || view !== 'app') return;

    const pendingActions = readPendingHydrationActions();
    if (pendingActions.length === 0) return;

    clearPendingHydrationActions();

    void (async () => {
      for (const action of pendingActions) {
        await handleAddWater(action.amount, 1, action.name);
      }
      toast.success(`Đã ghi nhận ${pendingActions.length} lần uống nước từ notification.`);
    })();
  }, [profile?.id, view]);

  useEffect(() => {
    if (activeTab === 'feed' && profile?.id) {
      void refreshSocialFeed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, profile?.id]);

  useEffect(() => {
    if (showDiscoverPeople && profile?.id) {
      void loadSocialDirectory(socialSearchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDiscoverPeople, profile?.id]);

  useEffect(() => () => {
    if (socialImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(socialImagePreview);
    }
  }, [socialImagePreview]);

  const lastDayRef = useRef(new Date().getDate());

  useEffect(() => {
    let timer: number | undefined;

    // Hàm kiểm tra ép Reset nếu phát hiện lệch ngày
    const checkMidnight = (currDate: Date) => {
      if (currDate.getDate() !== lastDayRef.current) {
        lastDayRef.current = currDate.getDate();
        window.location.reload(); // Quét sạch state cũ và nạp lại ngày mới
      }
    };

    const start = () => { 
      if (timer) return; 
      timer = window.setInterval(() => {
        setNow(prev => {
          const curr = new Date();
          checkMidnight(curr); // Quét mỗi giây khi app đang bật
          return curr;
        });
      }, 1000); 
    };
    const stop = () => { if (!timer) return; window.clearInterval(timer); timer = undefined; };
    const onVis = () => { 
      if (document.visibilityState === 'visible') { 
        const curr = new Date();
        checkMidnight(curr); // KIỂM TRA NGAY LẬP TỨC khi app vừa được đánh thức từ Background!
        setNow(curr); 
        start(); 
      } else {
        stop(); 
      }
    };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    if (!isWatchConnected) return;

    let interval: number;

    const fetchRealHealthData = async () => {
      // Fallback: Chạy trên Web/Android thì dùng mock data để không bị crash
      if (Capacitor.getPlatform() !== 'ios') {
        setWatchData(prev => ({ 
          heartRate: Math.floor(Math.random() * 14) + 72, 
          steps: prev.steps + Math.floor(Math.random() * 3) 
        }));
        return;
      }

      try {
        // 1. Xin quyền đọc dữ liệu từ Apple Health
        await Health.requestAuthorization({
          read: ['steps', 'heartRate'],
          write: []
        });

        // 2. Lấy thời gian từ đầu ngày hôm nay
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 3. Yêu cầu Apple Health tự tính TỔNG bước chân trong ngày
        const stepsRes = await Health.queryAggregated({
          dataType: 'steps',
          startDate: today.toISOString(),
          endDate: new Date().toISOString(),
          bucket: 'day',
          aggregation: 'sum'
        });
        const totalSteps = stepsRes?.samples && stepsRes.samples.length > 0 ? stepsRes.samples[0].value : 0;

        // 4. Query nhịp tim gần nhất (lấy limit: 1)
        const hrRes = await Health.readSamples({
          dataType: 'heartRate',
          startDate: today.toISOString(),
          endDate: new Date().toISOString(),
          limit: 1
        });
        const latestHR = hrRes?.samples && hrRes.samples.length > 0 ? hrRes.samples[0].value : 75;

        setWatchData({ heartRate: Math.round(latestHR), steps: Math.round(totalSteps) });
      } catch (error) {
        console.error("Lỗi đọc Apple Health:", error);
      }
    };

    fetchRealHealthData();
    interval = window.setInterval(fetchRealHealthData, 10000); // Lấy data mỗi 10 giây

    return () => clearInterval(interval);
  }, [isWatchConnected]);

  // ==========================================================================
  // [4] THUẬT TOÁN TÍNH TOÁN (ALGORITHMS)
  // ==========================================================================

  const calculateWP = (intake: number, goal: number, currentStreak: number) => {
    return Math.min(intake, goal) + (currentStreak * 200);
  };

  const getRankInfo = (wp: number) => {
    if (wp >= 4500) return { name: 'Thách Đấu', color: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/30' };
    if (wp >= 3500) return { name: 'Kim Cương', color: 'text-cyan-300', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30' };
    if (wp >= 2500) return { name: 'Bạch Kim', color: 'text-teal-300', bg: 'bg-teal-500/20', border: 'border-teal-500/30' };
    if (wp >= 1500) return { name: 'Vàng', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' };
    if (wp >= 800) return { name: 'Bạc', color: 'text-slate-300', bg: 'bg-slate-500/20', border: 'border-slate-500/30' };
    return { name: 'Đồng', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' };
  };

  const handleUpdatePreset = (index: number, field: string, value: any) => {
    const newPresets = [...editingPresets];
    newPresets[index] = { ...newPresets[index], [field]: value };
    setEditingPresets(newPresets);
  };

  const savePresets = () => {
    setDrinkPresets(editingPresets);
    setShowPresetManager(false);
    toast.success("Đã lưu cấu hình đồ uống mặc định!");
  };

  // ✅ FIX #2: Auto-detect từ Calendar → Watch → Thủ công (theo thứ tự ưu tiên)
  const waterGoal = useMemo(() => {
    if (!profile) return 2000;
    let base = profile.weight * 35;

    const gymKeywords = ['gym', 'tập', 'chạy', 'yoga', 'bơi', 'thể dục', 'boxing', 'cycling', 'football', 'bóng'];

    if (isCalendarSynced) {
      // Ưu tiên 1: Calendar — tìm event có tên liên quan vận động mạnh
      const hasGymEvent = calendarEvents.some(e =>
        gymKeywords.some(kw => e.title.toLowerCase().includes(kw))
      );
      if (hasGymEvent) base += 800;
      // Không có event gym thì giữ nguyên base (ít vận động)
    } else if (isWatchConnected && watchData.steps > 0) {
      // Ưu tiên 2: Watch data thực tế
      if (watchData.steps >= 8000 || watchData.heartRate >= 100) base += 800;
      else if (watchData.steps >= 4000 || watchData.heartRate >= 85) base += 400;
    } else {
      // Ưu tiên 3: Thủ công (dùng để demo khi chưa kết nối thiết bị)
      if (currentActivity === 'light') base += 400;
      if (currentActivity === 'hard') base += 800;
    }

    // Cộng thêm theo thời tiết
    if (isWeatherSynced && weatherData.temp > 30) base += 500;
    else if (profile.climate?.includes('Nóng')) base += 200;

    return base;
  }, [profile, currentActivity, isCalendarSynced, isWatchConnected, watchData, calendarEvents, isWeatherSynced, weatherData.temp]);

  // Fasting Math
  const fastingElapsed = isFastingMode && fastingStartTime ? now.getTime() - fastingStartTime : 0;
  const fastingTotalMs = 16 * 60 * 60 * 1000; // 16 hours
  const fastingRemaining = Math.max(fastingTotalMs - fastingElapsed, 0);
  const fastingHours = Math.floor(fastingRemaining / (1000 * 60 * 60));
  const fastingMinutes = Math.floor((fastingRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const fastingSeconds = Math.floor((fastingRemaining % (1000 * 60)) / 1000);

  const progress = Math.min((waterIntake / waterGoal) * 100, 100);
  const reminderPreview = useMemo(() => getHydrationReminderPreview(reminderSettings), [reminderSettings]);

  const nowText = useMemo(() => ({
    date: new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(now),
    time: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now),
  }), [now]);

  const getSocialErrorMessage = (message?: string) => {
    if (!message) return 'Không thể tải tính năng cộng đồng lúc này.';
    if (isMissingSocialSchemaError(message)) {
      return 'Social chưa được bật trên Supabase. Hãy chạy file supabase/social_lite.sql rồi mở lại app.';
    }
    return message;
  };

  const resetSocialComposer = () => {
    if (socialImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(socialImagePreview);
    }
    setSocialComposer({ ...DEFAULT_SOCIAL_COMPOSER });
    setSocialImageFile(null);
    setSocialImagePreview('');
  };

  const closeSocialComposer = () => {
    resetSocialComposer();
    setShowSocialComposer(false);
  };

  const openSocialComposer = (kind: SocialComposerState['postKind'] = 'status') => {
    if (!profile?.id) {
      toast.error('Vui lòng đăng nhập lại để đăng bài.');
      return;
    }

    const content = kind === 'progress'
      ? buildProgressShareText({
        nickname: profile.nickname,
        waterIntake,
        waterGoal,
        streak,
      })
      : '';

    resetSocialComposer();
    setSocialComposer({
      content,
      imageUrl: '',
      postKind: kind,
      visibility: kind === 'story' ? 'followers' : 'public',
    });
    setActiveTab('feed');
    setShowSocialComposer(true);
  };

  const uploadSocialImage = async (file: File) => {
    if (!profile?.id) throw new Error('Vui lòng đăng nhập lại.');

    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : 'jpg';
    const safeExtension = extension || 'jpg';
    const filePath = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExtension}`;
    const { error } = await supabase!.storage.from('social-media').upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    return supabase!.storage.from('social-media').getPublicUrl(filePath).data.publicUrl;
  };

  const loadSocialDirectory = async (query: string) => {
    if (!profile?.id) return;

    setIsSocialSearching(true);
    try {
      const keyword = query.trim();
      let request = supabase!
        .from('profiles')
        .select('id, nickname')
        .neq('id', profile.id);

      request = keyword.length >= 2
        ? request.ilike('nickname', `%${keyword}%`)
        : request.order('nickname', { ascending: true });

      const { data, error } = await request.limit(8);
      if (error) throw error;

      setSocialError('');
      setSocialSearchResults((data || []).map((user: any) => ({
        id: user.id,
        nickname: user.nickname || 'Người dùng DigiWell',
        isFollowing: socialFollowingIds.includes(user.id),
      })));
    } catch (err: any) {
      const friendlyMessage = getSocialErrorMessage(err.message);
      setSocialError(friendlyMessage);
      toast.error(friendlyMessage);
    } finally {
      setIsSocialSearching(false);
    }
  };

  const refreshSocialFeed = async (options?: { silent?: boolean }) => {
    if (!profile?.id) return;

    if (!options?.silent) {
      setIsSocialLoading(true);
    }

    try {
      const [
        followingRes,
        followersCountRes,
        followingCountRes,
        postsCountRes,
      ] = await Promise.all([
        supabase!.from('social_follows').select('following_id').eq('follower_id', profile.id),
        supabase!.from('social_follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
        supabase!.from('social_follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
        supabase!.from('social_posts').select('*', { count: 'exact', head: true }).eq('author_id', profile.id),
      ]);

      if (followingRes.error) throw followingRes.error;
      if (followersCountRes.error) throw followersCountRes.error;
      if (followingCountRes.error) throw followingCountRes.error;
      if (postsCountRes.error) throw postsCountRes.error;

      const followingIds = (followingRes.data || []).map((row: any) => row.following_id);
      setSocialFollowingIds(followingIds);
      setSocialProfileStats({
        followers: followersCountRes.count || 0,
        following: followingCountRes.count || 0,
        posts: postsCountRes.count || 0,
      });

      const feedAuthorIds = Array.from(new Set([profile.id, ...followingIds]));
      const { data: postRows, error: postsError } = await supabase!
        .from('social_posts')
        .select('id, author_id, content, image_url, post_kind, visibility, hydration_ml, streak_snapshot, like_count, created_at, expires_at')
        .in('author_id', feedAuthorIds)
        .order('created_at', { ascending: false })
        .limit(40);

      if (postsError) throw postsError;

      const validRows = (postRows || []).filter((row: any) => {
        if (row.post_kind !== 'story') return true;
        if (!row.expires_at) return false;
        return new Date(row.expires_at).getTime() > Date.now();
      });

      const authorIds = Array.from(new Set(validRows.map((row: any) => row.author_id)));
      const postIds = validRows.map((row: any) => row.id);

      const [profilesRes, likesRes] = await Promise.all([
        authorIds.length > 0
          ? supabase!.from('profiles').select('id, nickname').in('id', authorIds)
          : Promise.resolve({ data: [], error: null }),
        postIds.length > 0
          ? supabase!.from('social_post_likes').select('post_id').eq('user_id', profile.id).in('post_id', postIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (likesRes.error) throw likesRes.error;

      const profileMap = new Map((profilesRes.data || []).map((row: any) => [row.id, {
        id: row.id,
        nickname: row.nickname || 'Người dùng DigiWell',
      }]));
      const likedPostIds = new Set((likesRes.data || []).map((row: any) => row.post_id));

      const mappedPosts: SocialFeedPost[] = validRows.map((row: any) => ({
        ...row,
        author: profileMap.get(row.author_id) || {
          id: row.author_id,
          nickname: row.author_id === profile.id ? (profile.nickname || 'Bạn') : 'Người dùng DigiWell',
        },
        likedByMe: likedPostIds.has(row.id),
      }));

      const storyMap = new Map<string, SocialFeedPost>();
      const latestStories = mappedPosts
        .filter(post => post.post_kind === 'story')
        .reduce<SocialFeedPost[]>((acc, post) => {
          if (storyMap.has(post.author_id)) return acc;
          storyMap.set(post.author_id, post);
          acc.push(post);
          return acc;
        }, []);

      setSocialStories(latestStories);
      setSocialPosts(mappedPosts.filter(post => post.post_kind !== 'story'));
      setSocialError('');
    } catch (err: any) {
      const friendlyMessage = getSocialErrorMessage(err.message);
      setSocialError(friendlyMessage);
      setSocialPosts([]);
      setSocialStories([]);
      if (!options?.silent) {
        toast.error(friendlyMessage);
      }
    } finally {
      setIsSocialLoading(false);
    }
  };

  // ==========================================================================
  // [5] CÁC HÀM XỬ LÝ (CONTROLLERS)
  // ==========================================================================

  handleHydrationNotificationActionRef.current = async (notificationAction: ActionPerformed) => {
    const intent = parseHydrationNotificationAction(notificationAction);
    if (!intent) return;

    if (intent.kind === 'snooze') {
      await scheduleHydrationSnooze({
        minutes: intent.minutes,
        dailyGoal: waterGoal,
        nickname: profile?.nickname,
      });
      toast.info(`Đã nhắc lại sau ${intent.minutes} phút.`);
      return;
    }

    if (!profile?.id) {
      queuePendingHydrationAction({
        amount: intent.amount,
        name: intent.name,
        timestamp: Date.now(),
      });
      return;
    }

    await handleAddWater(intent.amount, 1, intent.name);
  };

  const createGeminiClient = () => {
    if (!geminiApiKey) throw new Error("Chưa cấu hình VITE_GEMINI_API_KEY");
    return new GoogleGenAI({ apiKey: geminiApiKey });
  };

  const getGenerateContentModels = async (ai: GoogleGenAI) => {
    if (availableGeminiModelsRef.current?.length) return availableGeminiModelsRef.current;

    const preferredModels = [
      'models/gemini-2.5-flash',
      'models/gemini-2.5-flash-lite',
      'models/gemini-2.0-flash',
      'models/gemini-2.0-flash-lite',
      'models/gemini-flash-latest',
      'models/gemini-flash-lite-latest',
    ];

    try {
      const pager = await ai.models.list({ config: { pageSize: 100 } });
      const availableModels = new Set<string>();

      for await (const model of pager) {
        if (model.name && model.supportedActions?.includes('generateContent')) {
          availableModels.add(model.name);
        }
      }

      const modelsToTry = preferredModels.filter(modelName => availableModels.has(modelName));
      if (modelsToTry.length > 0) {
        availableGeminiModelsRef.current = modelsToTry;
        return modelsToTry;
      }
    } catch (error) {
      console.warn('Không thể tải danh sách Gemini models:', error);
    }

    availableGeminiModelsRef.current = preferredModels;
    return preferredModels;
  };

  const getGeminiErrorMessage = (error: unknown) => {
    const rawMessage = error instanceof Error ? error.message : String(error);

    if (
      rawMessage.includes('NOT_FOUND') &&
      rawMessage.toLowerCase().includes('models/')
    ) {
      return "Model Gemini cũ không còn hỗ trợ cho generateContent nữa.";
    }

    if (
      rawMessage.includes('RESOURCE_EXHAUSTED') ||
      rawMessage.includes('"code":429') ||
      rawMessage.toLowerCase().includes('quota exceeded')
    ) {
      return "Gemini API đang hết quota hoặc project Google AI Studio chưa bật billing.";
    }

    return rawMessage;
  };

  // Gọi AI Gemini thật
  const fetchAIAdvice = async () => {
    if (isAiLoading) return;
    setIsAiLoading(true);
    
    try {
      // Tạo Context (Bối cảnh) gửi cho AI
      const prompt = `Bạn là trợ lý sức khỏe AI của app DigiWell.
      Thông tin của tôi lúc này:
      - Thời gian: ${now.getHours()} giờ ${now.getMinutes()} phút
      - Lượng nước đã uống: ${waterIntake}/${waterGoal} ml
      - Thời tiết hiện tại: ${weatherData.temp}°C, ${weatherData.status}
      - Nhịp tim: ${watchData.heartRate} BPM, Số bước: ${watchData.steps}
      - Sự kiện sắp tới: ${isCalendarSynced ? calendarEvents[0]?.title : 'Không có lịch'}
      
      Dựa vào các thông tin trên, hãy đưa ra 1 lời khuyên thật ngắn gọn, tự nhiên, thân thiện (dưới 35 chữ) về việc uống nước hoặc nghỉ ngơi. Không cần chào hỏi dài dòng.`;

      const ai = createGeminiClient();
      
      // Tự động lấy danh sách model generateContent mà API Key của bạn đang hỗ trợ
      const modelsToTry = await getGenerateContentModels(ai);
      let advice = "";
      let lastErr = null;
      
      for (const modelName of modelsToTry) {
        try {
          console.log(`Đang gọi AI bằng model: ${modelName}...`);
          const result = await ai.models.generateContent({
            model: modelName,
            contents: prompt
          });
          advice = result.text || "";
          console.log("AI chạy thành công!");
          break; // Thành công thì thoát vòng lặp ngay
        } catch (e: any) { 
          console.error(`Lỗi ở model ${modelName}:`, e.message); // IN LỖI CHI TIẾT RA ĐÂY
          lastErr = e; 
        }
      }
      
      if (!advice) throw lastErr || new Error("Tất cả model AI đều bị từ chối");
      
      setAiAdvice(advice.replace(/\*/g, '')); // Xóa các dấu * in đậm của markdown nếu có
    } catch (err: any) {
      const message = getGeminiErrorMessage(err);
      toast.error("Lỗi AI: " + message);
      setAiAdvice(message.includes('hết quota')
        ? "Gemini API đang hết quota, kiểm tra billing rồi thử lại nhé!"
        : "Hệ thống AI đang bảo trì, vui lòng uống đủ nước bạn nhé!");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Lấy Context động (Hàm này giúp cập nhật lại thông tin nước NGAY LẬP TỨC sau khi AI gọi Tool)
      const getSystemPrompt = () => {
        const historyText = waterEntriesRef.current.length > 0 
          ? `Lịch sử uống nước hôm nay:\n` + waterEntriesRef.current.map(e => `- ${new Date(e.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}: ${e.actual_ml || e.amount}ml ${e.name}`).join('\n')
          : 'Chưa có ghi nhận nào.';

        const weatherStr = isWeatherSynced ? `\n- Thời tiết hiện tại: ${weatherData.temp}°C, ${weatherData.status}` : '';
        const watchStr = isWatchConnected ? `\n- Tình trạng vận động: ${watchData.steps} bước, nhịp tim ${watchData.heartRate} BPM` : '';

        return `Bạn là "DigiCoach" - một chuyên gia sức khỏe AI thân thiện, vui tính và cực kỳ thông minh của ứng dụng DigiWell.
Tên người dùng: ${profile?.nickname || 'Bạn'}
Thời gian thực: ${new Date().toLocaleTimeString('vi-VN')}

Nhiệm vụ & Kỷ luật thép (BẮT BUỘC TUÂN THỦ):
1. Luôn xưng hô "Mình", gọi người dùng là "${profile?.nickname || 'Bạn'}". Trả lời siêu ngắn gọn như tin nhắn người thật, kèm emoji.
2. TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ CỘNG NHẨM TRONG ĐẦU. Khi người dùng báo vừa uống nước/sữa/trà/bia..., BẮT BUỘC gọi Tool 'recordWaterIntake' để ghi nhận vào app.
3. BẮT BUỘC gọi Tool 'deleteLastWaterIntake' nếu người dùng nói lỡ nhập sai hoặc muốn xóa ly nước vừa nãy.
4. Nếu gọi Tool, hệ thống sẽ trả về kết quả. Đọc kết quả đó và phản hồi lại bằng văn bản 1 cách tự nhiên nhất.

Chỉ số sức khỏe hiện tại của người dùng:
- Đã uống: ${waterIntakeRef.current}/${waterGoal} ml (Còn thiếu ${Math.max(waterGoal - waterIntakeRef.current, 0)} ml)${weatherStr}${watchStr}

${historyText}`;
      };

      // Đưa toàn bộ lịch sử chat vào để AI nhớ ngữ cảnh
      const conversation: any[] = chatMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user', // API Gemini dùng 'model' thay vì 'assistant'
        parts: [{ text: msg.content }]
      }));
      conversation.push({ role: 'user', parts: [{ text: userMsg }] });

      const ai = createGeminiClient();
      const modelsToTry = await getGenerateContentModels(ai);
      let advice = "";
      let lastErr: unknown = null;

      // Cấu hình Native Function Calling cho Gemini
      const tools = [{
        functionDeclarations: [{
          name: 'recordWaterIntake',
          description: 'BẮT BUỘC GỌI HÀM NÀY khi người dùng nói họ vừa uống bất kỳ loại đồ uống nào (nước, trà, sữa, cà phê, bia...). Công cụ sẽ tự động xử lý và cộng vào hệ thống.',
          parameters: {
            type: 'OBJECT' as any,
            properties: {
              amount: { type: 'INTEGER' as any, description: 'Dung tích tính bằng ml (vd: 200, 300)' },
              factor: { type: 'NUMBER' as any, description: 'Hệ số: Nước/Nước trái cây=1.0, Cà phê/Trà=0.8, Sữa=1.1, Cồn=-0.5' },
              name: { type: 'STRING' as any, description: 'Tên loại đồ uống (vd: Nước lọc, Cà phê, Bia)' }
            },
            required: ['amount', 'factor', 'name']
          }
        }]
      }, {
        functionDeclarations: [{
          name: 'navigateTab',
          description: 'Mở các thẻ (tab) chức năng của ứng dụng (Trang chủ, Thống kê, Bảng xếp hạng, Cộng đồng, Hồ sơ).',
          parameters: {
            type: 'OBJECT' as any,
            properties: {
              tabName: { type: 'STRING' as any, description: 'Chỉ định 1 trong: "home", "insight", "league", "feed", "profile"' }
            },
            required: ['tabName']
          }
        }]
      }, {
        functionDeclarations: [{
          name: 'deleteLastWaterIntake',
          description: 'Hủy hoặc xóa lần ghi nhận nước uống gần nhất trong ngày khi người dùng nói họ nhập nhầm, nhập sai, hoặc bảo xóa bớt đi.',
          parameters: {
            type: 'OBJECT' as any,
            properties: {
              reason: { type: 'STRING' as any, description: 'Lý do xóa' }
            }
          }
        }]
      }, {
        functionDeclarations: [{
          name: 'triggerSystemAction',
          description: 'Thực hiện các hành động hệ thống như: "export_pdf" (xuất báo cáo y khoa PDF), "toggle_fasting" (bật/tắt nhịn ăn), "open_history" (mở lịch sử).',
          parameters: {
            type: 'OBJECT' as any,
            properties: {
              action: { type: 'STRING' as any, description: 'Các hành động hỗ trợ: "export_pdf", "toggle_fasting", "open_history"' }
            },
            required: ['action']
          }
        }]
      }];

      for (const modelName of modelsToTry) {
        try {
          let currentConversation = [...conversation];
          let loopCount = 0;
          let isDone = false;

          // Khởi tạo Agentic Loop (Tối đa 3 bước: Suy nghĩ -> Gọi hàm -> Trả lời)
          while (loopCount < 3 && !isDone) {
            loopCount++;
            const result = await ai.models.generateContent({ 
              model: modelName, 
              contents: currentConversation,
              config: { 
                systemInstruction: getSystemPrompt(), // Lấy context mới nhất sau mỗi hành động
                tools: tools 
              }
            });
            
            if (result.functionCalls && result.functionCalls.length > 0) {
              const call = result.functionCalls[0];
              let functionResult: any = {};

              if (call.name === 'recordWaterIntake') {
                const { amount, factor, name } = call.args as any;
                const newTotal = await handleAddWater(amount, factor, name);
                functionResult = { success: true, message: `Đã cộng ${amount}ml (${name}). Nước hiện tại: ${newTotal}/${waterGoal}ml` };
              } else if (call.name === 'deleteLastWaterIntake') {
                if (waterEntriesRef.current.length > 0) {
                  const lastEntry = waterEntriesRef.current[waterEntriesRef.current.length - 1];
                  const newTotal = await handleDeleteEntry(lastEntry.id);
                  functionResult = { success: true, message: `Đã xóa ${lastEntry.actual_ml || lastEntry.amount}ml gần nhất. Nước còn lại: ${newTotal}ml.` };
                } else {
                  functionResult = { success: false, message: `Không có dữ liệu nước nào hôm nay để xóa.` };
                }
              } else if (call.name === 'navigateTab') {
                const { tabName } = call.args as any;
                if (['home', 'insight', 'league', 'feed', 'profile'].includes(tabName)) {
                  setActiveTab(tabName as TabType);
                  setTimeout(() => setShowAiChat(false), 1500);
                  functionResult = { success: true, message: `Đã chuyển đến trang ${tabName}` };
                } else {
                  functionResult = { success: false, message: `Trang ${tabName} không tồn tại` };
                }
              } else if (call.name === 'triggerSystemAction') {
                const { action } = call.args as any;
                if (action === 'export_pdf') {
                  handleExportPDF();
                  functionResult = { success: true, message: 'Đã yêu cầu xuất PDF.' };
                } else if (action === 'toggle_fasting') {
                  toggleFastingMode();
                  functionResult = { success: true, message: 'Đã đổi chế độ Fasting.' };
                } else if (action === 'open_history') {
                  setShowHistory(true);
                  functionResult = { success: true, message: 'Đã mở màn hình lịch sử uống nước.' };
                }
              }

              // Nạp lại kết quả vào cuộc hội thoại để AI đọc và phản hồi
              currentConversation.push({ role: 'model', parts: [{ functionCall: call }] });
              currentConversation.push({ role: 'user', parts: [{ functionResponse: { name: call.name, response: functionResult } }] });
              
              // Vòng lặp sẽ tiếp tục ở bước tiếp theo để lấy Text phản hồi từ AI
            } else if (result.text) { 
              advice = result.text; 
              isDone = true; 
            } else {
              isDone = true;
            }
          }
          if (advice) {
            break;
          }
        } catch (err) { lastErr = err; }
      }
      if (!advice) throw lastErr || new Error("Không nhận được phản hồi");

      setChatMessages(prev => [...prev, { role: 'assistant', content: advice }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Xin lỗi, hiện tại hệ thống AI đang quá tải. Vui lòng thử lại sau!" }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const updateReminderSetting = <K extends keyof HydrationReminderSettings>(
    key: K,
    value: HydrationReminderSettings[K],
  ) => {
    setReminderSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyReminderSettings = async () => {
    const validationError = validateHydrationReminderSettings(reminderSettings);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsApplyingReminderSettings(true);

    try {
      if (!supportsNativeHydrationReminders()) {
        toast.success('Đã lưu lịch nhắc. Hãy chạy bản Android/iOS để nhận thông báo nền.');
        return;
      }

      let granted = await checkHydrationReminderPermission();
      if (!granted && reminderSettings.enabled) {
        granted = await requestHydrationReminderPermission();
      }

      setIsReminderPermissionGranted(granted);

      if (reminderSettings.enabled && !granted) {
        throw new Error('Bạn cần cấp quyền thông báo để DigiWell nhắc uống nước.');
      }

      const result = await scheduleHydrationReminders(reminderSettings, {
        dailyGoal: waterGoal,
        nickname: profile?.nickname,
      });

      toast.success(
        result.scheduled
          ? `Đã lên lịch ${result.count} lời nhắc uống nước mỗi ngày!`
          : 'Đã tắt lịch nhắc uống nước định kỳ.',
      );
    } catch (err: any) {
      toast.error(err.message || 'Không thể cập nhật lịch nhắc uống nước.');
    } finally {
      setIsApplyingReminderSettings(false);
    }
  };

  const readPendingHydrationActions = (): PendingHydrationAction[] => {
    try {
      return JSON.parse(localStorage.getItem(PENDING_HYDRATION_ACTIONS_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const queuePendingHydrationAction = (action: PendingHydrationAction) => {
    const pending = readPendingHydrationActions();
    pending.push(action);
    localStorage.setItem(PENDING_HYDRATION_ACTIONS_KEY, JSON.stringify(pending.slice(-10)));
  };

  const clearPendingHydrationActions = () => {
    localStorage.removeItem(PENDING_HYDRATION_ACTIONS_KEY);
  };

  const handleSocialImagePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc HEIC.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh tối đa 5MB để upload nhanh hơn.');
      event.target.value = '';
      return;
    }

    if (socialImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(socialImagePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setSocialImageFile(file);
    setSocialImagePreview(previewUrl);
    setSocialComposer(prev => ({ ...prev, imageUrl: '' }));
    event.target.value = '';
  };

  const handleSearchSocialUsers = async (query: string) => {
    setSocialSearchQuery(query);
    await loadSocialDirectory(query);
  };

  const handleFollowUser = async (targetUserId: string, nickname: string) => {
    if (!profile?.id) return;

    const toastId = toast.loading(`Đang theo dõi ${nickname}...`);
    try {
      const { error } = await supabase!
        .from('social_follows')
        .insert({ follower_id: profile.id, following_id: targetUserId });
      if (error) throw error;

      setSocialFollowingIds(prev => prev.includes(targetUserId) ? prev : [...prev, targetUserId]);
      setSocialSearchResults(prev => prev.map(user => user.id === targetUserId ? { ...user, isFollowing: true } : user));
      setSocialProfileStats(prev => ({ ...prev, following: prev.following + 1 }));
      toast.success(`Đã theo dõi ${nickname}.`, { id: toastId });
      await refreshSocialFeed({ silent: true });
    } catch (err: any) {
      toast.error(getSocialErrorMessage(err.message), { id: toastId });
    }
  };

  const handleUnfollowUser = async (targetUserId: string, nickname: string) => {
    if (!profile?.id) return;

    const toastId = toast.loading(`Đang bỏ theo dõi ${nickname}...`);
    try {
      const { error } = await supabase!
        .from('social_follows')
        .delete()
        .eq('follower_id', profile.id)
        .eq('following_id', targetUserId);
      if (error) throw error;

      setSocialFollowingIds(prev => prev.filter(id => id !== targetUserId));
      setSocialSearchResults(prev => prev.map(user => user.id === targetUserId ? { ...user, isFollowing: false } : user));
      setSocialProfileStats(prev => ({ ...prev, following: Math.max(prev.following - 1, 0) }));
      toast.success(`Đã bỏ theo dõi ${nickname}.`, { id: toastId });
      await refreshSocialFeed({ silent: true });
    } catch (err: any) {
      toast.error(getSocialErrorMessage(err.message), { id: toastId });
    }
  };

  const handleToggleLikePost = async (post: SocialFeedPost) => {
    if (!profile?.id) return;

    const nextLiked = !post.likedByMe;
    const likeDelta = nextLiked ? 1 : -1;
    setSocialPosts(prev => prev.map(item => item.id === post.id ? {
      ...item,
      likedByMe: nextLiked,
      like_count: Math.max((item.like_count || 0) + likeDelta, 0),
    } : item));
    setSocialStories(prev => prev.map(item => item.id === post.id ? {
      ...item,
      likedByMe: nextLiked,
      like_count: Math.max((item.like_count || 0) + likeDelta, 0),
    } : item));

    try {
      if (nextLiked) {
        const { error } = await supabase!.from('social_post_likes').insert({
          post_id: post.id,
          user_id: profile.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase!.from('social_post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', profile.id);
        if (error) throw error;
      }

      const { error: countError } = await supabase!.from('social_posts')
        .update({ like_count: Math.max((post.like_count || 0) + likeDelta, 0) })
        .eq('id', post.id);
      if (countError) throw countError;
    } catch (err: any) {
      setSocialPosts(prev => prev.map(item => item.id === post.id ? post : item));
      setSocialStories(prev => prev.map(item => item.id === post.id ? post : item));
      toast.error(getSocialErrorMessage(err.message));
    }
  };

  const handlePublishSocialPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    const trimmedContent = socialComposer.content.trim();
    const trimmedImageUrl = socialComposer.imageUrl.trim();

    if (!trimmedContent && !trimmedImageUrl && !socialImageFile) {
      toast.error('Viết gì đó hoặc thêm ảnh trước khi đăng.');
      return;
    }

    setIsPublishingSocialPost(true);
    const toastId = toast.loading(socialComposer.postKind === 'story' ? 'Đang đăng story...' : 'Đang đăng bài...');

    try {
      let imageUrl = trimmedImageUrl || null;
      if (socialImageFile) {
        imageUrl = await uploadSocialImage(socialImageFile);
      }

      const expiresAt = socialComposer.postKind === 'story'
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error } = await supabase!.from('social_posts').insert({
        author_id: profile.id,
        content: trimmedContent,
        image_url: imageUrl,
        post_kind: socialComposer.postKind,
        visibility: socialComposer.visibility,
        hydration_ml: waterIntake,
        streak_snapshot: streak,
        expires_at: expiresAt,
      });
      if (error) throw error;

      toast.success(
        socialComposer.postKind === 'story' ? 'Story đã lên sóng 24 giờ.' : 'Bài đăng đã xuất hiện trên feed.',
        { id: toastId },
      );
      closeSocialComposer();
      await refreshSocialFeed({ silent: true });
    } catch (err: any) {
      toast.error(getSocialErrorMessage(err.message), { id: toastId });
    } finally {
      setIsPublishingSocialPost(false);
    }
  };

  const handleExportPDF = async () => {
    if (!isPremium) {
      setShowPremiumModal(true);
      return;
    }
    setIsExportingPDF(true);
    const tid = toast.loading("Đang tạo báo cáo Y khoa PDF...");
    
    try {
      // Load html2pdf dynamically
      const loadHtml2Pdf = async () => {
        if ((window as any).html2pdf) return (window as any).html2pdf;
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = () => resolve((window as any).html2pdf);
          script.onerror = reject;
          document.head.appendChild(script);
        });
      };

      const html2pdf = await loadHtml2Pdf() as any;
      
      // Tạo template HTML ẩn để in
      const reportDiv = document.createElement('div');
      reportDiv.innerHTML = `
        <div style="padding: 40px; font-family: sans-serif; color: #333; background: white;">
          <h1 style="color: #0ea5e9; text-align: center; margin-bottom: 5px;">BÁO CÁO SỨC KHỎE DIGIWELL</h1>
          <p style="text-align: center; color: #666; font-size: 14px;">Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} - Thu thập bởi DigiCoach AI</p>
          <hr style="margin: 20px 0; border: 1px solid #eee;" />
          <h2 style="color: #0f172a; font-size: 18px;">1. Thông tin cá nhân</h2>
          <ul style="line-height: 1.8;">
            <li><strong>Họ và tên:</strong> ${profile?.nickname || 'Khách'}</li>
            <li><strong>Thể trạng:</strong> ${profile?.age || '--'} tuổi, ${profile?.height || '--'} cm, ${profile?.weight || '--'} kg</li>
            <li><strong>Mục tiêu sức khỏe:</strong> ${profile?.goal || '--'}</li>
          </ul>
          <h2 style="color: #0f172a; font-size: 18px; margin-top: 30px;">2. Thống kê nước (Hôm nay)</h2>
          <ul style="line-height: 1.8;">
            <li><strong>Đã uống:</strong> ${waterIntake} ml / ${waterGoal} ml (Hoàn thành ${Math.round(progress)}%)</li>
            <li><strong>Chuỗi hiện tại:</strong> ${streak} ngày liên tiếp</li>
          </ul>
          <h2 style="color: #0f172a; font-size: 18px; margin-top: 30px;">3. Nhịp sinh học & Hoạt động</h2>
          <ul style="line-height: 1.8;">
            <li><strong>Mức độ vận động:</strong> ${profile?.activity || '--'}</li>
            <li><strong>Nhịp tim gần nhất:</strong> ${isWatchConnected ? watchData.heartRate + ' BPM' : 'Chưa đồng bộ'}</li>
            <li><strong>Số bước chân:</strong> ${isWatchConnected ? watchData.steps : 'Chưa đồng bộ'}</li>
          </ul>
          <p style="margin-top: 50px; text-align: center; font-style: italic; color: #999; font-size: 12px;">
            Tài liệu này được tạo tự động. Không dùng để thay thế chẩn đoán y tế chuyên sâu.
          </p>
        </div>
      `;

      // FIX BUG: Xóa lỗi cú pháp backslash (\`) cản trở biên dịch JS
      const opt = { margin: 1, filename: `DigiWell_Report_${new Date().toISOString().slice(0,10)}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
      await html2pdf().set(opt).from(reportDiv).save();
      
      toast.success("Đã tải xuống báo cáo PDF thành công!", { id: tid });
    } catch (error) {
      toast.error("Có lỗi xảy ra khi tạo PDF!", { id: tid });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const toggleFastingMode = () => {
    if (!isPremium) {
      setShowPremiumModal(true);
      return;
    }
    if (isFastingMode) {
      setIsFastingMode(false);
      setFastingStartTime(null);
      localStorage.removeItem('digiwell_fasting_start');
      toast.info("Đã tắt chế độ Nhịn ăn gián đoạn.");
    } else {
      setIsFastingMode(true);
      const t = Date.now();
      setFastingStartTime(t);
      localStorage.setItem('digiwell_fasting_start', t.toString());
      toast.success("Bật Fasting 16:8. Bắt đầu đếm giờ!");
    }
  };

  const openEditProfile = () => {
    if (profile) {
      setEditProfileData({
        nickname: profile.nickname || '', gender: profile.gender || 'Nam',
        age: profile.age || 20, height: profile.height || 170, weight: profile.weight || 60,
        activity: profile.activity || 'active', climate: profile.climate || 'Nhiệt đới (Nóng)', goal: profile.goal || 'Sức khỏe tổng quát'
      });
      setShowEditProfile(true);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setIsUpdatingProfile(true);
    const toastId = toast.loading("Đang cập nhật hồ sơ...");
    try {
      const { error } = await supabase!.from('profiles').update({
        nickname: editProfileData.nickname, gender: editProfileData.gender,
        age: editProfileData.age, height: editProfileData.height,
        weight: editProfileData.weight, activity: editProfileData.activity,
        climate: editProfileData.climate, goal: editProfileData.goal,
        updated_at: new Date().toISOString()
      }).eq('id', profile.id);
      if (error) throw error;
      setProfile({ ...profile, ...editProfileData }); // Cập nhật lại state frontend
      toast.success("Cập nhật hồ sơ thành công! ✅", { id: toastId });
      setShowEditProfile(false);
    } catch (err: any) {
      toast.error(err.message || "Lỗi cập nhật hồ sơ!", { id: toastId });
    } finally { setIsUpdatingProfile(false); }
  };

  const handleLogout = async () => {
    if (confirm("Xác nhận đăng xuất an toàn?")) {
      await supabase!.auth.signOut();
    }
  };

  const syncWeather = async () => {
    toast.info("Đang truy xuất vị trí và thời tiết...");
    
    if (!navigator.geolocation) {
      toast.error("Trình duyệt không hỗ trợ định vị GPS!");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const apiKey = import.meta.env.VITE_WEATHER_API_KEY || '9bc63ef84a50831427890f388bf72ffa';
        
        if (!apiKey) {
          toast.warning("Chưa có API Key, dùng dữ liệu giả lập!");
          setWeatherData({ temp: 34, location: 'Quận 1, HCM', status: 'Nắng gắt (Mock)' });
          setIsWeatherSynced(true);
          return;
        }

        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&lang=vi&appid=${apiKey}`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error("Chi tiết lỗi OpenWeather:", errorData);
          toast.warning("API Key chưa kích hoạt hoặc không hợp lệ. Đang dùng dữ liệu giả lập!");
          setWeatherData({ temp: 34, location: 'Khu vực của bạn', status: 'Nắng gắt (Mock)' });
          setIsWeatherSynced(true);
          return;
        }
        
        const data = await res.json();
        setWeatherData({ 
          temp: Math.round(data.main.temp), 
          location: data.name, 
          status: data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1)
        });
        
        setIsWeatherSynced(true);
        toast.success(data.main.temp > 30 ? `Trời nóng (${Math.round(data.main.temp)}°C)! Đã tăng mục tiêu nước.` : `Đã cập nhật thời tiết tại ${data.name}`);
      } catch (err: any) {
        toast.error("Không thể lấy thời tiết: " + err.message);
      }
    }, () => toast.error("Vui lòng cấp quyền vị trí để xem thời tiết!"));
  };

  const syncCalendar = async () => {
    toast.info("Đang kết nối Google Calendar...");
    
    try {
      // LƯU Ý: Để chạy được thật, bạn cần có Provider Token của Google.
      // Thường lấy từ Supabase Session nếu bạn cho người dùng Đăng nhập bằng Google.
      const googleAccessToken = localStorage.getItem('google_provider_token'); 

      if (!googleAccessToken) {
        if (confirm("Bạn chưa kết nối tài khoản Google. Bạn có muốn kết nối ngay để đồng bộ lịch không?")) {
          const tid = toast.loading("Đang chuyển trang... Vui lòng đăng nhập Google để cấp quyền đọc Lịch nhé!");
          
          setTimeout(async () => {
            try {
              // Thử dùng tính năng liên kết tài khoản của Supabase
              if (typeof supabase!.auth.linkIdentity === 'function') {
                const { data, error } = await supabase!.auth.linkIdentity({
                  provider: 'google',
                  options: { 
                    scopes: 'https://www.googleapis.com/auth/calendar.readonly', 
                    redirectTo: Capacitor.isNativePlatform() ? 'digiwell://login-callback' : window.location.origin,
                    skipBrowserRedirect: Capacitor.isNativePlatform() 
                  }
                });
                if (error) throw error;
                if (data?.url && Capacitor.isNativePlatform()) await Browser.open({ url: data.url });
              } else {
                const { data, error } = await supabase!.auth.signInWithOAuth({
                  provider: 'google',
                  options: { 
                    scopes: 'https://www.googleapis.com/auth/calendar.readonly', 
                    redirectTo: Capacitor.isNativePlatform() ? 'digiwell://login-callback' : window.location.origin,
                    skipBrowserRedirect: Capacitor.isNativePlatform()
                  }
                });
                if (error) throw error;
                if (data?.url && Capacitor.isNativePlatform()) await Browser.open({ url: data.url });
              }
            } catch (err: any) {
              toast.dismiss(tid);
              if (err.message?.includes('Manual linking is disabled')) {
                toast.error("Lỗi: Hãy vào Supabase Dashboard -> Authentication -> Advanced và bật 'Allow manual linking' nhé!");
              } else {
                toast.error("Lỗi chuyển hướng Google: " + (err.message || "Hãy kiểm tra lại cấu hình Provider trên Supabase!"));
              }
            }
          }, 1500);
        } else {
          toast.warning("Đang dùng dữ liệu lịch giả lập!");
          setTimeout(() => { 
            setIsCalendarSynced(true); 
            toast.success("Đã tải 2 sự kiện hôm nay (Mock)!"); 
          }, 1500);
        }
        return;
      }

      // Gọi API Google lấy lịch của ngày hôm nay
      const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);

      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}&singleEvents=true&orderBy=startTime`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });

      if (res.status === 401) {
        localStorage.removeItem('google_provider_token'); // Xóa token cũ đã hết hạn
        setIsCalendarSynced(false);
        throw new Error("Phiên bản Google đã hết hạn (1 giờ). Vui lòng bấm kết nối lại để cấp quyền mới!");
      }
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          localStorage.removeItem('google_provider_token'); // Xóa token thiếu quyền
          setIsCalendarSynced(false);
          throw new Error("Google từ chối! Bạn quên tích chọn ô cấp quyền Xem Lịch khi đăng nhập. Hãy kết nối lại nhé!");
        }
        throw new Error("Lỗi từ Google API: " + (errorData.error?.message || "Không rõ nguyên nhân"));
      }

      const data = await res.json();
      const mappedEvents = data.items.map((item: any) => {
        const startTime = new Date(item.start.dateTime || item.start.date);
        return {
          time: startTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          title: item.summary || 'Sự kiện không tên',
          location: item.location || 'Lịch Online'
        };
      });

      setCalendarEvents(mappedEvents.length > 0 ? mappedEvents : [{ time: '--:--', title: 'Trống lịch hôm nay', location: '-' }]);
      setIsCalendarSynced(true);
      toast.success(`Đã đồng bộ ${mappedEvents.length} sự kiện từ Google Calendar!`);
    } catch (err: any) {
      toast.error("Không thể đồng bộ lịch: " + err.message);
    }
  };

  const handleScan = () => {
    if (!geminiApiKey) return toast.error("Vui lòng cấu hình VITE_GEMINI_API_KEY!");
    fileInputRef.current?.click();
  };

  const processImageScan = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsScanning(true);
    const tid = toast.loading("AI đang phân tích hình ảnh...");
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const ai = createGeminiClient();
          
          const prompt = "Đây là hình ảnh một loại đồ uống. Hãy ước lượng dung tích và loại nước. Trả về ĐÚNG 1 dòng theo định dạng này: [Tên đồ uống] - [Dung tích dự đoán bằng số]ml. Ví dụ: Cà phê đen - 200ml. Nếu trong ảnh không có đồ uống, hãy trả về: Lỗi - Không nhận diện được.";
          
          const modelsToTry = await getGenerateContentModels(ai);
          let responseText = "";
          let lastErr = null;
          
          for (const modelName of modelsToTry) {
            try {
              const result = await ai.models.generateContent({
                model: modelName,
                contents: [ prompt, { inlineData: { data: base64Data, mimeType: file.type || 'image/jpeg' } } ]
              });
              responseText = result.text || "";
              break;
            } catch (e: any) { lastErr = e; }
          }
          
          if (!responseText) throw lastErr || new Error("Không có model nào khả dụng để phân tích ảnh!");
          if (responseText.includes("Lỗi")) throw new Error("Không nhận ra đồ uống trong ảnh!");
          
          const match = responseText.match(/(.*)\s*-\s*(\d+)\s*ml/i);
          if (match) {
            const name = match[1].trim();
            const amount = parseInt(match[2]);
            let factor = 1.0;
            if (name.toLowerCase().includes("cà phê") || name.toLowerCase().includes("coffee")) factor = 0.8;
            else if (name.toLowerCase().includes("bia") || name.toLowerCase().includes("rượu")) factor = -0.5;
            
            handleAddWater(amount, factor, `${name} (AI Scan)`);
            toast.success(`AI nhận diện: ${name} (${amount}ml)`, { id: tid });
          } else {
            throw new Error("Không thể dự đoán dung tích!");
          }
        } catch (err: any) {
          toast.error(getGeminiErrorMessage(err) || "Lỗi xử lý ảnh từ AI", { id: tid });
        } finally {
          setIsScanning(false);
        }
      };
    } catch (err: any) {
      toast.error(err.message, { id: tid });
      setIsScanning(false);
    }
    e.target.value = '';
  };

  // Lấy dữ liệu bảng xếp hạng tùy theo Mode
  const getLeagueData = () => {
    const myData = { name: profile?.nickname || 'Bạn', dept: 'Người dùng hệ thống', wp: calculateWP(waterIntake, waterGoal, streak), streak: streak, isMe: true };
    if (leagueMode === 'public') return [
      { name: 'Thầy Hùng', dept: 'Khoa Công nghệ thông tin', wp: 4600, streak: 7, isMe: false },
      { name: 'Tuấn Anh', dept: 'Ban Phong trào VLU', wp: 3400, streak: 4, isMe: false },
      myData,
      { name: 'Lan Phương', dept: 'Khoa Ngoại ngữ', wp: 1200, streak: 1, isMe: false }
    ];
    return [ ...friendsList, myData ];
  };

  const card = "bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl";
  const cardGlow = "bg-slate-800/60 backdrop-blur-sm border border-cyan-500/20 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.08)]";
  const currentRank = getRankInfo(calculateWP(waterIntake, waterGoal, streak));
  const completionPercent = Math.round(progress);
  const remainingWater = Math.max(waterGoal - waterIntake, 0);
  const activityLabelMap: Record<string, string> = {
    sedentary: 'Ít vận động',
    light: 'Vận động nhẹ',
    moderate: 'Vận động vừa',
    active: 'Năng động',
    hard: 'Cường độ cao',
    athlete: 'Vận động viên',
  };
  const activityLabel = activityLabelMap[profile?.activity || ''] || profile?.activity || '--';
  const connectedSystems = [
    { icon: CloudSun, label: 'Trạm thời tiết', sub: 'Đồng bộ tự động qua GPS', active: isWeatherSynced, action: syncWeather, activeColor: '#f97316', activeBg: 'rgba(249,115,22,0.2)', activeBorder: 'rgba(249,115,22,0.4)' },
    { icon: Calendar, label: 'Lịch trình thông minh', sub: 'Nhắc nhở theo agenda và giờ học', active: isCalendarSynced, action: syncCalendar, activeColor: '#818cf8', activeBg: 'rgba(99,102,241,0.2)', activeBorder: 'rgba(99,102,241,0.4)' },
    { icon: Watch, label: 'Watch / HealthKit', sub: 'Nhịp tim và bước chân thời gian thực', active: isWatchConnected, action: () => setIsWatchConnected(!isWatchConnected), activeColor: '#22d3ee', activeBg: 'rgba(6,182,212,0.2)', activeBorder: 'rgba(6,182,212,0.4)' },
  ];
  const connectedSystemsCount = connectedSystems.filter(item => item.active).length;
  const assistantFace = progress < 30 ? '(;-;)' : progress < 70 ? '(o_o)' : '(^o^)';
  const assistantStatus = progress < 30 ? 'Hydration thấp' : progress < 70 ? 'Đang ổn định' : 'Đang rất tốt';
  const assistantTone = progress < 30 ? 'text-red-400' : progress < 70 ? 'text-cyan-400' : 'text-emerald-400';
  const visibleDrinkPresets = drinkPresets.slice(0, 6);
  const primaryDrinkPreset = visibleDrinkPresets.find(preset => preset.name.toLowerCase().includes('nước')) || visibleDrinkPresets[0];
  const secondaryDrinkPresets = visibleDrinkPresets.filter(preset => preset.id !== primaryDrinkPreset?.id).slice(0, 4);

  // ==========================================================================
  // [GIAO DIỆN 1] WELCOME SCREEN
  // ==========================================================================
  if (view === 'welcome') return <WelcomeScreen onNavigate={(v) => setView(v)} />;

  // ==========================================================================
  // [GIAO DIỆN 2] LOGIN SCREEN
  // ==========================================================================
  if (view === 'login') return <LoginScreen onBack={() => setView('welcome')} initialEmail={loginPrefill} />;

  // ==========================================================================
  // [GIAO DIỆN 3] REGISTER SCREEN
  // ==========================================================================
  if (view === 'register') return <RegisterScreen onBack={() => setView('welcome')} onSuccess={(email) => { setLoginPrefill(email); setView('login'); }} />;

  // ==========================================================================
  // [GIAO DIỆN 4] MAIN DASHBOARD
  // ==========================================================================
  return (
    <div className="flex flex-col h-screen max-w-md mx-auto relative font-sans overflow-hidden" style={{ background: '#0f172a' }}>
      <Toaster position="top-center" theme="dark" richColors closeButton />
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={processImageScan} />

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-28">

        {/* ==================== HOME TAB ==================== */}
        {activeTab === 'home' && (
          <HomeTab
            profile={profile}
            nowText={nowText}
            hasPendingCloudSync={hasPendingCloudSync}
            waterIntake={waterIntake}
            waterGoal={waterGoal}
            remainingWater={remainingWater}
            progress={progress}
            completionPercent={completionPercent}
            streak={streak}
            assistantFace={assistantFace}
            assistantStatus={assistantStatus}
            assistantTone={assistantTone}
            primaryDrinkPreset={primaryDrinkPreset}
            secondaryDrinkPresets={secondaryDrinkPresets}
            drinkPresets={drinkPresets}
            isScanning={isScanning}
            handleAddWater={handleAddWater}
            handleScan={handleScan}
            handleLogout={handleLogout}
            setShowSmartHub={setShowSmartHub}
            setShowHistory={setShowHistory}
            openSocialComposer={openSocialComposer}
            setShowPresetManager={setShowPresetManager}
            setShowCustomDrink={setShowCustomDrink}
            customDrinkForm={customDrinkForm}
            setCustomDrinkForm={setCustomDrinkForm}
            setEditingPresets={setEditingPresets}
          />
        )}

        {/* ==================== INSIGHT TAB ==================== */}
        {activeTab === 'insight' && (
          <InsightTab
            isPremium={isPremium}
            setShowPremiumModal={setShowPremiumModal}
            isExportingPDF={isExportingPDF}
            handleExportPDF={handleExportPDF}
            waterIntake={waterIntake}
            waterGoal={waterGoal}
            weeklyChartData={weeklyHistory}
            progress={progress}
            streak={streak}
            isAiLoading={isAiLoading}
            aiAdvice={aiAdvice}
            fetchAIAdvice={fetchAIAdvice}
            setShowAiChat={setShowAiChat}
          />
        )}

        {/* ==================== LEAGUE TAB ==================== */}
        {activeTab === 'league' && (
          <LeagueTab
            leagueMode={leagueMode}
            setLeagueMode={setLeagueMode}
            setShowAddFriend={setShowAddFriend}
            getLeagueData={getLeagueData}
            getRankInfo={getRankInfo}
          />
        )}

        {/* ==================== FEED TAB ==================== */}
        {activeTab === 'feed' && (
          <FeedTab
            profile={profile}
            socialStories={socialStories}
            socialPosts={socialPosts}
            socialError={socialError}
            isSocialLoading={isSocialLoading}
            socialFollowingIds={socialFollowingIds}
            openSocialComposer={openSocialComposer}
            setShowSocialProfile={setShowSocialProfile}
            setShowDiscoverPeople={setShowDiscoverPeople}
            handleToggleLikePost={handleToggleLikePost}
          />
        )}

        {/* ==================== PROFILE TAB ==================== */}
        {activeTab === 'profile' && (
          <ProfileTab
            profile={profile}
            isPremium={isPremium}
            streak={streak}
            socialProfileStats={socialProfileStats}
            waterIntake={waterIntake}
            waterGoal={waterGoal}
            weeklyHistory={weeklyHistory}
            progress={progress}
            completionPercent={completionPercent}
            remainingWater={remainingWater}
            currentRank={currentRank}
            wp={calculateWP(waterIntake, waterGoal, streak)}
            setShowPremiumModal={setShowPremiumModal}
            setShowAddFriend={setShowAddFriend}
            setShowProfileSettings={setShowProfileSettings}
            setActiveTab={setActiveTab}
            handleLogout={handleLogout}
          />
        )}
      </div>

      {/* BOTTOM NAV */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* ===== HISTORY MODAL ===== */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setShowHistory(false)}>
          <div className="w-full max-w-md rounded-t-3xl p-6 pb-10" style={{ background: '#1e293b', border: '1px solid rgba(6,182,212,0.2)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest">Hôm nay</p>
                <h3 className="text-xl font-black text-white">Lịch sử uống nước</h3>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 text-xs bg-slate-700 px-3 py-1.5 rounded-lg font-bold">Đóng</button>
            </div>

            {waterEntries.length === 0 ? (
              <div className="text-center py-10">
                <Droplet size={36} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Chưa có ghi nhận nào hôm nay</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {[...waterEntries].reverse().map((entry) => {
                  const t = new Date(entry.timestamp);
                  const timeStr = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(t);
                  return (
                    <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.12)' }}>
                      <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                        <Droplet size={16} className="text-cyan-400" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold text-sm ${(entry.actual_ml !== undefined && entry.actual_ml < 0) ? 'text-red-400' : 'text-white'}`}>
                          {(entry.actual_ml !== undefined && entry.actual_ml < 0) ? '' : '+'}{entry.actual_ml || entry.amount} ml
                        </p>
                        <p className="text-slate-400 text-[10px] line-clamp-1 truncate pr-2">
                          {timeStr} · {entry.name || 'Nước lọc'}
                        </p>
                      </div>
                      <button onClick={() => { setEditingEntry(entry); setEditAmount(entry.amount.toString()); setShowHistory(false); }}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 mr-1">
                        Sửa
                      </button>
                      <button onClick={() => handleDeleteEntry(entry.id)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-red-400 border border-red-500/30 bg-red-500/10">
                        Xóa
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
              <p className="text-slate-400 text-xs">{waterEntries.length} lần · Tổng cộng</p>
              <p className="text-cyan-400 font-black">{waterIntake} ml</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== EDIT MODAL ===== */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => { setEditingEntry(null); setEditAmount(''); }}>
          <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: '#1e293b', border: '1px solid rgba(6,182,212,0.2)' }} onClick={e => e.stopPropagation()}>
            <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-1">Chỉnh sửa</p>
            <h3 className="text-xl font-black text-white mb-5">Cập nhật ghi nhận</h3>
            <div className="mb-4">
              <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 block">Lượng nước (ml)</label>
              <input
                type="number"
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                className="w-full p-4 rounded-xl bg-slate-900 border border-slate-700 text-white text-lg font-bold outline-none focus:border-cyan-500"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setEditingEntry(null); setEditAmount(''); }}
                className="flex-1 py-3 rounded-xl text-slate-400 font-bold text-sm border border-slate-700 bg-slate-800">
                Huỷ
              </button>
              <button onClick={handleEditEntry}
                className="flex-1 py-3 rounded-xl font-bold text-slate-900 text-sm"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)' }}>
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SMART HUB MODAL (Gom các tính năng phụ) ===== */}
      {showSmartHub && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setShowSmartHub(false)}>
          <div className="w-full max-w-md rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto" style={{ background: '#1e293b', border: '1px solid rgba(6,182,212,0.2)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-black text-white">Tiện ích</h3>
              </div>
              <button onClick={() => setShowSmartHub(false)} className="text-slate-400 text-xs bg-slate-700 px-3 py-1.5 rounded-lg font-bold">Đóng</button>
            </div>

            <div className="space-y-4">
              {/* Widget Nhắc uống nước */}
              <div className={`${card} p-5 border-l-4 ${reminderSettings.enabled ? 'border-l-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.1)]' : 'border-l-slate-700'}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${reminderSettings.enabled ? 'bg-cyan-500/15 border-cyan-500/30' : 'bg-slate-800 border-slate-700'}`}>
                    <Bell size={20} className={reminderSettings.enabled ? 'text-cyan-400' : 'text-slate-500'} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white text-base font-bold">Nhắc uống nước</p>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${reminderSettings.enabled ? 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' : 'text-slate-500 border-slate-700 bg-slate-800'}`}>
                        {reminderSettings.enabled ? 'Đang bật' : 'Đang tắt'}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${isReminderPermissionGranted ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-300 border-amber-500/30 bg-amber-500/10'}`}>
                        {isReminderPermissionGranted ? 'Có quyền thông báo' : 'Chưa cấp quyền'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => updateReminderSetting('enabled', !reminderSettings.enabled)}
                    className={`w-10 h-6 rounded-full p-1 transition-colors ${reminderSettings.enabled ? 'bg-cyan-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${reminderSettings.enabled ? 'translate-x-4' : ''}`} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1.5 block">Bắt đầu</label>
                    <input
                      type="time"
                      value={reminderSettings.startTime}
                      onChange={e => updateReminderSetting('startTime', e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1.5 block">Kết thúc</label>
                    <input
                      type="time"
                      value={reminderSettings.endTime}
                      onChange={e => updateReminderSetting('endTime', e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1.5 block">Tần suất nhắc</label>
                  <select
                    value={reminderSettings.intervalMinutes}
                    onChange={e => updateReminderSetting('intervalMinutes', Number(e.target.value))}
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500"
                  >
                    <option value={45}>Mỗi 45 phút</option>
                    <option value={60}>Mỗi 60 phút</option>
                    <option value={90}>Mỗi 90 phút</option>
                    <option value={120}>Mỗi 2 giờ</option>
                    <option value={180}>Mỗi 3 giờ</option>
                  </select>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-700">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Preview</p>
                  <p className="text-sm text-slate-300">{reminderPreview}</p>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleApplyReminderSettings}
                    disabled={isApplyingReminderSettings}
                    className="flex-1 py-3 rounded-xl font-bold text-slate-900 text-sm disabled:opacity-50 active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)' }}
                  >
                    {isApplyingReminderSettings ? 'Đang cập nhật...' : reminderSettings.enabled ? 'Lưu & kích hoạt' : 'Lưu & tắt nhắc'}
                  </button>
                </div>
              </div>

              {/* Widget Thời tiết */}
              {isWeatherSynced && (
                <div className={`${card} p-4 flex items-center gap-3`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}>
                    <CloudSun size={18} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold">{weatherData.location} · {weatherData.temp}°C</p>
                    <p className="text-slate-400 text-xs">{weatherData.status} · +500ml mục tiêu để bù nhiệt</p>
                  </div>
                  <button onClick={syncWeather}><RefreshCw size={14} className="text-slate-500" /></button>
                </div>
              )}

              {/* Widget Lịch trình */}
              {isCalendarSynced && (
                <div className="p-4 rounded-2xl flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                  <Bell size={18} className="text-white flex-shrink-0" />
                  <div>
                    <p className="text-white text-sm font-bold">{calendarEvents[0]?.title || 'Không có sự kiện'}</p>
                    <p className="text-indigo-200 text-xs">{calendarEvents[0]?.time || '--:--'} · Nhớ uống nước trước khi bắt đầu nhé!</p>
                  </div>
                </div>
              )}

              {/* Widget Apple Watch */}
              {isWatchConnected && (
                <div className={`${card} p-4 flex items-center gap-4`}>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                    <Watch size={18} className="text-blue-400" />
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase tracking-wider">Nhịp tim Live</p>
                      <p className="text-white font-bold text-lg">{watchData.heartRate} <span className="text-slate-500 text-xs font-normal">BPM</span></p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase tracking-wider">Bước đi Live</p>
                      <p className="text-white font-bold text-lg">{watchData.steps} <span className="text-slate-500 text-xs font-normal">steps</span></p>
                    </div>
                  </div>
                  <Bluetooth size={14} className="text-blue-400 ml-auto animate-pulse" />
                </div>
              )}

              {/* AUTO-DETECT ACTIVITY CARD */}
              <AutoActivityCard
                isWatchConnected={isWatchConnected}
                isCalendarSynced={isCalendarSynced}
                watchData={watchData}
                calendarEvents={calendarEvents}
                currentActivity={currentActivity}
                setCurrentActivity={setCurrentActivity}
              />

              {/* Eye rest */}
              <button onClick={() => toast.success("Đã bật chế độ bảo vệ mắt. Hệ thống sẽ nhắc bạn nhìn xa 6 mét trong 20 giây mỗi 20 phút.")} className={`${card} w-full p-5 flex items-center gap-4 active:scale-95 transition-all text-left border-l-4 border-l-violet-500`}>
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                  <Eye size={20} className="text-violet-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white text-base font-bold">Chế độ 20-20-20</p>
                </div>
                <ShieldCheck size={20} className="text-slate-600" />
              </button>

              {/* Fasting Mode (Premium) */}
              <div className={`${card} w-full p-5 flex flex-col gap-4 border-l-4 ${isFastingMode ? 'border-l-amber-500 bg-amber-500/10' : 'border-l-amber-500/30'}`}>
                <div className="flex items-center gap-4 cursor-pointer" onClick={toggleFastingMode}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isFastingMode ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-slate-800 border border-slate-700'}`}>
                    <Coffee size={20} className={isFastingMode ? "text-amber-400" : "text-slate-500"} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-base font-bold ${isFastingMode ? 'text-amber-400' : 'text-white'}`}>Fasting Tracker</p>
                      {!isPremium && <Lock size={12} className="text-amber-500" />}
                    </div>
                    <p className="text-slate-400 text-[10px] mt-1">Chế độ 16:8</p>
                  </div>
                  <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isFastingMode ? 'bg-amber-500' : 'bg-slate-700'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isFastingMode ? 'translate-x-4' : ''}`} />
                  </div>
                </div>
                {isFastingMode && (
                  <div className="pt-3 border-t border-amber-500/20 flex items-center justify-between">
                    <div>
                      <p className="text-amber-200/70 text-[10px] uppercase tracking-widest font-bold">Thời gian còn lại</p>
                      <p className="text-amber-400 text-xl font-black font-mono mt-1">
                        {String(fastingHours).padStart(2, '0')}:{String(fastingMinutes).padStart(2, '0')}:{String(fastingSeconds).padStart(2, '0')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-200/70 text-[10px] uppercase tracking-widest font-bold">Trạng thái</p>
                      <p className="text-amber-300 text-sm font-bold mt-1">
                        {fastingRemaining === 0 ? "Hoàn thành!" : "Đang đốt mỡ"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== CUSTOM DRINK MODAL ===== */}
      {showCustomDrink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setShowCustomDrink(false)}>
          <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: '#1e293b', border: '1px solid rgba(6,182,212,0.2)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black text-white mb-5">Thêm đồ uống khác</h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 block">Tên đồ uống</label>
                <input type="text" value={customDrinkForm.name} onChange={e => setCustomDrinkForm({...customDrinkForm, name: e.target.value})} className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500" placeholder="VD: Trà đào, Nước dừa..." />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 block">Dung tích (ml)</label>
                <input type="number" value={customDrinkForm.amount} onChange={e => setCustomDrinkForm({...customDrinkForm, amount: e.target.value})} className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 block">Nhóm chất lỏng (BHI)</label>
                <select value={customDrinkForm.factor} onChange={e => setCustomDrinkForm({...customDrinkForm, factor: Number(e.target.value)})} className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500">
                  <option value={1.0}>Nước lọc / Nước trái cây (100%)</option>
                  <option value={1.1}>Nước bù khoáng / Sữa (110%)</option>
                  <option value={0.8}>Cà phê / Trà đậm (80%)</option>
                  <option value={-0.5}>Rượu / Bia / Cồn (-50%)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowCustomDrink(false)} className="flex-1 py-3 rounded-xl text-slate-400 font-bold text-sm border border-slate-700 bg-slate-800">Huỷ</button>
              <button onClick={() => {
                const amt = Number(customDrinkForm.amount) || 0;
                if (amt <= 0) return toast.error("Dung tích không hợp lệ!");
                handleAddWater(amt, customDrinkForm.factor, customDrinkForm.name || 'Đồ uống tùy chỉnh');
                setShowCustomDrink(false);
              }} className="flex-1 py-3 rounded-xl font-bold text-slate-900 text-sm" style={{ background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)' }}>Thêm ngay</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PRESET MANAGER MODAL ===== */}
      {showPresetManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setShowPresetManager(false)}>
          <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: '#1e293b', border: '1px solid rgba(6,182,212,0.2)' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-xl font-black text-white">Menu đồ uống</h3>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setEditingPresets([...editingPresets, { id: Date.now().toString(), name: 'Đồ uống mới', amount: 200, factor: 1.0, icon: 'Droplet', color: 'cyan' }])} className="text-cyan-400 bg-cyan-500/10 p-1.5 rounded-lg border border-cyan-500/20 active:scale-95 transition-all"><Plus size={18} /></button>
                <button onClick={() => setShowPresetManager(false)} className="text-slate-400 hover:text-white"><X size={22} /></button>
              </div>
            </div>

            <div className="space-y-3 mb-6 max-h-[55vh] overflow-y-auto pr-1">
              {editingPresets.map((p, idx) => (
                <div key={p.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 space-y-3">
                  <div className="flex items-center gap-3">
                    {renderIcon(p.icon, { size: 18, className: presetStyles[p.color as keyof typeof presetStyles]?.text || 'text-cyan-400' })}
                    <input type="text" value={p.name} onChange={e => handleUpdatePreset(idx, 'name', e.target.value)} className="flex-1 bg-transparent border-b border-slate-700 text-white text-sm font-bold outline-none focus:border-cyan-500 pb-1" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 uppercase mb-1 block font-semibold">Dung tích (ml)</label>
                      <input type="number" value={p.amount} onChange={e => handleUpdatePreset(idx, 'amount', Number(e.target.value))} className="w-full bg-slate-800 p-2.5 rounded-lg text-white text-xs border border-slate-700 outline-none focus:border-cyan-500" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 uppercase mb-1 block font-semibold">Hệ số BHI</label>
                      <select value={p.factor} onChange={e => handleUpdatePreset(idx, 'factor', Number(e.target.value))} className="w-full bg-slate-800 p-2.5 rounded-lg text-white text-xs border border-slate-700 outline-none focus:border-cyan-500">
                        <option value={1.0}>Nước (100%)</option>
                        <option value={1.1}>Bù khoáng (110%)</option>
                        <option value={0.8}>Cà phê (80%)</option>
                        <option value={-0.5}>Cồn (-50%)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowPresetManager(false)} className="flex-1 py-3 rounded-xl text-slate-400 font-bold text-sm border border-slate-700 bg-slate-800 active:scale-95 transition-all">Huỷ</button>
              <button onClick={savePresets} className="flex-1 py-3 rounded-xl font-bold text-slate-900 text-sm active:scale-95 transition-all" style={{ background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)' }}>Lưu cấu hình</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ONBOARDING MODAL (HƯỚNG DẪN TÂN THỦ) ===== */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-slate-900/90 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[2rem] p-8 text-center relative overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)]" style={{ background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(6,182,212,0.3)' }}>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl"></div>
            
            {onboardingStep === 1 && (
              <div className="animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 mx-auto bg-cyan-500/20 border-2 border-cyan-500/50 rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                  <span className="text-4xl font-black text-white">(^o^)</span>
                </div>
                <h3 className="text-2xl font-black text-white mb-3">Holo-Pet</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">Nhắc bạn uống nước mỗi ngày.</p>
              </div>
            )}
            {onboardingStep === 2 && (
              <div className="animate-in fade-in slide-in-from-right duration-500">
                <div className="w-20 h-20 mx-auto bg-orange-500/20 border-2 border-orange-500/50 rounded-3xl flex items-center justify-center mb-6"><Coffee size={32} className="text-orange-400" /></div>
                <h3 className="text-2xl font-black text-white mb-3">Đồ uống</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">Mỗi loại đồ uống có hệ số khác nhau.</p>
              </div>
            )}
            {onboardingStep === 3 && (
              <div className="animate-in fade-in slide-in-from-right duration-500">
                <div className="w-20 h-20 mx-auto bg-emerald-500/20 border-2 border-emerald-500/50 rounded-3xl flex items-center justify-center mb-6"><Sparkles size={32} className="text-emerald-400" /></div>
                <h3 className="text-2xl font-black text-white mb-3">Tiện ích</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">Mở góc phải màn hình để xem kết nối và lời nhắc.</p>
              </div>
            )}

            <button onClick={() => { if (onboardingStep < 3) setOnboardingStep(onboardingStep + 1); else { localStorage.setItem(`digiwell_onboarded_${profile?.id}`, 'true'); setShowOnboarding(false); toast.success("Đã hoàn tất thiết lập!"); } }} className="w-full py-4 rounded-xl font-bold text-slate-900 text-sm active:scale-95 transition-all shadow-lg" style={{ background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)' }}>
              {onboardingStep < 3 ? 'Tiếp tục' : 'Bắt đầu'}
            </button>
            <div className="flex justify-center gap-2 mt-6">{[1, 2, 3].map(i => (<div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${onboardingStep === i ? 'bg-cyan-400 w-6' : 'bg-slate-700'}`} />))}</div>
          </div>
        </div>
      )}

      {/* ===== SOCIAL PROFILE PAGE ===== */}
      {showSocialProfile && (
        <div className="fixed inset-0 z-[80] flex justify-center" style={{ background: '#0f172a' }}>
          <div className="w-full max-w-md min-h-screen overflow-y-auto scrollbar-hide">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 pt-6 pb-4 border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Feed</p>
                <h3 className="text-2xl font-black text-white mt-1">Hồ sơ mạng xã hội</h3>
              </div>
              <button onClick={() => setShowSocialProfile(false)} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:text-white transition-all active:scale-95">
                Đóng
              </button>
            </div>

            <div className="px-5 pt-5 pb-10">
            <div className={`${cardGlow} overflow-hidden`}>
              <div className="relative p-6">
                <div className="absolute -top-10 -right-8 w-28 h-28 rounded-full blur-3xl bg-cyan-500/15 pointer-events-none" />
                <div className="absolute -bottom-12 -left-10 w-32 h-32 rounded-full blur-3xl bg-indigo-500/10 pointer-events-none" />
                <div className="relative flex items-start gap-4">
                  <div className="w-20 h-20 rounded-[1.75rem] flex items-center justify-center flex-shrink-0 shadow-lg" style={{ background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)' }}>
                    <span className="text-4xl font-black text-slate-900">{(profile?.nickname || 'U').charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-2xl font-black text-white truncate">{profile?.nickname || 'Khách'}</h3>
                      <div
                        className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 ${currentRank.bg} ${currentRank.border}`}
                        title={currentRank.name}
                      >
                        <Trophy size={14} className={currentRank.color} />
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap mt-4">
                      <div className="px-3 py-2 rounded-xl bg-slate-950/35 border border-white/10 text-cyan-200 text-[11px] font-bold">
                        {waterIntake}/{waterGoal}ml hôm nay
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-slate-950/35 border border-white/10 text-orange-200 text-[11px] font-bold">
                        Streak {streak} ngày
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {socialError ? (
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-amber-300 text-xs font-bold uppercase tracking-widest mb-2">Thiết lập</p>
                <p className="text-slate-200 text-sm leading-relaxed">{socialError}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: 'Follower', value: socialProfileStats.followers, color: 'text-cyan-300' },
                    { label: 'Đang follow', value: socialProfileStats.following, color: 'text-emerald-300' },
                    { label: 'Bài viết', value: socialProfileStats.posts, color: 'text-amber-300' },
                  ].map(item => (
                    <div key={item.label} className={`${card} p-4`}>
                      <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">{item.label}</p>
                      <p className={`mt-2 text-xl font-black ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={() => {
                      setShowSocialProfile(false);
                      openSocialComposer('progress');
                    }}
                    className="py-3 rounded-xl bg-indigo-500/12 border border-indigo-500/25 text-indigo-300 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Share2 size={14} /> Share progress
                  </button>
                  <button
                    onClick={() => {
                      setShowSocialProfile(false);
                      openSocialComposer('status');
                    }}
                    className="py-3 rounded-xl bg-cyan-500/12 border border-cyan-500/25 text-cyan-300 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Edit2 size={14} /> Tạo bài
                  </button>
                  <button
                    onClick={() => {
                      setShowSocialProfile(false);
                      setShowDiscoverPeople(true);
                    }}
                    className="py-3 rounded-xl bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Users size={14} /> Khám phá
                  </button>
                  <button
                    onClick={() => {
                      setShowSocialProfile(false);
                      openSocialComposer('story');
                    }}
                    className="py-3 rounded-xl bg-fuchsia-500/12 border border-fuchsia-500/25 text-fuchsia-300 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Plus size={14} /> Đăng story
                  </button>
                </div>

                <div className={`${card} p-5 mt-4`}>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Tổng quan</p>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 px-4 py-3">
                      <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Tiến độ hôm nay</p>
                      <p className="mt-2 text-xl font-black text-cyan-300">{completionPercent}%</p>
                    </div>
                    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 px-4 py-3">
                      <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Còn thiếu</p>
                      <p className="mt-2 text-xl font-black text-orange-300">{remainingWater} ml</p>
                    </div>
                  </div>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ===== SOCIAL DISCOVER MODAL ===== */}
      {showDiscoverPeople && (
        <div className="fixed inset-0 z-[90] flex justify-center" style={{ background: '#0f172a' }}>
          <div className="w-full max-w-md min-h-screen overflow-y-auto scrollbar-hide">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 pt-6 pb-4 border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Feed</p>
                <h3 className="text-2xl font-black text-white mt-1">Khám phá</h3>
              </div>
              <button onClick={() => setShowDiscoverPeople(false)} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:text-white transition-all active:scale-95">
                Đóng
              </button>
            </div>

            <div className="px-5 pt-5 pb-10">
            <div className="relative mb-5">
              <input
                type="text"
                value={socialSearchQuery}
                onChange={e => void handleSearchSocialUsers(e.target.value)}
                placeholder="Tìm theo nickname..."
                className="w-full h-12 pl-11 pr-4 rounded-2xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500"
              />
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>

            {isSocialSearching ? (
              <div className={`${card} p-8 text-center`}>
                <RefreshCw size={26} className="text-emerald-400 mx-auto mb-4 animate-spin" />
                <p className="text-white font-semibold">Đang tìm profile...</p>
              </div>
            ) : socialSearchResults.length > 0 ? (
              <div className="space-y-3">
                {socialSearchResults.map(user => (
                  <div key={user.id} className="rounded-[1.5rem] border border-slate-700 bg-slate-800/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-inner" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                          {(user.nickname || 'D').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-bold truncate">{user.nickname}</p>
                          <p className="text-slate-500 text-[11px] mt-1">Người dùng DigiWell</p>
                        </div>
                      </div>

                      {user.isFollowing ? (
                        <button onClick={() => void handleUnfollowUser(user.id, user.nickname)} className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-600 text-slate-200 text-[11px] font-bold flex items-center gap-2 active:scale-95 transition-all">
                          <UserMinus size={14} /> Bỏ follow
                        </button>
                      ) : (
                        <button onClick={() => void handleFollowUser(user.id, user.nickname)} className="px-4 py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-2 active:scale-95 transition-all">
                          <UserPlus size={14} /> Follow
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`${card} p-8 text-center`}>
                <Users size={34} className="text-slate-600 mx-auto mb-3" />
                <p className="text-white text-sm font-semibold mb-1">Chưa có kết quả phù hợp</p>
                <p className="text-slate-400 text-xs">
                  {socialSearchQuery.trim().length >= 2
                    ? 'Thử nickname ngắn hơn hoặc gần giống hơn.'
                    : 'Nhập nickname để follow và xây network của riêng bạn.'}
                </p>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ===== SOCIAL COMPOSER MODAL ===== */}
      {showSocialComposer && (
        <div className="fixed inset-0 z-[95] flex justify-center" style={{ background: '#0f172a' }}>
          <div className="w-full max-w-md min-h-screen overflow-y-auto scrollbar-hide">
            <form onSubmit={handlePublishSocialPost}>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 pt-6 pb-4 border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
                <button type="button" onClick={closeSocialComposer} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:text-white transition-all active:scale-95">
                  Hủy
                </button>
                <div className="text-center min-w-0">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Composer</p>
                  <h3 className="text-xl font-black text-white truncate mt-1">{socialComposer.postKind === 'story' ? 'Đăng story' : 'Tạo bài viết'}</h3>
                </div>
                <button type="submit" disabled={isPublishingSocialPost} className="px-4 py-2 rounded-xl text-slate-950 text-xs font-black disabled:opacity-60 active:scale-95 transition-all" style={{ background: 'linear-gradient(135deg, #22d3ee, #06b6d4)' }}>
                  {isPublishingSocialPost ? 'Đang đăng' : 'Đăng'}
                </button>
              </div>

              <div className="px-5 pt-5 pb-10 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Bài viết', value: 'status' as const },
                  { label: 'Tiến độ', value: 'progress' as const },
                  { label: 'Story', value: 'story' as const },
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSocialComposer(prev => ({ ...prev, postKind: option.value, visibility: option.value === 'story' ? 'followers' : prev.visibility }))}
                    className={`py-3 rounded-2xl text-[11px] font-bold border transition-all ${socialComposer.postKind === option.value ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className={`${card} p-4`}>
                <textarea
                  value={socialComposer.content}
                  onChange={e => setSocialComposer(prev => ({ ...prev, content: e.target.value }))}
                  rows={6}
                  placeholder={socialComposer.postKind === 'story' ? 'Viết caption ngắn cho story 24h...' : 'Hôm nay bạn muốn chia sẻ gì với community?'}
                  className="w-full rounded-2xl bg-slate-900 border border-slate-700 text-white text-sm p-4 outline-none focus:border-cyan-500 resize-none"
                />

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button type="button" onClick={() => setSocialComposer(prev => ({ ...prev, content: buildProgressShareText({ nickname: profile?.nickname, waterIntake, waterGoal, streak }), postKind: 'progress' }))} className="py-3 rounded-xl bg-indigo-500/12 border border-indigo-500/25 text-indigo-300 text-xs font-bold active:scale-95 transition-all">
                    Dùng progress card
                  </button>
                  <select
                    value={socialComposer.visibility}
                    onChange={e => setSocialComposer(prev => ({ ...prev, visibility: e.target.value as SocialComposerState['visibility'] }))}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 text-white text-xs px-3 outline-none focus:border-cyan-500"
                  >
                    <option value="public">Công khai</option>
                    <option value="followers">Chỉ follower</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 rounded-[1.5rem] border border-slate-700 bg-slate-900/60 p-4">
                <div className="flex gap-3">
                  <button type="button" onClick={() => socialImageInputRef.current?.click()} className="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                    <ImagePlus size={14} /> Upload ảnh
                  </button>
                  <button type="button" onClick={() => { setSocialImageFile(null); if (socialImagePreview.startsWith('blob:')) URL.revokeObjectURL(socialImagePreview); setSocialImagePreview(''); setSocialComposer(prev => ({ ...prev, imageUrl: '' })); }} className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold active:scale-95 transition-all">
                    Xóa ảnh
                  </button>
                </div>

                <input
                  ref={socialImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSocialImagePicked}
                  className="hidden"
                />

                <input
                  type="url"
                  value={socialComposer.imageUrl}
                  onChange={e => setSocialComposer(prev => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="Hoặc dán link ảnh công khai..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 text-white text-xs px-3 py-3 outline-none focus:border-cyan-500"
                />

                {(socialImagePreview || socialComposer.imageUrl.trim()) && (
                  <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                    <img src={socialImagePreview || socialComposer.imageUrl.trim()} alt="Xem trước ảnh bài viết" className="w-full h-48 object-cover" />
                  </div>
                )}

                {socialImageFile && (
                  <p className="text-slate-400 text-[11px]">File đã chọn: {socialImageFile.name}</p>
                )}
              </div>

              <div className="rounded-[1.5rem] border border-cyan-500/15 bg-cyan-500/5 p-4">
                <p className="text-cyan-300 text-[10px] font-bold uppercase tracking-widest mb-2">Snapshot khi đăng</p>
                <div className="flex gap-2 flex-wrap">
                  <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-[11px] text-cyan-300 font-semibold">{waterIntake}/{waterGoal}ml</div>
                  <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-[11px] text-orange-300 font-semibold">Streak {streak} ngày</div>
                </div>
              </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== ADD FRIEND MODAL ===== */}
      {showAddFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowAddFriend(false); setSearchQuery(''); setSearchResults([]); }}>
          <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: '#1e293b', border: '1px solid rgba(16,185,129,0.3)' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-xl font-black text-white">Thêm bạn bè</h3>
              </div>
              <button onClick={() => { setShowAddFriend(false); setSearchQuery(''); setSearchResults([]); }} className="text-slate-400 hover:text-white"><X size={22} /></button>
            </div>
            
            <div className="relative mb-6">
              <input type="text" value={searchQuery} onChange={e => handleSearchUser(e.target.value)} placeholder="Nhập nickname cần tìm..." className="w-full p-3.5 pl-10 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500" />
              <Search size={16} className="absolute left-3.5 top-4 text-slate-500" />
            </div>

            {isSearching ? (
              <p className="text-center text-slate-400 text-sm py-4">Đang tìm kiếm...</p>
            ) : searchResults.length > 0 ? (
              <div className="space-y-3 mb-6">
                {searchResults.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        {(user.nickname || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">{user.nickname || 'Người dùng'}</p>
                        <p className="text-slate-400 text-[10px]">Người dùng DigiWell</p>
                      </div>
                    </div>
                    <button onClick={() => handleAddFriend(user.id, user.nickname)} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold active:scale-95 transition-all">
                      Kết bạn
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Users size={32} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">{searchQuery.length > 2 ? 'Không tìm thấy người dùng này' : 'Tìm kiếm bằng nickname để cùng đua top'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== PROFILE SETTINGS PAGE ===== */}
      {showProfileSettings && (
        <div className="fixed inset-0 z-[80] flex justify-center" style={{ background: '#0f172a' }}>
          <div className="w-full max-w-md min-h-screen px-5 pt-6 pb-10 overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Profile</p>
                <h3 className="text-2xl font-black text-white mt-1">Cài đặt</h3>
              </div>
              <button onClick={() => setShowProfileSettings(false)} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:text-white transition-all active:scale-95">
                Đóng
              </button>
            </div>

            <div className="rounded-[2rem] border border-slate-700/70 bg-slate-900/65 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Tài khoản</p>
                  <h4 className="text-white text-xl font-black mt-2">{profile?.nickname || 'Khách'}</h4>
                  <p className="text-slate-400 text-sm mt-1">{profile?.goal?.split('&')[0]?.trim() || 'Sức khỏe tổng quát'}</p>
                </div>
                <button onClick={() => { setShowProfileSettings(false); openEditProfile(); }} className="px-4 py-2 rounded-xl bg-cyan-500/12 border border-cyan-500/25 text-cyan-300 text-xs font-bold flex items-center gap-2 active:scale-95 transition-all">
                  <Edit2 size={14} /> Chỉnh sửa
                </button>
              </div>
            </div>

            <div className="space-y-4 mt-4">
              <div className={`${card} p-5`}>
                <h4 className="text-white text-lg font-black mb-4">Thông tin cá nhân</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Giới tính', value: profile?.gender || '--' },
                    { label: 'Tuổi', value: profile?.age ? `${profile.age}` : '--' },
                    { label: 'Chiều cao', value: profile?.height ? `${profile.height} cm` : '--' },
                    { label: 'Cân nặng', value: profile?.weight ? `${profile.weight} kg` : '--' },
                  ].map(item => (
                    <div key={item.label} className="rounded-2xl border border-slate-700/60 bg-slate-900/50 px-4 py-3">
                      <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">{item.label}</p>
                      <p className="text-white text-sm font-bold mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${card} p-5`}>
                <h4 className="text-white text-lg font-black mb-4">Thiết lập nước</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Mục tiêu nước', value: `${waterGoal} ml`, tone: 'text-cyan-300' },
                    { label: 'Mức vận động', value: activityLabel, tone: 'text-emerald-300' },
                    { label: 'Khí hậu', value: profile?.climate || '--', tone: 'text-slate-100' },
                    { label: 'Lộ trình', value: profile?.goal?.split('&')[0]?.trim() || '--', tone: 'text-amber-300' },
                  ].map(item => (
                    <div key={item.label} className="rounded-2xl border border-slate-700/60 bg-slate-900/50 px-4 py-3">
                      <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">{item.label}</p>
                      <p className={`text-sm font-bold mt-1 ${item.tone}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${card} p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white text-lg font-black">Kết nối</h4>
                  <div className="px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-200 text-[11px] font-bold">
                    {connectedSystemsCount}/3 đang bật
                  </div>
                </div>

                <div className="space-y-3">
                  {connectedSystems.map(({ icon: Icon, label, sub, active, action, activeColor, activeBg, activeBorder }) => (
                    <div key={label} className="rounded-2xl border border-slate-700/60 bg-slate-900/55 p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                          style={{ background: active ? activeBg : '#1e293b', border: `1px solid ${active ? activeBorder : '#334155'}` }}
                        >
                          <Icon size={20} style={{ color: active ? activeColor : '#64748b' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-bold truncate">{label}</p>
                          <p className="text-slate-500 text-[10px] uppercase tracking-wider mt-1">{sub}</p>
                        </div>
                      </div>
                      <button
                        onClick={action}
                        className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex-shrink-0"
                        style={active ? { background: activeBg, color: activeColor, border: `1px solid ${activeBorder}` } : { background: '#1e293b', color: '#64748b', border: '1px solid #334155' }}
                      >
                        {active ? 'Đã bật' : 'Kết nối'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== EDIT PROFILE MODAL ===== */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setShowEditProfile(false)}>
          <div className="w-full max-w-sm rounded-3xl p-6 max-h-[85vh] overflow-y-auto scrollbar-hide" style={{ background: '#1e293b', border: '1px solid rgba(6,182,212,0.2)' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-xl font-black text-white">Chỉnh sửa thông tin</h3>
              </div>
              <button onClick={() => setShowEditProfile(false)} className="text-slate-400 hover:text-white"><X size={22} /></button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold uppercase mb-1 block">Nickname hiển thị</label>
                <input type="text" value={editProfileData.nickname} onChange={e => setEditProfileData({...editProfileData, nickname: e.target.value})} className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500" required />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-slate-400 font-semibold uppercase mb-1 block">Giới tính</label><select value={editProfileData.gender} onChange={e => setEditProfileData({...editProfileData, gender: e.target.value})} className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500"><option>Nam</option><option>Nữ</option><option>Khác</option></select></div>
                <div><label className="text-[10px] text-slate-400 font-semibold uppercase mb-1 block">Tuổi</label><input type="number" value={editProfileData.age} onChange={e => setEditProfileData({...editProfileData, age: +e.target.value})} className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500" required /></div>
                <div><label className="text-[10px] text-slate-400 font-semibold uppercase mb-1 block">Chiều cao (cm)</label><input type="number" value={editProfileData.height} onChange={e => setEditProfileData({...editProfileData, height: +e.target.value})} className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500" required /></div>
                <div><label className="text-[10px] text-slate-400 font-semibold uppercase mb-1 block">Cân nặng (kg)</label><input type="number" value={editProfileData.weight} onChange={e => setEditProfileData({...editProfileData, weight: +e.target.value})} className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500" required /></div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-semibold uppercase mb-1 block">Mục tiêu chính</label>
                <select value={editProfileData.goal} onChange={e => setEditProfileData({...editProfileData, goal: e.target.value})} className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-cyan-500">
                  <option value="Giảm mỡ & Tăng cơ">Giảm mỡ & Tăng cơ</option><option value="Sức khỏe tổng quát">Sức khỏe tổng quát</option><option value="Bảo vệ da">Bảo vệ da</option>
                </select>
              </div>

              <button type="submit" disabled={isUpdatingProfile} className="w-full py-4 mt-2 rounded-xl font-bold text-slate-900 text-sm disabled:opacity-50 active:scale-95 transition-all" style={{ background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)' }}>
                {isUpdatingProfile ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== PREMIUM PAYWALL MODAL ===== */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-slate-900/90 backdrop-blur-md" onClick={() => setShowPremiumModal(false)}>
          <div className="w-full max-w-sm rounded-[2rem] p-8 relative overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.15)]" style={{ background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(245,158,11,0.3)' }} onClick={e => e.stopPropagation()}>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="w-16 h-16 bg-amber-500/20 border border-amber-500/50 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
              <Sparkles size={28} className="text-amber-400" />
            </div>
            
            <h3 className="text-2xl font-black text-white mb-2">DigiWell <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">PRO</span></h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">Nâng cấp để mở khóa toàn bộ tính năng thông minh.</p>
            
            <ul className="space-y-3 mb-8">
              {[
                'Xuất báo cáo PDF chuẩn Y khoa',
                'Chế độ Nhịn ăn gián đoạn (Fasting)',
                'AI Analytics chuyên sâu phân tích thói quen',
              ].map((ft, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Target size={12} className="text-amber-400" />
                  </div>
                  {ft}
                </li>
              ))}
            </ul>

            <button onClick={() => { setIsPremium(true); setShowPremiumModal(false); toast.success("Chào mừng bạn đến với DigiWell PRO! 🌟"); }} className="w-full py-4 rounded-xl font-bold text-slate-900 text-sm active:scale-95 transition-all shadow-lg" style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}>
              Nâng cấp ngay - 49.000đ/tháng
            </button>
            <button onClick={() => setShowPremiumModal(false)} className="w-full mt-3 py-3 rounded-xl text-slate-400 text-xs font-bold hover:bg-slate-800 transition-colors">
              Để sau
            </button>
          </div>
        </div>
      )}

      <AiChatModal
        isOpen={showAiChat}
        onClose={() => setShowAiChat(false)}
        messages={chatMessages}
        isLoading={isChatLoading}
        input={chatInput}
        onInputChange={setChatInput}
        onSubmit={handleSendChatMessage}
      />
    </div>
  );
}

// ==========================================================================
// ROOT WRAPPER
// ==========================================================================
export default function App() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="min-h-screen max-w-md mx-auto p-8 font-sans flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="w-full p-8 rounded-[2rem] border border-slate-700 bg-slate-800/80">
          <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6 border border-red-500/30">
            <Target size={28} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">Thiếu cấu hình</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Không tìm thấy kết nối Cloud. Tạo file <span className="text-cyan-400 font-mono bg-slate-900 px-2 py-1 rounded-md">.env</span> tại thư mục gốc:
          </p>
          <div className="bg-slate-950 rounded-2xl p-5 text-xs font-mono text-cyan-400 whitespace-pre-wrap border border-slate-900">
{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}
          </div>
          <p className="text-xs text-slate-500 mt-6 border-t border-slate-700 pt-5 font-bold uppercase tracking-widest">
            Restart: npm run dev
          </p>
        </div>
      </div>
    );
  }
  return <AppContent />;
}
