import React, { useMemo, useState } from "react";
import { BarChart3, CalendarDays, Check, ChevronRight, HeartPulse, Home, Plus, RotateCcw, Scale } from "lucide-react";
import { AppState, ActivityEntry, RoutineLog } from "../types";
import { isScheduleValidForDate } from "../utils";

interface SimpleTodayViewProps {
  state: AppState;
  onChangeState: (state: AppState) => void;
  onOpenProgress?: () => void;
  onOpenReview?: () => void;
}

const hcmDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

const hcmTime = () => new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
}).format(new Date());

export default function SimpleTodayView({ state, onChangeState, onOpenProgress, onOpenReview }: SimpleTodayViewProps) {
  const today = hcmDate();
  const [quickText, setQuickText] = useState("");
  const [quickTime, setQuickTime] = useState(hcmTime());
  const [weight, setWeight] = useState("");
  const [quickNext, setQuickNext] = useState("");
  const [quickGoal, setQuickGoal] = useState("");
  const [captureError, setCaptureError] = useState("");

  const todaySchedule = useMemo(() => (state.scheduleItems || [])
    .filter(item => item.date === today && isScheduleValidForDate(item))
    .sort((a, b) => a.startTime.localeCompare(b.startTime)), [state.scheduleItems, today]);

  const scheduledIds = new Set(todaySchedule.map(item => item.taskId).filter(Boolean));
  const fallbackTasks = (state.priorityTasks || []).filter(task =>
    !task.completed && task.status !== "dropped" && !scheduledIds.has(task.id) && (!task.dueDate || task.dueDate <= today)
  );
  const mainItems = [...todaySchedule, ...fallbackTasks.map(task => ({
    id: `task-${task.id}`, taskId: task.id, goalId: task.goalId || task.journeyId || null, title: task.title, date: today, startTime: "", endTime: "", completed: task.completed
  }))];

  const logs = state.routineLogs || [];
  const activeGoals = (state.goals || []).filter(goal => goal.status === "active");
  const getAspect = (goalId?: string | null, title = "") => {
    const goal = activeGoals.find(item => item.id === goalId);
    const source = `${goal?.name || ""} ${title}`;
    if (goal?.category === "health" || /sức khỏe|health|yoga|chạy bộ|skincare/i.test(source)) return { key: "health", label: "Sức khỏe", tone: "bg-rose-100 text-rose-700" };
    if (goal?.category === "fund_backtest" || /fund|trading|backtest|demo/i.test(source)) return { key: "fund", label: "Fund", tone: "bg-violet-100 text-violet-700" };
    if (goal?.category === "business" || goal?.category === "marketing" || /b2b|seo|website|content/i.test(source)) return { key: "b2b", label: "B2B", tone: "bg-blue-100 text-blue-700" };
    if (goal?.category === "finance" || /tài chính|finance|tiền|thanh toán|ngân sách/i.test(source)) return { key: "money", label: "Tiền", tone: "bg-amber-100 text-amber-700" };
    if (goal?.category === "career" || /job|freelance|outlier|upwork|linkedin|thu nhập/i.test(source)) return { key: "job", label: "Job & Thu nhập", tone: "bg-emerald-100 text-emerald-700" };
    if (goal?.category === "home" || /dọn|nhà|mèo|rainy|đi chợ/i.test(source)) return { key: "chores", label: "Chores & Nhà", tone: "bg-cyan-100 text-cyan-700" };
    return { key: goal ? `goal-${goal.id}` : "life", label: goal?.name || "Đời sống", tone: "bg-slate-100 text-slate-600" };
  };

  const weekDays = useMemo(() => {
    const current = new Date(`${today}T12:00:00`);
    const mondayOffset = (current.getDay() + 6) % 7;
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(current);
      date.setDate(current.getDate() - mondayOffset + index);
      const dateStr = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
      const schedules = (state.scheduleItems || []).filter(item => item.date === dateStr && isScheduleValidForDate(item));
      const dayLogs = logs.filter(log => log.date === dateStr && log.status !== "missed");
      const done = schedules.filter(item => item.completed).length + dayLogs.length;
      const planned = schedules.length + (state.routines || []).filter(routine => routine.active !== false && (!routine.scheduleDays?.length || routine.scheduleDays.includes(date.getDay()))).length;
      return { date: dateStr, day: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][index], schedules, done, planned, percent: planned ? Math.min(100, Math.round(done / planned * 100)) : 0, isSunday: index === 6 };
    });
  }, [today, state.scheduleItems, state.routines, logs]);
  const sixDayAverage = Math.round(weekDays.slice(0, 6).reduce((sum, day) => sum + day.percent, 0) / 6);
  const isSunday = new Date(`${today}T12:00:00`).getDay() === 0;

  const activeRoutines = (state.routines || []).filter(routine => {
    if (routine.active === false) return false;
    const day = new Date(`${today}T12:00:00`).getDay();
    return !routine.scheduleDays?.length || routine.scheduleDays.includes(day);
  });
  const todayChores = (state.chores || []).filter(chore => !chore.completed && (chore.frequency === "daily" || !chore.dueDate || chore.dueDate <= today));
  const groupedMain = mainItems.reduce<Record<string, { label: string; tone: string; items: typeof mainItems }>>((groups, item) => {
    const aspect = getAspect(item.goalId, item.title);
    if (!groups[aspect.key]) groups[aspect.key] = { label: aspect.label, tone: aspect.tone, items: [] };
    groups[aspect.key].items.push(item);
    return groups;
  }, {});
  const basicGroups = [
    { key: "fund", label: "Fund", tone: "bg-violet-100 text-violet-700" },
    { key: "job", label: "Job & Thu nhập", tone: "bg-emerald-100 text-emerald-700" },
    { key: "b2b", label: "B2B", tone: "bg-blue-100 text-blue-700" },
    { key: "money", label: "Tiền", tone: "bg-amber-100 text-amber-700" }
  ];
  const dynamicGroups = Object.entries(groupedMain).filter(([key]) => !["health", "chores", ...basicGroups.map(group => group.key)].includes(key));
  const activities = (state.activities || []).filter(item => item.date === today)
    .sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));
  const completedMain = mainItems.filter(item => item.completed).length;
  const completedRoutine = activeRoutines.filter(routine => logs.some(log => log.routineId === routine.id && log.date === today && log.status !== "missed")).length;
  const totalChecks = mainItems.length + activeRoutines.length;
  const completion = totalChecks ? Math.round(((completedMain + completedRoutine) / totalChecks) * 100) : 0;

  const toggleMain = (item: typeof mainItems[number]) => {
    const completed = !item.completed;
    onChangeState({
      ...state,
      scheduleItems: (state.scheduleItems || []).map(schedule => schedule.id === item.id ? { ...schedule, completed } : schedule),
      priorityTasks: (state.priorityTasks || []).map(task => task.id === item.taskId ? {
        ...task, completed, status: completed ? "completed" : "ready", completedAt: completed ? new Date().toISOString() : null
      } : task)
    });
  };

  const toggleRoutine = (routineId: string) => {
    const existing = logs.find(log => log.routineId === routineId && log.date === today);
    const nextLogs = existing
      ? logs.filter(log => log.id !== existing.id)
      : [...logs, {
          id: `routine-${routineId}-${today}-${Date.now()}`, routineId,
          goalId: state.routines.find(r => r.id === routineId)?.goalId || "health",
          date: today, status: "completed", source: "manual",
          createdTimestamp: Date.now(), updatedTimestamp: Date.now()
        } as RoutineLog];
    onChangeState({ ...state, routineLogs: nextLogs });
  };

  const toggleChore = (choreId: string) => onChangeState({ ...state, chores: (state.chores || []).map(chore => chore.id === choreId ? { ...chore, completed: true, lastCompletedDate: today } : chore) });

  const saveActivity = () => {
    const text = quickText.trim();
    const parsedWeight = weight.trim() ? Number(weight) : null;
    if (!text && parsedWeight === null) return setCaptureError("Hãy nhập một việc đã làm hoặc cân nặng.");
    if (text.length > 300) return setCaptureError("Nội dung tối đa 300 ký tự.");
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 25 || parsedWeight > 300)) return setCaptureError("Cân nặng cần nằm trong khoảng 25–300 kg.");
    const now = Date.now();
    const entry: ActivityEntry = {
      id: `manual-${now}`, date: today, goalId: quickGoal || null, source: "manual",
      activity: text || `Cân lúc ${quickTime}`, output: parsedWeight === null ? {} : { weightKg: parsedWeight },
      outcome: {}, outcomeStatus: "not_applicable", insight: null, nextAction: quickNext.trim() || null,
      confidence: 1, createdTimestamp: now, updatedTimestamp: now, startTime: quickTime
    };
    const nextHealth = parsedWeight === null ? state.healthRecords : {
      ...state.healthRecords,
      [today]: { ...(state.healthRecords[today] || { date: today, sleepHours: null, energy: null, steps: null, strengthSession: false, eatOnPlan: false, skincare: false, styleAndAppearance: false, notes: "" }), weight: parsedWeight }
    };
    onChangeState({ ...state, activities: [entry, ...(state.activities || [])], healthRecords: nextHealth });
    setQuickText(""); setQuickNext(""); setWeight(""); setCaptureError("");
  };

  return <div className="mx-auto max-w-5xl space-y-5">
    <section className="overflow-hidden rounded-[28px] bg-slate-950 p-5 text-white shadow-xl md:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Bảng điều hành hôm nay</p><h2 className="mt-2 text-2xl font-black">Biết rõ từng phần của cuộc sống</h2><p className="mt-1 text-sm text-slate-300">Mở từng nhóm, làm việc tiếp theo và tick ngay khi hoàn tất.</p></div>
        <div className="min-w-40 rounded-2xl bg-white/10 p-4"><div className="flex justify-between text-xs font-black"><span>Nhịp hôm nay</span><span>{completion}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${completion}%` }} /></div></div>
      </div>
    </section>

    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">Theo khía cạnh</p><h3 className="mt-1 text-xl font-black">Việc cần làm & việc tiếp theo</h3></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{completedMain}/{mainItems.length} lịch xong</span></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <article className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-rose-100 p-2 text-rose-600"><HeartPulse className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-rose-600">Nền tảng</p><h3 className="text-lg font-black">Sức khỏe hôm nay</h3></div></div>
        <div className="mt-4 space-y-2">{activeRoutines.map(routine => { const done = logs.some(log => log.routineId === routine.id && log.date === today && log.status !== "missed"); return <button key={routine.id} onClick={() => toggleRoutine(routine.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${done ? "border-rose-200 bg-white" : "border-white bg-white/70"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-lg ${done ? "bg-rose-500 text-white" : "border-2 border-rose-200"}`}>{done && <Check className="h-3.5 w-3.5" />}</span><span className="text-sm font-bold text-slate-800">{routine.name}</span></button>})}{activeRoutines.length === 0 && <p className="text-xs text-slate-400">Chưa có routine hôm nay.</p>}</div>
      </article>
      <article className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4"><div><span className="rounded-full bg-cyan-100 px-2 py-1 text-[9px] font-black text-cyan-700">CHORES & NHÀ</span><h3 className="mt-3 text-lg font-black">Việc nhà, mèo & sinh hoạt</h3></div><div className="mt-4 space-y-2">{todayChores.map(chore => <button key={chore.id} onClick={() => toggleChore(chore.id)} className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left"><span className="h-5 w-5 rounded-md border-2 border-cyan-200" /><span className="text-sm font-bold">{chore.title}</span></button>)}{todayChores.length === 0 && <p className="text-xs text-slate-400">Không có chore đến hạn.</p>}</div></article>
      {basicGroups.map(group => { const items = groupedMain[group.key]?.items || []; return <article key={group.key} className="rounded-2xl border border-slate-200 p-4"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${group.tone}`}>{group.label.toUpperCase()}</span><p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-400">Việc tiếp theo</p>{items.length ? <div className="mt-2 space-y-2">{items.map(item => <button key={item.id} onClick={() => toggleMain(item)} className={`flex w-full items-start gap-2 rounded-xl p-3 text-left ${item.completed ? "bg-emerald-50" : "bg-slate-50"}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${item.completed ? "bg-emerald-500 text-white" : "border-2 border-slate-200"}`}>{item.completed && <Check className="h-3 w-3" />}</span><span><b className={`block text-sm ${item.completed ? "line-through text-emerald-700" : "text-slate-800"}`}>{item.title}</b>{item.startTime && <small className="font-mono text-slate-400">{item.startTime}–{item.endTime}</small>}</span></button>)}</div> : <p className="mt-2 text-xs text-slate-400">Chưa có việc được xếp vào hôm nay.</p>}</article>})}
      {dynamicGroups.map(([key, group]) => <article key={key} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${group.tone}`}>{group.label.toUpperCase()}</span><p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-400">Nhóm được tạo tự động</p><div className="mt-2 space-y-2">{group.items.map(item => <button key={item.id} onClick={() => toggleMain(item)} className="flex w-full items-center gap-2 rounded-xl bg-white p-3 text-left"><span className="h-5 w-5 rounded-md border-2 border-amber-200" /><span className="text-sm font-bold">{item.title}</span></button>)}</div></article>)}
      </div>
    </section>

    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-indigo-600" /><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">Toàn tuần</p><h3 className="text-lg font-black">Timeline lịch trình</h3></div></div><div className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Nhịp T2–T7: {sixDayAverage}%</div></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{weekDays.map(day => <article key={day.date} className={`rounded-2xl border p-3 ${day.date === today ? "border-indigo-400 bg-indigo-50" : day.isSunday ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between"><span className="text-xs font-black">{day.day}</span><span className="font-mono text-[9px] text-slate-400">{day.date.slice(8,10)}/{day.date.slice(5,7)}</span></div>{day.isSunday ? <><p className="mt-4 text-xs font-black text-amber-800">Review tuần</p><button onClick={onOpenReview} className="mt-3 flex items-center gap-1 text-[10px] font-black text-amber-700">Mở review <ChevronRight className="h-3 w-3" /></button></> : <><p className="mt-3 text-xl font-black">{day.percent}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-indigo-500" style={{ width: `${day.percent}%` }} /></div><p className="mt-2 text-[9px] text-slate-500">{day.done}/{day.planned} việc</p><div className="mt-2 space-y-1">{day.schedules.slice(0,2).map(item => <p key={item.id} className="truncate text-[9px] font-bold text-slate-600">• {item.title}</p>)}</div></>}</article>)}</div>
      {isSunday && <button onClick={onOpenReview} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950"><RotateCcw className="h-4 w-4" />Hôm nay chỉ review 6 ngày vừa qua</button>}
    </section>

    <section id="section-quick-input" className="rounded-[24px] border-2 border-indigo-200 bg-indigo-50/50 p-5">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-600 p-2 text-white"><Plus className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">10 giây</p><h3 className="text-lg font-black">Ghi việc vừa làm</h3></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[100px_1fr_160px]"><input type="time" value={quickTime} onChange={e => setQuickTime(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold" /><input value={quickText} maxLength={300} onChange={e => setQuickText(e.target.value)} placeholder="Đã thực hiện việc gì?" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" /><select value={quickGoal} onChange={e => setQuickGoal(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold"><option value="">Đời sống</option>{activeGoals.map(goal => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_130px_auto]"><input value={quickNext} maxLength={200} onChange={e => setQuickNext(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveActivity(); }} placeholder="Hành động tiếp theo là gì?" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" /><label className="relative"><Scale className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Cân nặng" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm" /></label><button onClick={saveActivity} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white">Ghi nhận</button></div>{captureError && <p className="mt-2 text-xs font-bold text-rose-600">{captureError}</p>}
    </section>

    <section className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Home className="h-5 w-5 text-emerald-600" /><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-600">Cuộc sống thật</p><h3 className="text-lg font-black">Đã sống & đã làm</h3></div></div><button onClick={onOpenProgress} className="text-xs font-black text-indigo-600">Xem biểu đồ →</button></div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">{activities.map(item => { const aspect = getAspect(item.goalId); return <article key={item.id} className="min-w-60 rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between"><span className="font-mono text-xs font-black text-emerald-700">{item.startTime || "--:--"}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${aspect.tone}`}>{aspect.label}</span></div><p className="mt-2 text-sm font-black">{item.activity}</p>{item.nextAction && <p className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-600"><b>Tiếp theo:</b> {item.nextAction}</p>}{typeof item.output?.weightKg === "number" && <p className="mt-2 text-xs font-black text-rose-600">{item.output.weightKg} kg</p>}</article>})}{activities.length === 0 && <p className="w-full rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">Chưa ghi nhận gì. Mỗi việc nhỏ đều được tính.</p>}</div>
    </section>

    <section className="rounded-[24px] border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-violet-600" /><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">Tiến bộ & bước kế</p><h3 className="text-lg font-black">Các khía cạnh cuộc sống</h3></div></div><button onClick={onOpenProgress} className="text-xs font-black text-indigo-600">Chi tiết →</button></div><div className="mt-4 grid gap-3 md:grid-cols-3">{activeGoals.slice(0,3).map(goal => { const aspect = getAspect(goal.id); return <article key={goal.id} className="rounded-2xl border border-slate-200 p-4"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${aspect.tone}`}>{aspect.label}</span><div className="mt-3 flex items-end justify-between"><p className="text-sm font-black text-slate-900">{goal.name}</p><b className="text-lg">{goal.currentProgress || 0}%</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-violet-500" style={{ width: `${Math.min(100, goal.currentProgress || 0)}%` }} /></div><p className="mt-3 text-xs text-slate-600"><b>Tiếp theo:</b> {goal.nextAction || goal.currentMilestone || "Chưa chốt"}</p></article>})}</div></section>
  </div>;
}
