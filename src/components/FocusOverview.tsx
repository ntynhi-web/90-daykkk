import React, { useState } from "react";
import { ArrowRight, CheckCircle2, Play, Sparkles, Target, Upload, X } from "lucide-react";
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

export default function FocusOverview({ state, today, currentDay, onChangeState }: FocusOverviewProps) {
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionStep, setCompletionStep] = useState<1 | 2>(1);
  const [output, setOutput] = useState("");
  const [outcome, setOutcome] = useState("");
  const [insight, setInsight] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [completeMilestone, setCompleteMilestone] = useState(false);
  const [completionKind, setCompletionKind] = useState<'done' | 'partial' | 'blocked'>('done');
  const [blockedNeed, setBlockedNeed] = useState('');
  const [blockedReviewDate, setBlockedReviewDate] = useState(() => {
    const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().split('T')[0];
  });
  const [outcomeStatus, setOutcomeStatus] = useState<'pending' | 'measured' | 'not_applicable'>('pending');
  const [outcomeReviewDate, setOutcomeReviewDate] = useState(() => {
    const date = new Date(); date.setDate(date.getDate() + 3); return date.toISOString().split('T')[0];
  });
  const activeGoals = state.goals.filter(goal => goal.status === "active");
  const todayAvailability = (state.weeklyAvailability || []).find(day => day.dayOfWeek === new Date(`${today}T12:00:00`).getDay());
  const suggestedMode = todayAvailability?.mode === 'office' ? 'busy' : todayAvailability?.mode === 'rest' ? 'recovery' : 'normal';
  const dailyMode = state.dailyModeDate === today ? state.dailyMode || suggestedMode : suggestedMode;

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
    .filter(task => linkedGoalId(task) === goalId && !task.completed && !['blocked', 'waiting', 'dropped'].includes(task.status || 'ready'))
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
      ? (state.priorityTasks || []).map(item => item.id === task.id ? { ...item, startedAt: item.startedAt || startedAt, status: 'in_progress' as const } : item)
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

  const cancelSession = () => {
    if (!session || !window.confirm('Hủy phiên tập trung này? Task vẫn được giữ lại để bạn làm sau.')) return;
    onChangeState({
      ...state,
      priorityTasks: (state.priorityTasks || []).map(task => task.id === session.taskId ? { ...task, startedAt: null, status: 'ready' as const } : task),
      activeFocusSession: null
    });
    setShowCompletion(false);
  };

  const currentTask = (state.priorityTasks || []).find(task => task.id === session?.taskId);
  const taskNeedsOutcome = currentTask?.requiresOutcome ?? /email|outreach|seo|ads|quảng cáo|backtest|hồ sơ|application|proposal|thử nghiệm|test|campaign/i.test(session?.title || '');

  const completeSession = () => {
    if (!session) return;
    const completedAt = new Date().toISOString();
    const activity: ActivityEntry = {
      id: `focus_activity_${Date.now()}`,
      date: today,
      goalId: session.goalId,
      milestoneId: session.milestoneId || null,
      source: 'manual',
      activity: `${session.title}${completionKind === 'partial' ? ' · Làm một phần' : completionKind === 'blocked' ? ' · Bị chặn' : ''}`,
      output: { deliverable: output.trim() || (completionKind === 'blocked' ? 'Đã ghi nhận trở ngại' : 'Đã cập nhật công việc'), plannedMinutes: session.plannedMinutes, completionKind },
      outcome: taskNeedsOutcome && outcomeStatus === 'measured' && outcome.trim() ? { result: outcome.trim() } : {},
      outcomeStatus: taskNeedsOutcome && completionKind !== 'blocked' ? outcomeStatus : 'not_applicable',
      outcomeReviewDate: taskNeedsOutcome && completionKind !== 'blocked' && outcomeStatus === 'pending' ? outcomeReviewDate : null,
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
      priorityTasks: (state.priorityTasks || []).map(task => task.id === session.taskId ? {
        ...task,
        completed: completionKind === 'done',
        completedAt: completionKind === 'done' ? completedAt : null,
        startedAt: null,
        status: completionKind === 'done' ? 'completed' as const : completionKind === 'blocked' ? 'blocked' as const : 'ready' as const,
        blockedReason: completionKind === 'blocked' ? output.trim() : null,
        waitingUntil: completionKind === 'blocked' ? blockedReviewDate : null,
        description: completionKind === 'blocked' && blockedNeed.trim() ? `${task.description || ''}\nCần để gỡ chặn: ${blockedNeed.trim()}`.trim() : task.description
      } : task),
      scheduleItems: (state.scheduleItems || []).map(item => item.taskId === session.taskId && completionKind === 'done' ? { ...item, completed: true } : item),
      activeFocusSession: null
    });
    setShowCompletion(false);
    setCompletionStep(1); setCompletionKind('done'); setBlockedNeed(''); setOutput(''); setOutcome(''); setInsight(''); setNextAction(''); setCompleteMilestone(false); setOutcomeStatus('pending');
  };

  return (
    <section id="section-daily-focus" className="grid grid-cols-1 gap-5 xl:grid-cols-[1.65fr_0.75fr]">
      <div className="overflow-hidden rounded-[30px] bg-gradient-to-br from-indigo-700 via-indigo-650 to-violet-700 text-white shadow-[0_28px_70px_rgba(67,56,202,0.28)] ring-1 ring-indigo-500/30">
        <div className="border-b border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <GoalIcon icon={focusGoal.icon} color="#ffffff" size={22} className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">Ưu tiên số 1 hôm nay</p>
                <h2 className="mt-2 font-display text-2xl font-black tracking-tight text-white md:text-3xl">{focusGoal.name}</h2>
                <p className="mt-1 text-sm font-semibold text-indigo-100">{activeMilestone?.title || focusGoal.currentMilestone}</p>
              </div>
            </div>
            <details className="relative shrink-0">
              <summary className="cursor-pointer list-none rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white">Đổi ưu tiên</summary>
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl bg-white p-2 text-slate-900 shadow-2xl">
                {activeGoals.map(goal => <button key={goal.id} onClick={() => selectFocus(goal.id)} className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-bold ${goal.id === focusGoal.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`}>{goal.name}</button>)}
              </div>
            </details>
          </div>
        </div>

        <div className="space-y-6 p-6 md:p-8">
          <div className="rounded-[24px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm md:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Việc cần làm trước</p>
                <p className="mt-3 text-xl font-black leading-snug text-white md:text-2xl">{nextTask?.title || focusGoal.nextAction || activeMilestone?.title || "Đánh giá mục tiêu"}</p>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-indigo-100">Kết quả cần tạo: bằng chứng rõ ràng cho cột mốc “{activeMilestone?.title || focusGoal.currentMilestone}”. Bạn tự làm theo nhịp của mình rồi quay lại cập nhật.</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {sessionBelongsHere ? (
                  <>
                    <span className="flex items-center gap-2 rounded-xl bg-emerald-400/20 px-3 py-2.5 text-sm font-black text-emerald-100 ring-1 ring-emerald-300/30"><CheckCircle2 className="h-4 w-4" />Đang thực hiện</span>
                    <button type="button" onClick={() => setShowCompletion(true)} className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-indigo-700 shadow-lg"><Upload className="h-4 w-4" />Cập nhật kết quả</button>
                    <button type="button" onClick={cancelSession} className="rounded-xl px-2 py-2.5 text-xs font-bold text-indigo-100 underline decoration-indigo-300/50 underline-offset-4">Đổi việc</button>
                  </>
                ) : (
                  <button type="button" onClick={startNextAction} disabled={Boolean(session)} className="flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-black text-indigo-700 shadow-xl transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"><Play className="h-4 w-4" />Bắt đầu công việc</button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 text-sm leading-relaxed text-indigo-100">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span><strong>Vì sao việc này đứng đầu:</strong> {focusReason}</span>
          </div>

        </div>
      </div>

      <div className="rounded-[28px] border border-sky-200 bg-sky-50/80 p-5 shadow-[0_16px_40px_rgba(14,165,233,0.08)] md:p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Việc hỗ trợ</p><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-sky-800 ring-1 ring-sky-200">{maintenanceGoals.length}</span></div>
          <h2 className="mt-2 font-display text-xl font-black text-slate-950">Làm sau khi xong việc chính</h2>
          <p className="mt-1 text-sm text-slate-600">Không cạnh tranh với ưu tiên số 1.</p>
        </div>

        <div className="space-y-3">
          {maintenanceGoals.map(goal => {
            const routine = state.routines.find(item => item.goalId === goal.id && item.active !== false && item.status !== "completed");
            const task = goalTasks(goal.id)[0];
            return (
              <div key={goal.id} className="rounded-2xl border border-sky-200 bg-white/75 p-4 transition hover:bg-white">
                <div className="flex items-center gap-3">
                  <GoalIcon icon={goal.icon} color={goal.accentColor} size={16} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-extrabold text-slate-900">{goal.name}</p>
                    <p className="mt-1 truncate text-sm text-slate-500">{routine?.minimumDay || task?.title || goal.nextAction || "Duy trì nhịp tối thiểu"}</p>
                  </div>
                  <div className="text-right"><span className="block text-sm font-black text-sky-800">{getProgress(goal)}%</span><span className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-500">{goalTasks(goal.id).length} việc <ArrowRight className="h-3 w-3" /></span></div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="border-t border-sky-200 pt-4 text-sm leading-relaxed text-slate-600">Chỉ mở các việc này sau khi hoàn thành hoặc chủ động đổi ưu tiên số 1.</p>
      </div>

      {showCompletion && session && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[26px] bg-white p-5 shadow-2xl md:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">Cập nhật công việc{taskNeedsOutcome ? ` · Bước ${completionStep}/2` : ''}</p><h3 className="mt-2 text-2xl font-black text-slate-950">{completionStep === 1 ? 'Công việc đang ở trạng thái nào?' : 'Kết quả đã xuất hiện chưa?'}</h3><p className="mt-1 text-sm text-slate-500">{completionStep === 1 ? 'App chỉ hỏi những gì cần thiết cho trạng thái bạn chọn.' : 'Việc này cần đo hiệu quả nên bạn có thể cập nhật ngay hoặc đặt ngày kiểm tra.'}</p></div><button onClick={() => setShowCompletion(false)} className="rounded-xl bg-slate-100 p-2 text-slate-500"><X className="h-4 w-4" /></button></div>
            {completionStep === 1 ? <div className="mt-5 space-y-4"><div className="grid grid-cols-3 gap-2">{([['done','Đã xong'],['partial','Một phần'],['blocked','Bị chặn']] as const).map(([kind,label]) => <button key={kind} onClick={() => setCompletionKind(kind)} className={`rounded-xl border px-2 py-3 text-sm font-black ${completionKind === kind ? kind === 'blocked' ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-500'}`}>{label}</button>)}</div><label className="block"><span className="text-sm font-black text-slate-700">{completionKind === 'blocked' ? 'Bạn đang bị chặn bởi điều gì? *' : completionKind === 'partial' ? 'Bạn đã làm được phần nào? *' : 'Bằng chứng hoặc kết quả đã tạo *'}</span><textarea value={output} onChange={event => setOutput(event.target.value)} placeholder={completionKind === 'blocked' ? 'Ví dụ: thiếu dữ liệu, đang chờ phản hồi hoặc chưa có quyền truy cập' : 'Mô tả ngắn hoặc dán đường dẫn file/ảnh đã tải lên'} className="mt-1.5 min-h-28 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400" /></label>{completionKind === 'blocked' && <div className="grid gap-3 sm:grid-cols-2"><label><span className="text-sm font-black text-slate-700">Cần gì để gỡ chặn?</span><input value={blockedNeed} onChange={event => setBlockedNeed(event.target.value)} placeholder="Dữ liệu, phản hồi, quyền truy cập…" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label><label><span className="text-sm font-black text-slate-700">Kiểm tra lại</span><input type="date" value={blockedReviewDate} onChange={event => setBlockedReviewDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label></div>}<button onClick={() => taskNeedsOutcome && completionKind !== 'blocked' ? setCompletionStep(2) : completeSession()} disabled={!output.trim()} className="w-full rounded-2xl bg-indigo-600 px-3 py-3.5 text-sm font-black text-white disabled:opacity-40">{taskNeedsOutcome && completionKind !== 'blocked' ? 'Tiếp tục cập nhật hiệu quả' : completionKind === 'blocked' ? 'Lưu & chuyển sang việc khác' : 'Lưu cập nhật'}</button>{!taskNeedsOutcome && completionKind !== 'blocked' && <p className="text-center text-xs text-slate-400">Việc này không cần đưa vào hàng chờ đo hiệu quả.</p>}</div> : <div className="mt-5 space-y-4">
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
