import React, { useMemo, useRef, useState } from "react";
import { BarChart3, CalendarDays, Check, ClipboardCheck, Droplets, Plus, RotateCcw, Scale, Timer } from "lucide-react";
import { ActivityEntry, AppState } from "../types";
import { isScheduleValidForDate } from "../utils";

interface SimpleTodayViewProps {
  state: AppState;
  onChangeState: (state: AppState) => void;
  onOpenReview?: () => void;
}

const DAY_MS = 86_400_000;
const hcmDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const hcmTime = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
const minutesBetween = (start = "", end = "") => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
  return Math.max(0, eh * 60 + em - sh * 60 - sm);
};
const dateAtNoon = (date: string) => new Date(`${date}T12:00:00`);
const formatDay = (date: string) => new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(dateAtNoon(date));

const LIFE_AREAS = {
  health: { label: "Sức khỏe", tone: "bg-rose-100 text-rose-700" },
  fund: { label: "Fund", tone: "bg-violet-100 text-violet-700" },
  b2b: { label: "B2B", tone: "bg-blue-100 text-blue-700" },
  relationship: { label: "Relationship", tone: "bg-pink-100 text-pink-700" },
  chores: { label: "Chores", tone: "bg-cyan-100 text-cyan-700" },
  work: { label: "Công việc", tone: "bg-emerald-100 text-emerald-700" },
  life: { label: "Đời sống", tone: "bg-slate-100 text-slate-600" }
} as const;
type LifeAreaKey = keyof typeof LIFE_AREAS;

