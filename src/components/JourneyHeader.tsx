import React from "react";
import { Plus, Target, Award } from "lucide-react";
import { AppState } from "../types";

interface JourneyHeaderProps {
  state: AppState;
  onCreateClick: () => void;
}

export default function JourneyHeader({ state, onCreateClick }: JourneyHeaderProps) {
  const activeJourneys = state.goals.filter(g => g.status === "active").length;
  const completedMilestones = state.goals.reduce((acc, g) => acc + g.milestones.filter(m => m.achieved).length, 0);

  return (
    <div id="journey-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
      <div className="space-y-1.5">
        <h2 className="font-display font-extrabold text-2xl md:text-3xl text-slate-900 tracking-tight flex items-center gap-2">
          Hành trình mục tiêu 90 ngày
        </h2>
        <p className="text-sm text-slate-500 max-w-xl">
          Quản lý các dự án, chỉ tiêu cốt lõi và lộ trình phát triển bản thân theo phương pháp 90-Day Life OS.
        </p>

        {/* Quick Stats Row */}
        <div className="flex items-center gap-4 pt-1.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-150 px-2.5 py-1 rounded-full">
            <Target className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
            <span>Đang chạy: <strong className="text-slate-800">{activeJourneys}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-150 px-2.5 py-1 rounded-full">
            <Award className="w-3.5 h-3.5 text-emerald-500" />
            <span>Cột mốc hoàn thành: <strong className="text-slate-800">{completedMilestones}</strong></span>
          </div>
        </div>
      </div>

      <button
        onClick={onCreateClick}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all shrink-0 cursor-pointer"
      >
        <Plus className="w-4 h-4" /> Tạo hành trình mới
      </button>
    </div>
  );
}
