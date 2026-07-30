import React from "react";
import { BriefcaseBusiness, CheckCircle2, HeartPulse, SearchCheck, TrendingUp } from "lucide-react";
import { AppState } from "../types";

interface DailyGoalProgressProps {
  state: AppState;
  today: string;
}

const minutesBetween = (start: string, end: string) => {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return Math.max(0, endHour * 60 + endMinute - startHour * 60 - startMinute);
};

const statusFor = (percent: number) => {
  if (percent >= 100) return { label: "Đã xong", classes: "bg-emerald-400/15 text-emerald-200" };
  if (percent >= 50) return { label: "Đang tiến triển", classes: "bg-indigo-400/15 text-indigo-200" };
  if (percent > 0) return { label: "Cần xem xét", classes: "bg-amber-400/15 text-amber-200" };
  return { label: "Chưa bắt đầu", classes: "bg-slate-400/15 text-slate-200" };
};

export default function DailyGoalProgress({ state, today }: DailyGoalProgressProps) {
  const weekday = new Date(`${today}T12:00:00`).getDay();
  const todaySchedule = (state.scheduleItems || []).filter(item => item.date === today);
  const completedMinutes = (goalId: string) => todaySchedule
    .filter(item => (item.goalId || item.journeyId) === goalId && item.completed)
    .reduce((total, item) => total + (item.estimatedMinutes || minutesBetween(item.startTime, item.endTime)), 0);
  const loggedMinutes = (goalId: string) => (state.activities || [])
    .filter(activity => activity.date === today && activity.goalId === goalId)
    .reduce((total, activity) => total + Number(activity.output?.minutes || 0), 0);
  const actualMinutes = (goalId: string) => Math.max(completedMinutes(goalId), loggedMinutes(goalId));
  const revenueUsd = (state.activities || [])
    .filter(activity => activity.date === today && activity.goalId === "G3")
    .reduce((total, activity) => total + Number(activity.output?.revenueUsd || activity.outcome?.revenueUsd || 0), 0);

  const healthRoutines = state.routines.filter(routine =>
    routine.goalId === "G4" &&
    routine.active !== false &&
    (!routine.scheduleDays?.length || routine.scheduleDays.includes(weekday))
  );
  const healthCompleted = healthRoutines.filter(routine =>
    (state.routineLogs || []).some(log =>
      log.routineId === routine.id &&
      log.date === today &&
      (log.status === "completed" || log.status === "minimum")
    )
  ).length;

  const targets = {
    G3: 60,
    G1: weekday >= 1 && weekday <= 5 ? 195 : 0,
    G2: weekday === 6 ? 150 : 30
  };
  const cards = [
    {
      id: "G3", name: "Freelancer", icon: BriefcaseBusiness,
      percent: Math.min(100, Math.round((
        Math.min(100, actualMinutes("G3") / targets.G3 * 100) +
        Math.min(100, revenueUsd / 8 * 100)
      ) / 2)),
      detail: `${actualMinutes("G3")}/${targets.G3} phút · $${revenueUsd.toFixed(2)}/$8`,
      note: "Outlier hoặc tối ưu Upwork/LinkedIn"
    },
    {
      id: "G1", name: "Fund", icon: TrendingUp,
      percent: targets.G1 ? Math.min(100, Math.round(actualMinutes("G1") / targets.G1 * 100)) : 0,
      detail: targets.G1 ? `${actualMinutes("G1")}/${targets.G1} phút` : "Không có block bắt buộc",
      note: targets.G1 ? "Hai khung giờ bắt buộc" : "Nghỉ cuối tuần"
    },
    {
      id: "G2", name: "B2B", icon: SearchCheck,
      percent: Math.min(100, Math.round(actualMinutes("G2") / targets.G2 * 100)),
      detail: `${actualMinutes("G2")}/${targets.G2} phút`,
      note: weekday === 6 ? "30 phút B2B + 2 giờ Affiliate MS" : "Tiến process B2B"
    },
    {
      id: "G4", name: "Health & Beauty", icon: HeartPulse,
      percent: healthRoutines.length ? Math.round(healthCompleted / healthRoutines.length * 100) : 100,
      detail: `${healthCompleted}/${healthRoutines.length} routine`,
      note: "Ưu tiên nền sức khỏe hằng ngày"
    }
  ];

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-xl md:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">02 · Tiến độ hôm nay</p>
          <h2 className="mt-2 font-display text-2xl font-black">Mục tiêu nào đã xong?</h2>
          <p className="mt-1 text-xs text-slate-400">Theo dõi theo thời gian, doanh thu và routine thực tế trong ngày.</p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-slate-200">
          <CheckCircle2 className="h-4 w-4 text-cyan-300" /> Cập nhật tự động
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => {
          const status = statusFor(card.percent);
          const Icon = card.icon;
          return (
            <article key={card.id} className="rounded-[22px] border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-cyan-300"><Icon className="h-5 w-5" /></span>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${status.classes}`}>
                  {status.label}
                </span>
              </div>
              <div className="mt-5 flex items-end justify-between gap-2">
                <div>
                  <p className="text-sm font-black">{card.name}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{card.detail}</p>
                </div>
                <strong className="font-display text-3xl font-black text-cyan-300">{card.percent}%</strong>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400 transition-all" style={{ width: `${card.percent}%` }} />
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-slate-400">{card.note}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
