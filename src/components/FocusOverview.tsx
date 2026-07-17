import React from "react";
import { Check, Play, Sparkles, Target } from "lucide-react";
import { AppState, Goal, PriorityTask } from "../types";
import GoalIcon from "./GoalIcon";

interface FocusOverviewProps {
  state: AppState;
  today: string;
  currentDay: number;
  onChangeState: (state: AppState) => void;
}

const linkedGoalId = (item: { goalId?: string | null; journeyId?: string | null }) =>
  item.goalId || item.journeyId || null;

const dateDistance = (from: string, to: string) => {
  const fromTime = new Date(`${from}T00:00:00`).getTime();
  const toTime = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return 999;
  return Math.ceil((toTime - fromTime) / 86_400_000);
};

const goalTone = () => "border-slate-200 bg-white hover:border-indigo-200";

export default function FocusOverview({ state, today, currentDay, onChangeState }: FocusOverviewProps) {
  const activeGoals = state.goals.filter(goal => goal.status === "active");

  const lastActivityDate = (goalId: string) =>
    state.activities
      .filter(activity => activity.goalId === goalId)
      .map(activity => activity.date)
      .sort()
      .at(-1) || null;

  const scoreGoal = (goal: Goal, index: number) => {
    const activeMilestone = goal.milestones.find(milestone => !milestone.achieved);
    const daysToDeadline = activeMilestone?.dueDate ? dateDistance(today, activeMilestone.dueDate) : 999;
    const lastDate = lastActivityDate(goal.id);
    const neglectedDays = lastDate ? Math.max(0, -dateDistance(today, lastDate)) : 7;
    const scheduledMinutes = (state.scheduleItems || [])
      .filter(item => item.date === today && linkedGoalId(item) === goal.id && !item.completed)
      .reduce((sum, item) => {
        const [startHour, startMinute] = item.startTime.split(":").map(Number);
        const [endHour, endMinute] = item.endTime.split(":").map(Number);
        return sum + Math.max(0, (endHour * 60 + endMinute) - (startHour * 60 + startMinute));
      }, 0);
    const priorityWeight = goal.priority === "highest" ? 18 : goal.priority === "secondary" ? 10 : 4;
    const urgencyWeight = daysToDeadline < 0 ? 45 : daysToDeadline <= 2 ? 32 : daysToDeadline <= 7 ? 16 : 0;
    const rotationWeight = index === ((Math.max(1, currentDay) - 1) % Math.max(1, activeGoals.length)) ? 14 : 0;
    return priorityWeight + urgencyWeight + Math.min(18, neglectedDays * 3) + Math.min(18, scheduledMinutes / 10) + rotationWeight;
  };

  const rankedGoals = [...activeGoals].sort((a, b) => {
    const aIndex = activeGoals.findIndex(goal => goal.id === a.id);
    const bIndex = activeGoals.findIndex(goal => goal.id === b.id);
    return scoreGoal(b, bIndex) - scoreGoal(a, aIndex);
  });

  const savedFocus = state.dailyFocusDate === today
    ? activeGoals.find(goal => goal.id === state.dailyFocusGoalId)
    : null;
  const focusGoal = savedFocus || rankedGoals[0] || null;
  const maintenanceGoals = rankedGoals.filter(goal => goal.id !== focusGoal?.id).slice(0, 2);

  const getProgress = (goal: Goal) => {
    if (!goal.milestones.length) return goal.currentProgress || 0;
    return Math.round((goal.milestones.filter(milestone => milestone.achieved).length / goal.milestones.length) * 100);
  };

  const goalTasks = (goalId: string) => (state.priorityTasks || [])
    .filter(task => linkedGoalId(task) === goalId && !task.completed)
    .sort((a, b) => {
      const order: Record<PriorityTask["priority"], number> = { important_urgent: 0, important: 1, urgent: 2, later: 3 };
      return order[a.priority] - order[b.priority];
    });

  const toggleTask = (taskId: string) => {
    onChangeState({
      ...state,
      priorityTasks: (state.priorityTasks || []).map(task =>
        task.id === taskId ? { ...task, completed: !task.completed, completedAt: !task.completed ? new Date().toISOString() : null } : task
      )
    });
  };

  const selectFocus = (goalId: string) => {
    onChangeState({ ...state, dailyFocusGoalId: goalId, dailyFocusDate: today });
  };

  if (!focusGoal) {
    return (
      <section className="life-panel p-6 text-center">
        <Target className="mx-auto h-6 w-6 text-slate-300" />
        <h2 className="mt-3 font-display text-lg font-extrabold text-slate-900">Chưa có mục tiêu đang hoạt động</h2>
        <p className="mt-1 text-xs text-slate-400">Tạo một hành trình để app có thể đề xuất trọng tâm cho hôm nay.</p>
      </section>
    );
  }

  const focusTasks = goalTasks(focusGoal.id).slice(0, 1);
  const nextTask = focusTasks[0] || null;
  const activeMilestone = focusGoal.milestones.find(milestone => !milestone.achieved) || null;
  const progress = getProgress(focusGoal);
  const focusIndex = activeGoals.findIndex(goal => goal.id === focusGoal.id);
  const focusScore = scoreGoal(focusGoal, focusIndex);
  const focusReason = activeMilestone && dateDistance(today, activeMilestone.dueDate) <= 2
    ? `Cột mốc “${activeMilestone.title}” đang gần hoặc đã tới hạn.`
    : (state.scheduleItems || []).some(item => item.date === today && linkedGoalId(item) === focusGoal.id)
      ? "Mục tiêu này đã có block tập trung trong lịch hôm nay."
      : "Được chọn dựa trên mức ưu tiên, nhịp luân phiên và thời gian chưa được cập nhật.";

  const startNextAction = () => {
    const startedAt = new Date().toISOString();
    if (nextTask) {
      onChangeState({ ...state, priorityTasks: (state.priorityTasks || []).map(task => task.id === nextTask.id ? { ...task, startedAt } : task) });
      return;
    }
    const task: PriorityTask = {
      id: `next_action_${Date.now()}`,
      title: focusGoal.nextAction || activeMilestone?.title || "Đánh giá bước tiếp theo",
      goalId: focusGoal.id,
      milestoneId: activeMilestone?.id || null,
      priority: 'important',
      estimatedMinutes: 30,
      dueDate: today,
      completed: false,
      createdAt: startedAt,
      startedAt
    };
    onChangeState({ ...state, priorityTasks: [task, ...(state.priorityTasks || [])] });
  };

  return (
    <section id="section-daily-focus" className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.8fr] gap-4">
      <div className="life-panel overflow-hidden border-t-4 border-t-indigo-600 shadow-[0_20px_50px_rgba(79,70,229,0.10)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/90 via-white to-white p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <GoalIcon icon={focusGoal.icon} color={focusGoal.accentColor} size={20} className="rounded-2xl p-3" />
              <div>
        <p className="life-kicker text-indigo-600">01 · Việc tiếp theo tốt nhất</p>
                <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight text-slate-950">{focusGoal.name}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{focusGoal.desiredOutcome}</p>
              </div>
            </div>
            <label className="shrink-0">
              <span className="sr-only">Đổi main focus</span>
              <select
                value={focusGoal.id}
                onChange={event => selectFocus(event.target.value)}
                className="rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs font-bold text-indigo-700 outline-none focus:ring-4 focus:ring-indigo-100"
              >
                {activeGoals.map(goal => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="p-5 md:p-6 space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cột mốc hiện tại</p>
                <p className="mt-1 text-sm font-extrabold text-slate-900">{activeMilestone?.title || "Đã hoàn thành toàn bộ cột mốc"}</p>
                <p className="mt-1 text-[11px] text-slate-500">{focusGoal.nextAction || activeMilestone?.description || "Đánh giá kết quả và chọn bước tiếp theo."}</p>
              </div>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-700">{progress}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="rounded-[22px] border border-indigo-200 bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-indigo-100">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-200">Làm ngay · {nextTask?.estimatedMinutes || 30} phút</p>
                <p className="mt-2 text-lg font-black leading-snug">{nextTask?.title || focusGoal.nextAction || activeMilestone?.title || "Đánh giá mục tiêu"}</p>
                <p className="mt-2 text-xs text-indigo-100">Hoàn thành việc này sẽ tạo bằng chứng cho cột mốc “{activeMilestone?.title || focusGoal.currentMilestone}”.</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={startNextAction} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-indigo-700 shadow-sm"><Play className="h-4 w-4" />{nextTask?.startedAt ? 'Tiếp tục' : 'Bắt đầu'}</button>
                {nextTask && <button type="button" onClick={() => toggleTask(nextTask.id)} aria-label="Đánh dấu hoàn thành" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20"><Check className="h-4 w-4" /></button>}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            <span><strong>Vì sao việc này đứng đầu:</strong> {focusReason} <span className="text-slate-400">Điểm ưu tiên {Math.round(focusScore)}.</span></span>
          </div>
        </div>
      </div>

      <div className="life-panel border-t-4 border-t-slate-300 p-5 md:p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3"><p className="life-kicker text-slate-500">Mục tiêu duy trì</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700">{maintenanceGoals.length} mục tiêu</span></div>
          <h2 className="mt-2 font-display text-lg font-extrabold text-slate-950">Giữ nhịp, không tạo áp lực</h2>
          <p className="mt-1 text-xs text-slate-400">Mỗi mục tiêu chỉ cần một hành động tối thiểu.</p>
        </div>

        <div className="space-y-3">
          {maintenanceGoals.map(goal => {
            const routine = state.routines.find(item => item.goalId === goal.id && item.status !== "completed");
            const task = goalTasks(goal.id)[0];
            return (
              <div key={goal.id} className={`rounded-2xl border p-4 shadow-sm transition ${goalTone()}`}>
                <div className="flex items-center gap-3">
                  <GoalIcon icon={goal.icon} color={goal.accentColor} size={16} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-slate-900">{goal.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">{routine?.minimumDay || task?.title || goal.nextAction || "Duy trì nhịp tối thiểu"}</p>
                  </div>
                  <div className="text-right"><span className="block text-[10px] font-black text-slate-700">{getProgress(goal)}%</span><span className="mt-1 block rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold text-slate-500">{goalTasks(goal.id).length} việc</span></div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-500">Chỉ cần giữ nhịp tối thiểu ở đây. Cột mốc, outcome và phân tích chi tiết nằm trong màn <strong>Kết quả</strong>.</p>
      </div>
    </section>
  );
}
