import React, { useState } from "react";
import { ChevronRight, Edit2, Archive, Check, MoreVertical } from "lucide-react";
import { Goal, GoalCategory } from "../types";
import GoalIcon, { COLOR_MAP } from "./GoalIcon";
import { formatDisplayDate } from "../utils";

interface JourneyCardProps {
  goal: Goal;
  onViewDetails: (goalId: string) => void;
  onEdit: (e: React.MouseEvent, goal: Goal) => void;
  onArchive?: (goalId: string) => void;
}

const CATEGORY_LABELS: Record<GoalCategory, string> = {
  business: "Kinh doanh",
  marketing: "Marketing",
  fund_backtest: "Fund & Backtest",
  health: "Sức khỏe",
  career: "Sự nghiệp",
  learning: "Học tập",
  finance: "Tài chính",
  home: "Gia đình",
  habit: "Thói quen",
  project: "Dự án cá nhân",
  custom: "Khác"
};

export default function JourneyCard({ goal, onViewDetails, onEdit, onArchive }: JourneyCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const colors = COLOR_MAP[goal.accentColor || "indigo"] || COLOR_MAP["indigo"];

  const activeMilestone = goal.milestones.find(m => !m.achieved) || goal.milestones[goal.milestones.length - 1];

  return (
    <div 
      id={`journey-card-${goal.id}`}
      onClick={() => onViewDetails(goal.id)}
      className="bg-white border border-slate-200/80 rounded-[20px] p-6 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative group overflow-hidden"
    >
      {/* Top Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <GoalIcon icon={goal.icon} color={goal.accentColor} size={16} className="p-2.5 rounded-xl border" />
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}>
                {CATEGORY_LABELS[goal.category || "custom"] || "Khác"}
              </span>
              <h4 className="font-display font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                {goal.name}
              </h4>
            </div>
          </div>

          {/* Actions Dropdown */}
          <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20">
                <button
                  onClick={(e) => {
                    onEdit(e, goal);
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-400" /> Sửa hành trình
                </button>
                {onArchive && (
                  <button
                    onClick={() => {
                      onArchive(goal.id);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                  >
                    <Archive className="w-3.5 h-3.5 text-rose-400" /> Lưu trữ
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Middle Section: Desired result & current milestone */}
        <div className="space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
            {goal.desiredOutcome}
          </p>

          {/* Active Milestone Info */}
          {activeMilestone && (
            <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 space-y-1 text-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Chặng hiện tại</span>
              <p className="font-semibold text-slate-800 line-clamp-1">
                {activeMilestone.title}
              </p>
            </div>
          )}

          {/* Milestone Path Preview */}
          {goal.milestones.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              {goal.milestones.map((m, i) => (
                <React.Fragment key={m.id}>
                  <div 
                    className={`w-2.5 h-2.5 rounded-full transition-all border ${
                      m.achieved 
                        ? "bg-emerald-500 border-emerald-500" 
                        : m.status === "active" 
                          ? "bg-indigo-500 border-indigo-500 ring-2 ring-indigo-100" 
                          : "bg-slate-100 border-slate-200"
                    }`}
                    title={`${m.title} (${m.targetValue})`}
                  />
                  {i < goal.milestones.length - 1 && (
                    <div className={`h-0.5 w-3 rounded ${m.achieved ? "bg-emerald-300" : "bg-slate-200"}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="space-y-2.5 pt-5 border-t border-slate-100 mt-4">
        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
            <span>Tiến độ hành trình</span>
            <span className="font-bold text-slate-700">{goal.currentProgress}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-300" 
              style={{ 
                width: `${goal.currentProgress}%`,
                backgroundColor: colors.rawHex
              }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-400">
          <span>Hạn chót: {formatDisplayDate(goal.deadline)}</span>
          <span className="text-xs font-bold text-indigo-600 flex items-center group-hover:text-indigo-700 transition-colors">
            Xem hành trình <ChevronRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </div>
  );
}
