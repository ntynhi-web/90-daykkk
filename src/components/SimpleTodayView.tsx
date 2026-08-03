import React, { useMemo, useState } from "react";
import { BarChart3, CalendarDays, Check, Home, Plus, RotateCcw, Scale } from "lucide-react";
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
  const [quickGoal, setQuickGoal] = useState("area:health");
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
  const getAspect = (goalId?: string | null, title = "", savedArea = "") => {
    const goal = activeGoals.find(item => item.id === goalId);
    const source = `${goal?.name || ""} ${title}`;
    const fixed = {
      health: { key: "health", label: "Sức khỏe", tone: "bg-rose-100 text-rose-700" },
      chores: { key: "chores", label: "Chores & Nhà", tone: "bg-cyan-100 text-cyan-700" },
      fund: { key: "fund", label: "Fund", tone: "bg-violet-100 text-violet-700" },
      job: { key: "job", label: "Job & Thu nhập", tone: "bg-emerald-100 text-emerald-700" },
      b2b: { key: "b2b", label: "B2B", tone: "bg-blue-100 text-blue-700" },
      relationship: { key: "relationship", label: "Relationship", tone: "bg-pink-100 text-pink-700" },
      money: { key: "money", label: "Tiền", tone: "bg-amber-100 text-amber-700" },
      life: { key: "life", label: "Đời sống", tone: "bg-slate-100 text-slate-600" }
    } as const;
    if (savedArea && fixed[savedArea as keyof typeof fixed]) return fixed[savedArea as keyof typeof fixed];
    if (goal?.category === "health" || /sức khỏe|health|yoga|chạy bộ|skincare/i.test(source)) return { key: "health", label: "Sức khỏe", tone: "bg-rose-100 text-rose-700" };
    if (goal?.category === "fund_backtest" || /fund|trading|backtest|demo/i.test(source)) return { key: "fund", label: "Fund", tone: "bg-violet-100 text-violet-700" };
    if (goal?.category === "business" || goal?.category === "marketing" || /b2b|seo|website|content/i.test(source)) return { key: "b2b", label: "B2B", tone: "bg-blue-100 text-blue-700" };
    if (/relationship|người yêu|lover|ba mẹ|mẹ|cha|bố|gia đình|rainy|ranny|lacky|kết nối|hẹn hò|date night/i.test(source)) return { key: "relationship", label: "Relationship", tone: "bg-pink-100 text-pink-700" };
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
  const healthRoutines = activeRoutines.filter(routine => getAspect(routine.goalId, routine.name).key === "health");
  const todayChores = (state.chores || []).filter(chore => {
    if (chore.frequency === "one_time") return !chore.completed && (!chore.dueDate || chore.dueDate <= today);
    return chore.lastCompletedDate !== today && (chore.frequency === "daily" || !chore.dueDate || chore.dueDate <= today);
  });
  const groupedMain = mainItems.reduce<Record<string, { label: string; tone: string; items: typeof mainItems }>>((groups, item) => {
    const aspect = getAspect(item.goalId, item.title);
    if (!groups[aspect.key]) groups[aspect.key] = { label: aspect.label, tone: aspect.tone, items: [] };
    groups[aspect.key].items.push(item);
    return groups;
  }, {});
  const focusGroups = [
    { key: "health", label: "Sức khỏe", tone: "bg-rose-100 text-rose-700", border: "border-rose-200" },
    { key: "fund", label: "Fund", tone: "bg-violet-100 text-violet-700", border: "border-violet-200" },
    { key: "b2b", label: "B2B", tone: "bg-blue-100 text-blue-700", border: "border-blue-200" },
    { key: "relationship", label: "Relationship", tone: "bg-pink-100 text-pink-700", border: "border-pink-200" },
    { key: "chores", label: "Chores", tone: "bg-cyan-100 text-cyan-700", border: "border-cyan-200" }
  ];
  const canonicalSubItems: Record<string, string[]> = {
    health: ["Tập thể dục", "Uống 1,5 lít nước", "Ăn healthy · hạn chế ngọt/béo", "Skincare & vệ sinh cá nhân"],
    fund: ["Học video", "Viết checklist", "Xem demo", "Backtest", "Trading journal", "Đánh giá demo", "Điều kiện mua quỹ"],
    b2b: ["Checklist sửa website", "Chỉnh website", "Viết SEO bằng AI", "Chi đọc lại", "Đăng bài", "Làm portfolio", "Học AI Automation"],
    relationship: ["Ba mẹ", "Lover", "Rainy & Lacky", "Other"],
    chores: ["Chăm mèo", "Dọn nhà", "Bếp & nấu ăn", "Giặt và sắp xếp quần áo", "Việc gia đình phát sinh"]
  };
  const routineDisplayName: Record<string, string> = {
    routine_running_park: "Tập thể dục",
    routine_water_1500: "Uống 1,5 lít nước",
    routine_health_foundation: "Ăn healthy · hạn chế ngọt/béo",
    routine_beauty_foundation: "Skincare & vệ sinh cá nhân"
  };
  const activities = (state.activities || []).filter(item => item.date === today)
    .sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));
  const completedMain = mainItems.filter(item => item.completed).length;
  const completedRoutine = healthRoutines.filter(routine => logs.some(log => log.routineId === routine.id && log.date === today && log.status !== "missed")).length;
  const totalChecks = mainItems.length + healthRoutines.length;
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

  const toggleChore = (choreId: string) => onChangeState({ ...state, chores: (state.chores || []).map(chore => chore.id === choreId ? { ...chore, completed: chore.frequency === "one_time", lastCompletedDate: today } : chore) });

  const saveActivity = () => {
    const text = quickText.trim();
    const parsedWeight = weight.trim() ? Number(weight) : null;
    if (!text && parsedWeight === null) return setCaptureError("Hãy nhập một việc đã làm hoặc cân nặng.");
    if (text.length > 300) return setCaptureError("Nội dung tối đa 300 ký tự.");
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 25 || parsedWeight > 300)) return setCaptureError("Cân nặng cần nằm trong khoảng 25–300 kg.");
    const now = Date.now();
    const selectedIsGoal = quickGoal.startsWith("goal:");
    const selectedArea = quickGoal.startsWith("area:") ? quickGoal.slice(5) : "";
    const explicitGoalId = selectedIsGoal ? quickGoal.slice(5) : null;
    const matchedGoal = explicitGoalId
      ? activeGoals.find(goal => goal.id === explicitGoalId)
      : activeGoals.find(goal => getAspect(goal.id).key === selectedArea);
    const linkedGoalId = matchedGoal?.id || null;
    const entry: ActivityEntry = {
      id: `manual-${now}`, date: today, goalId: linkedGoalId, source: "manual",
      activity: text || `Cân lúc ${quickTime}`, output: { ...(parsedWeight === null ? {} : { weightKg: parsedWeight }), lifeArea: selectedArea || getAspect(linkedGoalId).key },
      outcome: {}, outcomeStatus: "not_applicable", insight: null, nextAction: quickNext.trim() || null,
      confidence: 1, createdTimestamp: now, updatedTimestamp: now, startTime: quickTime
    };
    const nextHealth = parsedWeight === null ? state.healthRecords : {
      ...state.healthRecords,
      [today]: { ...(state.healthRecords[today] || { date: today, sleepHours: null, energy: null, steps: null, strengthSession: false, eatOnPlan: false, skincare: false, styleAndAppearance: false, notes: "" }), weight: parsedWeight }
    };
    const nextGoals = quickNext.trim() && linkedGoalId
      ? state.goals.map(goal => goal.id === linkedGoalId ? { ...goal, nextAction: quickNext.trim() } : goal)
      : state.goals;
    onChangeState({ ...state, goals: nextGoals, activities: [entry, ...(state.activities || [])], healthRecords: nextHealth });
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-indigo-600" /><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">Việc hằng ngày × timeline tuần</p><h3 className="text-xl font-black">5 khía cạnh chính</h3></div></div><div className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Nhịp T2–T7: {sixDayAverage}%</div></div>
      <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-3 xl:grid xl:grid-cols-5 xl:overflow-visible">{focusGroups.map(group => {
        const scheduled = groupedMain[group.key]?.items || [];
        return <article key={group.key} className={`min-w-[260px] snap-start rounded-2xl border bg-white p-4 ${group.border} xl:min-w-0`}>
          <div className="flex items-center justify-between"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${group.tone}`}>{group.label}</span><span className="text-[9px] font-black text-slate-400">TUẦN NÀY</span></div>
          <div className="mt-4 grid grid-cols-7 gap-1">{weekDays.map(day => {
            const groupSchedules = day.schedules.filter(item => getAspect(item.goalId || item.journeyId, item.title).key === group.key);
            const routinePlanned = group.key === "health" ? (state.routines || []).filter(routine => routine.active !== false && getAspect(routine.goalId, routine.name).key === "health" && (!routine.scheduleDays?.length || routine.scheduleDays.includes(new Date(`${day.date}T12:00:00`).getDay()))).length : 0;
            const routineDone = group.key === "health" ? logs.filter(log => log.date === day.date && log.status !== "missed" && getAspect(log.goalId).key === "health").length : 0;
            const planned = groupSchedules.length + routinePlanned;
            const done = groupSchedules.filter(item => item.completed).length + routineDone;
            const percent = planned ? Math.min(100, Math.round(done / planned * 100)) : 0;
            return <div key={day.date} className={`rounded-lg p-1 text-center ${day.date === today ? "bg-indigo-100 ring-1 ring-indigo-300" : day.isSunday ? "bg-amber-50" : "bg-slate-50"}`}><p className="text-[8px] font-black text-slate-500">{day.day}</p><span className={`mx-auto mt-1 block h-2 w-2 rounded-full ${day.isSunday ? "bg-amber-400" : percent === 100 ? "bg-emerald-500" : percent > 0 ? "bg-indigo-400" : "bg-slate-200"}`} /></div>;
          })}</div>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Mục con chuẩn</p><div className="mt-2 space-y-1">{canonicalSubItems[group.key].map((item, index) => <p key={item} className={`text-[10px] leading-snug ${index === 0 && group.key !== "relationship" ? "font-black text-slate-800" : "font-medium text-slate-500"}`}>{index + 1}. {item}</p>)}</div></div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-slate-400">Hôm nay</p>
          <div className="mt-2 max-h-52 space-y-2 overflow-y-auto">
            {group.key === "health" && healthRoutines.map(routine => { const done = logs.some(log => log.routineId === routine.id && log.date === today && log.status !== "missed"); return <button key={routine.id} onClick={() => toggleRoutine(routine.id)} className={`flex w-full items-start gap-2 rounded-xl p-2.5 text-left ${done ? "bg-emerald-50" : "bg-slate-50"}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${done ? "bg-emerald-500 text-white" : "border-2 border-slate-200"}`}>{done && <Check className="h-3 w-3" />}</span><span className="text-xs font-bold">{routineDisplayName[routine.id] || routine.name}</span></button>})}
            {group.key === "chores" && todayChores.map(chore => <button key={chore.id} onClick={() => toggleChore(chore.id)} className="flex w-full items-start gap-2 rounded-xl bg-slate-50 p-2.5 text-left"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 border-slate-200" /><span className="text-xs font-bold">{chore.title}</span></button>)}
            {scheduled.map(item => <button key={item.id} onClick={() => toggleMain(item)} className={`flex w-full items-start gap-2 rounded-xl p-2.5 text-left ${item.completed ? "bg-emerald-50" : "bg-slate-50"}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${item.completed ? "bg-emerald-500 text-white" : "border-2 border-slate-200"}`}>{item.completed && <Check className="h-3 w-3" />}</span><span><b className={`block text-xs ${item.completed ? "line-through text-emerald-700" : "text-slate-800"}`}>{item.title}</b>{item.startTime && <small className="font-mono text-[9px] text-slate-400">{item.startTime}–{item.endTime}</small>}</span></button>)}
            {scheduled.length === 0 && group.key !== "health" && group.key !== "chores" && <p className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-[10px] text-slate-400">Chưa có việc hôm nay.</p>}
          </div>
          {group.key === "relationship" && scheduled.length === 0 && <p className="mt-3 text-[10px] text-pink-600">Gợi ý: một hành động kết nối nhỏ.</p>}
        </article>;
      })}</div>
      {isSunday && <button onClick={onOpenReview} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950"><RotateCcw className="h-4 w-4" />Review 6 ngày vừa qua</button>}
    </section>

    <section id="section-quick-input" className="rounded-[24px] border-2 border-indigo-200 bg-indigo-50/50 p-5">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-600 p-2 text-white"><Plus className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">10 giây</p><h3 className="text-lg font-black">Ghi việc vừa làm</h3></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[100px_1fr_190px]"><input aria-label="Giờ thực hiện" type="time" value={quickTime} onChange={e => setQuickTime(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold" /><input aria-label="Việc đã thực hiện" value={quickText} maxLength={300} onChange={e => setQuickText(e.target.value)} placeholder="Đã thực hiện việc gì?" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" /><select aria-label="Khía cạnh cuộc sống" value={quickGoal} onChange={e => setQuickGoal(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-800"><option value="area:health">Sức khỏe</option><option value="area:fund">Fund</option><option value="area:b2b">B2B</option><option value="area:relationship">Relationship</option><option value="area:chores">Chores</option>{activeGoals.length > 0 && <optgroup label="Mục tiêu đang hoạt động">{activeGoals.map(goal => <option key={goal.id} value={`goal:${goal.id}`}>{goal.name}</option>)}</optgroup>}</select></div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_130px_auto]"><input value={quickNext} maxLength={200} onChange={e => setQuickNext(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveActivity(); }} placeholder="Hành động tiếp theo là gì?" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" /><label className="relative"><Scale className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Cân nặng" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm" /></label><button onClick={saveActivity} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white">Ghi nhận</button></div>{captureError && <p className="mt-2 text-xs font-bold text-rose-600">{captureError}</p>}
    </section>

    <section className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Home className="h-5 w-5 text-emerald-600" /><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-600">Cuộc sống thật</p><h3 className="text-lg font-black">Đã sống & đã làm</h3></div></div><button onClick={onOpenProgress} className="text-xs font-black text-indigo-600">Xem biểu đồ →</button></div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">{activities.map(item => { const aspect = getAspect(item.goalId, item.activity, String(item.output?.lifeArea || "")); return <article key={item.id} className="min-w-60 rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between"><span className="font-mono text-xs font-black text-emerald-700">{item.startTime || "--:--"}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${aspect.tone}`}>{aspect.label}</span></div><p className="mt-2 text-sm font-black">{item.activity}</p>{item.nextAction && <p className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-600"><b>Tiếp theo:</b> {item.nextAction}</p>}{typeof item.output?.weightKg === "number" && <p className="mt-2 text-xs font-black text-rose-600">{item.output.weightKg} kg</p>}</article>})}{activities.length === 0 && <p className="w-full rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">Chưa ghi nhận gì. Mỗi việc nhỏ đều được tính.</p>}</div>
    </section>

    <section className="rounded-[24px] border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-violet-600" /><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">Tiến bộ & bước kế</p><h3 className="text-lg font-black">Các khía cạnh cuộc sống</h3></div></div><button onClick={onOpenProgress} className="text-xs font-black text-indigo-600">Chi tiết →</button></div><div className="mt-4 grid gap-3 md:grid-cols-3">{activeGoals.slice(0,3).map(goal => { const aspect = getAspect(goal.id); return <article key={goal.id} className="rounded-2xl border border-slate-200 p-4"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${aspect.tone}`}>{aspect.label}</span><div className="mt-3 flex items-end justify-between"><p className="text-sm font-black text-slate-900">{goal.name}</p><b className="text-lg">{goal.currentProgress || 0}%</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-violet-500" style={{ width: `${Math.min(100, goal.currentProgress || 0)}%` }} /></div><p className="mt-3 text-xs text-slate-600"><b>Tiếp theo:</b> {goal.nextAction || goal.currentMilestone || "Chưa chốt"}</p></article>})}</div></section>
  </div>;
}
