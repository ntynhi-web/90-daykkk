import React, { useRef, useState } from "react";
import { Check, Circle, Flag, LockKeyhole, Pencil, Save, TrendingUp, X } from "lucide-react";
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
  const [progressEditorId, setProgressEditorId] = useState<string | null>(null);
  const [progressDraft, setProgressDraft] = useState({ progress: 10, note: "" });
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneDraft, setMilestoneDraft] = useState({ title: "", targetValue: "", dueDate: "" });
  const [editNotice, setEditNotice] = useState("");

  const milestoneLogs = state.milestoneProgressLogs || [];
  const getMilestoneLogs = (milestoneId: string) => milestoneLogs
    .filter(log => log.milestoneId === milestoneId)
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  const getMilestoneProgress = (milestone: Goal["milestones"][number]) => {
    if (milestone.achieved) return 100;
    return getMilestoneLogs(milestone.id)[0]?.progress || 0;
  };

  const openProgressEditor = (milestone: Goal["milestones"][number]) => {
    setProgressDraft({ progress: getMilestoneProgress(milestone), note: "" });
    setProgressEditorId(milestone.id);
  };

  const openMilestoneEditor = (milestone: Goal["milestones"][number]) => {
    setMilestoneDraft({ title: milestone.title, targetValue: milestone.targetValue, dueDate: milestone.dueDate });
    setEditingMilestoneId(milestone.id);
    setEditNotice("");
  };

  const saveMilestoneEdit = (goal: Goal, milestoneId: string) => {
    const title = milestoneDraft.title.trim();
    const targetValue = milestoneDraft.targetValue.trim();
    if (!title || !targetValue) return setEditNotice("Tên mục và kết quả không được để trống.");
    if (title.length > 120 || targetValue.length > 240) return setEditNotice("Tên tối đa 120 ký tự; kết quả tối đa 240 ký tự.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(milestoneDraft.dueDate) || milestoneDraft.dueDate < state.startDate || milestoneDraft.dueDate > state.endDate) return setEditNotice(`Hạn phải nằm trong chu kỳ ${state.startDate}–${state.endDate}.`);
    onChangeState({ ...state, goals: state.goals.map(item => item.id === goal.id ? { ...item, milestones: item.milestones.map(milestone => milestone.id === milestoneId ? { ...milestone, title, targetValue, dueDate: milestoneDraft.dueDate } : milestone) } : item) });
    setEditingMilestoneId(null);
    setEditNotice("");
  };

  const saveMilestoneProgress = (goal: Goal, milestoneId: string) => {
    const progress = Math.max(0, Math.min(100, Math.round(Number(progressDraft.progress))));
    if (!Number.isFinite(progress) || progressDraft.note.trim().length > 500 || completingRef.current.has(`progress:${milestoneId}`)) return;
    completingRef.current.add(`progress:${milestoneId}`);
    const now = Date.now();
    const completedAt = progress === 100 ? new Date(now).toISOString() : null;
    const updatedMilestones = goal.milestones.map(milestone => milestone.id === milestoneId
      ? { ...milestone, currentValue: `${progress}%`, achieved: progress === 100, status: progress === 100 ? "completed" as const : "active" as const, completedAt }
      : milestone);
    const nextMilestone = updatedMilestones.find(milestone => !milestone.parallel && !milestone.achieved && milestone.status !== "skipped") || null;
    const allLogs = [{
      id: `milestone_progress_${milestoneId}_${now}`,
      goalId: goal.id,
      milestoneId,
      date: today,
      time: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(now)),
      progress,
      note: progressDraft.note.trim(),
      createdTimestamp: now
    }, ...milestoneLogs];
    const weightedProgress = Math.round(updatedMilestones.reduce((sum, milestone) => {
      if (milestone.achieved) return sum + 100;
      return sum + (milestone.id === milestoneId ? progress : getMilestoneProgress(milestone));
    }, 0) / Math.max(updatedMilestones.length, 1));
    const allCompleted = updatedMilestones.every(milestone => milestone.achieved || milestone.status === "skipped");

    onChangeState({
      ...state,
      milestoneProgressLogs: allLogs,
      goals: state.goals.map(item => item.id === goal.id ? {
        ...item,
        milestones: updatedMilestones.map(milestone => milestone.achieved || milestone.status === "skipped" ? milestone : milestone.parallel ? { ...milestone, status: "active" as const } : { ...milestone, status: milestone.id === nextMilestone?.id ? "active" as const : "locked" as const }),
        currentMilestoneId: nextMilestone?.id || null,
        currentMilestone: nextMilestone?.title || (allCompleted ? "Đã hoàn thành" : "Các nhánh song song đang thực hiện"),
        currentProgress: weightedProgress,
        status: allCompleted ? "completed" : "active"
      } : item)
    });
    setProgressEditorId(null);
    setProgressDraft({ progress: 10, note: "" });
    window.setTimeout(() => completingRef.current.delete(`progress:${milestoneId}`), 500);
  };

  const toggleDailyRoutine = (routineId: string, goalId: string, completed: boolean, evidence: string) => {
    const lockKey = `routine:${routineId}`;
    if (completingRef.current.has(lockKey)) return;
    completingRef.current.add(lockKey);
    const now = Date.now();
    const existingLogs = state.routineLogs || [];
    const nextLogs = completed
      ? existingLogs.filter(log => !(log.routineId === routineId && log.date === today))
      : [{
          id: `routine_log_${routineId}_${today}`,
          routineId,
          goalId,
          date: today,
          status: "completed" as const,
          source: "manual" as const,
          evidence,
          activityId: null,
          createdTimestamp: now,
          updatedTimestamp: now
        }, ...existingLogs.filter(log => !(log.routineId === routineId && log.date === today))];

    onChangeState({
      ...state,
      routineLogs: nextLogs,
      routines: state.routines.map(routine => routine.id === routineId
        ? { ...routine, status: completed ? "pending" as const : "completed" as const }
        : routine)
    });
    window.setTimeout(() => completingRef.current.delete(lockKey), 500);
  };

  const completeCurrentStep = (goal: Goal) => {
    if (completingRef.current.has(goal.id)) return;
    const current = goal.milestones.find(milestone => !milestone.parallel && !milestone.achieved);
    if (!current) return;
    completingRef.current.add(goal.id);

    const completedAt = new Date().toISOString();
    const milestones = goal.milestones.map(milestone =>
      milestone.id === current.id
        ? { ...milestone, achieved: true, status: "completed" as const, completedAt }
        : milestone
    );
    const next = milestones.find(milestone => !milestone.parallel && !milestone.achieved);
    const normalized = milestones.map(milestone => {
      if (milestone.achieved) return milestone;
      return milestone.parallel ? { ...milestone, status: "active" as const } : { ...milestone, status: milestone.id === next?.id ? "active" as const : "locked" as const };
    });
    const allCompleted = normalized.every(milestone => milestone.achieved || milestone.status === "skipped");

    onChangeState({
      ...state,
      goals: state.goals.map(item => item.id === goal.id ? {
        ...item,
        milestones: normalized,
        currentMilestoneId: next?.id || null,
        currentMilestone: next?.title || (allCompleted ? "Đã hoàn thành" : "Các nhánh song song đang thực hiện"),
        currentProgress: normalized.length
          ? Math.round(normalized.filter(milestone => milestone.achieved).length / normalized.length * 100)
          : 100,
        status: allCompleted ? "completed" : "active"
      } : item)
    });
    window.setTimeout(() => completingRef.current.delete(goal.id), 500);
  };

  const completeParallelStep = (goal: Goal, milestoneId: string) => {
    const lockKey = `parallel:${milestoneId}`;
    if (completingRef.current.has(lockKey)) return;
    completingRef.current.add(lockKey);
    const now = new Date().toISOString();
    const milestones = goal.milestones.map(milestone => milestone.id === milestoneId ? { ...milestone, achieved: !milestone.achieved, status: milestone.achieved ? "active" as const : "completed" as const, completedAt: milestone.achieved ? null : now } : milestone);
    const completedCount = milestones.filter(milestone => milestone.achieved).length;
    const allCompleted = milestones.length > 0 && completedCount === milestones.length;
    onChangeState({
      ...state,
      goals: state.goals.map(item => item.id === goal.id ? {
        ...item,
        milestones,
        currentProgress: Math.round(completedCount / Math.max(milestones.length, 1) * 100),
        status: allCompleted ? "completed" : "active"
      } : item)
    });
    window.setTimeout(() => completingRef.current.delete(lockKey), 400);
  };

  const renderParallelRows = (goal: Goal) => {
    const items = goal.id === "G4" ? goal.milestones : goal.milestones.filter(milestone => milestone.parallel);
    if (!items.length) return null;
    return <div className="mt-5 border-t border-slate-200 pt-4">
      <div className="mb-3"><p className="text-[10px] font-black uppercase tracking-[.14em] text-indigo-600">{goal.id === "G4" ? "Lộ trình kết quả" : "Có thể làm song song"}</p><p className="mt-1 text-xs text-slate-500">Không cần hoàn tất mục trước để mở mục sau.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">{items.map(milestone => {
        const progress = getMilestoneProgress(milestone);
        return <article key={milestone.id} className={`rounded-2xl border p-4 ${milestone.achieved ? "border-emerald-200 bg-emerald-50" : "border-indigo-200 bg-white"}`}>
          <div className="flex items-start gap-3"><button type="button" onClick={() => completeParallelStep(goal, milestone.id)} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${milestone.achieved ? "bg-emerald-600 text-white" : "bg-indigo-100 text-indigo-700"}`}>{milestone.achieved ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</button><div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-950">{milestone.title}</p><p className="mt-1 text-[11px] text-slate-500">{milestone.targetValue} · hạn {formatDisplayDate(milestone.dueDate)}</p></div><button type="button" onClick={() => openMilestoneEditor(milestone)} aria-label={`Sửa ${milestone.title}`} className="rounded-lg border bg-white p-2 text-slate-500"><Pencil className="h-3.5 w-3.5" /></button></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${progress}%` }} /></div>
          <button type="button" onClick={() => openProgressEditor(milestone)} className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black text-indigo-700"><TrendingUp className="h-3 w-3" /> Ghi tiến bộ · {progress}%</button>
          {editingMilestoneId === milestone.id && <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3"><input maxLength={120} value={milestoneDraft.title} onChange={event => setMilestoneDraft({ ...milestoneDraft, title: event.target.value })} className="w-full rounded-lg border px-2.5 py-2 text-xs" /><textarea maxLength={240} rows={2} value={milestoneDraft.targetValue} onChange={event => setMilestoneDraft({ ...milestoneDraft, targetValue: event.target.value })} className="w-full rounded-lg border px-2.5 py-2 text-xs" /><input type="date" value={milestoneDraft.dueDate} onChange={event => setMilestoneDraft({ ...milestoneDraft, dueDate: event.target.value })} className="w-full rounded-lg border px-2.5 py-2 text-xs" />{editNotice && <p className="text-[10px] font-bold text-rose-600">{editNotice}</p>}<div className="flex gap-2"><button type="button" onClick={() => saveMilestoneEdit(goal, milestone.id)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-950 px-3 py-2 text-[10px] font-black text-white"><Save className="h-3 w-3" />Lưu</button><button type="button" onClick={() => setEditingMilestoneId(null)} className="rounded-lg border px-3 py-2 text-[10px] font-black">Hủy</button></div></div>}
          {progressEditorId === milestone.id && <div className="mt-3 space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3"><label className="block text-[10px] font-bold">Tiến độ: {progressDraft.progress}%<input type="range" min="0" max="100" step="5" value={progressDraft.progress} onChange={event => setProgressDraft({ ...progressDraft, progress: Number(event.target.value) })} className="mt-1 w-full" /></label><textarea maxLength={500} rows={2} value={progressDraft.note} onChange={event => setProgressDraft({ ...progressDraft, note: event.target.value })} placeholder="Đã tiến được gì?" className="w-full rounded-lg border px-2 py-1 text-[10px]" /><button type="button" onClick={() => saveMilestoneProgress(goal, milestone.id)} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-black text-white">Lưu tiến bộ</button></div>}
        </article>;
      })}</div>
    </div>;
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
                              <button
                                type="button"
                                onClick={() => toggleDailyRoutine(routine.id, routine.goalId, completedToday, routine.target || routine.minimumDay)}
                                aria-pressed={completedToday}
                                aria-label={completedToday ? `Bỏ hoàn tất ${routine.name}` : `Hoàn tất ${routine.name}`}
                                className={`flex h-8 w-8 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2 ${
                                completedToday ? "bg-emerald-600 text-white" : "bg-rose-100 text-rose-600"
                              }`}>
                                {completedToday ? <Check className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5" />}
                              </button>
                              <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${completedToday ? "bg-emerald-100 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                {completedToday ? "Đã hoàn tất" : "Bấm để hoàn tất"}
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
                      Các hành động Health & Beauty luôn mở song song. Tick trực tiếp vòng tròn để hoàn tất trong ngày; bấm lại để bỏ hoàn tất.
                    </p>
                    {renderParallelRows(goal)}
                  </>
                ) : (
                  <>
                <ol className="flex gap-3 overflow-x-auto pb-2">
                  {goal.milestones.filter(milestone => !milestone.parallel).map(milestone => {
                    const isCurrent = milestone.id === current?.id;
                    const isCompleted = milestone.achieved;
                    const progress = getMilestoneProgress(milestone);
                    const progressLogs = getMilestoneLogs(milestone.id);

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
                              <div className="flex items-center gap-1">{isCurrent && <span className="rounded-full bg-indigo-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-indigo-700">Đang làm</span>}<button type="button" onClick={() => openMilestoneEditor(milestone)} aria-label={`Sửa ${milestone.title}`} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500"><Pencil className="h-3 w-3" /></button></div>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Kết quả: {milestone.targetValue} · hạn {formatDisplayDate(milestone.dueDate)}
                            </p>
                            <div className="mt-3">
                              <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-slate-500">
                                <span>{progress}% tiến bộ</span>
                                <span>{progressLogs.length} cập nhật</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                <div className={`h-full rounded-full transition-all ${isCompleted ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${progress}%` }} />
                              </div>
                              {progressLogs[0]?.note && <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-slate-500">Gần nhất: {progressLogs[0].note}</p>}
                              {(isCurrent || isCompleted) && <button type="button" onClick={() => openProgressEditor(milestone)} className="mt-2 flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-50"><TrendingUp className="h-3 w-3" /> Ghi tiến bộ</button>}
                              {progressEditorId === milestone.id && <div className="mt-3 space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                                <div className="flex items-center justify-between"><span className="text-[10px] font-black text-indigo-900">Cập nhật cột mốc</span><button type="button" onClick={() => setProgressEditorId(null)} className="text-indigo-400"><X className="h-3.5 w-3.5" /></button></div>
                                <label className="block text-[10px] font-bold text-slate-600">Tiến độ: {progressDraft.progress}%<input type="range" min="0" max="100" step="5" value={progressDraft.progress} onChange={event => setProgressDraft({ ...progressDraft, progress: Number(event.target.value) })} className="mt-1 w-full accent-indigo-600" /></label>
                                <textarea maxLength={500} rows={2} value={progressDraft.note} onChange={event => setProgressDraft({ ...progressDraft, note: event.target.value })} placeholder="Hôm nay đã tiến được gì?" className="w-full resize-none rounded-lg border border-indigo-200 bg-white px-2.5 py-2 text-[10px] outline-none focus:border-indigo-500" />
                                <button type="button" onClick={() => saveMilestoneProgress(goal, milestone.id)} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-black text-white">Lưu tiến bộ</button>
                              </div>}
                              {editingMilestoneId === milestone.id && <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3"><input maxLength={120} value={milestoneDraft.title} onChange={event => setMilestoneDraft({ ...milestoneDraft, title: event.target.value })} className="w-full rounded-lg border px-2.5 py-2 text-[10px]" /><textarea maxLength={240} rows={2} value={milestoneDraft.targetValue} onChange={event => setMilestoneDraft({ ...milestoneDraft, targetValue: event.target.value })} className="w-full rounded-lg border px-2.5 py-2 text-[10px]" /><input type="date" value={milestoneDraft.dueDate} onChange={event => setMilestoneDraft({ ...milestoneDraft, dueDate: event.target.value })} className="w-full rounded-lg border px-2.5 py-2 text-[10px]" />{editNotice && <p className="text-[10px] font-bold text-rose-600">{editNotice}</p>}<div className="flex gap-2"><button type="button" onClick={() => saveMilestoneEdit(goal, milestone.id)} className="flex-1 rounded-lg bg-slate-950 px-3 py-2 text-[10px] font-black text-white">Lưu thay đổi</button><button type="button" onClick={() => setEditingMilestoneId(null)} className="rounded-lg border px-3 py-2 text-[10px] font-black">Hủy</button></div></div>}
                          </div>
                        </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {renderParallelRows(goal)}

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
