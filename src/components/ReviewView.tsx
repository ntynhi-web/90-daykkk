import React, { useMemo, useRef, useState } from "react";
import { BookOpenCheck, CalendarDays, CheckCircle2, Plus, RotateCcw } from "lucide-react";
import { AppState, WeeklyReview } from "../types";
import { formatDisplayDate } from "../utils";

interface ReviewViewProps {
  state: AppState;
  onChangeState: (newState: AppState) => void;
}

const dateKey = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(date);

const getReviewRange = (source: Date) => {
  const mondayOffset = (source.getDay() + 6) % 7;
  const monday = new Date(source);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(source.getDate() - mondayOffset);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  return { startDate: dateKey(monday), endDate: dateKey(saturday), monday };
};

const emptyForm = () => ({
  planned: "",
  actual: "",
  wins: "",
  problems: "",
  lessons: "",
  adjustments: "",
  status: "continue" as WeeklyReview["status"]
});

export default function ReviewView({ state, onChangeState }: ReviewViewProps) {
  const today = new Date();
  const { startDate, endDate, monday } = getReviewRange(today);
  const isSunday = today.getDay() === 0;
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const summary = useMemo(() => {
    const schedule = (state.scheduleItems || []).filter(item => item.date >= startDate && item.date <= endDate);
    const activities = state.activities.filter(item => item.date >= startDate && item.date <= endDate);
    const routineLogs = (state.routineLogs || []).filter(item => item.date >= startDate && item.date <= endDate && ["completed", "minimum"].includes(item.status));
    const completedSchedule = schedule.filter(item => item.completed).length;
    const activeDays = new Set([...activities.map(item => item.date), ...routineLogs.map(item => item.date)]).size;
    return {
      planned: schedule.length,
      completed: completedSchedule,
      completion: schedule.length ? Math.round(completedSchedule / schedule.length * 100) : 0,
      activities: activities.length,
      routineLogs: routineLogs.length,
      activeDays
    };
  }, [endDate, startDate, state.activities, state.routineLogs, state.scheduleItems]);

  const savedReviews = [...state.weeklyReviews].sort((a, b) => b.startDate.localeCompare(a.startDate));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const values = Object.values(form).filter(value => typeof value === "string") as string[];
    if (values.some(value => value.length > 1200)) {
      setError("Mỗi phần review tối đa 1.200 ký tự.");
      return;
    }
    if (!form.wins.trim() && !form.problems.trim() && !form.adjustments.trim()) {
      setError("Hãy ghi ít nhất một điều đã làm được, một trở ngại hoặc một điều chỉnh.");
      return;
    }

    submittingRef.current = true;
    setError("");
    const cycleStart = new Date(`${state.startDate}T12:00:00`);
    const weekNumber = Math.max(1, Math.floor((monday.getTime() - cycleStart.getTime()) / 604_800_000) + 1);
    const activities = state.activities.filter(item => item.date >= startDate && item.date <= endDate);
    const allocationBase = Math.max(activities.length, 1);
    const timeAllocation = state.goals.reduce<Record<string, number>>((result, goal) => {
      result[goal.id] = Math.round(activities.filter(item => item.goalId === goal.id).length / allocationBase * 100);
      return result;
    }, {});
    const review: WeeklyReview = {
      id: `review_${Date.now()}`,
      weekNumber,
      startDate,
      endDate,
      ...form,
      planned: form.planned.trim(),
      actual: form.actual.trim(),
      wins: form.wins.trim(),
      problems: form.problems.trim(),
      lessons: form.lessons.trim(),
      adjustments: form.adjustments.trim(),
      outputs: { completed: summary.completed, planned: summary.planned, activities: summary.activities, routineLogs: summary.routineLogs },
      outcomes: { activeDays: summary.activeDays, completion: summary.completion },
      timeAllocation,
      submitted: true
    };
    const withoutSameWeek = state.weeklyReviews.filter(item => item.startDate !== startDate);
    onChangeState({ ...state, weeklyReviews: [review, ...withoutSameWeek] });
    setForm(emptyForm());
    setIsEditing(false);
    window.setTimeout(() => { submittingRef.current = false; }, 500);
  };

  return (
    <div id="review-view" className="mx-auto max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-indigo-200"><BookOpenCheck className="h-6 w-6" /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-300">04 · Review tuần</p>
              <h2 className="mt-2 font-display text-2xl font-black md:text-3xl">Sáu ngày thực hiện, Chủ nhật nhìn lại</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Dữ liệu chỉ tính từ thứ Hai đến thứ Bảy. Review giúp chọn điều cần giữ, bỏ hoặc điều chỉnh cho tuần kế tiếp.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-indigo-600">{formatDisplayDate(startDate)} – {formatDisplayDate(endDate)}</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">Dữ liệu thực hiện tuần này</h3>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-black ${isSunday ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{isSunday ? "Hôm nay là ngày review" : "Có thể xem trước · Chủ nhật chốt"}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Lịch đã xong", `${summary.completed}/${summary.planned}`],
            ["Hoàn thành", `${summary.completion}%`],
            ["Hành động thật", summary.activities],
            ["Routine ghi nhận", summary.routineLogs],
            ["Ngày có hành động", `${summary.activeDays}/6`]
          ].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{value}</p></div>)}
        </div>
      </section>

      {!isEditing ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 text-center shadow-sm">
          <CalendarDays className="mx-auto h-9 w-9 text-indigo-500" />
          <h3 className="mt-3 text-lg font-black text-slate-950">{state.weeklyReviews.some(item => item.startDate === startDate) ? "Tuần này đã có review" : "Chưa có review cho tuần này"}</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">Chỉ cần ghi điều đã làm được, trở ngại và một thay đổi nhỏ. Không cần tạo thêm báo cáo dài.</p>
          <button type="button" onClick={() => setIsEditing(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white"><Plus className="h-4 w-4" />{state.weeklyReviews.some(item => item.startDate === startDate) ? "Cập nhật review" : "Bắt đầu review"}</button>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-[24px] border border-indigo-200 bg-white p-5 shadow-sm md:p-7">
          <div><p className="text-xs font-black uppercase tracking-wider text-indigo-600">Review ngắn</p><h3 className="mt-1 text-xl font-black text-slate-950">Nhìn lại để tuần sau nhẹ và rõ hơn</h3></div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["planned", "Tuần này tôi định làm gì?"], ["actual", "Thực tế tôi đã làm gì?"],
              ["wins", "Điều đã làm được"], ["problems", "Trở ngại hoặc điều không hiệu quả"],
              ["lessons", "Bài học"], ["adjustments", "Một điều chỉnh cho tuần tới"]
            ].map(([key, label]) => <label key={key} className="space-y-1.5"><span className="text-xs font-black text-slate-700">{label}</span><textarea maxLength={1200} value={form[key as keyof typeof form]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} className="h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400" /></label>)}
          </div>
          <label className="block space-y-1.5"><span className="text-xs font-black text-slate-700">Quyết định</span><select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as WeeklyReview["status"] }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm md:w-72"><option value="continue">Tiếp tục</option><option value="adjust">Điều chỉnh</option><option value="paused">Tạm dừng</option><option value="stop">Dừng</option></select></label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">{error}</p>}
          <div className="flex flex-wrap gap-3"><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white"><CheckCircle2 className="h-4 w-4" />Lưu review tuần</button><button type="button" onClick={() => { setForm(emptyForm()); setError(""); setIsEditing(false); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600"><RotateCcw className="h-4 w-4" />Hủy</button></div>
        </form>
      )}

      <section className="space-y-3">
        <h3 className="text-base font-black text-slate-950">Review đã lưu</h3>
        {savedReviews.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Chưa có review nào. Dữ liệu tuần vẫn được giữ để bạn review vào Chủ nhật.</div> : savedReviews.map(review => <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-slate-950">Tuần {review.weekNumber} · {formatDisplayDate(review.startDate)} – {formatDisplayDate(review.endDate)}</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">{review.status}</span></div><p className="mt-3 text-sm text-slate-600"><strong>Đã làm được:</strong> {review.wins || "Chưa ghi"}</p><p className="mt-2 text-sm text-slate-600"><strong>Tuần tới:</strong> {review.adjustments || "Chưa ghi"}</p></article>)}
      </section>
    </div>
  );
}
