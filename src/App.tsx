import React, { useState, useEffect, useRef } from "react";
import { Sparkles, BarChart3, Compass, Calendar, Clock, Settings, Plus, Database, Bell, Search, Cloud, LogOut, LoaderCircle, Mic, MoreHorizontal } from "lucide-react";
import { AppState } from "./types";
import { getDefaultAppState, getCycleStats, formatDateStr, migrateAppState } from "./utils";
import TodayView from "./components/TodayView";
import GoalsView from "./components/GoalsView";
import ProgressView from "./components/ProgressView";
import ReviewView from "./components/ReviewView";
import CalendarView from "./components/CalendarView";
import AuthScreen from "./components/AuthScreen";
import OnboardingFlow from "./components/OnboardingFlow";
import { User, firebaseConfigured, loadUserState, observeAuth, saveUserState, signOutCurrentUser } from "./firebase";

const LOCAL_STORAGE_KEY = "90day_life_os_state_v1";

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

  const [activeTab, setActiveTab] = useState<'today' | 'journeys' | 'calendar' | 'progress' | 'settings'>('today');
  const [autoOpenCreateModal, setAutoOpenCreateModal] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const syncTimerRef = useRef<number | null>(null);

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
    syncTimerRef.current = window.setTimeout(async () => {
      try {
        await saveUserState(authUser.uid, state);
        setSyncStatus('saved');
      } catch (error) {
        console.error("Failed to sync personal cloud state:", error);
        setSyncStatus('error');
      }
    }, 800);
    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [state, authUser?.uid, cloudReady]);

  const handleUpdateState = (newState: AppState) => {
    setState(newState);
  };

  const openVoiceCheckin = () => {
    setMobileMoreOpen(false);
    setActiveTab('today');
    window.setTimeout(() => document.getElementById('section-quick-input')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
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

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <button
            id="nav-today"
            onClick={() => setActiveTab('today')}
            className={`w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'today'
                ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Hôm nay</span>
          </button>

          <button
            id="nav-journeys"
            onClick={() => setActiveTab('journeys')}
            className={`w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'journeys'
                ? "bg-indigo-50 text-indigo-600 shadow-3xs"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span>Các Hành trình</span>
          </button>

          <button
            id="nav-calendar"
            onClick={() => setActiveTab('calendar')}
            className={`w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'calendar'
                ? "bg-indigo-50 text-indigo-600 shadow-3xs"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span>Lịch biểu</span>
          </button>

          <button
            id="nav-progress"
            onClick={() => setActiveTab('progress')}
            className={`w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'progress'
                ? "bg-indigo-50 text-indigo-600 shadow-3xs"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>Kết quả</span>
          </button>

          <button
            id="nav-settings"
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? "bg-indigo-50 text-indigo-600 shadow-3xs"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Đánh giá</span>
          </button>
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
        <div className="hidden md:flex items-center justify-between px-8 py-5 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-30">
          {activeTab === 'today' ? (
            <div className="space-y-1">
              <p className="life-kicker text-indigo-600">Daily command center</p>
              <h1 className="font-display text-2xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
                Hôm nay mình tiến một bước nhỏ
              </h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
                <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100 font-bold">
                  {stats.currentDay === 0 ? `Bắt đầu ${state.startDate.split('-').reverse().join('/')}` : `Ngày ${stats.currentDay}/${stats.totalDays}`}
                </span>
                <span>({cyclePercentage}% Chu kỳ)</span>
                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden inline-block border border-slate-200/50">
                  <div 
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${cyclePercentage}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                {activeTab === 'journeys' && "Các Hành Trình Mục Tiêu"}
                {activeTab === 'calendar' && "Lịch Biểu & Phân Bổ Thời Gian"}
                {activeTab === 'progress' && "Kết Quả Theo Mục Tiêu"}
                {activeTab === 'settings' && "Đánh Giá & Điều Chỉnh"}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                {activeTab === 'journeys' && `Hành trình ${stats.totalDays} ngày của bạn với lộ trình cột mốc chi tiết.`}
                {activeTab === 'calendar' && "Quản lý và tối ưu hóa thời gian, tránh xung đột lịch biểu."}
                {activeTab === 'progress' && "Sự phân bổ hoạt động, phễu lead, thể trạng và chỉ số trading."}
                {activeTab === 'settings' && "Đánh giá tuần, chạy thử nghiệm thói quen và sao lưu dữ liệu."}
              </p>
            </div>
          )}

          {activeTab === 'today' ? (
            <div className="flex items-center gap-2"><div className="mr-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5"><span className={`h-2 w-2 rounded-full ${syncStatus === 'error' ? 'bg-rose-500' : syncStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} /><div className="hidden xl:block"><p className="max-w-32 truncate text-[10px] font-black text-slate-700">{authUser.displayName || authUser.email}</p><p className="text-[9px] text-slate-400">{syncStatus === 'saving' ? 'Đang đồng bộ' : syncStatus === 'error' ? 'Lưu cục bộ' : 'Đã đồng bộ'}</p></div>{authUser.photoURL && <img src={authUser.photoURL} alt="" className="h-7 w-7 rounded-lg" />}<button onClick={() => signOutCurrentUser()} aria-label="Đăng xuất" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><LogOut className="h-3.5 w-3.5" /></button></div><button aria-label="Tìm kiếm" className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-500 flex items-center justify-center"><Search className="h-4 w-4" /></button><button aria-label="Thông báo" className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-500 flex items-center justify-center"><Bell className="h-4 w-4" /></button><button
              onClick={() => {
                setActiveTab('journeys');
                setAutoOpenCreateModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo hành trình</span>
            </button></div>
          ) : (
            /* Timezone Indicator */
            <div className="flex items-center gap-3 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 px-4 py-2 rounded-xl">
              <Cloud className={`h-4 w-4 ${syncStatus === 'error' ? 'text-rose-500' : 'text-emerald-500'}`} />
              <span className="font-semibold text-[11px]">{syncStatus === 'saving' ? 'Đang đồng bộ…' : syncStatus === 'error' ? 'Chưa đồng bộ cloud' : `Đã đồng bộ · ${authUser.email}`}</span>
              <button onClick={() => signOutCurrentUser()} className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Đăng xuất"><LogOut className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>

        {/* WORKSPACE AREA */}
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-10">
          <div className="max-w-7xl mx-auto transition-all duration-150">
            {activeTab === 'today' && (
              <TodayView 
                state={state} 
                onChangeState={handleUpdateState} 
                onOpenProgress={() => setActiveTab('progress')}
              />
            )}

            {activeTab === 'journeys' && (
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

            {activeTab === 'progress' && (
              <ProgressView 
                state={state} 
                onChangeState={handleUpdateState}
              />
            )}

            {activeTab === 'settings' && (
              <ReviewView 
                state={state} 
                onChangeState={handleUpdateState} 
              />
            )}
          </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAV WITH SHORT LABELS & SAFE-AREA & 44PX TARGETS */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-slate-200/80 shadow-lg z-40 flex justify-around items-center px-2 pb-safe-bottom">
        <button
          onClick={() => setActiveTab('today')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 rounded-xl text-[10px] font-bold transition-all flex-1 cursor-pointer ${
            activeTab === 'today' 
              ? "text-indigo-600 bg-indigo-50/70" 
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Sparkles className="w-5 h-5 shrink-0" />
          <span>Hôm nay</span>
        </button>

        <button
          onClick={() => setActiveTab('journeys')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 rounded-xl text-[10px] font-bold transition-all flex-1 cursor-pointer ${
            activeTab === 'journeys' 
              ? "text-indigo-600 bg-indigo-50/70" 
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Compass className="w-5 h-5 shrink-0" />
          <span>Lộ trình</span>
        </button>

        <button onClick={openVoiceCheckin} className="-mt-5 flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[10px] font-black text-indigo-700"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200"><Mic className="h-5 w-5" /></span><span>Check-in</span></button>

        <button onClick={() => setActiveTab('calendar')} className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 text-[10px] font-bold ${activeTab === 'calendar' ? "bg-indigo-50/70 text-indigo-600" : "text-slate-500"}`}><Calendar className="h-5 w-5" /><span>Lịch</span></button>

        <div className="relative flex-1">
          {mobileMoreOpen && <div className="absolute bottom-14 right-0 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"><button onClick={() => { setActiveTab('progress'); setMobileMoreOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><BarChart3 className="h-4 w-4" />Kết quả</button><button onClick={() => { setActiveTab('settings'); setMobileMoreOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Settings className="h-4 w-4" />Đánh giá & Cài đặt</button></div>}
          <button onClick={() => setMobileMoreOpen(value => !value)} className={`flex min-h-[48px] w-full flex-col items-center justify-center gap-1 rounded-xl py-1 text-[10px] font-bold ${activeTab === 'progress' || activeTab === 'settings' ? 'bg-indigo-50/70 text-indigo-600' : 'text-slate-500'}`}><MoreHorizontal className="h-5 w-5" /><span>Thêm</span></button>
        </div>
      </nav>

    </div>
  );
}
