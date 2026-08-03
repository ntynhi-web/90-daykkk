import React, { useMemo, useState } from "react";
import { Activity, Check, HeartPulse, Home, Plus, Scale, Sparkles } from "lucide-react";
import { AppState, ActivityEntry, RoutineLog } from "../types";
import { isScheduleValidForDate } from "../utils";

interface SimpleTodayViewProps {
  state: AppState;
  onChangeState: (state: AppState) => void;
  onOpenProgress?: () => void;
}

const hcmDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

const hcmTime = () => new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
}).format(new Date());

export default function SimpleTodayView({ state, onChangeState, onOpenProgress }: SimpleTodayViewProps) {
  const today = hcmDate();
  const [quickText, setQuickText] = useState("");
  const [quickTime, setQuickTime] = useState(hcmTime());
  const [weight, setWeight] = useState("");
  const [captureError, setCaptureError] = useState("");

  const todaySchedule = useMemo(() => (state.scheduleItems || [])
    .filter(item => item.date === today && isScheduleValidForDate(item))
    .sort((a, b) => a.startTime.localeCompare(b.startTime)), [state.scheduleItems, today]);

  const scheduledIds = new Set(todaySchedule.map(item => item.taskId).filter(Boolean));
  const fallbackTasks = (state.priorityTasks || []).filter(task =>
    !task.completed && task.status !== "dropped" && !scheduledIds.has(task.id) && (!task.dueDate || task.dueDate <= today)
  );
  const mainItems = [...todaySchedule, ...fallbackTasks.map(task => ({
    id: `task-${task.id}`, taskId: task.id, title: task.title, date: today, startTime: "", endTime: "", completed: task.completed
  }))].slice(0, 3);

  const activeRoutines = (state.routines || []).filter(routine => {
    if (routine.active === false) return false;
    const day = new Date(`${today}T12:00:00`).getDay();
    return !routine.scheduleDays?.length || routine.scheduleDays.includes(day);
  }).slice(0, 3);
  const logs = state.routineLogs || [];
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

  const saveActivity = () => {
    const text = quickText.trim();
    const parsedWeight = weight.trim() ? Number(weight) : null;
    if (!text && parsedWeight === null) return setCaptureError("Hãy nhập một việc đã làm hoặc cân nặng.");
    if (text.length > 300) return setCaptureError("Nội dung tối đa 300 ký tự.");
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 25 || parsedWeight > 300)) return setCaptureError("Cân nặng cần nằm trong khoảng 25–300 kg.");
    const now = Date.now();
    const entry: ActivityEntry = {
      id: `manual-${now}`, date: today, goalId: null, source: "manual",
      activity: text || `Cân lúc ${quickTime}`, output: parsedWeight === null ? {} : { weightKg: parsedWeight },
      outcome: {}, outcomeStatus: "not_applicable", insight: null, nextAction: null,
      confidence: 1, createdTimestamp: now, updatedTimestamp: now, startTime: quickTime
    };
    const nextHealth = parsedWeight === null ? state.healthRecords : {
      ...state.healthRecords,
      [today]: { ...(state.healthRecords[today] || { date: today, sleepHours: null, energy: null, steps: null, strengthSession: false, eatOnPlan: false, skincare: false, styleAndAppearance: false, notes: "" }), weight: parsedWeight }
    };
    onChangeState({ ...state, activities: [entry, ...(state.activities || [])], healthRecords: nextHealth });
    setQuickText(""); setWeight(""); setCaptureError("");
  };

  return <div className="mx-auto max-w-5xl space-y-5">
    <section className="overflow-hidden rounded-[28px] bg-slate-950 p-5 text-white shadow-xl md:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Hôm nay chỉ cần vậy</p><h2 className="mt-2 text-2xl font-black">Làm ít, nhưng có kết quả</h2><p className="mt-1 text-sm text-slate-300">Tối đa 3 việc chính. Việc nhà và sức khỏe vẫn được tính là tiến bộ thật.</p></div>
        <div className="min-w-40 rounded-2xl bg-white/10 p-4"><div className="flex justify-between text-xs font-black"><span>Nhịp hôm nay</span><span>{completion}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${completion}%` }} /></div></div>
      </div>
    </section>

    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">Ưu tiên</p><h3 className="mt-1 text-xl font-black">3 việc hôm nay</h3></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{completedMain}/{mainItems.length}</span></div>
        <div className="mt-4 space-y-2">{mainItems.map((item, index) => <button key={item.id} onClick={() => toggleMain(item)} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${item.completed ? "border-emerald-200 bg-emerald-50" : "border-slate-200 hover:border-indigo-300"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${item.completed ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>{item.completed ? <Check className="h-4 w-4" /> : index + 1}</span><span className="min-w-0 flex-1"><span className={`block text-sm font-black ${item.completed ? "text-emerald-800 line-through" : "text-slate-900"}`}>{item.title}</span>{item.startTime && <span className="mt-1 block font-mono text-[10px] text-slate-400">{item.startTime}–{item.endTime}</span>}</span></button>)}{mainItems.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Không có việc bắt buộc. Hôm nay có thể dành cho phục hồi.</div>}</div>
      </section>

      <section className="rounded-[24px] border border-rose-100 bg-rose-50/60 p-5">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-rose-100 p-2 text-rose-600"><HeartPulse className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-rose-600">Nền tảng</p><h3 className="text-lg font-black">Sức khỏe hôm nay</h3></div></div>
        <div className="mt-4 space-y-2">{activeRoutines.map(routine => { const done = logs.some(log => log.routineId === routine.id && log.date === today && log.status !== "missed"); return <button key={routine.id} onClick={() => toggleRoutine(routine.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${done ? "border-rose-200 bg-white" : "border-white bg-white/70"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-lg ${done ? "bg-rose-500 text-white" : "border-2 border-rose-200"}`}>{done && <Check className="h-3.5 w-3.5" />}</span><span className="text-sm font-bold text-slate-800">{routine.name}</span></button>})}</div>
      </section>
    </div>

    <section id="section-quick-input" className="rounded-[24px] border-2 border-indigo-200 bg-indigo-50/50 p-5">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-600 p-2 text-white"><Plus className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">10 giây</p><h3 className="text-lg font-black">Ghi việc vừa làm</h3></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[100px_1fr_130px_auto]"><input type="time" value={quickTime} onChange={e => setQuickTime(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold" /><input value={quickText} maxLength={300} onChange={e => setQuickText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveActivity(); }} placeholder="Ví dụ: chạy bộ, chăm mèo, dọn nhà…" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" /><label className="relative"><Scale className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Cân nặng" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm" /></label><button onClick={saveActivity} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white">Lưu</button></div>{captureError && <p className="mt-2 text-xs font-bold text-rose-600">{captureError}</p>}
    </section>

    <section className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Home className="h-5 w-5 text-emerald-600" /><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-600">Cuộc sống thật</p><h3 className="text-lg font-black">Đã sống & đã làm</h3></div></div><button onClick={onOpenProgress} className="text-xs font-black text-indigo-600">Xem biểu đồ →</button></div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">{activities.map(item => <article key={item.id} className="min-w-52 rounded-2xl bg-slate-50 p-4"><span className="font-mono text-xs font-black text-emerald-700">{item.startTime || "--:--"}</span><p className="mt-2 text-sm font-black">{item.activity}</p>{typeof item.output?.weightKg === "number" && <p className="mt-2 text-xs font-black text-rose-600">{item.output.weightKg} kg</p>}</article>)}{activities.length === 0 && <p className="w-full rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">Chưa ghi nhận gì. Mỗi việc nhỏ đều được tính.</p>}</div>
    </section>
  </div>;
}
