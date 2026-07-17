import React, { useEffect, useState } from "react";
import { Pause, Play, Sparkles, Square, Target, X } from "lucide-react";
import { ActivityEntry, AppState, Goal, PriorityTask } from "../types";
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
  const [now, setNow] = useState(Date.now());
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionStep, setCompletionStep] = useState<1 | 2>(1);
  const [output, setOutput] = useState("");
  const [outcome, setOutcome] = useState("");
  const [insight, setInsight] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [completeMilestone, setCompleteMilestone] = useState(false);
  const [outcomeStatus, setOutcomeStatus] = useState<'pending' | 'measured' | 'not_applicable'>('pending');
  const [outcomeReviewDate, setOutcomeReviewDate] = useState(() => {
    const date = new Date(); date.setDate(date.getDate() + 3); return date.toISOString().split('T')[0];
  });
  const activeGoals = state.goals.filter(goal => goal.status === "active");
  const todayAvailability = (state.weeklyAvailability || []).find(day => day.dayOfWeek === new Date(`${today}T12:00:00`).getDay());
  const suggestedMode = todayAvailability?.mode === 'office' ? 'busy' : todayAvailability?.mode === 'rest' ? 'recovery' : 'normal';
  const dailyMode = state.dailyModeDate === today ? state.dailyMode || suggestedMode : suggestedMode;
  const modeIsSuggested = state.dailyModeDate !== today;

  useEffect(() => {
    if (state.activeFocusSession?.status !== 'active') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.activeFocusSession?.status]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      const current = state.activeFocusSession;
      if (document.visibilityState !== 'hidden' || !current || current.status !== 'active') return;
      const elapsed = current.elapsedSeconds + Math.max(0, Math.floor((Date.now() - new Date(current.startedAt).getTime()) / 1000));
      onChangeState({ ...state, activeFocusSession: { ...current, elapsedSeconds: elapsed, status: 'paused', startedAt: new Date().toISOString() } });
    };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, [state, onChangeState]);

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
    const weeklyWeight = state.weeklyFocusGoalId === goal.id ? 60 : (state.weeklySupportGoalIds || []).includes(goal.id) ? 8 : 0;
    const urgentTaskWeight = (state.priorityTasks || []).some(task => linkedGoalId(task) === goal.id && !task.completed && task.priority === 'important_urgent' && (!task.dueDate || task.dueDate <= today)) ? 80 : 0;
    const urgencyWeight = daysToDeadline < 0 ? 45 : daysToDeadline <= 2 ? 32 : daysToDeadline <= 7 ? 16 : 0;
    const rotationWeight = index === ((Math.max(1, currentDay) - 1) % Math.max(1, activeGoals.length)) ? 14 : 0;
    return priorityWeight + weeklyWeight + urgentTaskWeight + urgencyWeight + Math.min(18, neglectedDays * 3) + Math.min(18, scheduledMinutes / 10) + rotationWeight;
  };

  const rankedGoals = [...activeGoals].sort((a, b) => {
    const aIndex = activeGoals.findIndex(goal => goal.id === a.id);
    const bIndex = activeGoals.findIndex(goal => goal.id === b.id);
    return scoreGoal(b, bIndex) - scoreGoal(a, aIndex);
  });

  const savedFocus = state.dailyFocusDate === today
    ? activeGoals.find(goal => goal.id === state.dailyFocusGoalId)
    : null;
  const emergencyGoal = activeGoals.find(goal => (state.priorityTasks || []).some(task => linkedGoalId(task) === goal.id && !task.completed && task.priority === 'important_urgent' && (!task.dueDate || task.dueDate <= today)));
  const weeklyGoal = activeGoals.find(goal => goal.id === state.weeklyFocusGoalId);
  const sessionGoal = activeGoals.find(goal => goal.id === state.activeFocusSession?.goalId);
  const focusGoal = sessionGoal || emergencyGoal || savedFocus || weeklyGoal || rankedGoals[0] || null;
  const supportOrder = (state.weeklySupportGoalIds || []).map(id => activeGoals.find(goal => goal.id === id)).filter(Boolean) as Goal[];
  const maintenanceLimit = dailyMode === 'normal' ? 2 : dailyMode === 'busy' ? 1 : 0;
  const maintenanceGoals = [...supportOrder, ...rankedGoals.filter(goal => !supportOrder.some(item => item.id === goal.id))].filter(goal => goal.id !== focusGoal?.id).slice(0, maintenanceLimit);

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
  const focusReason = emergencyGoal?.id === focusGoal.id
    ? "Có việc Quan trọng & Khẩn cấp đến hạn nên tạm thời vượt trọng tâm tuần."
    : activeMilestone && dateDistance(today, activeMilestone.dueDate) <= 2
    ? `Cột mốc “${activeMilestone.title}” đang gần hoặc đã tới hạn.`
    : (state.scheduleItems || []).some(item => item.date === today && linkedGoalId(item) === focusGoal.id)
      ? "Mục tiêu này đã có block tập trung trong lịch hôm nay."
      : state.weeklyFocusGoalId === focusGoal.id
        ? "Đây là trọng tâm tuần nên được ưu tiên trước các mục tiêu duy trì."
        : "Được chọn dựa trên mức ưu tiên, nhịp luân phiên và thời gian chưa được cập nhật.";

  const session = state.activeFocusSession;
  const sessionBelongsHere = session?.goalId === focusGoal.id;
  const elapsedSeconds = !session ? 0 : session.status === 'paused'
    ? session.elapsedSeconds
    : session.elapsedSeconds + Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1000));
  const timerLabel = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
  const recommendedMinutes = dailyMode === 'recovery' ? Math.min(nextTask?.estimatedMinutes || 30, 10) : dailyMode === 'busy' ? Math.min(nextTask?.estimatedMinutes || 30, 15) : nextTask?.estimatedMinutes || 30;

  const startNextAction = () => {
    const startedAt = new Date().toISOString();
    const task: PriorityTask = nextTask || {
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
    const tasks = nextTask
      ? (state.priorityTasks || []).map(item => item.id === task.id ? { ...item, startedAt: item.startedAt || startedAt } : item)
      : [task, ...(state.priorityTasks || [])];
    onChangeState({
      ...state,
      priorityTasks: tasks,
      activeFocusSession: {
        id: `focus_${Date.now()}`,
        title: task.title,
        taskId: task.id,
        goalId: focusGoal.id,
        milestoneId: task.milestoneId || activeMilestone?.id || null,
        date: today,
        plannedMinutes: recommendedMinutes,
        startedAt,
        elapsedSeconds: 0,
        status: 'active'
      }
    });
  };

  const pauseSession = () => session && onChangeState({
    ...state,
    activeFocusSession: { ...session, elapsedSeconds, status: 'paused', startedAt: new Date().toISOString() }
  });

  const resumeSession = () => session && onChangeState({
    ...state,
    activeFocusSession: { ...session, status: 'active', startedAt: new Date().toISOString() }
  });

  const cancelSession = () => {
    if (!session || !window.confirm('Hủy phiên tập trung này? Task vẫn được giữ lại để bạn làm sau.')) return;
    onChangeState({
      ...state,
      priorityTasks: (state.priorityTasks || []).map(task => task.id === session.taskId ? { ...task, startedAt: null } : task),
      activeFocusSession: null
    });
    setShowCompletion(false);
  };

  const completeSession = () => {
    if (!session) return;
    const completedAt = new Date().toISOString();
    const activity: ActivityEntry = {
      id: `focus_activity_${Date.now()}`,
      date: today,
      goalId: session.goalId,
      milestoneId: session.milestoneId || null,
      source: 'manual',
      activity: session.title,
      output: { deliverable: output.trim() || 'Đã hoàn thành focus session', plannedMinutes: session.plannedMinutes, actualMinutes: Math.max(1, Math.round(elapsedSeconds / 60)) },
      outcome: outcomeStatus === 'measured' && outcome.trim() ? { result: outcome.trim() } : {},
      outcomeStatus,
      outcomeReviewDate: outcomeStatus === 'pending' ? outcomeReviewDate : null,
      insight: insight.trim() || null,
      nextAction: nextAction.trim() || null,
      confidence: outcomeStatus === 'measured' && outcome.trim() ? 0.9 : 0.7,
      createdTimestamp: Date.now(),
      updatedTimestamp: Date.now()
    };
    const nextGoals = state.goals.map(goal => {
      if (goal.id !== session.goalId) return goal;
      const milestones = goal.milestones.map(milestone => milestone.id === session.milestoneId && completeMilestone ? { ...milestone, achieved: true, status: 'completed' as const, completedAt } : milestone);
      const firstOpen = milestones.find(milestone => !milestone.achieved);
      return {
        ...goal,
        milestones: milestones.map(milestone => milestone.id === firstOpen?.id ? { ...milestone, status: 'active' as const } : milestone),
        currentMilestoneId: firstOpen?.id || null,
        currentMilestone: firstOpen?.title || 'Hoàn thành',
        currentProgress: milestones.length ? Math.round(milestones.filter(milestone => milestone.achieved).length / milestones.length * 100) : goal.currentProgress,
        nextAction: nextAction.trim() || goal.nextAction,
        status: firstOpen ? goal.status : 'completed' as const
      };
    });
    onChangeState({
      ...state,
      goals: nextGoals,
      activities: [activity, ...state.activities],
      priorityTasks: (state.priorityTasks || []).map(task => task.id === session.taskId ? { ...task, completed: true, completedAt } : task),
      scheduleItems: (state.scheduleItems || []).map(item => item.taskId === session.taskId ? { ...item, completed: true } : item),
      activeFocusSession: null
    });
    setShowCompletion(false);
    setCompletionStep(1); setOutput(''); setOutcome(''); setInsight(''); setNextAction(''); setCompleteMilestone(false); setOutcomeStatus('pending');
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
                <p className="mt-1 text-xs font-semibold text-slate-500">{activeMilestone?.title || focusGoal.currentMilestone}</p>
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

        <div className="space-y-5 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Năng lực hôm nay</p>{modeIsSuggested && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-black text-indigo-700">App đề xuất theo lịch</span>}</div><p className="mt-1 text-xs text-slate-500">{todayAvailability?.label || 'App sẽ tự thu nhỏ kế hoạch, không xem ngày bận là thất bại.'}</p></div><div className="flex rounded-xl bg-slate-100 p-1">{([['normal','Bình thường'],['busy','Bận'],['recovery','Phục hồi']] as const).map(([mode,label]) => <button key={mode} onClick={() => onChangeState({ ...state, dailyMode: mode, dailyModeDate: today })} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black transition ${dailyMode === mode ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div></div>

          <div className="rounded-[22px] border border-indigo-200 bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-indigo-100">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-200">Làm ngay · {recommendedMinutes} phút</p>
                <p className="mt-2 text-lg font-black leading-snug">{nextTask?.title || focusGoal.nextAction || activeMilestone?.title || "Đánh giá mục tiêu"}</p>
                <p className="mt-2 text-xs text-indigo-100">Hoàn thành việc này sẽ tạo bằng chứng cho cột mốc “{activeMilestone?.title || focusGoal.currentMilestone}”.</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {sessionBelongsHere ? (
                  <>
                    <span className="rounded-xl bg-white/15 px-3 py-2 font-mono text-sm font-black tabular-nums">{timerLabel}</span>
                    <button type="button" onClick={session.status === 'active' ? pauseSession : resumeSession} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-black text-indigo-700">{session.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{session.status === 'active' ? 'Tạm dừng' : 'Tiếp tục'}</button>
                    <button type="button" onClick={() => setShowCompletion(true)} className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2.5 text-xs font-black text-white"><Square className="h-3.5 w-3.5" />Hoàn thành</button>
                    <button type="button" onClick={cancelSession} className="rounded-xl px-2 py-2.5 text-[10px] font-bold text-indigo-100 underline decoration-indigo-300/50 underline-offset-4">Hủy phiên</button>
                  </>
                ) : (
                  <button type="button" onClick={startNextAction} disabled={Boolean(session)} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-indigo-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><Play className="h-4 w-4" />Bắt đầu</button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            <span><strong>Vì sao việc này đứng đầu:</strong> {focusReason}</span>
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
            const routine = state.routines.find(item => item.goalId === goal.id && item.active !== false && item.status !== "completed");
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

      {showCompletion && session && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[26px] bg-white p-5 shadow-2xl md:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="life-kicker text-indigo-600">Hoàn thành phiên tập trung · {timerLabel} · Bước {completionStep}/2</p><h3 className="mt-2 text-xl font-black text-slate-950">{completionStep === 1 ? 'Bạn đã tạo ra điều gì?' : 'Kết quả đã xuất hiện chưa?'}</h3><p className="mt-1 text-xs text-slate-500">{completionStep === 1 ? 'Chỉ cần ghi bằng chứng bắt buộc trước.' : 'Nếu chưa có kết quả, app sẽ nhắc bạn kiểm tra lại.'}</p></div><button onClick={() => setShowCompletion(false)} className="rounded-xl bg-slate-100 p-2 text-slate-500"><X className="h-4 w-4" /></button></div>
            {completionStep === 1 ? <div className="mt-5"><label className="block"><span className="text-xs font-black text-slate-700">Sản phẩm hoặc bằng chứng đã tạo *</span><textarea value={output} onChange={event => setOutput(event.target.value)} placeholder="Ví dụ: hoàn thành checklist setup và ghi 20 lệnh backtest" className="mt-1.5 min-h-28 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400" /></label><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={completeSession} disabled={!output.trim()} className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-xs font-black text-indigo-800 disabled:opacity-40">Lưu nhanh</button><button onClick={() => setCompletionStep(2)} disabled={!output.trim()} className="rounded-2xl bg-indigo-600 px-3 py-3 text-xs font-black text-white disabled:opacity-40">Thêm kết quả</button></div><p className="mt-2 text-center text-[10px] text-slate-400">Lưu nhanh sẽ đưa hoạt động vào hàng đợi kiểm tra kết quả sau.</p></div> : <div className="mt-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">{([['pending','Chưa có'],['measured','Đã có'],['not_applicable','Không cần']] as const).map(([status,label]) => <button key={status} onClick={() => setOutcomeStatus(status)} className={`rounded-xl border px-2 py-2.5 text-xs font-black ${outcomeStatus === status ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-500'}`}>{label}</button>)}</div>
              {outcomeStatus === 'pending' && <label className="block"><span className="text-xs font-black text-slate-700">Nhắc kiểm tra kết quả vào ngày</span><input type="date" value={outcomeReviewDate} onChange={event => setOutcomeReviewDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>}
              {outcomeStatus === 'measured' && <label className="block"><span className="text-xs font-black text-slate-700">Kết quả ban đầu</span><textarea value={outcome} onChange={event => setOutcome(event.target.value)} placeholder="Ví dụ: tìm thấy 2 lỗi lặp lại trong setup" className="mt-1.5 min-h-20 w-full rounded-2xl border border-slate-200 p-3 text-sm" /></label>}
              <div className="grid gap-3 sm:grid-cols-2"><label><span className="text-xs font-black text-slate-700">Bài học · tùy chọn</span><input value={insight} onChange={event => setInsight(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label><label><span className="text-xs font-black text-slate-700">Bước tiếp theo · tùy chọn</span><input value={nextAction} onChange={event => setNextAction(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label></div>
              {session.milestoneId && <label className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-900"><input type="checkbox" checked={completeMilestone} onChange={event => setCompleteMilestone(event.target.checked)} className="mt-0.5" /><span>Đủ bằng chứng để hoàn thành cột mốc hiện tại.</span></label>}
              <div className="flex gap-2"><button onClick={() => setCompletionStep(1)} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-600">Quay lại</button><button onClick={completeSession} disabled={outcomeStatus === 'measured' && !outcome.trim()} className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Lưu & hoàn thành</button></div>
            </div>}
          </div>
        </div>
      )}
    </section>
  );
}
