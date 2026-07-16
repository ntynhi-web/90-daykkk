import React, { useMemo, useState } from "react";
import {
  Cat,
  Check,
  ChevronDown,
  ClipboardList,
  Home,
  Plus,
  ShoppingBasket,
  Sparkles,
  Trash2
} from "lucide-react";
import { AppState, Chore, ChoreCategory, ChoreFrequency } from "../types";

interface LifeMaintenanceProps {
  state: AppState;
  today: string;
  onChangeState: (newState: AppState) => void;
}

const categories: Record<ChoreCategory, { label: string; icon: React.ElementType; tone: string; card: string; accent: string }> = {
  home: { label: "Nhà cửa", icon: Home, tone: "bg-sky-100 text-sky-800 border-sky-200", card: "border-sky-200 bg-gradient-to-r from-sky-50 to-white", accent: "bg-sky-500" },
  pet: { label: "Thú cưng", icon: Cat, tone: "bg-amber-100 text-amber-800 border-amber-200", card: "border-amber-200 bg-gradient-to-r from-amber-50 to-white", accent: "bg-amber-500" },
  errand: { label: "Mua sắm", icon: ShoppingBasket, tone: "bg-violet-100 text-violet-800 border-violet-200", card: "border-violet-200 bg-gradient-to-r from-violet-50 to-white", accent: "bg-violet-500" },
  self_care: { label: "Cá nhân", icon: Sparkles, tone: "bg-rose-100 text-rose-800 border-rose-200", card: "border-rose-200 bg-gradient-to-r from-rose-50 to-white", accent: "bg-rose-500" },
  admin: { label: "Hành chính", icon: ClipboardList, tone: "bg-slate-200 text-slate-800 border-slate-300", card: "border-slate-300 bg-gradient-to-r from-slate-100 to-white", accent: "bg-slate-500" }
};

const frequencyLabels: Record<ChoreFrequency, string> = {
  daily: "Mỗi ngày",
  weekly: "Mỗi tuần",
  one_time: "Một lần"
};

const isCompletedToday = (chore: Chore, today: string) =>
  chore.frequency === "one_time" ? chore.completed : chore.lastCompletedDate === today;

