import React, { useMemo, useState } from "react";
import { Check, ChevronDown, Circle, Minus, Sparkles } from "lucide-react";
import { AppState, Routine, RoutineLog } from "../types";
import GoalIcon from "./GoalIcon";

interface DailyRoutineCheckinProps {
  state: AppState;
  today: string;
  onChangeState: (state: AppState) => void;
}

const routineTone = (goalId: string, completed: boolean) => {
  if (completed) return "border-emerald-300 bg-gradient-to-br from-emerald-100 to-white shadow-sm";
  if (goalId === "G1") return "border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-sm";
  if (goalId === "G2") return "border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm";
  if (goalId === "G3") return "border-rose-200 bg-gradient-to-br from-rose-50 to-white shadow-sm";
  return "border-slate-200 bg-gradient-to-br from-slate-50 to-white";
};

export default function DailyRoutineCheckin({ state, today, onChangeState }: DailyRoutineCheckinProps) {
  const [expanded, setExpanded] = useState(false);
  const activeGoals = state.goals.filter(goal => goal.status === "active");
  const activeGoalIds = new Set(activeGoals.map(goal => goal.id));
  const routines = state.routines.filter(routine => activeGoalIds.has(routine.goalId));
  const logs = state.routineLogs || [];

  const recommendedIds = useMemo(() => new Set(
    activeGoals
      .map(goal => routines.find(routine => routine.goalId === goal.id)?.id)
      .filter(Boolean)
  ), [activeGoals, routines]);

  const visibleRoutines = expanded ? routines : routines.filter(routine => recommendedIds.has(routine.id));
  const todayLogs = logs.filter(log => log.date === today);
  const completedCount = todayLogs.filter(log => log.status === "minimum" || log.status === "completed").length;

  const getLog = (routineId: string) => todayLogs.find(log => log.routineId === routineId);

  const setRoutineStatus = (routine: Routine, status: "minimum" | "completed") => {
    const now = Date.now();
    const currentLog = getLog(routine.id);
    const isTogglingOff = currentLog?.status === status;
    let nextLogs: RoutineLog[];

    if (isTogglingOff) {
      nextLogs = logs.filter(log => !(log.routineId === routine.id && log.date === today));
    } else {
      const nextLog: RoutineLog = {
        id: currentLog?.id || `routine_log_${routine.id}_${today}`,
        routineId: routine.id,
        goalId: routine.goalId,
        date: today,
        status,
        source: "manual",
        evidence: status === "minimum" ? routine.minimumDay : routine.target,
        activityId: currentLog?.activityId || null,
        createdTimestamp: currentLog?.createdTimestamp || now,
        updatedTimestamp: now
      };
      nextLogs = [nextLog, ...logs.filter(log => !(log.routineId === routine.id && log.date === today))];
    }

    onChangeState({
      ...state,
      routineLogs: nextLogs,
      routines: state.routines.map(item => item.id === routine.id
        ? { ...item, status: isTogglingOff ? "pending" as const : "completed" as const }
        : item)
    });
  };

  return (
    <section id="section-daily-routine-input" className="life-panel overflow-hidden border-t-4 border-t-emerald-500">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="life-kicker text-emerald-600">05 · Thói quen giữ nhịp</p>
            <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[9px] font-black text-white shadow-sm">{completedCount}/{routines.length} xong</span>
          </div>
          <h2 className="mt-2 font-display text-lg font-extrabold text-slate-950">Bạn đã giữ nhịp nào?</h2>
          <p className="mt-1 text-xs text-slate-400">Chọn mức tối thiểu hoặc hoàn thành. Dữ liệu này sẽ đi thẳng vào Kết quả.</p>
        </div>
        {routines.length > recommendedIds.size && (
          <button onClick={() => setExpanded(value => !value)} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50">
            {expanded ? "Thu gọn" : `Xem tất cả ${routines.length} routine`}
            <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3">
        {visibleRoutines.map(routine => {
          const goal = state.goals.find(item => item.id === routine.goalId);
          const log = getLog(routine.id);
          return (
            <div key={routine.id} className={`relative overflow-hidden rounded-2xl border p-4 transition ${routineTone(routine.goalId, !!log)}`}>
              <span className={`absolute inset-x-0 top-0 h-1 ${log ? "bg-emerald-500" : routine.goalId === "G1" ? "bg-violet-500" : routine.goalId === "G2" ? "bg-sky-500" : "bg-rose-500"}`} />
              <div className="flex items-start gap-3">
                <GoalIcon icon={goal?.icon} color={goal?.accentColor} size={15} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold text-slate-900">{routine.name}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-400">{log?.evidence || `Tối thiểu: ${routine.minimumDay}`}</p>
                </div>
                {log ? <span className="rounded-full bg-emerald-600 p-1 text-white"><Check className="h-3 w-3" /></span> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => setRoutineStatus(routine, "minimum")} className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-bold ${log?.status === "minimum" ? "border-amber-300 bg-amber-100 text-amber-800" : "border-slate-200 bg-white text-slate-500 hover:border-amber-200"}`}>
                  <Minus className="h-3 w-3" /> Minimum
                </button>
                <button onClick={() => setRoutineStatus(routine, "completed")} className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-bold ${log?.status === "completed" ? "border-emerald-300 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200"}`}>
                  <Check className="h-3 w-3" /> Hoàn thành
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 border-t border-slate-100 bg-indigo-50/50 px-5 py-3 text-[10px] leading-relaxed text-indigo-700">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Bạn cũng có thể nói trong Voice Check-in. AI sẽ đề xuất routine tương ứng và chỉ lưu sau khi bạn xác nhận.
      </div>
    </section>
  );
}
