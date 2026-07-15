import React, { useState, useEffect } from "react";
import { Sparkles, BarChart3, ListTodo, RefreshCw, Calendar, Clock, Layout, Settings, Plus } from "lucide-react";
import { AppState } from "./types";
import { getDefaultAppState, getCycleStats, formatDateStr, migrateAppState } from "./utils";
import TodayView from "./components/TodayView";
import GoalsView from "./components/GoalsView";
import ProgressView from "./components/ProgressView";
import ReviewView from "./components/ReviewView";
import CalendarView from "./components/CalendarView";

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

  // Sync state to LocalStorage automatically whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save 90-Day Life OS state:", e);
    }
  }, [state]);

  const handleUpdateState = (newState: AppState) => {
    setState(newState);
  };

  // Live cycle tracking calculations
  const stats = getCycleStats(state.startDate, formatDateStr(new Date()));
  const cyclePercentage = Math.round((stats.currentDay / stats.totalDays) * 100);

  return (
    <div id="app-root" className="min-h-screen bg-[#f8f9fa] text-slate-900 font-sans flex flex-col md:flex-row antialiased selection:bg-indigo-100 selection:text-indigo-950">
      
      {/* DESKTOP SIDEBAR (SLIM WHITE STYLE) */}
      <aside className="hidden md:flex flex-col w-64 bg-white text-slate-800 h-screen sticky top-0 shrink-0 border-r border-slate-200/80 z-40 shadow-2xs">
        {/* Sidebar Header: Logo & Branding */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-lg tracking-tight text-slate-900">
              90-Day Life OS
            </span>
            <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-lg border border-indigo-100">
              v2.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium italic mt-1">
            “Nói một phút. Hiểu tiến độ.”
          </p>
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          <button
            id="nav-today"
            onClick={() => setActiveTab('today')}
            className={`w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'today'
                ? "bg-indigo-50 text-indigo-600 shadow-3xs"
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
            <ListTodo className="w-4 h-4 shrink-0" />
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
            <span>Tiến độ</span>
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
            <span>Cài đặt & Đánh giá</span>
          </button>
        </nav>

        {/* Sidebar Footer: Cycle Progress */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-bold text-slate-500">Chu kỳ 90 ngày</span>
              <span className="font-mono font-black text-indigo-600">Ngày {stats.currentDay}/90</span>
            </div>
            
            {/* Cycle progress bar */}
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${cyclePercentage}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Day 1</span>
              <span>Còn lại: {stats.daysRemaining} ngày</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="flex md:hidden items-center justify-between px-5 py-4 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <span className="font-display font-black text-base tracking-tight text-slate-900">
            90-Day Life OS
          </span>
          <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100 uppercase">
            Day {stats.currentDay}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span>Còn {stats.daysRemaining} ngày</span>
        </div>
      </header>

      {/* MAIN CONTAINER CONTENT */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        
        {/* MAIN TOP BAR */}
        <div className="hidden md:flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
          {activeTab === 'today' ? (
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Chào ngày mới! ☀️
              </h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
                <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100 font-bold">
                  Ngày {stats.currentDay}/90
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
                {activeTab === 'progress' && "Bảng Theo Dõi Tiến Độ Thực Tế"}
                {activeTab === 'settings' && "Cài Đặt & Đánh Giá Định Kỳ"}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                {activeTab === 'journeys' && "Hành trình bento 90 ngày của bạn với lộ trình cột mốc chi tiết."}
                {activeTab === 'calendar' && "Quản lý và tối ưu hóa thời gian, tránh xung đột lịch biểu."}
                {activeTab === 'progress' && "Sự phân bổ hoạt động, phễu lead, thể trạng và chỉ số trading."}
                {activeTab === 'settings' && "Đánh giá tuần, chạy thử nghiệm thói quen và sao lưu dữ liệu."}
              </p>
            </div>
          )}

          {activeTab === 'today' ? (
            <button
              onClick={() => {
                setActiveTab('journeys');
                setAutoOpenCreateModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-indigo-700 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tạo hành trình</span>
            </button>
          ) : (
            /* Timezone Indicator */
            <div className="flex items-center gap-3 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 px-4 py-2 rounded-xl">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold font-mono text-[11px]">Ho Chi Minh (UTC+7)</span>
            </div>
          )}
        </div>

        {/* WORKSPACE AREA */}
        <main className="flex-1 px-4 md:px-8 py-6 pb-24 md:pb-8">
          <div className="max-w-6xl mx-auto transition-all duration-150">
            {activeTab === 'today' && (
              <TodayView 
                state={state} 
                onChangeState={handleUpdateState} 
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
          <ListTodo className="w-5 h-5 shrink-0" />
          <span>Lộ trình</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 rounded-xl text-[10px] font-bold transition-all flex-1 cursor-pointer ${
            activeTab === 'calendar' 
              ? "text-indigo-600 bg-indigo-50/70" 
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Calendar className="w-5 h-5 shrink-0" />
          <span>Lịch biểu</span>
        </button>

        <button
          onClick={() => setActiveTab('progress')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 rounded-xl text-[10px] font-bold transition-all flex-1 cursor-pointer ${
            activeTab === 'progress' 
              ? "text-indigo-600 bg-indigo-50/70" 
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <BarChart3 className="w-5 h-5 shrink-0" />
          <span>Tiến độ</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 rounded-xl text-[10px] font-bold transition-all flex-1 cursor-pointer ${
            activeTab === 'settings' 
              ? "text-indigo-600 bg-indigo-50/70" 
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Settings className="w-5 h-5 shrink-0" />
          <span>Cài đặt</span>
        </button>
      </nav>

    </div>
  );
}
