import React, { useMemo, useRef, useState } from "react";
import { BarChart3, BatteryLow, CalendarDays, Check, ChevronDown, ClipboardCheck, Droplets, Pencil, Plus, RotateCcw, Scale, Timer, Trash2, X } from "lucide-react";
import { ActivityEntry, AppState, ScheduleItem } from "../types";
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
  const isRecoveryMode = state.dailyMode === "recovery" && state.dailyModeDate === today;
  const [activity, setActivity] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [time, setTime] = useState(hcmTime());
  const [area, setArea] = useState<LifeAreaKey>("health");
  const [duration, setDuration] = useState("");
  const [weight, setWeight] = useState("");
  const [water, setWater] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [quickDraft, setQuickDraft] = useState({ weight: "", exercise: "", water: "", fund: "", b2b: "", chores: "" });
  const [quickNotice, setQuickNotice] = useState("");
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleNotice, setScheduleNotice] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState({ title: "", startTime: "", endTime: "", area: "life" as LifeAreaKey });
  const [showDetailedLog, setShowDetailedLog] = useState(false);
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [flashMetric, setFlashMetric] = useState<string | null>(null);
  const submitLock = useRef(false);
  const quickLock = useRef(false);

  const activeGoals = (state.goals || []).filter(goal => goal.status === "active");
  const resolveArea = (goalId?: string | null, title = "", savedArea = ""): LifeAreaKey => {
    if (savedArea.startsWith("lifeArea:")) savedArea = savedArea.slice("lifeArea:".length);
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
    const weeklyActivities = activities.filter(item => item.source === "manual" && item.originalTranscript === `weekly-manual-${date}`);
    const metricActivities = weeklyActivities.length ? weeklyActivities : activities;
    const routineLogs = (state.routineLogs || []).filter(item => item.date === date && item.status !== "missed" && item.status !== "skipped");
    const scheduleMinutes = (key: LifeAreaKey, pattern?: RegExp) => schedules
      .filter(item => resolveArea(item.goalId || item.journeyId, item.title, item.notes || "") === key && (!pattern || pattern.test(item.title)))
      .reduce((sum, item) => sum + (item.estimatedMinutes || minutesBetween(item.startTime, item.endTime)), 0);
    const exactActivity = (metric: string) => activities.find(item => item.originalTranscript === `exact:${metric}:${date}`);
    const activityMinutes = (key: LifeAreaKey) => metricActivities
      .filter(item => resolveArea(item.goalId, item.activity, String(item.output?.lifeArea || "")) === key)
      .reduce((sum, item) => sum + (Number(item.output?.durationMinutes) || 0), 0);
    const routineDone = (id: string) => routineLogs.some(log => log.routineId === id);
    const record = state.healthRecords?.[date];
    const exactWater = exactActivity("water");
    const exactExercise = exactActivity("exercise");
    const exactFund = exactActivity("fund");
    const exactB2b = exactActivity("b2b");
    const exactChores = exactActivity("chores");
    const waterMl = exactWater ? Number(exactWater.output?.waterMl) || 0 : metricActivities.reduce((sum, item) => sum + (Number(item.output?.waterMl) || 0), 0) || (routineDone("routine_water_1500") ? 1500 : 0);
    const exerciseMinutes = exactExercise ? Number(exactExercise.output?.durationMinutes) || 0 : Math.max(scheduleMinutes("health", /chạy|yoga|thể dục|exercise/i), activityMinutes("health"), routineDone("routine_running_park") ? 45 : 0);
    const fundMinutes = exactFund ? Number(exactFund.output?.durationMinutes) || 0 : Math.max(scheduleMinutes("fund"), activityMinutes("fund"));
    const b2bMinutes = exactB2b ? Number(exactB2b.output?.durationMinutes) || 0 : Math.max(scheduleMinutes("b2b"), activityMinutes("b2b"));
    const skincareDone = routineDone("routine_beauty_foundation");
    const choreScheduleDone = schedules.filter(item => resolveArea(item.goalId || item.journeyId, item.title, item.notes || "") === "chores").length;
    const manualChoreDone = metricActivities.reduce((sum, item) => sum + (Number(item.output?.choreCount) || 0), 0);
    const choreDone = exactChores ? Number(exactChores.output?.choreCount) || 0 : weeklyActivities.length ? manualChoreDone : (state.chores || []).filter(chore => chore.lastCompletedDate === date).length + choreScheduleDone + manualChoreDone;
    const chorePlanned = Math.max(1, (state.chores || []).filter(chore => chore.frequency === "daily" || isChoreDue(chore, date)).length);
    return { weight: record?.weight ?? null, exerciseMinutes, waterMl, skincareDone, fundMinutes, b2bMinutes, choreDone, chorePlanned };
  };

  const todayProgress = progressForDate(today);
  const latestWeights = Object.values(state.healthRecords || {}).filter(record => typeof record.weight === "number" && record.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const previousWeight = latestWeights[1]?.weight ?? null;
  const dayMetrics = [
    { key: "weight", label: "Cân nặng", value: todayProgress.weight === null ? "Chưa ghi" : `${todayProgress.weight} kg`, detail: todayProgress.weight !== null && previousWeight !== null ? `${todayProgress.weight - previousWeight > 0 ? "+" : ""}${(todayProgress.weight - previousWeight).toFixed(2)} kg` : "Ghi buổi sáng", percent: todayProgress.weight === null ? 0 : 100 },
    { key: "exercise", label: "Thể dục", value: `${todayProgress.exerciseMinutes}/30 phút`, detail: "Mức tối thiểu", percent: Math.min(100, todayProgress.exerciseMinutes / 30 * 100) },
    { key: "water", label: "Nước", value: `${todayProgress.waterMl}/1.500 ml`, detail: "Trong cả ngày", percent: Math.min(100, todayProgress.waterMl / 1500 * 100) },
    { key: "skincare", label: "Skincare", value: todayProgress.skincareDone ? "Đã hoàn tất" : "Chưa làm", detail: "Routine tối", percent: todayProgress.skincareDone ? 100 : 0 },
    { key: "fund", label: "Fund", value: `${todayProgress.fundMinutes}/120 phút`, detail: "T2–T6", percent: Math.min(100, todayProgress.fundMinutes / 120 * 100) },
    { key: "b2b", label: "B2B", value: `${todayProgress.b2bMinutes}/30 phút`, detail: "Mức duy trì", percent: Math.min(100, todayProgress.b2bMinutes / 30 * 100) },
    { key: "chores", label: "Chores", value: `${todayProgress.choreDone} xong · ${todayProgress.chorePlanned} dự kiến`, detail: "Nhà và mèo", percent: Math.min(100, todayProgress.choreDone / todayProgress.chorePlanned * 100) }
  ];

  const completedToday = todaySchedule.filter(item => item.completed).length;
  const incompleteToday = todaySchedule.filter(item => !item.completed);
  const visibleFocusItems = isRecoveryMode ? incompleteToday.slice(0, 1) : incompleteToday.slice(0, 3);
  const nextItem = visibleFocusItems[0] || null;
  const todayActivities = useMemo(() => (state.activities || [])
    .filter(item => item.date === today)
    .sort((a, b) => (b.startTime || "").localeCompare(a.startTime || "") || b.createdTimestamp - a.createdTimestamp), [state.activities, today]);

  const addQuickActivity = (activityName: string, lifeArea: LifeAreaKey, output: Record<string, number>, feedback: string) => {
    if (quickLock.current) return;
    quickLock.current = true;
    const now = Date.now();
    const linkedGoal = activeGoals.find(goal => resolveArea(goal.id) === lifeArea);
    const metric = output.waterMl ? "water" : output.choreCount ? "chores" : lifeArea === "health" ? "exercise" : lifeArea === "fund" ? "fund" : lifeArea === "b2b" ? "b2b" : null;
    const marker = metric ? `exact:${metric}:${today}` : null;
    const existingExact = marker ? (state.activities || []).find(item => item.originalTranscript === marker) : null;
    const increment = Number(output.waterMl || output.choreCount || output.durationMinutes || 0);
    const exactKey = metric === "water" ? "waterMl" : metric === "chores" ? "choreCount" : "durationMinutes";
    const nextExactValue = existingExact ? (Number(existingExact.output?.[exactKey]) || 0) + increment : null;
    const entry: ActivityEntry = existingExact && marker ? {
      ...existingExact,
      activity: `Tổng ${metric} hôm nay: ${nextExactValue}`,
      output: { ...existingExact.output, [exactKey]: nextExactValue },
      updatedTimestamp: now,
      startTime: hcmTime()
    } : { id: `quick-preset-${now}`, date: today, goalId: linkedGoal?.id || null, source: "manual", activity: activityName, output: { lifeArea, ...output }, outcome: {}, outcomeStatus: "not_applicable", insight: null, nextAction: null, confidence: 1, createdTimestamp: now, updatedTimestamp: now, startTime: hcmTime() };
    onChangeState({ ...state, activities: [entry, ...(state.activities || []).filter(item => item.id !== entry.id)] });
    setQuickNotice(existingExact ? `Đã cập nhật tổng ${metric} hôm nay = ${nextExactValue}.` : feedback);
    setFlashMetric(lifeArea);
    window.setTimeout(() => { quickLock.current = false; setFlashMetric(null); }, 800);
  };

  const deleteActivity = (item: ActivityEntry) => {
    if (!window.confirm(`Xóa ghi nhận “${item.activity}”?`)) return;
    const scheduleId = item.originalTranscript?.startsWith("schedule:") ? item.originalTranscript.slice("schedule:".length) : null;
    onChangeState({
      ...state,
      activities: (state.activities || []).filter(activityItem => activityItem.id !== item.id),
      routineLogs: (state.routineLogs || []).filter(log => log.activityId !== item.id),
      scheduleItems: scheduleId ? (state.scheduleItems || []).map(schedule => schedule.id === scheduleId ? { ...schedule, completed: false } : schedule) : state.scheduleItems
    });
  };

  const setRecoveryMode = () => {
    const recovery = !isRecoveryMode;
    onChangeState({ ...state, dailyMode: recovery ? "recovery" : "normal", dailyModeDate: today });
    setQuickNotice(recovery ? "Đã bật Ngày ít năng lượng: chỉ giữ một việc chính." : "Đã trở lại chế độ bình thường.");
  };

  const openScheduleEditor = (item?: ScheduleItem) => {
    setEditingScheduleId(item?.id || null);
    setScheduleDraft({
      title: item?.title || "",
      startTime: item?.startTime || "",
      endTime: item?.endTime || "",
      area: item ? resolveArea(item.goalId || item.journeyId, item.title, item.notes || "") : "life"
    });
    setScheduleNotice("");
    setScheduleEditorOpen(true);
  };

  const saveScheduleItem = () => {
    const title = scheduleDraft.title.trim();
    if (!title) return setScheduleNotice("Tên công việc không được để trống.");
    if (title.length > 200) return setScheduleNotice("Tên công việc tối đa 200 ký tự.");
    if (!/^\d{2}:\d{2}$/.test(scheduleDraft.startTime) || !/^\d{2}:\d{2}$/.test(scheduleDraft.endTime)) return setScheduleNotice("Hãy nhập đủ giờ bắt đầu và kết thúc.");
    if (scheduleDraft.endTime <= scheduleDraft.startTime) return setScheduleNotice("Giờ kết thúc phải sau giờ bắt đầu.");
    const linkedGoal = activeGoals.find(goal => resolveArea(goal.id) === scheduleDraft.area);
    const current = editingScheduleId ? (state.scheduleItems || []).find(item => item.id === editingScheduleId) : null;
    const item: ScheduleItem = {
      ...(current || {}),
      id: current?.id || `schedule-manual-${Date.now()}`,
      title,
      date: today,
      startTime: scheduleDraft.startTime,
      endTime: scheduleDraft.endTime,
      estimatedMinutes: minutesBetween(scheduleDraft.startTime, scheduleDraft.endTime),
      goalId: linkedGoal?.id || null,
      journeyId: linkedGoal?.id || null,
      type: current?.type || "personal",
      completed: current?.completed || false,
      notes: `lifeArea:${scheduleDraft.area}`
    };
    const items = editingScheduleId
      ? (state.scheduleItems || []).map(existing => existing.id === editingScheduleId ? item : existing)
      : [...(state.scheduleItems || []), item];
    onChangeState({ ...state, scheduleItems: items });
    setScheduleEditorOpen(false);
    setEditingScheduleId(null);
    setScheduleNotice("");
  };

  const deleteScheduleItem = (item: ScheduleItem) => {
    if (!window.confirm(`Xóa “${item.title}” khỏi lịch hôm nay?`)) return;
    onChangeState({
      ...state,
      scheduleItems: (state.scheduleItems || []).filter(existing => existing.id !== item.id),
      priorityTasks: (state.priorityTasks || []).filter(task => task.id !== item.taskId)
    });
  };
  const saveQuickMetric = (metric: "weight" | "exercise" | "water" | "skincare" | "fund" | "b2b" | "chores") => {
    if (quickLock.current) return;
    const rawValue = metric === "skincare" ? "1" : quickDraft[metric].trim();
    if (metric !== "skincare" && rawValue === "") return setQuickNotice("Hãy nhập một giá trị trước khi đặt tổng.");
    const value = Number(rawValue);
    if (metric === "weight" && (!Number.isFinite(value) || value < 25 || value > 300)) return setQuickNotice("Cân nặng cần nằm trong khoảng 25–300 kg.");
    if (metric === "exercise" && (!Number.isFinite(value) || value < 0 || value > 720)) return setQuickNotice("Thời gian thể dục cần nằm trong khoảng 0–720 phút.");
    if (metric === "water" && (!Number.isFinite(value) || value < 0 || value > 5000)) return setQuickNotice("Lượng nước cần nằm trong khoảng 0–5.000 ml.");
    if ((metric === "fund" || metric === "b2b") && (!Number.isFinite(value) || value < 0 || value > 720)) return setQuickNotice("Thời gian cần nằm trong khoảng 0–720 phút.");
    if (metric === "chores" && (!Number.isInteger(value) || value < 0 || value > 50)) return setQuickNotice("Số chores cần là số nguyên từ 0–50.");
    quickLock.current = true;
    const now = Date.now();
    if (metric === "weight") {
      onChangeState({
        ...state,
        healthRecords: {
          ...state.healthRecords,
          [today]: {
            ...(state.healthRecords[today] || { date: today, sleepHours: null, energy: null, steps: null, strengthSession: false, eatOnPlan: false, skincare: false, styleAndAppearance: false, notes: "" }),
            weight: value
          }
        }
      });
    } else if (metric === "skincare") {
      const routineId = "routine_beauty_foundation";
      const completed = todayProgress.skincareDone;
      const filtered = (state.routineLogs || []).filter(log => !(log.routineId === routineId && log.date === today));
      onChangeState({
        ...state,
        routineLogs: completed ? filtered : [{
          id: `quick-${routineId}-${today}`,
          routineId,
          goalId: "G4",
          date: today,
          status: "completed",
          source: "manual",
          evidence: "Tick trực tiếp ở Tiến độ hôm nay",
          activityId: null,
          createdTimestamp: now,
          updatedTimestamp: now
        }, ...filtered]
      });
    } else {
      const lifeArea = metric === "exercise" || metric === "water" ? "health" : metric;
      const goalId = metric === "fund" ? "G1" : metric === "b2b" ? "G2" : metric === "chores" ? null : "G4";
      const output = metric === "water" ? { lifeArea, waterMl: value } : metric === "chores" ? { lifeArea, choreCount: value } : { lifeArea, durationMinutes: value };
      const marker = `exact:${metric}:${today}`;
      const entry: ActivityEntry = {
        id: `exact-${metric}-${today}`,
        date: today,
        goalId,
        source: "manual",
        originalTranscript: marker,
        activity: `Tổng ${metric} hôm nay: ${value}`,
        output,
        outcome: {},
        outcomeStatus: "not_applicable",
        insight: null,
        nextAction: null,
        confidence: 1,
        createdTimestamp: now,
        updatedTimestamp: now,
        startTime: hcmTime()
      };
      onChangeState({ ...state, activities: [entry, ...(state.activities || []).filter(item => item.originalTranscript !== marker)] });
    }
    setQuickDraft(current => ({ ...current, [metric]: "" }));
    setQuickNotice(metric === "skincare" && todayProgress.skincareDone ? "Đã bỏ hoàn tất skincare." : metric === "skincare" ? "Đã hoàn tất skincare." : `Đã đặt tổng ${metric} hôm nay = ${value}.`);
    window.setTimeout(() => { quickLock.current = false; }, 400);
  };

  const toggleSchedule = (id: string) => {
    const current = todaySchedule.find(item => item.id === id);
    if (!current) return;
    const completed = !current.completed;
    const skincareRoutineId = "routine_beauty_foundation";
    const existingLogs = state.routineLogs || [];
    const activityMarker = `schedule:${current.id}`;
    const existingActivities = state.activities || [];
    const scheduledActivity = existingActivities.find(item => item.originalTranscript === activityMarker);
    const areaKey = resolveArea(current.goalId || current.journeyId, current.title, current.notes || "");
    const now = Date.now();
    const activityEntry: ActivityEntry = {
      id: scheduledActivity?.id || `schedule-activity-${current.id}-${now}`,
      date: today,
      goalId: current.goalId || current.journeyId || null,
      source: "manual",
      originalTranscript: activityMarker,
      activity: current.title,
      output: { lifeArea: areaKey, durationMinutes: current.estimatedMinutes || minutesBetween(current.startTime, current.endTime) },
      outcome: {}, outcomeStatus: "not_applicable", insight: null, nextAction: null, confidence: 1,
      createdTimestamp: scheduledActivity?.createdTimestamp || now,
      updatedTimestamp: now,
      startTime: current.startTime,
      endTime: current.endTime
    };
    const activities = completed
      ? [activityEntry, ...existingActivities.filter(item => item.originalTranscript !== activityMarker)]
      : existingActivities.filter(item => item.originalTranscript !== activityMarker);
    const routineLogs = /skincare/i.test(current.title)
      ? completed
        ? [{ id: `schedule-${skincareRoutineId}-${today}`, routineId: skincareRoutineId, goalId: "G4", date: today, status: "completed" as const, source: "manual" as const, evidence: "Hoàn tất từ lịch hôm nay", activityId: null, createdTimestamp: Date.now(), updatedTimestamp: Date.now() }, ...existingLogs.filter(log => !(log.routineId === skincareRoutineId && log.date === today))]
        : existingLogs.filter(log => !(log.routineId === skincareRoutineId && log.date === today))
      : existingLogs;
    onChangeState({
      ...state,
      scheduleItems: (state.scheduleItems || []).map(item => item.id === id ? { ...item, completed } : item),
      priorityTasks: (state.priorityTasks || []).map(task => task.id === current.taskId ? { ...task, completed, status: completed ? "completed" : "ready", completedAt: completed ? new Date().toISOString() : null } : task),
      routineLogs,
      activities
    });
    setQuickNotice(completed ? `Đã ghi ${current.title} · ${activityEntry.output.durationMinutes} phút.` : `Đã bỏ hoàn tất ${current.title}.`);
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
    <ActivityFrequencyChart today={today} state={state} getProgress={progressForDate} />
  </div>;

  return <div className="mx-auto max-w-6xl space-y-5">
    <section className={`rounded-[28px] p-5 text-white shadow-xl md:p-7 ${isRecoveryMode ? "bg-gradient-to-br from-amber-700 to-rose-800" : "bg-gradient-to-br from-slate-950 to-indigo-950"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-200">Việc tiếp theo</p><h2 className="mt-2 text-2xl font-black">{nextItem?.title || "Hôm nay đã xử lý hết việc chính"}</h2><p className="mt-2 text-sm text-slate-300">{nextItem ? `${nextItem.startTime}–${nextItem.endTime} · ${LIFE_AREAS[resolveArea(nextItem.goalId || nextItem.journeyId, nextItem.title, nextItem.notes || "")].label}` : "Không cần tự tạo thêm áp lực."}</p></div><button type="button" onClick={setRecoveryMode} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black"><BatteryLow className="h-4 w-4" />{isRecoveryMode ? "Trở lại ngày thường" : "Hôm nay ít năng lượng"}</button></div>
      {visibleFocusItems.length > 0 && <div className="mt-5 grid gap-3 md:grid-cols-3">{visibleFocusItems.map((item, index) => <article key={item.id} className="rounded-2xl border border-white/15 bg-white/10 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-indigo-200">{index === 0 ? "Làm ngay" : `Sau đó ${index}`}</p><p className="mt-2 text-sm font-black">{item.title}</p><p className="mt-1 text-xs text-slate-300">{item.startTime}–{item.endTime}</p><button type="button" onClick={() => toggleSchedule(item.id)} className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950">Hoàn tất và ghi nhận</button></article>)}</div>}
      <p className="mt-4 text-xs text-slate-300">{isRecoveryMode ? "Ngày ít năng lượng chỉ giữ một việc chính. Việc còn lại không bị tính là thất bại." : `Chỉ hiện tối đa 3 việc. Còn ${Math.max(0, incompleteToday.length - 3)} việc nằm trong lịch đầy đủ.`}</p>
    </section>

    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><button type="button" onClick={() => setShowFullSchedule(current => !current)} className="flex items-center gap-3 text-left"><div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">Kế hoạch · không phải kết quả</p><h2 className="mt-1 text-xl font-black">Lịch trình đầy đủ</h2><p className="mt-1 text-sm capitalize text-slate-500">{formatDay(today)} · {completedToday}/{todaySchedule.length} đã xong</p></div><ChevronDown className={`h-5 w-5 text-slate-400 transition ${showFullSchedule ? "rotate-180" : ""}`} /></button><button type="button" onClick={() => { setShowFullSchedule(true); openScheduleEditor(); }} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700"><Plus className="h-4 w-4" />Thêm việc</button></div>
      {showFullSchedule && <>
      {scheduleEditorOpen && <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-slate-950">{editingScheduleId ? "Sửa công việc" : "Thêm công việc hôm nay"}</p><button type="button" onClick={() => setScheduleEditorOpen(false)} aria-label="Đóng trình sửa lịch" className="rounded-lg p-1.5 text-slate-500 hover:bg-white"><X className="h-4 w-4" /></button></div><div className="mt-3 grid gap-2 md:grid-cols-[1fr_110px_110px_150px_auto]"><input maxLength={200} value={scheduleDraft.title} onChange={event => setScheduleDraft(current => ({ ...current, title: event.target.value }))} placeholder="Tên công việc" className="rounded-xl border bg-white px-3 py-2.5 text-sm" /><input aria-label="Giờ bắt đầu" type="time" value={scheduleDraft.startTime} onChange={event => setScheduleDraft(current => ({ ...current, startTime: event.target.value }))} className="rounded-xl border bg-white px-3 py-2.5 text-sm" /><input aria-label="Giờ kết thúc" type="time" value={scheduleDraft.endTime} onChange={event => setScheduleDraft(current => ({ ...current, endTime: event.target.value }))} className="rounded-xl border bg-white px-3 py-2.5 text-sm" /><select aria-label="Nhóm công việc" value={scheduleDraft.area} onChange={event => setScheduleDraft(current => ({ ...current, area: event.target.value as LifeAreaKey }))} className="rounded-xl border bg-white px-3 py-2.5 text-sm font-bold">{Object.entries(LIFE_AREAS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select><button type="button" onClick={saveScheduleItem} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white">Lưu lịch</button></div>{scheduleNotice && <p role="alert" className="mt-2 text-xs font-bold text-rose-600">{scheduleNotice}</p>}</div>}
      {todaySchedule.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-8 text-center"><CalendarDays className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 text-sm font-bold text-slate-700">Hôm nay chưa có lịch</p><button type="button" onClick={() => openScheduleEditor()} className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white">Thêm việc đầu tiên</button></div> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[820px] border-separate border-spacing-y-2"><thead><tr className="text-left text-[10px] font-black uppercase tracking-wide text-slate-400"><th className="px-3">Giờ</th><th className="px-3">Việc cần làm</th><th className="px-3">Nhóm</th><th className="px-3 text-right">Thao tác</th></tr></thead><tbody>{todaySchedule.map(item => { const key = resolveArea(item.goalId || item.journeyId, item.title, item.notes || ""); const meta = LIFE_AREAS[key]; return <tr key={item.id} className={item.completed ? "bg-emerald-50" : "bg-slate-50"}><td className="rounded-l-xl px-3 py-3 font-mono text-xs font-black text-slate-600">{item.startTime || "—"}–{item.endTime || "—"}</td><td className={`px-3 py-3 text-sm font-bold ${item.completed ? "text-emerald-700 line-through" : "text-slate-900"}`}>{item.title}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${meta.tone}`}>{meta.label}</span></td><td className="rounded-r-xl px-3 py-3"><div className="flex justify-end gap-1.5"><button type="button" onClick={() => openScheduleEditor(item)} aria-label={`Sửa ${item.title}`} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => deleteScheduleItem(item)} aria-label={`Xóa ${item.title}`} className="rounded-lg border border-rose-200 bg-white p-2 text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button><button onClick={() => toggleSchedule(item.id)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black ${item.completed ? "bg-emerald-500 text-white" : "border border-slate-300 bg-white text-slate-600"}`}>{item.completed && <Check className="h-3 w-3" />}{item.completed ? "Đã xong" : "Đánh dấu xong"}</button></div></td></tr>; })}</tbody></table></div>}
      </>}
    </section>

    <section className="rounded-[24px] border-2 border-indigo-200 bg-indigo-50/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-600 p-2 text-white"><Plus className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">Quick Log · dưới 5 giây</p><h3 className="text-lg font-black">Ghi hành động thật</h3></div></div><button type="button" onClick={() => setShowDetailedLog(current => !current)} className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-700">{showDetailedLog ? "Đóng form chi tiết" : "Ghi hoạt động khác"}</button></div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6"><button type="button" onClick={() => addQuickActivity("Uống 250 ml nước", "health", { waterMl: 250 }, `Nước ${todayProgress.waterMl} → ${todayProgress.waterMl + 250} ml`)} className="rounded-xl border border-blue-200 bg-white px-3 py-3 text-xs font-black text-blue-700">+250 ml nước</button><button type="button" onClick={() => addQuickActivity("Thể dục 15 phút", "health", { durationMinutes: 15 }, `Thể dục ${todayProgress.exerciseMinutes} → ${todayProgress.exerciseMinutes + 15} phút`)} className="rounded-xl border border-rose-200 bg-white px-3 py-3 text-xs font-black text-rose-700">+15p thể dục</button><button type="button" onClick={() => addQuickActivity("Fund 30 phút", "fund", { durationMinutes: 30 }, `Fund ${todayProgress.fundMinutes} → ${todayProgress.fundMinutes + 30} phút`)} className="rounded-xl border border-violet-200 bg-white px-3 py-3 text-xs font-black text-violet-700">+30p Fund</button><button type="button" onClick={() => addQuickActivity("B2B 30 phút", "b2b", { durationMinutes: 30 }, `B2B ${todayProgress.b2bMinutes} → ${todayProgress.b2bMinutes + 30} phút`)} className="rounded-xl border border-sky-200 bg-white px-3 py-3 text-xs font-black text-sky-700">+30p B2B</button><button type="button" onClick={() => addQuickActivity("Hoàn tất 1 chore", "chores", { choreCount: 1 }, `Chores ${todayProgress.choreDone} → ${todayProgress.choreDone + 1} việc`)} className="rounded-xl border border-cyan-200 bg-white px-3 py-3 text-xs font-black text-cyan-700">+1 chore</button><button type="button" onClick={() => saveQuickMetric("skincare")} className={`rounded-xl border px-3 py-3 text-xs font-black ${todayProgress.skincareDone ? "border-emerald-300 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-700"}`}>{todayProgress.skincareDone ? "✓ Skincare xong" : "Skincare xong"}</button></div>
      {showDetailedLog && <div className="mt-4 rounded-2xl border border-indigo-100 bg-white/70 p-3">
      <div className="mt-4 grid gap-2 md:grid-cols-[100px_1fr_170px_110px]"><input aria-label="Giờ thực hiện" type="time" value={time} onChange={event => setTime(event.target.value)} className="rounded-xl border bg-white px-3 py-3 text-sm" /><input aria-label="Việc đã thực hiện" maxLength={300} value={activity} onChange={event => setActivity(event.target.value)} placeholder="Bạn vừa làm gì?" className="rounded-xl border bg-white px-3 py-3 text-sm" /><select aria-label="Nhóm cuộc sống" value={area} onChange={event => setArea(event.target.value as LifeAreaKey)} className="rounded-xl border bg-white px-3 py-3 text-sm font-bold">{Object.entries(LIFE_AREAS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select><label className="relative"><Timer className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input aria-label="Số phút thực tế" inputMode="numeric" value={duration} onChange={event => setDuration(event.target.value)} placeholder="Số phút" className="w-full rounded-xl border bg-white py-3 pl-9 pr-3 text-sm" /></label></div>
      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_140px_140px_auto]"><input maxLength={200} value={nextAction} onChange={event => setNextAction(event.target.value)} placeholder="Hành động tiếp theo" className="rounded-xl border bg-white px-3 py-3 text-sm" /><label className="relative"><Scale className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input aria-label="Cân nặng" inputMode="decimal" value={weight} onChange={event => setWeight(event.target.value)} placeholder="Cân nặng" className="w-full rounded-xl border bg-white py-3 pl-9 pr-3 text-sm" /></label><label className="relative"><Droplets className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input aria-label="Lượng nước ml" inputMode="numeric" value={water} onChange={event => setWater(event.target.value)} placeholder="Nước (ml)" className="w-full rounded-xl border bg-white py-3 pl-9 pr-3 text-sm" /></label><button disabled={saving} onClick={saveActivity} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Đang lưu…" : "Ghi nhận"}</button></div>
      </div>}
      {notice && <p className={`mt-3 text-xs font-bold ${notice.startsWith("Đã") ? "text-emerald-700" : "text-rose-600"}`}>{notice}</p>}
      {quickNotice && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-700">{quickNotice}</p>}
      <div className="mt-5 border-t border-indigo-100 pt-4"><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-black text-slate-950">Đã ghi hôm nay</h4><span className="text-xs font-bold text-slate-400">{todayActivities.length} ghi nhận</span></div>{todayActivities.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">Chưa có thông tin thực tế nào được ghi hôm nay.</p> : <div className="mt-3 space-y-2">{todayActivities.slice(0, 8).map(item => { const key = resolveArea(item.goalId, item.activity, String(item.output?.lifeArea || "")); return <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"><span className="font-mono text-xs font-black text-slate-500">{item.startTime || "--:--"}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black ${LIFE_AREAS[key].tone}`}>{LIFE_AREAS[key].label}</span><p className="min-w-[180px] flex-1 text-sm font-bold text-slate-800">{item.activity}</p>{Number(item.output?.durationMinutes) > 0 && <span className="text-xs font-bold text-slate-500">{item.output.durationMinutes} phút</span>}{Number(item.output?.waterMl) > 0 && <span className="text-xs font-bold text-blue-600">{item.output.waterMl} ml</span>}{Number(item.output?.weightKg) > 0 && <span className="text-xs font-bold text-rose-600">{item.output.weightKg} kg</span>}<button type="button" onClick={() => deleteActivity(item)} aria-label={`Xóa ${item.activity}`} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button></div>; })}</div>}</div>
    </section>

    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3"><ClipboardCheck className="h-5 w-5 text-emerald-600" /><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">Theo từng mục nhỏ</p><h3 className="text-xl font-black">Tiến độ hôm nay</h3></div></div>
      <p className="mt-2 text-xs text-slate-500">Nhập tổng thực tế của hôm nay rồi lưu. Giá trị mới sẽ ghi đè tổng cũ, không cộng thêm.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{dayMetrics.map(metric => {
        const quickType = metric.key as keyof typeof quickDraft | "skincare";
        return <article key={metric.label} className={`rounded-2xl p-4 transition duration-700 ${flashMetric && resolveArea(null, metric.label) === flashMetric ? "bg-emerald-100 ring-2 ring-emerald-300" : "bg-slate-50"}`}><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black text-slate-500">{metric.label}</p><p className="mt-1 text-sm font-black text-slate-900">{metric.value}</p></div><span className="text-xs font-black text-indigo-600">{Math.round(metric.percent)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${metric.percent}%` }} /></div><p className="mt-2 text-[10px] font-semibold text-slate-400">{metric.detail}</p>{quickType === "skincare" ? <button type="button" aria-pressed={todayProgress.skincareDone} onClick={() => saveQuickMetric("skincare")} className={`mt-3 w-full rounded-xl px-3 py-2.5 text-xs font-black ${todayProgress.skincareDone ? "bg-emerald-600 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>{todayProgress.skincareDone ? "✓ Đã hoàn tất · bấm để bỏ" : "Đánh dấu hoàn tất"}</button> : <div className="mt-3 flex gap-2"><input aria-label={`Nhập tổng ${metric.label}`} inputMode={quickType === "weight" ? "decimal" : "numeric"} value={quickDraft[quickType]} onChange={event => setQuickDraft(current => ({ ...current, [quickType]: event.target.value }))} placeholder={quickType === "weight" ? "kg" : quickType === "water" ? "ml" : quickType === "chores" ? "số việc" : "phút"} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" /><button type="button" onClick={() => saveQuickMetric(quickType)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Đặt tổng</button></div>}</article>;
      })}</div>
      {quickNotice && <p role="status" className={`mt-3 text-xs font-bold ${quickNotice.startsWith("Đã") ? "text-emerald-700" : "text-rose-600"}`}>{quickNotice}</p>}
    </section>

    <RecoveryPanel today={today} state={state} onChangeState={onChangeState} />
    <WeeklyProgress weekDays={weekDays} getProgress={progressForDate} />
    <ActivityFrequencyChart today={today} state={state} getProgress={progressForDate} />
  </div>;
}

function ActivityFrequencyChart({ today, state, getProgress }: { today: string; state: AppState; getProgress: (date: string) => any }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const todayDate = dateAtNoon(today);
  const mondayOffset = (todayDate.getDay() + 6) % 7;
  const periodStart = period === "week"
    ? new Date(todayDate.getTime() - mondayOffset * DAY_MS)
    : new Date(todayDate.getFullYear(), todayDate.getMonth(), 1, 12);
  const planStart = dateAtNoon(state.startDate);
  const startDate = planStart > periodStart ? planStart : periodStart;
  const totalDays = period === "week" ? 7 : new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.floor((todayDate.getTime() - startDate.getTime()) / DAY_MS) + 1));
  const dates = Array.from({ length: elapsedDays }, (_, index) => {
    const date = new Date(startDate.getTime() + index * DAY_MS);
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  });
  const completedSchedules = (date: string, pattern: RegExp) => (state.scheduleItems || []).some(item => item.date === date && item.completed && pattern.test(item.title));
  const loggedActivity = (date: string, pattern: RegExp) => (state.activities || []).some(item => item.date === date && pattern.test(item.activity));
  const routineDone = (date: string, pattern: RegExp) => (state.routineLogs || []).some(log => {
    if (log.date !== date || log.status !== "completed") return false;
    const routine = state.routines.find(item => item.id === log.routineId);
    return Boolean(routine && pattern.test(routine.name));
  });
  const coreTrackers = [
    { label: "Tắm & gội", done: (date: string) => completedSchedules(date, /tắm|gội/i) || loggedActivity(date, /tắm|gội/i) },
    { label: "Thể dục", done: (date: string) => getProgress(date).exerciseMinutes > 0 },
    { label: "Uống đủ nước", done: (date: string) => getProgress(date).waterMl >= 1500 },
    { label: "Skincare", done: (date: string) => getProgress(date).skincareDone },
    { label: "Fund", done: (date: string) => getProgress(date).fundMinutes > 0 },
    { label: "B2B", done: (date: string) => getProgress(date).b2bMinutes > 0 },
    { label: "Chores", done: (date: string) => getProgress(date).choreDone > 0 || routineDone(date, /dọn|chore|mèo/i) }
  ];
  const coveredRoutine = /chạy|thể dục|yoga|nước|skincare|fund|b2b|dọn|chore|mèo/i;
  const routineTrackers = state.routines.filter(routine => routine.active !== false && !coveredRoutine.test(routine.name)).map(routine => ({
    label: routine.name,
    done: (date: string) => (state.routineLogs || []).some(log => log.date === date && log.routineId === routine.id && log.status === "completed")
  }));
  const trackers = [...coreTrackers, ...routineTrackers];
  const summaries = trackers.map(tracker => ({ ...tracker, count: dates.filter(tracker.done).length }));
  const daily = dates.map(date => ({ date, count: trackers.filter(tracker => tracker.done(date)).length }));
  const maxDaily = Math.max(1, ...daily.map(item => item.count));

  return <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-fuchsia-600">Tần suất thực tế</p><h3 className="mt-1 text-xl font-black text-slate-950">Hoạt động tuần hoặc tháng</h3><p className="mt-1 text-xs text-slate-500">Đếm số ngày đã thực hiện trong phần thời gian đã trôi qua; biểu đồ không gán thất bại cho ngày tương lai.</p></div><div className="flex rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setPeriod("week")} className={`rounded-lg px-3 py-2 text-xs font-black ${period === "week" ? "bg-white text-fuchsia-700 shadow-sm" : "text-slate-500"}`}>Tuần</button><button type="button" onClick={() => setPeriod("month")} className={`rounded-lg px-3 py-2 text-xs font-black ${period === "month" ? "bg-white text-fuchsia-700 shadow-sm" : "text-slate-500"}`}>Tháng</button></div></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-3">{summaries.map(item => <div key={item.label} className="rounded-2xl bg-slate-50 p-3.5"><div className="flex items-center justify-between gap-3"><span className="text-xs font-black text-slate-800">{item.label}</span><span className="font-mono text-sm font-black text-fuchsia-700">{item.count}/{elapsedDays} ngày</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all" style={{ width: `${elapsedDays ? item.count / elapsedDays * 100 : 0}%` }} /></div></div>)}</div>
      <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-black text-slate-900">Ngày nhiều · ngày ít</p><p className="mt-1 text-[10px] text-slate-500">Số nhóm hoạt động có dữ liệu trong từng ngày</p></div><span className="text-[10px] font-bold text-slate-400">Tối đa {trackers.length}</span></div><div className="mt-5 flex h-52 items-end gap-2 overflow-x-auto border-b border-slate-200 px-1 pb-1">{daily.map(item => <div key={item.date} className="flex min-w-[34px] flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-black text-slate-600">{item.count}</span><div title={`${item.date}: ${item.count} nhóm`} className={`w-full max-w-10 rounded-t-lg transition-all ${item.count ? "bg-gradient-to-t from-violet-600 to-fuchsia-400" : "bg-slate-200"}`} style={{ height: `${Math.max(6, item.count / maxDaily * 150)}px` }} /><span className="whitespace-nowrap font-mono text-[9px] text-slate-400">{item.date.slice(8, 10)}/{item.date.slice(5, 7)}</span></div>)}</div></div>
    </div>
  </section>;
}

