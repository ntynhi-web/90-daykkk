import React from "react";
import { Cat, Check, Flame, Heart, HeartHandshake, Sparkles, Utensils } from "lucide-react";
import { AppState, LifeAnchor, LifeAnchorIcon } from "../types";

interface LifeAnchorsProps {
  state: AppState;
  today: string;
  onChangeState: (state: AppState) => void;
}

const icons: Record<LifeAnchorIcon, React.ElementType> = {
  cat: Cat,
  spiritual: Flame,
  meal: Utensils,
  self_care: Sparkles,
  connection: HeartHandshake
};

export default function LifeAnchors({ state, today, onChangeState }: LifeAnchorsProps) {
  const anchors = (state.lifeAnchors || []).filter(anchor => anchor.active);
  const completedCount = anchors.filter(anchor => anchor.lastCompletedDate === today).length;

  const toggleAnchor = (target: LifeAnchor) => {
    const completed = target.lastCompletedDate === today;
    onChangeState({
      ...state,
      lifeAnchors: (state.lifeAnchors || []).map(anchor =>
        anchor.id === target.id
          ? { ...anchor, lastCompletedDate: completed ? null : today }
          : anchor
      )
    });
  };

  return (
    <section id="section-life-anchors" className="life-panel overflow-hidden border-t-4 border-t-amber-400">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div>
          <p className="life-kicker text-amber-700">Tinh thần & điều mình trân trọng</p>
          <h2 className="mt-2 font-display text-lg font-extrabold text-slate-950">Những điều nuôi dưỡng đời sống tinh thần</h2>
          <p className="mt-1 text-xs text-slate-400">Không phải KPI hay việc nhà: đây là tình yêu, niềm tin và khoảng lặng bạn muốn dành thời gian mỗi ngày.</p>
        </div>
        <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black text-amber-800">
          {completedCount}/{anchors.length} đã được chăm sóc
        </span>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-2 md:px-6">
        {anchors.length > 0 ? anchors.map(anchor => {
          const Icon = icons[anchor.icon] || Heart;
          const completed = anchor.lastCompletedDate === today;
          return (
            <button
              key={anchor.id}
              onClick={() => toggleAnchor(anchor)}
              className={`group flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                completed
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-amber-200 bg-gradient-to-br from-amber-50/70 to-white hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
              }`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                completed ? "border-emerald-200 bg-emerald-600 text-white" : "border-amber-200 bg-white text-amber-700"
              }`}>
                {completed ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-extrabold ${completed ? "text-emerald-900" : "text-slate-900"}`}>{anchor.title}</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">{anchor.description}</span>
                <span className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold ${completed ? "text-emerald-700" : "text-amber-700"}`}>
                  <Heart className="h-3 w-3" /> {completed ? "Đã dành thời gian hôm nay" : "Ghi nhận hôm nay"}
                </span>
              </span>
            </button>
          );
        }) : (
          <div className="col-span-full rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 p-6 text-center">
            <Heart className="mx-auto h-5 w-5 text-amber-400" />
            <p className="mt-2 text-xs font-semibold text-slate-500">Bạn chưa thêm điều muốn gìn giữ mỗi ngày.</p>
          </div>
        )}
      </div>
    </section>
  );
}
