import React, { lazy, Suspense, useState, useEffect, useRef } from "react";
import { Sparkles, Compass, Calendar, Clock, Plus, Database, Bell, Cloud, LogOut, LoaderCircle, BookOpenCheck, SlidersHorizontal, BrainCircuit } from "lucide-react";
import { AppState } from "./types";
import { getDefaultAppState, getCycleStats, formatDateStr, migrateAppState } from "./utils";
import SimpleTodayView from "./components/SimpleTodayView";
import AuthScreen from "./components/AuthScreen";
import OnboardingFlow from "./components/OnboardingFlow";
import { User, firebaseConfigured, loadUserState, observeAuth, saveUserState, signOutCurrentUser } from "./firebase";

const GoalsView = lazy(() => import("./components/GoalsView"));
const ReviewView = lazy(() => import("./components/ReviewView"));
const CalendarView = lazy(() => import("./components/CalendarView"));
const PlanHub = lazy(() => import("./components/PlanHub"));
const AICoachView = lazy(() => import("./components/AICoachView"));

const LOCAL_STORAGE_KEY = "90day_life_os_state_v1";
type AppPage = 'today' | 'goals' | 'calendar' | 'review' | 'plan' | 'ai';
const APP_PAGES: AppPage[] = ['today', 'goals', 'calendar', 'review', 'plan', 'ai'];
const readPageFromUrl = (): AppPage => {
  const page = new URLSearchParams(window.location.search).get('page');
  return APP_PAGES.includes(page as AppPage) ? page as AppPage : 'today';
};
const NAV_ITEMS = [
  { id: 'today' as const, label: 'Hôm nay', icon: Sparkles },
  { id: 'goals' as const, label: 'Mục tiêu', icon: Compass },
  { id: 'calendar' as const, label: 'Calendar', icon: Calendar },
  { id: 'review' as const, label: 'Review tuần', icon: BookOpenCheck },
  { id: 'plan' as const, label: 'Plan Hub', icon: SlidersHorizontal },
  { id: 'ai' as const, label: 'AI Coach', icon: BrainCircuit }
];
const PAGE_COPY: Record<AppPage, { title: string; description: string }> = {
  today: { title: 'Lịch trình & tiến độ hôm nay', description: 'Làm việc cần làm, ghi số liệu và xem tiến độ T2–T7.' },
  goals: { title: 'Mục tiêu & lộ trình', description: 'Xem từng mục tiêu đã đến bước nào và hành động tiếp theo.' },
  calendar: { title: 'Calendar & việc phát sinh', description: 'Quản lý ngày, giờ, lịch cố định và việc mới phát sinh.' },
  review: { title: 'Review tuần', description: 'Đánh giá dữ liệu thứ Hai–thứ Bảy; Chủ nhật chỉ review.' },
  plan: { title: 'Plan Hub', description: 'Chỉnh mục tiêu, process, routine, lịch và template tại một nơi.' },
  ai: { title: 'AI cảnh báo & đề xuất', description: 'Phát hiện quá tải, xung đột và đề xuất thay đổi có kiểm soát.' }
};

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return migrateAppState(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to restore 90-Day Life OS state:", e);
    }
    return migrateAppState(getDefaultAppState());
  });

  const [activeTab, setActiveTab] = useState<AppPage>(readPageFromUrl);
  const [autoOpenCreateModal, setAutoOpenCreateModal] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    () => typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const syncTimerRef = useRef<number | null>(null);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const syncRevisionRef = useRef(0);

  const navigateTo = (page: AppPage, replace = false) => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', page);
    window.history[replace ? 'replaceState' : 'pushState']({ page }, '', url);
    setActiveTab(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onPopState = () => setActiveTab(readPageFromUrl());
    window.addEventListener('popstate', onPopState);
    if (!new URLSearchParams(window.location.search).has('page')) navigateTo('today', true);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => observeAuth(user => {
    setAuthUser(user);
    setAuthLoading(false);
    if (!user) setCloudReady(false);
  }), []);

  useEffect(() => {
    if (!authUser || !firebaseConfigured) return;
    let cancelled = false;
    const hydrate = async () => {
      setCloudReady(false);
      setSyncStatus('idle');
      try {
        const remoteState = await loadUserState(authUser.uid);
        if (cancelled) return;
        if (remoteState) {
          setState(migrateAppState(remoteState));
        } else {
          const personalKey = `${LOCAL_STORAGE_KEY}_${authUser.uid}`;
          const personalBackup = localStorage.getItem(personalKey);
          const claimedUid = localStorage.getItem(`${LOCAL_STORAGE_KEY}_claimed_uid`);
          const initialState = personalBackup
            ? migrateAppState(JSON.parse(personalBackup))
            : (!claimedUid || claimedUid === authUser.uid)
              ? state
              : migrateAppState(getDefaultAppState());
          setState(initialState);
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_claimed_uid`, authUser.uid);
          await saveUserState(authUser.uid, initialState);
        }
        if (!cancelled) {
          setCloudReady(true);
          setSyncStatus('saved');
        }
      } catch (error) {
        console.error("Failed to load personal cloud state:", error);
        if (!cancelled) {
          setCloudReady(true);
          setSyncStatus('error');
        }
      }
    };
    hydrate();
    return () => { cancelled = true; };
  }, [authUser?.uid]);

  // Sync state to LocalStorage automatically whenever changed
  useEffect(() => {
    try {
      const storageKey = authUser ? `${LOCAL_STORAGE_KEY}_${authUser.uid}` : LOCAL_STORAGE_KEY;
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save 90-Day Life OS state:", e);
    }
    if (!authUser || !cloudReady || !firebaseConfigured) return;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    setSyncStatus('saving');
    const revision = ++syncRevisionRef.current;
    const uid = authUser.uid;
    const stateSnapshot = state;
    syncTimerRef.current = window.setTimeout(() => {
      syncQueueRef.current = syncQueueRef.current
        .catch(() => undefined)
        .then(() => saveUserState(uid, stateSnapshot));
      syncQueueRef.current.then(() => {
        if (revision === syncRevisionRef.current) setSyncStatus('saved');
      }).catch(error => {
        console.error("Failed to sync personal cloud state:", error);
        if (revision === syncRevisionRef.current) setSyncStatus('error');
      });
    }, 800);
    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [state, authUser?.uid, cloudReady]);

  useEffect(() => {
    if (notificationPermission !== "granted") return;
    const checkSchedule = () => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).formatToParts(new Date());
      const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || "";
      const date = `${value("year")}-${value("month")}-${value("day")}`;
      const time = `${value("hour")}:${value("minute")}`;
      (state.scheduleItems || [])
        .filter(item => item.date === date && item.startTime === time && !item.completed)
        .forEach(item => {
          const reminderKey = `90day_reminder_${item.id}_${date}_${time}`;
          if (sessionStorage.getItem(reminderKey)) return;
          sessionStorage.setItem(reminderKey, "sent");
          new Notification("Đến giờ thực hiện", { body: item.title, tag: reminderKey });
        });
    };
    checkSchedule();
    const timer = window.setInterval(checkSchedule, 30_000);
    return () => window.clearInterval(timer);
  }, [notificationPermission, state.scheduleItems]);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      window.alert("Trình duyệt này không hỗ trợ thông báo.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "denied") window.alert("Thông báo đang bị chặn. Bạn có thể bật lại trong cài đặt trình duyệt.");
    } catch {
      window.alert("Không thể bật thông báo trên trình duyệt này.");
    }
  };

  const handleUpdateState = (newState: AppState) => {
    setState(newState);
  };

  // Live cycle tracking calculations
  const stats = getCycleStats(state.startDate, formatDateStr(new Date()), state.endDate);
  const cyclePercentage = Math.round((stats.currentDay / stats.totalDays) * 100);

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><LoaderCircle className="h-7 w-7 animate-spin text-indigo-400" /></div>;
  }

  if (!authUser) return <AuthScreen />;

  if (!cloudReady) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-white"><LoaderCircle className="h-7 w-7 animate-spin text-indigo-400" /><p className="text-xs font-semibold text-slate-400">Đang mở không gian cá nhân…</p></div>;
  }

  return (
    <div id="app-root" className="life-canvas min-h-screen text-slate-900 font-sans flex flex-col md:flex-row antialiased selection:bg-indigo-100 selection:text-indigo-950">
      {!state.onboardingCompleted && <OnboardingFlow state={state} onChangeState={handleUpdateState} />}
      
      {/* DESKTOP SIDEBAR (SLIM WHITE STYLE) */}
      <aside className="hidden md:flex flex-col w-64 bg-white text-slate-800 h-screen sticky top-0 shrink-0 border-r border-slate-200/80 z-40">
        {/* Sidebar Header: Logo & Branding */}
        <div className="px-6 py-7 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-slate-950 text-white shadow-lg shadow-slate-200">
              <Database className="h-5 w-5" />
            </span>
            <div>
            <span className="font-display font-extrabold text-lg tracking-tight text-slate-950">
              90-Day OS
            </span>
            <p className="life-kicker text-indigo-500 mt-0.5">Focus companion</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-4 leading-relaxed">
            Biến mục tiêu lớn thành một nhịp tiến bộ rõ ràng mỗi ngày.
          </p>
        </div>

        <nav className="flex-1 space-y-1.5 px-4 py-6" aria-label="Điều hướng chính">
          {NAV_ITEMS.map(item => { const Icon = item.icon; return <button key={item.id} id={`nav-${item.id}`} onClick={() => navigateTo(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${activeTab === item.id ? "border border-indigo-100 bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon className="h-4 w-4 shrink-0" /><span>{item.label}</span></button>; })}
        </nav>

        {/* Sidebar Footer: Cycle Progress */}
        <div className="m-4 p-4 rounded-[20px] border border-slate-800 bg-slate-950 text-white shadow-xl shadow-slate-200">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="life-kicker text-slate-400">Cycle progress</span>
              <span className="font-mono font-black text-white">{stats.currentDay}/{stats.totalDays}</span>
            </div>
            
            {/* Cycle progress bar */}
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-400 rounded-full"
                style={{ width: `${cyclePercentage}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>{stats.currentDay === 0 ? 'Chuẩn bị' : `Day ${stats.currentDay}`}</span>
              <span>Còn lại: {stats.daysRemaining} ngày</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="flex md:hidden items-center justify-between px-5 py-4 bg-white/95 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <span className="font-display font-black text-base tracking-tight text-slate-900">
            90-Day Life OS
          </span>
          <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100 uppercase">
            {stats.currentDay === 0 ? 'Chuẩn bị' : `Day ${stats.currentDay}`}
          </span>
        </div>
        <button onClick={() => signOutCurrentUser()} aria-label="Đăng xuất" className="flex items-center gap-2 rounded-xl p-1 text-xs font-semibold text-slate-500 hover:bg-rose-50">
          <span className={`h-2 w-2 rounded-full ${syncStatus === 'error' ? 'bg-rose-500' : syncStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
          {authUser.photoURL ? <img src={authUser.photoURL} alt={authUser.displayName || "Tài khoản"} className="h-8 w-8 rounded-full border-2 border-white shadow" /> : <Clock className="w-4 h-4 text-indigo-500" />}
        </button>
      </header>

      {/* MAIN CONTAINER CONTENT */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        
        {/* MAIN TOP BAR */}
        <div className="sticky top-0 z-30 hidden items-center justify-between border-b border-slate-200/80 bg-white/90 px-8 py-5 backdrop-blur-xl md:flex">
          <div><p className="life-kicker text-indigo-600">90-Day Life OS</p><h1 className="mt-1 text-xl font-extrabold text-slate-950">{PAGE_COPY[activeTab].title}</h1><p className="mt-1 text-xs font-medium text-slate-500">{PAGE_COPY[activeTab].description}</p></div>
          <div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"><Cloud className={`h-4 w-4 ${syncStatus === 'error' ? 'text-rose-500' : 'text-emerald-500'}`} /><span className="text-[11px] font-semibold text-slate-600">{syncStatus === 'saving' ? 'Đang đồng bộ…' : syncStatus === 'error' ? 'Đang lưu cục bộ' : 'Đã đồng bộ'}</span></div>{activeTab === 'today' && <button onClick={requestNotifications} aria-label="Bật thông báo lịch" className={`flex h-10 w-10 items-center justify-center rounded-xl border ${notificationPermission === "granted" ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-slate-200 bg-white text-slate-500"}`}><Bell className="h-4 w-4" /></button>}{activeTab === 'goals' && <button onClick={() => setAutoOpenCreateModal(true)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white"><Plus className="h-4 w-4" />Tạo mục tiêu</button>}<button onClick={() => signOutCurrentUser()} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-400 hover:text-rose-600" aria-label="Đăng xuất"><LogOut className="h-4 w-4" /></button></div>
        </div>

        {/* WORKSPACE AREA */}
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-10">
          <div className="max-w-7xl mx-auto transition-all duration-150">
            <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-indigo-600" /></div>}>
            {activeTab === 'today' && (
              <SimpleTodayView 
                state={state} 
                onChangeState={handleUpdateState} 
                onOpenReview={() => navigateTo('review')}
              />
            )}

            {activeTab === 'goals' && (
              <GoalsView 
                state={state} 
                onChangeState={handleUpdateState} 
                autoOpenCreateModal={autoOpenCreateModal}
                onCloseCreateModal={() => setAutoOpenCreateModal(false)}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView 
                state={state} 
                onChangeState={handleUpdateState} 
              />
            )}

            {activeTab === 'review' && (
              <ReviewView 
                state={state} 
                onChangeState={handleUpdateState} 
              />
            )}
            {activeTab === 'plan' && <PlanHub state={state} onChangeState={handleUpdateState} />}
            {activeTab === 'ai' && <AICoachView state={state} onOpenPlanHub={() => navigateTo('plan')} />}
            </Suspense>
          </div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center overflow-x-auto border-t border-slate-200/80 bg-white px-1 shadow-lg md:hidden" aria-label="Điều hướng di động">{NAV_ITEMS.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => navigateTo(item.id)} className={`flex min-h-[54px] min-w-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[9px] font-bold ${activeTab === item.id ? "bg-indigo-50 text-indigo-600" : "text-slate-500"}`}><Icon className="h-4 w-4" /><span className="whitespace-nowrap">{item.label.replace(' tuần', '')}</span></button>; })}</nav>

    </div>
  );
}