function WeeklyProgress({ weekDays, getProgress }: { weekDays: { date: string; label: string }[]; getProgress: (date: string) => any }) {
  const rows = [
    { label: "Cân nặng", render: (p: any) => p.weight === null ? "—" : `${p.weight}kg` },
    { label: "Thể dục", render: (p: any) => `${p.exerciseMinutes}p` },
    { label: "Nước", render: (p: any) => `${Math.round(p.waterMl / 100) / 10}L` },
    { label: "Skincare", render: (p: any) => p.skincareDone ? "✓" : "—" },
    { label: "Fund", render: (p: any) => `${p.fundMinutes}p` },
    { label: "B2B", render: (p: any) => `${p.b2bMinutes}p` },
    { label: "Chores", render: (p: any) => `${p.choreDone} xong · ${p.chorePlanned} dự kiến` }
  ];
  return <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-violet-600" /><div><p className="text-xs font-black uppercase tracking-[.16em] text-violet-600">Đầu ra tự tính · Thứ Hai–Thứ Bảy</p><h3 className="text-xl font-black">Tiến độ tuần theo từng mục nhỏ</h3><p className="mt-1 text-xs text-slate-500">Bảng chỉ đọc. Dữ liệu đến từ lịch đã hoàn tất và Quick Log, không nhập lại tại đây.</p></div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[660px] text-sm"><thead><tr className="border-b text-left text-[10px] font-black uppercase tracking-wide text-slate-400"><th className="px-3 py-2">Hạng mục</th>{weekDays.map(day => <th key={day.date} className="px-3 py-2 text-center">{day.label}<span className="block font-mono font-medium normal-case">{day.date.slice(8, 10)}/{day.date.slice(5, 7)}</span></th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.label} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 font-black text-slate-800">{row.label}</td>{weekDays.map(day => <td key={day.date} className="px-3 py-3 text-center font-mono text-xs font-bold text-slate-600">{row.render(getProgress(day.date))}</td>)}</tr>)}</tbody></table></div></section>;
}

function RecoveryPanel({ today, state, onChangeState }: { today: string; state: AppState; onChangeState: (state: AppState) => void }) {
  const todayDate = dateAtNoon(today);
  const dates = Array.from({ length: 3 }, (_, index) => {
    const date = new Date(todayDate.getTime() - (index + 1) * DAY_MS);
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  });
  const markRecovery = (date: string, status: "forgot" | "rest" | "none") => {
    const marker = `recovery:${date}`;
    const kept = (state.activities || []).filter(item => item.originalTranscript !== marker);
    if (status === "none") return onChangeState({ ...state, activities: kept });
    const now = Date.now();
    const entry: ActivityEntry = { id: `${marker}:${now}`, date, goalId: null, source: "manual", originalTranscript: marker, activity: status === "forgot" ? "Đã làm nhưng quên ghi chi tiết" : "Ngày phục hồi chủ động", output: { lifeArea: "life", recoveryStatus: status }, outcome: {}, outcomeStatus: "not_applicable", insight: null, nextAction: null, confidence: 1, createdTimestamp: now, updatedTimestamp: now, startTime: "23:59" };
    onChangeState({ ...state, activities: [entry, ...kept] });
  };
  return <details className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer list-none"><p className="text-xs font-black uppercase tracking-[.16em] text-amber-600">Khôi phục tối đa 3 ngày</p><h3 className="mt-1 text-lg font-black text-slate-950">Quên log không đồng nghĩa với thất bại</h3><p className="mt-1 text-xs text-slate-500">Chỉ ghi trạng thái ngày; không cho sửa ngày tương lai và không ép nhập báo cáo dài.</p></summary><div className="mt-4 grid gap-3 md:grid-cols-3">{dates.map(date => { const status = (state.activities || []).find(item => item.originalTranscript === `recovery:${date}`)?.output?.recoveryStatus; return <article key={date} className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-black text-slate-900">{formatDay(date)}</p><div className="mt-3 space-y-2"><button type="button" onClick={() => markRecovery(date, "forgot")} className={`w-full rounded-xl px-3 py-2 text-xs font-black ${status === "forgot" ? "bg-indigo-600 text-white" : "border bg-white"}`}>Đã làm nhưng quên ghi</button><button type="button" onClick={() => markRecovery(date, "rest")} className={`w-full rounded-xl px-3 py-2 text-xs font-black ${status === "rest" ? "bg-amber-500 text-white" : "border bg-white"}`}>Ngày phục hồi</button><button type="button" onClick={() => markRecovery(date, "none")} className="w-full rounded-xl border bg-white px-3 py-2 text-xs font-black text-slate-500">Không làm / xóa trạng thái</button></div></article>; })}</div></details>;
}
