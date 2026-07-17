import React, { useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Sparkles, Target } from "lucide-react";
import { AppState, WeeklyAvailability } from "../types";

interface OnboardingFlowProps {
  state: AppState;
  onChangeState: (state: AppState) => void;
}

const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const modeLabel: Record<WeeklyAvailability['mode'], string> = {
  office: "Công ty",
  home: "Làm ở nhà",
  rest: "Nghỉ"
};

export default function OnboardingFlow({ state, onChangeState }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const activeGoals = state.goals.filter(goal => goal.status === 'active');
  const focusId = state.weeklyFocusGoalId || activeGoals[0]?.id || null;
  const supportIds = state.weeklySupportGoalIds || [];

  const updateAvailability = (dayOfWeek: number, mode: WeeklyAvailability['mode']) => {
    const existing = state.weeklyAvailability || [];
    const next: WeeklyAvailability = {
      dayOfWeek,
      mode,
      label: modeLabel[mode],
      ...(mode === 'office' ? { blockedStart: '08:00', blockedEnd: '18:40' } : {})
    };
    onChangeState({
      ...state,
      weeklyAvailability: [...existing.filter(day => day.dayOfWeek !== dayOfWeek), next].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    });
  };

  const toggleSupport = (goalId: string) => {
    const next = supportIds.includes(goalId)
      ? supportIds.filter(id => id !== goalId)
      : [...supportIds, goalId].slice(-2);
    onChangeState({ ...state, weeklySupportGoalIds: next });
  };

  const finish = () => onChangeState({ ...state, onboardingCompleted: true });

  const steps = [
    { title: "Chọn trọng tâm tuần", description: "Một mục tiêu chính giúp dashboard biết việc nào phải được đưa lên trước.", icon: Target },
    { title: "Xác nhận nhịp làm việc", description: "App chỉ xếp lịch vào khoảng thời gian thực sự khả thi.", icon: CalendarDays },
    { title: "Chọn nhịp duy trì", description: "Tối đa hai mục tiêu phụ và mức routine tối thiểu để không tạo áp lực.", icon: Sparkles }
  ];
  const StepIcon = steps[step].icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl">
        <div className="bg-slate-950 p-6 text-white md:p-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500"><StepIcon className="h-5 w-5" /></span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">Thiết lập {step + 1}/3</p>
                <h1 className="mt-1 text-xl font-black">{steps[step].title}</h1>
              </div>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">Khoảng 2 phút</span>
          </div>
          <p className="mt-3 text-sm text-slate-300">{steps[step].description}</p>
          <div className="mt-5 grid grid-cols-3 gap-2">{steps.map((_, index) => <span key={index} className={`h-1.5 rounded-full ${index <= step ? 'bg-indigo-400' : 'bg-slate-700'}`} />)}</div>
        </div>

        <div className="p-5 md:p-8">
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeGoals.map(goal => {
                const selected = goal.id === focusId;
                return <button key={goal.id} onClick={() => onChangeState({ ...state, weeklyFocusGoalId: goal.id, dailyFocusGoalId: goal.id })} className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-200'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{goal.name}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{goal.desiredOutcome}</p></div>{selected && <Check className="h-5 w-5 shrink-0 text-indigo-600" />}</div></button>;
              })}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              {dayNames.map((day, dayOfWeek) => {
                const availability = (state.weeklyAvailability || []).find(item => item.dayOfWeek === dayOfWeek);
                return <div key={day} className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-slate-200 p-3"><span className="text-sm font-black text-slate-700">{day}</span><div className="grid grid-cols-3 gap-2">{(['office', 'home', 'rest'] as const).map(mode => <button key={mode} onClick={() => updateAvailability(dayOfWeek, mode)} className={`rounded-xl px-2 py-2 text-[10px] font-bold transition ${availability?.mode === mode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{modeLabel[mode]}</button>)}</div></div>;
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Mục tiêu duy trì · tối đa 2</p>
                <div className="flex flex-wrap gap-2">{activeGoals.filter(goal => goal.id !== focusId).map(goal => <button key={goal.id} onClick={() => toggleSupport(goal.id)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${supportIds.includes(goal.id) ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500'}`}>{supportIds.includes(goal.id) ? '✓ ' : '+ '}{goal.name}</button>)}</div>
              </div>
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Mức routine tối thiểu</p>
                <div className="space-y-2">{state.routines.slice(0, 5).map(routine => <label key={routine.id} className="grid gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center"><span className="text-xs font-bold text-slate-800">{routine.name}</span><input value={routine.minimumDay} onChange={event => onChangeState({ ...state, routines: state.routines.map(item => item.id === routine.id ? { ...item, minimumDay: event.target.value } : item) })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-indigo-400" /></label>)}</div>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
            <button disabled={step === 0} onClick={() => setStep(value => value - 1)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 disabled:opacity-0"><ArrowLeft className="h-4 w-4" /> Quay lại</button>
            {step < 2 ? <button onClick={() => setStep(value => value + 1)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white">Tiếp tục <ArrowRight className="h-4 w-4" /></button> : <button onClick={finish} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white"><Check className="h-4 w-4" /> Hoàn tất thiết lập</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
