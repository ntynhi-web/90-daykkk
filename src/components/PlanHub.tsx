import React, { useRef, useState } from "react";
import { Download, FileUp, LoaderCircle } from "lucide-react";
import { AppState } from "../types";
import { fetchWithTimeout, MAX_TEMPLATE_BYTES, MAX_TEXT_LENGTH, validatePlanTemplate } from "../planTemplate";

export default function PlanHub({ state, onChangeState }: { state: AppState; onChangeState: (state: AppState) => void }) {
  const [tab, setTab] = useState<"goals" | "routines" | "schedule" | "template">("goals");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [schedulePage, setSchedulePage] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const schedulePageSize = 50;
  const scheduleItems = state.scheduleItems || [];
  const schedulePageCount = Math.max(1, Math.ceil(scheduleItems.length / schedulePageSize));
  const visibleScheduleItems = scheduleItems.slice(schedulePage * schedulePageSize, (schedulePage + 1) * schedulePageSize);
  const patchGoal = (goalId: string, patch: Record<string, any>) =>
    onChangeState({ ...state, goals: state.goals.map(goal => goal.id === goalId ? { ...goal, ...patch } : goal) });

  const exportTemplate = () => {
    const plan = {
      format: "90-day-os-plan-template", version: 1,
      plan: {
        startDate: state.startDate, endDate: state.endDate,
        goals: state.goals.map(goal => ({ ...goal, currentProgress: 0, milestones: goal.milestones.map(step => ({ ...step, achieved: false, currentValue: "0", completedAt: null, status: step.order === 0 ? "active" : "locked" })) })),
        routines: state.routines.map(routine => ({ ...routine, status: "pending" })),
        scheduleItems: (state.scheduleItems || []).map(item => ({ ...item, completed: false }))
      }
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "90-day-os-plan-template.json"; link.click();
    URL.revokeObjectURL(url);
    setNotice("Đã xuất template sạch, không kèm check-in hoặc dữ liệu cá nhân.");
  };

  const applyPlan = (plan: any) => {
    const validated = validatePlanTemplate(plan, state);
    onChangeState({ ...state, ...validated });
  };

  const importTemplate = async (file?: File) => {
    if (!file || loading) return;
    if (file.size > MAX_TEMPLATE_BYTES) {
      setNotice("Không thể nhập: file vượt quá 256 KB.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setLoading(true); setNotice("");
    try {
      const content = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) applyPlan(JSON.parse(content));
      else {
        const response = await fetchWithTimeout("/api/plan-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, currentPlan: { startDate: state.startDate, endDate: state.endDate, goals: state.goals, routines: state.routines, scheduleItems: state.scheduleItems } }) });
        const payload = await response.json().catch(() => ({ message: "Server trả về dữ liệu không hợp lệ." }));
        if (!response.ok) throw new Error(payload.message || "AI không đọc được file.");
        applyPlan(payload.plan);
      }
      setNotice("Đã nhập và sắp xếp kế hoạch vào tài khoản này.");
    } catch (error: any) { setNotice(`Không thể nhập: ${error.message}`); }
    finally { setLoading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <section className="rounded-[28px] border border-indigo-200 bg-white p-5 shadow-sm md:p-7">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Plan Hub</p>
      <h2 className="mt-2 font-display text-2xl font-black text-slate-950">Chỉnh toàn bộ kế hoạch tại một nơi</h2>
      <div className="mt-5 flex gap-2 overflow-x-auto">{(["goals","routines","schedule","template"] as const).map(value => <button key={value} onClick={() => setTab(value)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${tab === value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>{value === "goals" ? "Mục tiêu & process" : value === "routines" ? "Routine" : value === "schedule" ? "Lịch" : "Template & nhân bản"}</button>)}</div>

      {tab === "goals" && <div className="mt-5 space-y-3">{state.goals.map(goal => <article key={goal.id} className="rounded-2xl border border-slate-200 p-4"><input maxLength={160} value={goal.name} onChange={event => patchGoal(goal.id, { name: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-black" /><textarea maxLength={MAX_TEXT_LENGTH} value={goal.description} onChange={event => patchGoal(goal.id, { description: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /><div className="mt-3 flex gap-2 overflow-x-auto">{goal.milestones.map(step => <div key={step.id} className="min-w-[210px] rounded-xl bg-slate-50 p-3"><input maxLength={160} value={step.title} onChange={event => patchGoal(goal.id, { milestones: goal.milestones.map(item => item.id === step.id ? { ...item, title: event.target.value } : item) })} className="w-full rounded-lg border px-2 py-1.5 text-xs font-bold" /><input maxLength={500} value={step.targetValue} onChange={event => patchGoal(goal.id, { milestones: goal.milestones.map(item => item.id === step.id ? { ...item, targetValue: event.target.value } : item) })} className="mt-2 w-full rounded-lg border px-2 py-1.5 text-[11px]" /><input type="date" value={step.dueDate} min={state.startDate} max={state.endDate} onChange={event => patchGoal(goal.id, { milestones: goal.milestones.map(item => item.id === step.id ? { ...item, dueDate: event.target.value } : item) })} className="mt-2 w-full rounded-lg border px-2 py-1.5 text-[11px]" /></div>)}</div></article>)}</div>}
      {tab === "routines" && <div className="mt-5 grid gap-3 lg:grid-cols-2">{state.routines.map(routine => <article key={routine.id} className="rounded-2xl border p-4"><input value={routine.name} onChange={event => onChangeState({ ...state, routines: state.routines.map(item => item.id === routine.id ? { ...item, name: event.target.value } : item) })} className="w-full rounded-lg border px-2 py-1.5 text-xs font-black" />{(["frequency","minimumDay","target"] as const).map(field => <input key={field} value={routine[field]} onChange={event => onChangeState({ ...state, routines: state.routines.map(item => item.id === routine.id ? { ...item, [field]: event.target.value } : item) })} className="mt-2 w-full rounded-lg border px-2 py-1.5 text-[11px]" />)}</article>)}</div>}
      {tab === "schedule" && <div className="mt-5"><div className="max-h-[520px] space-y-2 overflow-y-auto">{visibleScheduleItems.map(item => <article key={item.id} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[130px_90px_90px_minmax(0,1fr)]">{(["date","startTime","endTime","title"] as const).map(field => <input key={field} maxLength={field === "title" ? 160 : undefined} type={field === "date" ? "date" : field.includes("Time") ? "time" : "text"} value={item[field]} min={field === "date" ? state.startDate : undefined} max={field === "date" ? state.endDate : undefined} onChange={event => onChangeState({ ...state, scheduleItems: state.scheduleItems.map(row => row.id === item.id ? { ...row, [field]: event.target.value } : row) })} className="rounded-lg border px-2 py-1.5 text-[11px]" />)}</article>)}</div>{schedulePageCount > 1 && <div className="mt-3 flex items-center justify-between"><button disabled={schedulePage === 0} onClick={() => setSchedulePage(page => Math.max(0, page - 1))} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">Trang trước</button><span className="text-xs font-semibold text-slate-500">{schedulePage + 1}/{schedulePageCount} · {scheduleItems.length} lịch</span><button disabled={schedulePage >= schedulePageCount - 1} onClick={() => setSchedulePage(page => Math.min(schedulePageCount - 1, page + 1))} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">Trang sau</button></div>}</div>}
      {tab === "template" && <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl bg-indigo-50 p-5"><Download className="h-5 w-5 text-indigo-700" /><h3 className="mt-2 text-sm font-black">Xuất để nhân bản</h3><p className="mt-1 text-xs text-slate-600">Người khác đăng nhập tài khoản riêng rồi import file này.</p><button disabled={loading} onClick={exportTemplate} className="mt-4 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-black text-white disabled:opacity-40">Tải template JSON</button></div><div className="rounded-2xl bg-emerald-50 p-5"><FileUp className="h-5 w-5 text-emerald-700" /><h3 className="mt-2 text-sm font-black">Import bằng AI</h3><p className="mt-1 text-xs text-slate-600">JSON nhập trực tiếp; TXT, MD hoặc CSV được AI tự sắp. Tối đa 256 KB.</p><input disabled={loading} ref={fileRef} type="file" accept=".json,.txt,.md,.csv" onChange={event => importTemplate(event.target.files?.[0])} className="mt-4 text-xs disabled:opacity-40" />{loading && <p className="mt-2 flex items-center gap-2 text-xs"><LoaderCircle className="h-4 w-4 animate-spin" />Đang xử lý…</p>}</div></div>}
      {notice && <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold">{notice}</p>}
    </section>
  );
}
