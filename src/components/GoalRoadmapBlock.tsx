import React, { useRef } from "react";
import { Check, Circle, Flag, LockKeyhole } from "lucide-react";
import { AppState, Goal } from "../types";
import GoalIcon, { COLOR_MAP } from "./GoalIcon";
import { formatDisplayDate } from "../utils";

interface GoalRoadmapBlockProps {
  state: AppState;
  today: string;
  onChangeState: (state: AppState) => void;
}

const GOAL_ORDER = ["G4", "G3", "G1", "G2"];

const getOrderedGoals = (goals: Goal[]) =>
  [...goals]
    .filter(goal => goal.status === "active" || goal.status === "completed")
    .sort((a, b) => {
      const aIndex = GOAL_ORDER.indexOf(a.id);
      const bIndex = GOAL_ORDER.indexOf(b.id);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });

export default function GoalRoadmapBlock({ state, today, onChangeState }: GoalRoadmapBlockProps) {
  const goals = getOrderedGoals(state.goals);
  const completingRef = useRef(new Set<string>());

  const completeCurrentStep = (goal: Goal) => {
    if (completingRef.current.has(goal.id)) return;
    const current = goal.milestones.find(milestone => !milestone.achieved);
    if (!current) return;
    completingRef.current.add(goal.id);

    const completedAt = new Date().toISOString();
    const milestones = goal.milestones.map(milestone =>
      milestone.id === current.id
        ? { ...milestone, achieved: true, status: "completed" as const, completedAt }
        : milestone
    );
    const next = milestones.find(milestone => !milestone.achieved);
    const normalized = milestones.map(milestone => {
      if (milestone.achieved) return milestone;
      return { ...milestone, status: milestone.id === next?.id ? "active" as const : "locked" as const };
    });

    onChangeState({
      ...state,
      goals: state.goals.map(item => item.id === goal.id ? {
        ...item,
        milestones: normalized,
        currentMilestoneId: next?.id || null,
        currentMilestone: next?.title || "Đã hoàn thành",
        currentProgress: normalized.length
          ? Math.round(normalized.filter(milestone => milestone.achieved).length / normalized.length * 100)
          : 100,
        status: next ? item.status : "completed"
      } : item)
    });
    window.setTimeout(() => completingRef.current.delete(goal.id), 500);
  };

  return (
    <section id="section-goal-roadmaps" className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">03 · Lộ trình theo mục tiêu</p>
          <h2 className="mt-2 font-display text-2xl font-black text-slate-950">Làm xong bước này rồi mới sang bước tiếp theo</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
            Đây là bản đồ các việc chính, không phải danh sách việc phải làm hết hôm nay. Mỗi hạng mục chỉ có một chặng đang mở.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">
          {goals.length} mục tiêu
        </span>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {goals.map(goal => {
          const colors = COLOR_MAP[goal.accentColor || "indigo"] || COLOR_MAP.indigo;
          const isDailyFoundation = goal.id === "G4";
          const dailyRoutines = state.routines.filter(routine => routine.goalId === goal.id && routine.active !== false);
          const current = goal.milestones.find(milestone => !milestone.achieved) || null;
          const completedCount = goal.milestones.filter(milestone => milestone.achieved).length;

          return (
            <article key={goal.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50/60">
              <div className="flex items-start gap-3 border-b border-slate-200 bg-white p-5">
                <GoalIcon icon={goal.icon} color={goal.accentColor} size={18} className="rounded-2xl border p-3" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-black text-slate-950">{goal.name}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${colors.bg} ${colors.text}`}>
                      {isDailyFoundation ? "Nền hằng ngày" : `${completedCount}/${goal.milestones.length} bước`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{goal.description}</p>
                </div>
              </div>

              <div className="p-5">
                {isDailyFoundation ? (
                  <>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {dailyRoutines.map(routine => {
                        const completedToday = (state.routineLogs || []).some(log =>
                          log.routineId === routine.id && log.date === today && log.status === "completed"
                        );
                        return (
                          <div key={routine.id} className={`min-w-[220px] flex-1 rounded-2xl border p-4 ${
                            completedToday ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-white"
                          }`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${
                                completedToday ? "bg-emerald-600 text-white" : "bg-rose-100 text-rose-600"
                              }`}>
                                {completedToday ? <Check className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5" />}
                              </span>
                              <span className="rounded-full bg-rose-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-rose-700">
                                Luôn mở
                              </span>
                            </div>
                            <p className="mt-3 text-sm font-black text-slate-950">{routine.name}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{routine.minimumDay}</p>
                            <p className="mt-2 text-[10px] font-bold text-rose-700">{routine.frequency}</p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
                      Các hành động Health & Beauty luôn mở song song. Bạn check theo ngày trong phần routine, không cần chờ hoàn thành một mốc cân nặng.
                    </p>
                  </>
                ) : (
                  <>
                <ol className="flex gap-3 overflow-x-auto pb-2">
                  {goal.milestones.map(milestone => {
                    const isCurrent = milestone.id === current?.id;
                    const isCompleted = milestone.achieved;

                    return (
                      <li key={milestone.id} className="flex min-w-[210px] flex-1 items-stretch">
                        <div className={`flex w-full gap-3 rounded-2xl border p-3.5 transition ${
                          isCompleted
                            ? "border-emerald-200 bg-emerald-50/80"
                            : isCurrent
                              ? "border-indigo-300 bg-white shadow-md ring-2 ring-indigo-100"
                              : "border-transparent bg-transparent"
                        }`}>
                          <button
                            type="button"
                            disabled={!isCurrent}
                            onClick={() => completeCurrentStep(goal)}
                            aria-label={isCurrent ? `Hoàn tất ${milestone.title}` : isCompleted ? `${milestone.title} đã hoàn thành` : `${milestone.title} chưa mở`}
                            title={isCurrent ? "Bấm để đánh dấu hoàn thành" : isCompleted ? "Đã hoàn thành" : "Hoàn thành bước trước để mở"}
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                            isCompleted
                              ? "bg-emerald-600 text-white"
                              : isCurrent
                                ? "cursor-pointer bg-indigo-600 text-white hover:scale-110 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2"
                                : "bg-slate-200 text-slate-500"
                          }`}>
                            {isCompleted ? <Check className="h-4 w-4" /> : isCurrent ? <Circle className="h-3.5 w-3.5 fill-current" /> : <LockKeyhole className="h-3.5 w-3.5" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className={`text-sm font-black ${isCompleted ? "text-emerald-900 line-through decoration-emerald-300" : isCurrent ? "text-slate-950" : "text-slate-500"}`}>
                                {milestone.title}
                              </p>
                              {isCurrent && <span className="rounded-full bg-indigo-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-indigo-700">Đang làm</span>}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Kết quả: {milestone.targetValue} · hạn {formatDisplayDate(milestone.dueDate)}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {current ? (
                  <button
                    type="button"
                    onClick={() => completeCurrentStep(goal)}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-indigo-700"
                  >
                    <Flag className="h-4 w-4" /> Hoàn tất “{current.title}”
                  </button>
                ) : (
                  <div className="mt-5 rounded-2xl bg-emerald-100 px-4 py-3 text-center text-sm font-black text-emerald-800">
                    Hành trình đã hoàn thành
                  </div>
                )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
