import React, { useMemo, useState } from "react";
import { ChevronDown, HeartHandshake, ListChecks, Sparkles } from "lucide-react";
import { AppState, Chore } from "../types";
import LifeAnchors from "./LifeAnchors";
import DailyRoutineCheckin from "./DailyRoutineCheckin";
import LifeMaintenance from "./LifeMaintenance";

interface LifeOperationsProps {
  state: AppState;
  today: string;
  onChangeState: (state: AppState) => void;
}

const choreDoneToday = (chore: Chore, today: string) =>
  chore.frequency === "one_time" ? chore.completed : chore.lastCompletedDate === today;

export default function LifeOperations({ state, today, onChangeState }: LifeOperationsProps) {
  const [expanded, setExpanded] = useState(false);
  const [activePanel, setActivePanel] = useState<'anchors' | 'routines' | 'chores'>('anchors');
  const weekday = new Date(`${today}T12:00:00`).getDay();
  const logs = state.routineLogs || [];

  const summary = useMemo(() => {
    const anchors = (state.lifeAnchors || []).filter(anchor => anchor.active);
    const anchorsDone = anchors.filter(anchor => anchor.lastCompletedDate === today).length;
    const scheduled = state.routines.filter(routine => routine.active !== false && (!routine.scheduleDays?.length || routine.scheduleDays.includes(weekday)));
    const yogaDue = scheduled.some(routine => routine.substitutionGroup === 'movement' && routine.name.toLowerCase().includes('yoga'));
    const dueRoutines = scheduled.filter(routine => !(yogaDue && routine.substitutionGroup === 'movement' && routine.name.toLowerCase().includes('đi bộ')));
    const routinesDone = dueRoutines.filter(routine => logs.some(log => log.routineId === routine.id && log.date === today && ['minimum', 'completed'].includes(log.status))).length;
    const visibleChores = (state.chores || []).filter(chore => chore.frequency === 'daily' || chore.frequency === 'weekly' || !chore.completed);
    const choresDone = visibleChores.filter(chore => choreDoneToday(chore, today)).length;
    return {
      anchors: { done: anchorsDone, total: anchors.length },
      routines: { done: routinesDone, total: dueRoutines.length },
      chores: { done: choresDone, total: visibleChores.length }
    };
  }, [logs, state.chores, state.lifeAnchors, state.routines, today, weekday]);

  const panels = [
    { id: 'anchors' as const, label: 'Điều làm cuộc sống có ý nghĩa', value: summary.anchors, icon: HeartHandshake, tone: 'rose' },
    { id: 'routines' as const, label: 'Chăm sóc bản thân', value: summary.routines, icon: Sparkles, tone: 'emerald' },
    { id: 'chores' as const, label: 'Việc nhà cần vận hành', value: summary.chores, icon: ListChecks, tone: 'slate' }
  ];

  return (
    <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-50/70 shadow-sm">
      <button type="button" onClick={() => setExpanded(value => !value)} className="flex w-full items-center justify-between gap-4 p-5 text-left md:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">04 · Nền tảng cuộc sống</p>
          <h2 className="mt-2 font-display text-xl font-black text-slate-950">Không quên những điều thiết yếu</h2>
          <p className="mt-1 text-sm text-slate-600">Tình cảm, sức khỏe và việc nhà được tách riêng — không còn trông như cùng một loại task.</p>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">
          {expanded ? 'Thu gọn' : 'Mở chi tiết'} <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div className="grid gap-2 border-t border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-3 md:p-4">
        {panels.map(panel => {
          const Icon = panel.icon;
          const complete = panel.value.total > 0 && panel.value.done === panel.value.total;
          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => { setExpanded(true); setActivePanel(panel.id); }}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${expanded && activePanel === panel.id ? panel.tone === 'rose' ? 'border-rose-200 bg-rose-50 shadow-sm' : panel.tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 shadow-sm' : 'border-slate-300 bg-white shadow-sm' : 'border-transparent bg-white/70 hover:border-slate-200'}`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${complete ? 'bg-emerald-100 text-emerald-700' : panel.tone === 'rose' ? 'bg-rose-100 text-rose-700' : panel.tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-slate-800">{panel.label}</span>
                <span className={`mt-1 block text-xs font-bold ${complete ? 'text-emerald-700' : 'text-slate-500'}`}>{panel.value.done}/{panel.value.total} hôm nay</span>
              </span>
            </button>
          );
        })}
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/30 p-3 md:p-4">
          {activePanel === 'anchors' && <LifeAnchors state={state} today={today} onChangeState={onChangeState} />}
          {activePanel === 'routines' && <DailyRoutineCheckin state={state} today={today} onChangeState={onChangeState} />}
          {activePanel === 'chores' && <LifeMaintenance state={state} today={today} onChangeState={onChangeState} />}
        </div>
      )}
    </section>
  );
}