export default function SimpleTodayView({ state, onChangeState, onOpenReview }: SimpleTodayViewProps) {
  const today = hcmDate();
  const isSunday = dateAtNoon(today).getDay() === 0;
  const [activity, setActivity] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [time, setTime] = useState(hcmTime());
  const [area, setArea] = useState<LifeAreaKey>("health");
  const [duration, setDuration] = useState("");
  const [weight, setWeight] = useState("");
  const [water, setWater] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);

  const activeGoals = (state.goals || []).filter(goal => goal.status === "active");
  const resolveArea = (goalId?: string | null, title = "", savedArea = ""): LifeAreaKey => {
    if (savedArea in LIFE_AREAS) return savedArea as LifeAreaKey;
    const goal = activeGoals.find(item => item.id === goalId) || state.goals.find(item => item.id === goalId);
    const source = `${goal?.name || ""} ${title}`;
    if (goal?.category === "health" || /health|chạy|yoga|skincare|nước|ngủ|tắm/i.test(source)) return "health";
    if (goal?.category === "fund_backtest" || /fund|trading|backtest|demo/i.test(source)) return "fund";
    if (goal?.category === "business" || goal?.category === "marketing" || /b2b|seo|website|portfolio/i.test(source)) return "b2b";
    if (/relationship|lover|ba mẹ|gia đình|rainy|ranny|lacky/i.test(source)) return "relationship";
    if (/dọn|mèo|chợ|bếp|nhà|giặt|chore/i.test(source)) return "chores";
    if (/công ty|full-time|đi làm|job|freelance|outlier|upwork/i.test(source)) return "work";
    return "life";
  };

  const todaySchedule = useMemo(() => (state.scheduleItems || [])
    .filter(item => item.date === today && isScheduleValidForDate(item))
    .sort((a, b) => a.startTime.localeCompare(b.startTime)), [state.scheduleItems, today]);

  const weekDays = useMemo(() => {
    const current = dateAtNoon(today);
    const mondayOffset = (current.getDay() + 6) % 7;
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(current.getTime() - (mondayOffset - index) * DAY_MS);
      const dateStr = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
      return { date: dateStr, label: ["T2", "T3", "T4", "T5", "T6", "T7"][index] };
    });
  }, [today]);

  const isChoreDue = (chore: NonNullable<AppState["chores"]>[number], date: string) => {
    if (chore.frequency === "one_time") return !chore.completed && (!chore.dueDate || chore.dueDate <= date);
    if (chore.frequency === "daily") return chore.lastCompletedDate !== date;
    if (chore.dueDate && chore.dueDate > date) return false;
    if (!chore.lastCompletedDate) return true;
    const elapsed = dateAtNoon(date).getTime() - dateAtNoon(chore.lastCompletedDate).getTime();
    return Number.isFinite(elapsed) && elapsed >= 7 * DAY_MS;
  };

  const progressForDate = (date: string) => {
    const schedules = (state.scheduleItems || []).filter(item => item.date === date && item.completed && isScheduleValidForDate(item));
    const activities = (state.activities || []).filter(item => item.date === date);
    const routineLogs = (state.routineLogs || []).filter(item => item.date === date && item.status !== "missed" && item.status !== "skipped");
    const scheduleMinutes = (key: LifeAreaKey, pattern?: RegExp) => schedules
      .filter(item => resolveArea(item.goalId || item.journeyId, item.title) === key && (!pattern || pattern.test(item.title)))
      .reduce((sum, item) => sum + (item.estimatedMinutes || minutesBetween(item.startTime, item.endTime)), 0);
    const activityMinutes = (key: LifeAreaKey) => activities
      .filter(item => resolveArea(item.goalId, item.activity, String(item.output?.lifeArea || "")) === key)
      .reduce((sum, item) => sum + (Number(item.output?.durationMinutes) || 0), 0);
    const routineDone = (id: string) => routineLogs.some(log => log.routineId === id);
    const record = state.healthRecords?.[date];
    const waterMl = activities.reduce((sum, item) => sum + (Number(item.output?.waterMl) || 0), 0) || (routineDone("routine_water_1500") ? 1500 : 0);
    const exerciseMinutes = Math.max(scheduleMinutes("health", /chạy|yoga|thể dục|exercise/i), activityMinutes("health"), routineDone("routine_running_park") ? 45 : 0);
    const fundMinutes = Math.max(scheduleMinutes("fund"), activityMinutes("fund"));
    const b2bMinutes = Math.max(scheduleMinutes("b2b"), activityMinutes("b2b"));
    const skincareDone = routineDone("routine_beauty_foundation") || schedules.some(item => /skincare/i.test(item.title));
    const choreScheduleDone = schedules.filter(item => resolveArea(item.goalId || item.journeyId, item.title) === "chores").length;
    const choreDone = (state.chores || []).filter(chore => chore.lastCompletedDate === date).length + choreScheduleDone;
    const chorePlanned = Math.max(1, (state.chores || []).filter(chore => chore.frequency === "daily" || isChoreDue(chore, date)).length);
    return { weight: record?.weight ?? null, exerciseMinutes, waterMl, skincareDone, fundMinutes, b2bMinutes, choreDone, chorePlanned };
  };

  const todayProgress = progressForDate(today);
  const latestWeights = Object.values(state.healthRecords || {}).filter(record => typeof record.weight === "number" && record.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const previousWeight = latestWeights[1]?.weight ?? null;
  const dayMetrics = [
    { label: "Cân nặng", value: todayProgress.weight === null ? "Chưa ghi" : `${todayProgress.weight} kg`, detail: todayProgress.weight !== null && previousWeight !== null ? `${todayProgress.weight - previousWeight > 0 ? "+" : ""}${(todayProgress.weight - previousWeight).toFixed(2)} kg` : "Ghi buổi sáng", percent: todayProgress.weight === null ? 0 : 100 },
    { label: "Thể dục", value: `${todayProgress.exerciseMinutes}/30 phút`, detail: "Mức tối thiểu", percent: Math.min(100, todayProgress.exerciseMinutes / 30 * 100) },
    { label: "Nước", value: `${todayProgress.waterMl}/1.500 ml`, detail: "Trong cả ngày", percent: Math.min(100, todayProgress.waterMl / 1500 * 100) },
    { label: "Skincare", value: todayProgress.skincareDone ? "Đã hoàn tất" : "Chưa làm", detail: "Routine tối", percent: todayProgress.skincareDone ? 100 : 0 },
    { label: "Fund", value: `${todayProgress.fundMinutes}/120 phút`, detail: "T2–T6", percent: Math.min(100, todayProgress.fundMinutes / 120 * 100) },
    { label: "B2B", value: `${todayProgress.b2bMinutes}/30 phút`, detail: "Mức duy trì", percent: Math.min(100, todayProgress.b2bMinutes / 30 * 100) },
    { label: "Chores", value: `${todayProgress.choreDone}/${todayProgress.chorePlanned} việc`, detail: "Nhà và mèo", percent: Math.min(100, todayProgress.choreDone / todayProgress.chorePlanned * 100) }
  ];

  const completedToday = todaySchedule.filter(item => item.completed).length;
  const toggleSchedule = (id: string) => {
    const current = todaySchedule.find(item => item.id === id);
    if (!current) return;
    const completed = !current.completed;
    onChangeState({
      ...state,
      scheduleItems: (state.scheduleItems || []).map(item => item.id === id ? { ...item, completed } : item),
      priorityTasks: (state.priorityTasks || []).map(task => task.id === current.taskId ? { ...task, completed, status: completed ? "completed" : "ready", completedAt: completed ? new Date().toISOString() : null } : task)
    });
  };

  const saveActivity = () => {
    if (submitLock.current) return;
    const cleanActivity = activity.trim();
    const parsedDuration = duration.trim() ? Number(duration) : 0;
    const parsedWeight = weight.trim() ? Number(weight) : null;
    const parsedWater = water.trim() ? Number(water) : 0;
    if (!cleanActivity && parsedWeight === null && parsedWater === 0) return setNotice("Nhập việc đã làm, cân nặng hoặc lượng nước.");
    if (cleanActivity.length > 300 || nextAction.trim().length > 200) return setNotice("Nội dung quá dài: việc tối đa 300 ký tự, bước tiếp theo tối đa 200 ký tự.");
    if (!Number.isFinite(parsedDuration) || parsedDuration < 0 || parsedDuration > 720) return setNotice("Thời lượng cần nằm trong khoảng 0–720 phút.");
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 25 || parsedWeight > 300)) return setNotice("Cân nặng cần nằm trong khoảng 25–300 kg.");
    if (!Number.isFinite(parsedWater) || parsedWater < 0 || parsedWater > 5000) return setNotice("Lượng nước cần nằm trong khoảng 0–5.000 ml.");
    submitLock.current = true;
    setSaving(true);
    const linkedGoal = activeGoals.find(goal => resolveArea(goal.id) === area);
    const now = Date.now();
    const entry: ActivityEntry = {
      id: `manual-${now}`, date: today, goalId: linkedGoal?.id || null, source: "manual",
      activity: cleanActivity || (parsedWeight !== null ? `Cân lúc ${time}` : `Uống nước lúc ${time}`),
      output: { lifeArea: area, ...(parsedDuration ? { durationMinutes: parsedDuration } : {}), ...(parsedWeight !== null ? { weightKg: parsedWeight } : {}), ...(parsedWater ? { waterMl: parsedWater } : {}) },
      outcome: {}, outcomeStatus: "not_applicable", insight: null, nextAction: nextAction.trim() || null,
      confidence: 1, createdTimestamp: now, updatedTimestamp: now, startTime: time
    };
    const healthRecords = parsedWeight === null ? state.healthRecords : {
      ...state.healthRecords,
      [today]: { ...(state.healthRecords[today] || { date: today, sleepHours: null, energy: null, steps: null, strengthSession: false, eatOnPlan: false, skincare: false, styleAndAppearance: false, notes: "" }), weight: parsedWeight }
    };
    const goals = nextAction.trim() && linkedGoal ? state.goals.map(goal => goal.id === linkedGoal.id ? { ...goal, nextAction: nextAction.trim() } : goal) : state.goals;
    onChangeState({ ...state, goals, healthRecords, activities: [entry, ...(state.activities || [])] });
    setActivity(""); setNextAction(""); setDuration(""); setWeight(""); setWater(""); setNotice("Đã ghi nhận và cập nhật tiến độ.");
    window.setTimeout(() => { submitLock.current = false; setSaving(false); }, 500);
  };

  if (isSunday) return <div className="mx-auto max-w-6xl space-y-5">
    <section className="rounded-[28px] bg-slate-950 p-6 text-white shadow-xl md:p-8">
      <p className="text-xs font-black uppercase tracking-[.18em] text-amber-300">Chủ nhật · chỉ review</p>
      <h2 className="mt-2 text-2xl font-black">Không thêm áp lực thực thi hôm nay</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">Xem lại dữ liệu từ thứ Hai đến thứ Bảy, chốt điều cần giữ, giảm hoặc đổi trong tuần tiếp theo.</p>
      <button onClick={onOpenReview} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950"><RotateCcw className="h-4 w-4" />Mở Review tuần</button>
    </section>
    <WeeklyProgress weekDays={weekDays} getProgress={progressForDate} />
  </div>;

  return <div className="mx-auto max-w-6xl space-y-5">
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">Trang 1 · việc cần làm</p><h2 className="mt-1 text-2xl font-black">Lịch trình hôm nay</h2><p className="mt-1 text-sm capitalize text-slate-500">{formatDay(today)}</p></div><span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">{completedToday}/{todaySchedule.length} đã xong</span></div>
      {todaySchedule.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-8 text-center"><CalendarDays className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 text-sm font-bold text-slate-700">Hôm nay chưa có lịch</p><p className="mt-1 text-xs text-slate-500">Thêm việc phát sinh trong Calendar hoặc nhập kế hoạch tại Plan Hub.</p></div> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] border-separate border-spacing-y-2"><thead><tr className="text-left text-[10px] font-black uppercase tracking-wide text-slate-400"><th className="px-3">Giờ</th><th className="px-3">Việc cần làm</th><th className="px-3">Nhóm</th><th className="px-3 text-right">Trạng thái</th></tr></thead><tbody>{todaySchedule.map(item => { const key = resolveArea(item.goalId || item.journeyId, item.title); const meta = LIFE_AREAS[key]; return <tr key={item.id} className={item.completed ? "bg-emerald-50" : "bg-slate-50"}><td className="rounded-l-xl px-3 py-3 font-mono text-xs font-black text-slate-600">{item.startTime || "—"}–{item.endTime || "—"}</td><td className={`px-3 py-3 text-sm font-bold ${item.completed ? "text-emerald-700 line-through" : "text-slate-900"}`}>{item.title}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${meta.tone}`}>{meta.label}</span></td><td className="rounded-r-xl px-3 py-3 text-right"><button onClick={() => toggleSchedule(item.id)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black ${item.completed ? "bg-emerald-500 text-white" : "border border-slate-300 bg-white text-slate-600"}`}>{item.completed && <Check className="h-3 w-3" />}{item.completed ? "Đã xong" : "Đánh dấu xong"}</button></td></tr>; })}</tbody></table></div>}
    </section>

    <section className="rounded-[24px] border-2 border-indigo-200 bg-indigo-50/40 p-5">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-600 p-2 text-white"><Plus className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">Ghi lại thông tin</p><h3 className="text-lg font-black">Việc vừa làm và số liệu thực tế</h3></div></div>
      <div className="mt-4 grid gap-2 md:grid-cols-[100px_1fr_170px_110px]"><input aria-label="Giờ thực hiện" type="time" value={time} onChange={event => setTime(event.target.value)} className="rounded-xl border bg-white px-3 py-3 text-sm" /><input aria-label="Việc đã thực hiện" maxLength={300} value={activity} onChange={event => setActivity(event.target.value)} placeholder="Bạn vừa làm gì?" className="rounded-xl border bg-white px-3 py-3 text-sm" /><select aria-label="Nhóm cuộc sống" value={area} onChange={event => setArea(event.target.value as LifeAreaKey)} className="rounded-xl border bg-white px-3 py-3 text-sm font-bold">{Object.entries(LIFE_AREAS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select><label className="relative"><Timer className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input aria-label="Số phút thực tế" inputMode="numeric" value={duration} onChange={event => setDuration(event.target.value)} placeholder="Số phút" className="w-full rounded-xl border bg-white py-3 pl-9 pr-3 text-sm" /></label></div>
      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_140px_140px_auto]"><input maxLength={200} value={nextAction} onChange={event => setNextAction(event.target.value)} placeholder="Hành động tiếp theo" className="rounded-xl border bg-white px-3 py-3 text-sm" /><label className="relative"><Scale className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input aria-label="Cân nặng" inputMode="decimal" value={weight} onChange={event => setWeight(event.target.value)} placeholder="Cân nặng" className="w-full rounded-xl border bg-white py-3 pl-9 pr-3 text-sm" /></label><label className="relative"><Droplets className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input aria-label="Lượng nước ml" inputMode="numeric" value={water} onChange={event => setWater(event.target.value)} placeholder="Nước (ml)" className="w-full rounded-xl border bg-white py-3 pl-9 pr-3 text-sm" /></label><button disabled={saving} onClick={saveActivity} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Đang lưu…" : "Ghi nhận"}</button></div>
      {notice && <p className={`mt-3 text-xs font-bold ${notice.startsWith("Đã") ? "text-emerald-700" : "text-rose-600"}`}>{notice}</p>}
    </section>

    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3"><ClipboardCheck className="h-5 w-5 text-emerald-600" /><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">Theo từng mục nhỏ</p><h3 className="text-xl font-black">Tiến độ hôm nay</h3></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{dayMetrics.map(metric => <article key={metric.label} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black text-slate-500">{metric.label}</p><p className="mt-1 text-sm font-black text-slate-900">{metric.value}</p></div><span className="text-xs font-black text-indigo-600">{Math.round(metric.percent)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${metric.percent}%` }} /></div><p className="mt-2 text-[10px] font-semibold text-slate-400">{metric.detail}</p></article>)}</div>
    </section>

    <WeeklyProgress weekDays={weekDays} getProgress={progressForDate} />
  </div>;
}

function WeeklyProgress({ weekDays, getProgress }: { weekDays: { date: string; label: string }[]; getProgress: (date: string) => any }) {
  const rows = [
    { label: "Cân nặng", render: (p: any) => p.weight === null ? "—" : `${p.weight}kg` },
    { label: "Thể dục", render: (p: any) => `${p.exerciseMinutes}p` },
    { label: "Nước", render: (p: any) => `${Math.round(p.waterMl / 100) / 10}L` },
    { label: "Skincare", render: (p: any) => p.skincareDone ? "✓" : "—" },
    { label: "Fund", render: (p: any) => `${p.fundMinutes}p` },
    { label: "B2B", render: (p: any) => `${p.b2bMinutes}p` },
    { label: "Chores", render: (p: any) => `${p.choreDone}/${p.chorePlanned}` }
  ];
  return <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-violet-600" /><div><p className="text-xs font-black uppercase tracking-[.16em] text-violet-600">Thứ Hai–Thứ Bảy</p><h3 className="text-xl font-black">Tiến độ tuần theo từng mục nhỏ</h3></div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[660px] text-sm"><thead><tr className="border-b text-left text-[10px] font-black uppercase tracking-wide text-slate-400"><th className="px-3 py-2">Hạng mục</th>{weekDays.map(day => <th key={day.date} className="px-3 py-2 text-center">{day.label}<span className="block font-mono font-medium normal-case">{day.date.slice(8, 10)}/{day.date.slice(5, 7)}</span></th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.label} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 font-black text-slate-800">{row.label}</td>{weekDays.map(day => <td key={day.date} className="px-3 py-3 text-center font-mono text-xs font-bold text-slate-600">{row.render(getProgress(day.date))}</td>)}</tr>)}</tbody></table></div></section>;
}
