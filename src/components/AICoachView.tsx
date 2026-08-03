import React, { useMemo } from "react";
import { AlertTriangle, BrainCircuit, CalendarClock, CheckCircle2, Gauge, Lightbulb, ShieldAlert } from "lucide-react";
import { AppState, ScheduleItem } from "../types";
import { isScheduleValidForDate } from "../utils";

interface AICoachViewProps {
  state: AppState;
  onOpenPlanHub: () => void;
}

type Finding = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  reason: string;
  recommendation: string;
};

const hcmDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const toMinutes = (value = "") => { const [hour, minute] = value.split(":").map(Number); return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : 0; };
const duration = (item: ScheduleItem) => Math.max(0, toMinutes(item.endTime) - toMinutes(item.startTime));

export default function AICoachView({ state, onOpenPlanHub }: AICoachViewProps) {
  const today = hcmDate();
  const findings = useMemo(() => {
    const result: Finding[] = [];
    const schedules = (state.scheduleItems || []).filter(item => item.date === today && isScheduleValidForDate(item)).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const totalMinutes = schedules.reduce((sum, item) => sum + duration(item), 0);
    if (totalMinutes > 12 * 60) result.push({ id: "overload", severity: "high", title: "Lịch hôm nay đang quá tải", reason: `${totalMinutes} phút đã được lên lịch, vượt ngưỡng 12 giờ.`, recommendation: "Giữ việc bắt buộc; dời hoặc thu nhỏ ít nhất một block phát triển." });
    for (let index = 1; index < schedules.length; index += 1) {
      const previous = schedules[index - 1];
      const current = schedules[index];
      if (toMinutes(current.startTime) < toMinutes(previous.endTime)) result.push({ id: `overlap-${current.id}`, severity: "high", title: "Có lịch trùng giờ", reason: `${previous.startTime}–${previous.endTime} ${previous.title} trùng với ${current.startTime}–${current.endTime} ${current.title}.`, recommendation: "Đổi giờ hoặc xác nhận đây là hoạt động có thể thực hiện song song." });
    }
    const overdue = (state.priorityTasks || []).filter(task => !task.completed && task.status !== "dropped" && task.dueDate && task.dueDate < today);
    if (overdue.length) result.push({ id: "overdue", severity: "medium", title: `${overdue.length} việc đã quá hạn`, reason: overdue.slice(0, 3).map(task => task.title).join(" · "), recommendation: "Chọn làm, dời ngày hoặc bỏ; không tự động dồn toàn bộ sang hôm nay." });
    const sixDays = Array.from({ length: 6 }, (_, index) => { const date = new Date(`${today}T12:00:00`); date.setDate(date.getDate() - index); return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date); });
    const activeRoutineCount = state.routines.filter(routine => routine.active !== false).length;
    const completedRoutineCount = (state.routineLogs || []).filter(log => sixDays.includes(log.date) && log.status !== "missed" && log.status !== "skipped").length;
    const routineRate = activeRoutineCount ? Math.round(completedRoutineCount / (activeRoutineCount * 6) * 100) : 100;
    if (routineRate < 50) result.push({ id: "routine", severity: "medium", title: "Nhịp routine dưới 50%", reason: `Tỷ lệ ghi nhận 6 ngày gần nhất là ${routineRate}%.`, recommendation: "Giảm routine về mức tối thiểu hoặc bỏ routine không còn phục vụ ưu tiên hiện tại." });
    const staleGoals = state.goals.filter(goal => goal.status === "active" && !(state.activities || []).some(item => item.goalId === goal.id && sixDays.includes(item.date)));
    if (staleGoals.length) result.push({ id: "stale", severity: "low", title: "Mục tiêu chưa có bằng chứng gần đây", reason: staleGoals.map(goal => goal.name).join(" · "), recommendation: "Chỉ mở một bước tiếp theo đủ nhỏ hoặc chuyển mục tiêu sang duy trì/tạm dừng." });
    return result.slice(0, 6);
  }, [state, today]);

  const highCount = findings.filter(item => item.severity === "high").length;
  return <div className="mx-auto max-w-5xl space-y-5">
    <section className="overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white shadow-xl md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Trang 6 · AI Coach</p><h2 className="mt-2 text-2xl font-black">Cảnh báo trước khi lịch làm bạn kiệt sức</h2><p className="mt-2 max-w-2xl text-sm text-slate-300">Phân tích lịch, tiến độ và dữ liệu ghi nhận. AI chỉ đề xuất; mọi thay đổi kế hoạch đều cần bạn xác nhận trong Plan Hub.</p></div><span className={`rounded-full px-4 py-2 text-xs font-black ${highCount ? "bg-rose-500 text-white" : "bg-emerald-400 text-slate-950"}`}>{highCount ? `${highCount} cảnh báo cao` : "Không có cảnh báo cao"}</span></div></section>
    {findings.length === 0 ? <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" /><h3 className="mt-3 text-lg font-black text-emerald-900">Chưa phát hiện vấn đề cần thay đổi</h3><p className="mt-1 text-sm text-emerald-700">Tiếp tục ghi nhận dữ liệu để AI có đủ bằng chứng đánh giá.</p></section> : <section className="space-y-3">{findings.map(item => { const Icon = item.id.startsWith("overlap") ? CalendarClock : item.id === "overload" ? Gauge : item.severity === "high" ? ShieldAlert : AlertTriangle; return <article key={item.id} className={`rounded-[22px] border bg-white p-5 shadow-sm ${item.severity === "high" ? "border-rose-200" : item.severity === "medium" ? "border-amber-200" : "border-slate-200"}`}><div className="flex items-start gap-3"><span className={`rounded-xl p-2 ${item.severity === "high" ? "bg-rose-100 text-rose-700" : item.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black text-slate-950">{item.title}</h3><span className="text-[10px] font-black uppercase text-slate-400">{item.severity === "high" ? "Cao" : item.severity === "medium" ? "Cần xem" : "Theo dõi"}</span></div><p className="mt-2 text-xs leading-relaxed text-slate-600">{item.reason}</p><div className="mt-3 flex items-start gap-2 rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /><span><b>Đề xuất:</b> {item.recommendation}</span></div></div></div></article>; })}</section>}
    <button onClick={onOpenPlanHub} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white"><BrainCircuit className="h-4 w-4" />Mở Plan Hub để xem và chỉnh</button>
  </div>;
}