export default function LifeMaintenance({ state, today, onChangeState }: LifeMaintenanceProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ChoreCategory>("home");
  const [frequency, setFrequency] = useState<ChoreFrequency>("one_time");
  const [dueDate, setDueDate] = useState(today);

  const chores = state.chores || [];
  const visibleChores = useMemo(() => chores
    .filter(chore => {
      if (chore.frequency === "daily") return true;
      if (chore.frequency === "weekly") return chore.lastCompletedDate === today || !chore.dueDate || chore.dueDate <= today;
      return !chore.completed || chore.lastCompletedDate === today;
    })
    .sort((a, b) => {
      const aDone = isCompletedToday(a, today) ? 1 : 0;
      const bDone = isCompletedToday(b, today) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return (a.dueTime || "23:59").localeCompare(b.dueTime || "23:59");
    }), [chores, today]);

  const completedCount = visibleChores.filter(chore => isCompletedToday(chore, today)).length;

  const toggleChore = (target: Chore) => {
    const done = isCompletedToday(target, today);
    onChangeState({
      ...state,
      chores: chores.map(chore => {
        if (chore.id !== target.id) return chore;
        if (chore.frequency === "one_time") {
          return { ...chore, completed: !done, lastCompletedDate: !done ? today : null };
        }
        if (done) return { ...chore, lastCompletedDate: null };
        if (chore.frequency === "weekly") {
          const nextDue = new Date(`${today}T12:00:00`);
          nextDue.setDate(nextDue.getDate() + 7);
          return { ...chore, lastCompletedDate: today, dueDate: nextDue.toISOString().slice(0, 10) };
        }
        return { ...chore, lastCompletedDate: today };
      })
    });
  };

  const addChore = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const nextChore: Chore = {
      id: `chore_${Date.now()}`,
      title: title.trim(),
      category,
      frequency,
      dueDate: dueDate || today,
      completed: false,
      lastCompletedDate: null,
      createdAt: new Date().toISOString()
    };
    onChangeState({ ...state, chores: [...chores, nextChore] });
    setTitle("");
    setShowAdd(false);
  };

  const deleteChore = (id: string) => {
    onChangeState({ ...state, chores: chores.filter(chore => chore.id !== id) });
  };

  return (
    <section id="section-life-maintenance" className="life-panel overflow-hidden border-t-4 border-t-teal-500">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <p className="life-kicker mb-2 text-teal-600">Life maintenance</p>
          <h2 className="font-display text-lg font-extrabold text-slate-950">Chores giữ cuộc sống vận hành</h2>
          <p className="mt-1 text-xs text-slate-400">Không tranh vị trí với mục tiêu chính; chỉ nhắc đúng lúc để việc nhỏ không biến thành rắc rối.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-teal-600 bg-teal-600 px-3 py-1.5 text-[10px] font-black text-white shadow-sm">{completedCount}/{visibleChores.length} xong</span>
          <button onClick={() => setShowAdd(value => !value)} className="flex items-center gap-1.5 rounded-xl bg-slate-950 px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-teal-700">
            <Plus className="h-3.5 w-3.5" /> Thêm chore
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={addChore} className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 md:grid-cols-[1fr_150px_140px_145px_auto] md:px-6">
          <input value={title} onChange={event => setTitle(event.target.value)} autoFocus placeholder="Ví dụ: mua thức ăn cho mèo" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100" />
          <label className="relative">
            <select value={category} onChange={event => setCategory(event.target.value as ChoreCategory)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-xs font-semibold outline-none">
              {Object.entries(categories).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
          </label>
          <label className="relative">
            <select value={frequency} onChange={event => setFrequency(event.target.value as ChoreFrequency)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-xs font-semibold outline-none">
              {Object.entries(frequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
          </label>
          <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold outline-none" />
          <button type="submit" className="rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-700">Lưu</button>
        </form>
      )}

      <div className="grid gap-2 p-4 md:grid-cols-2 md:p-6">
        {visibleChores.length > 0 ? visibleChores.map(chore => {
          const config = categories[chore.category];
          const Icon = config.icon;
          const done = isCompletedToday(chore, today);
          const overdue = !done && !!chore.dueDate && chore.dueDate < today;
          return (
            <div key={chore.id} className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 shadow-sm transition ${done ? "border-emerald-300 bg-gradient-to-r from-emerald-100 to-white" : overdue ? "border-rose-300 bg-gradient-to-r from-rose-100 to-white" : config.card}`}>
              <span className={`absolute inset-y-0 left-0 w-1.5 ${done ? "bg-emerald-500" : overdue ? "bg-rose-600" : config.accent}`} />
              <button onClick={() => toggleChore(chore)} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${done ? "border-emerald-200 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-400 hover:border-teal-400 hover:text-teal-600"}`} aria-label={done ? "Đánh dấu chưa xong" : "Đánh dấu hoàn thành"}>
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </button>
              <button onClick={() => toggleChore(chore)} className="min-w-0 flex-1 text-left">
                <span className={`block truncate text-xs font-bold ${done ? "text-emerald-800 line-through" : "text-slate-800"}`}>{chore.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] font-bold">
                  <span className={`rounded-full border px-2 py-0.5 ${config.tone}`}>{config.label}</span>
                  <span className="text-slate-400">{frequencyLabels[chore.frequency]}</span>
                  {overdue && <span className="text-rose-600">Quá hạn</span>}
                  {!overdue && chore.dueTime && <span className="text-slate-400">· {chore.dueTime}</span>}
                </span>
              </button>
              <button onClick={() => deleteChore(chore.id)} className="rounded-lg p-2 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100" aria-label="Xóa chore"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          );
        }) : (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <Home className="mx-auto h-5 w-5 text-slate-300" />
            <p className="mt-2 text-xs font-semibold text-slate-500">Không có chore nào đến hạn hôm nay.</p>
          </div>
        )}
      </div>
    </section>
  );
}
