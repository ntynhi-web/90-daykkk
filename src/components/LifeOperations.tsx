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
    { id: 'anchors' as const, label: 'Điều quan trọng', value: summary.anchors, icon: HeartHandshake },
    { id: 'routines' as const, label: 'Routine đến hạn', value: summary.routines, icon: Sparkles },
    { id: 'chores' as const, label: 'Việc duy trì', value: summary.chores, icon: ListChecks }
  ];

  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => setExpanded(value => !value)} className="flex w-full items-center justify-between gap-4 p-5 text-left md:p-6">
        <div>
          <p className="life-kicker text-slate-500">04 · Nền tảng cuộc sống</p>
          <h2 className="mt-2 font-display text-lg font-extrabold text-slate-950">Giữ cuộc sống vận hành</h2>
          <p className="mt-1 text-xs text-slate-500">Những điều có ý nghĩa, routine và việc nhà nằm chung một nơi — mở khi bạn cần.</p>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600">
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
              className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${expanded && activePanel === panel.id ? 'border-indigo-200 bg-white shadow-sm' : 'border-transparent bg-white/60 hover:border-slate-200'}`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-extrabold text-slate-800">{panel.label}</span>
                <span className={`mt-0.5 block text-[10px] font-bold ${complete ? 'text-emerald-700' : 'text-slate-400'}`}>{panel.value.done}/{panel.value.total} hôm nay</span>
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
