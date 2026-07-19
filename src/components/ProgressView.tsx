import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  TrendingDown, Award, AlertTriangle, Check, ShieldAlert, BarChart3, PieChart, Info, Heart, 
  Coffee, ShieldCheck, HelpCircle, Activity, Target, Zap, Compass, Sparkles, Scale, Plus, Trash2, ArrowRight,
  BriefcaseBusiness, HeartPulse, CandlestickChart
} from "lucide-react";
import { AppState, B2BLead, JobApplication, HealthRecord, LifestyleRecord, BatchTestRecord, RoutineLog } from "../types";
import { formatDisplayDate } from "../utils";

interface ProgressViewProps {
  state: AppState;
  onChangeState?: (newState: AppState) => void;
}

export default function ProgressView({ state, onChangeState }: ProgressViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'pipelines' | 'health' | 'trading'>('overview');
  const [outcomeDrafts, setOutcomeDrafts] = useState<Record<string, string>>({});

  // Compute pipelines statistics
  const b2bStatusCounts = {
    lead: state.b2bLeads.filter(l => l.status === "lead").length,
    outreached: state.b2bLeads.filter(l => l.status === "outreached").length,
    replied: state.b2bLeads.filter(l => l.status === "replied").length,
    meeting: state.b2bLeads.filter(l => l.status === "meeting").length,
    proposal: state.b2bLeads.filter(l => l.status === "proposal").length,
    paying: state.b2bLeads.filter(l => l.status === "paying").length
  };

  const jobStatusCounts = {
    applied: state.jobApplications.filter(j => j.status === "applied").length,
    interviewing: state.jobApplications.filter(j => j.status === "interviewing").length,
    offered: state.jobApplications.filter(j => j.status === "offered").length,
    rejected: state.jobApplications.filter(j => j.status === "rejected").length
  };

  // Compute weight records for charts
  const healthLogsSorted = Object.values(state.healthRecords)
    .sort((a, b) => a.date.localeCompare(b.date));
  const weightRecords = healthLogsSorted.filter(h => h.weight !== null) as Array<HealthRecord & { weight: number }>;

  const activeGoals = state.goals.filter(goal => goal.status === 'active');
  const fundGoal = activeGoals.find(g => g.category === 'fund_backtest') || activeGoals[0];
  const b2bGoal = activeGoals.find(g => g.category === 'business' || g.category === 'marketing') || activeGoals[1];
  const healthGoal = activeGoals.find(g => g.category === 'health') || activeGoals[2];
  const careerGoal = activeGoals.find(g => g.category === 'career');

  const parseNumbers = (value: string) => (value.match(/\d+(?:[.,]\d+)?/g) || []).map(item => Number(item.replace(',', '.')));
  const healthNumbers = parseNumbers(`${healthGoal?.desiredOutcome || ''} ${healthGoal?.milestones.map(m => m.targetValue).join(' ') || ''}`);
  const g3InitialWeight = Math.max(64.5, ...healthNumbers, weightRecords[0]?.weight || 0);
  const g3TargetWeight = healthNumbers.length > 1 ? Math.min(...healthNumbers) : 54;
  const g3CurrentWeight = weightRecords.length > 0 ? weightRecords[weightRecords.length - 1].weight : g3InitialWeight;
  const g3WeightLoss = Math.round((g3InitialWeight - g3CurrentWeight) * 10) / 10;
  const g3AvgSteps = healthLogsSorted.length > 0
    ? Math.round(healthLogsSorted.reduce((acc, curr) => acc + (curr.steps || 0), 0) / healthLogsSorted.length)
    : 0;

  const topActivityGoal = state.goals
    .map(goal => ({ goal, count: state.activities.filter(activity => activity.goalId === goal.id).length }))
    .sort((a, b) => b.count - a.count)[0];
  const outcomeCount = state.activities.filter(activity => Object.keys(activity.outcome || {}).length > 0).length;
  const pendingOutcomes = state.activities.filter(activity => activity.outcomeStatus === 'pending').sort((a, b) => (a.outcomeReviewDate || '').localeCompare(b.outcomeReviewDate || ''));
  const allMilestones = activeGoals.flatMap(goal => goal.milestones);
  const completedMilestones = allMilestones.filter(milestone => milestone.achieved).length;
  const mindshareTotal = state.activities.filter(a => [fundGoal?.id, b2bGoal?.id, healthGoal?.id].includes(a.goalId)).length;
  const mindsharePercent = (goalId?: string, fallback = 0) => mindshareTotal > 0
    ? Math.round((state.activities.filter(a => a.goalId === goalId).length / mindshareTotal) * 100)
    : fallback;
  const fundMindshare = mindsharePercent(fundGoal?.id, 34);
  const b2bMindshare = mindsharePercent(b2bGoal?.id, 33);
  const healthMindshare = mindsharePercent(healthGoal?.id, 33);

  // Calculate real routine consistency from dated logs (never generated/demo history).
  const last15Days = [...Array(15)].map((_, i) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(Date.now() - (14 - i) * 86_400_000)));
  const eligibleRoutineDays = last15Days.filter(day => day >= state.startDate);
  const persistedRoutineLogs = state.routineLogs || [];
  // Older calendar completions did not create routineLogs. Treat their completed
  // routine blocks as real evidence so history repairs itself without fake data.
  const inferredRoutineLogs: RoutineLog[] = (state.scheduleItems || [])
    .filter(item => item.completed && item.routineId)
    .filter(item => !persistedRoutineLogs.some(log => log.routineId === item.routineId && log.date === item.date))
    .map(item => ({
      id: `inferred_${item.routineId}_${item.date}`,
      routineId: item.routineId as string,
      goalId: item.goalId || item.journeyId || state.routines.find(routine => routine.id === item.routineId)?.goalId || '',
      date: item.date,
      status: 'completed',
      source: 'manual',
      evidence: `Hoàn thành trong Lịch: ${item.title}`,
      activityId: null,
      createdTimestamp: Date.now(),
      updatedTimestamp: Date.now()
    }));
  const routineLogs = [...persistedRoutineLogs, ...inferredRoutineLogs];
  const routineIsDue = (routine: typeof state.routines[number], date: string) => {
    if (!routine.scheduleDays?.length) return true;
    return routine.scheduleDays.includes(new Date(`${date}T12:00:00`).getDay());
  };
  const canonicalRoutineIds = new Set([
    'routine_fund_daily', 'routine_fund_weekly', 'routine_b2b_career', 'routine_english',
    'routine_yoga', 'routine_walk', 'routine_healthy_eating', 'routine_skincare_am',
    'routine_skincare_pm', 'routine_haircare', 'routine_sleep'
  ]);
  const activeRoutines = state.routines.filter(routine =>
    routine.active !== false && ((state.personalScheduleSeedVersion || 0) < 8 || canonicalRoutineIds.has(routine.id))
  );
  const routineOpportunities = activeRoutines.flatMap(routine => eligibleRoutineDays
    .filter(date => routineIsDue(routine, date))
    .filter(date => !routineLogs.some(log => log.routineId === routine.id && log.date === date && log.status === 'skipped'))
    .map(date => `${routine.id}:${date}`));
  const completedRoutineLogs = routineLogs.filter(log =>
    eligibleRoutineDays.includes(log.date) &&
    (log.status === 'minimum' || log.status === 'completed') &&
    activeRoutines.some(routine => routine.id === log.routineId && routineIsDue(routine, log.date))
  );
  const totalRoutineOpportunities = routineOpportunities.length;
  const routinesRatio = totalRoutineOpportunities > 0
    ? Math.round((completedRoutineLogs.length / totalRoutineOpportunities) * 100)
    : 0;

  const g5TotalTradeR = state.batchTestRecords.reduce((acc, curr) => acc + curr.resultR, 0);
  const g5CompliantCount = state.batchTestRecords.filter(t => t.checklistCompliance).length;
  const g5TotalTrades = state.batchTestRecords.length;
  const g5ComplianceRate = g5TotalTrades > 0 ? Math.round((g5CompliantCount / g5TotalTrades) * 100) : 100;

  // Add pipeline states if editing
  const [newLeadCompany, setNewLeadCompany] = useState("");
  const [newLeadStatus, setNewLeadStatus] = useState<'lead' | 'outreached' | 'replied' | 'meeting' | 'proposal' | 'paying'>("lead");
  const [newJobCompany, setNewJobCompany] = useState("");
  const [newJobRole, setNewJobRole] = useState("");
  const [newJobSalary, setNewJobSalary] = useState("");
  const [newJobStatus, setNewJobStatus] = useState<'applied' | 'interviewing' | 'offered' | 'rejected'>("applied");

  // Handler to add lead
  const handleAddLead = () => {
    if (!newLeadCompany || !onChangeState) return;
    const newLead: B2BLead = {
      id: `lead_${Date.now()}`,
      companyName: newLeadCompany,
      contactPerson: "Chưa rõ",
      status: newLeadStatus,
      notes: "Nhập liệu thủ công",
      updatedAt: new Date().toISOString().split('T')[0]
    };
    onChangeState({
      ...state,
      b2bLeads: [newLead, ...state.b2bLeads]
    });
    setNewLeadCompany("");
  };

  // Handler to delete lead
  const handleDeleteLead = (id: string) => {
    if (!onChangeState) return;
    onChangeState({
      ...state,
      b2bLeads: state.b2bLeads.filter(l => l.id !== id)
    });
  };

  // Handler to add job application
  const handleAddJob = () => {
    if (!newJobCompany || !newJobRole || !onChangeState) return;
    const newJob: JobApplication = {
      id: `job_${Date.now()}`,
      companyName: newJobCompany,
      role: newJobRole,
      salary: newJobSalary || "Cạnh tranh",
      status: newJobStatus,
      notes: "Nhập liệu thủ công",
      updatedAt: new Date().toISOString().split('T')[0]
    };
    onChangeState({
      ...state,
      jobApplications: [newJob, ...state.jobApplications]
    });
    setNewJobCompany("");
    setNewJobRole("");
    setNewJobSalary("");
  };

  // Handler to delete job
  const handleDeleteJob = (id: string) => {
    if (!onChangeState) return;
    onChangeState({
      ...state,
      jobApplications: state.jobApplications.filter(j => j.id !== id)
    });
  };

  const renderWeightChart = () => {
    if (weightRecords.length < 2) {
      return (
        <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-4 text-center">
          <TrendingDown className="w-6 h-6 text-slate-300 mb-2" />
          <span>Cần ít nhất 2 ngày ghi nhận cân nặng để vẽ biểu đồ tiến độ.</span>
        </div>
      );
    }

    const weights = weightRecords.map(r => r.weight);
    const minW = Math.min(...weights) - 0.5;
    const maxW = Math.max(...weights) + 0.5;
    const rangeW = maxW - minW || 1;

    const width = 500;
    const height = 180;
    const padding = 30;

    const points = weightRecords.map((r, i) => {
      const x = padding + (i * (width - padding * 2) / (weightRecords.length - 1));
      const y = height - padding - ((r.weight - minW) * (height - padding * 2) / rangeW);
      return { x, y, weight: r.weight, date: r.date };
    });

    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

    return (
      <div className="space-y-2">
        <div className="bg-[#f8fafc] p-4 rounded-2xl border border-slate-150">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = padding + ratio * (height - padding * 2);
              const wVal = Math.round((maxW - ratio * rangeW) * 10) / 10;
              return (
                <g key={i}>
                  <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(226, 232, 240, 0.6)" strokeWidth="1" />
                  <text x={padding - 5} y={y + 3} fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="end">{wVal}</text>
                </g>
              );
            })}

            {/* Main Trend Line */}
            <path d={pathD} fill="none" stroke="#4648d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Connection dots */}
            {points.map((p, i) => (
              <g key={i} className="group cursor-pointer">
                <circle cx={p.x} cy={p.y} r="4" fill="#4648d4" stroke="#ffffff" strokeWidth="1.5" />
                <title>{p.weight} kg vào {formatDisplayDate(p.date)}</title>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  // Generate Routine Contribution Heatmap Grid
  const renderRoutineHeatmap = () => {
    return (
      <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Lịch sử routine thực tế</h4>
            <p className="text-xs text-slate-500 mt-0.5">Dữ liệu được ghi từ Cập nhật tiến độ hôm nay hoặc Voice/Text Check-in — không dùng dữ liệu giả lập.</p>
          </div>
          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold border border-emerald-100 uppercase">
            Consistency: {routinesRatio}%
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[600px] space-y-3.5">
            {activeRoutines.map(rot => {
              const linkedGoal = state.goals.find(g => g.id === rot.goalId);
              
              return (
                <div key={rot.id} className="flex items-center gap-4 text-xs">
                  <div className="w-40 shrink-0 flex items-center justify-between pr-2 border-r border-slate-100">
                    <span className="font-bold text-slate-800 truncate" title={rot.name}>{rot.name}</span>
                    <span className="max-w-20 truncate text-[9px] font-mono px-1 bg-slate-100 rounded text-slate-500" title={linkedGoal?.name}>{linkedGoal?.name || rot.goalId}</span>
                  </div>

                  <div className="flex gap-1.5 flex-1 items-center">
                    {last15Days.map(dayStr => {
                      const log = routineLogs.find(item => item.routineId === rot.id && item.date === dayStr);
                      const completed = log?.status === 'completed';
                      const minimum = log?.status === 'minimum';
                      const beforeCycle = dayStr < state.startDate;
                      const scheduled = routineIsDue(rot, dayStr);
                      const statusLabel = beforeCycle
                        ? "Chưa bắt đầu chu kỳ"
                        : !scheduled
                          ? "Không có trong lịch"
                        : completed
                          ? "Hoàn thành target"
                          : minimum
                            ? "Hoàn thành Minimum Day"
                            : log?.status === 'skipped'
                              ? "Chủ động nghỉ"
                              : log?.status === 'missed'
                                ? "Bỏ lỡ"
                                : "Chưa có dữ liệu";

                      return (
                        <div key={dayStr} className="group relative">
                          <div 
                            className={`w-6 h-6 rounded-md border transition-all ${
                              completed 
                                ? "bg-emerald-600 border-emerald-500"
                                : minimum
                                  ? "bg-amber-300 border-amber-400"
                                  : log?.status === 'skipped'
                                    ? "bg-slate-200 border-slate-300"
                                  : !scheduled
                                    ? "bg-slate-50 border-slate-100 opacity-50"
                                  : beforeCycle
                                    ? "bg-slate-100 border-slate-100"
                                    : "bg-white border-dashed border-slate-300"
                            }`}
                          />
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block bg-[#0b0f19] text-white text-[9px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-20">
                            {formatDisplayDate(dayStr)}: {statusLabel}{log?.evidence ? ` · ${log.evidence}` : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-600" /> Hoàn thành target</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-300" /> Minimum Day</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-200" /> Được thay thế / chủ động nghỉ</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-dashed border-slate-300 bg-white" /> Chưa có dữ liệu</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-slate-100 bg-slate-50 opacity-50" /> Không nằm trong lịch</span>
        </div>
      </div>
    );
  };

  return (
    <div id="progress-view" className="space-y-8">
      
      {/* Title Header with Accent */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display font-extrabold text-3xl text-[#0b0f19] tracking-tight">Kết Quả 90 Ngày</h2>
          <p className="text-sm text-slate-500 max-w-xl">
            Phân tích định tính và định lượng từ nhật ký check-in của bạn.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-[#f1f5f9] p-1 rounded-xl border border-slate-200 shrink-0">
          {(['overview', 'pipelines', 'health', 'trading'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === tab 
                  ? "bg-white text-[#0b0f19] shadow-xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab === 'overview' ? "Tổng quan" :
               tab === 'pipelines' ? "B2B & Tìm việc" :
               tab === 'health' ? "Health & Beauty" : "Fund & Backtest"}
            </button>
          ))}
        </div>
      </section>

      <AnimatePresence mode="wait">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <section className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-indigo-100 bg-indigo-50/70 p-5">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">1 · Execution</span>
                <p className="mt-2 text-2xl font-black text-slate-950">{state.activities.length} bằng chứng</p>
                <p className="mt-1 text-xs text-slate-600">Tập trung nhiều nhất: <strong>{topActivityGoal?.goal.name || "chưa có dữ liệu"}</strong>.</p>
              </div>
              <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/70 p-5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">2 · Outcome</span>
                <p className="mt-2 text-2xl font-black text-slate-950">{outcomeCount} kết quả</p>
                <p className="mt-1 text-xs text-slate-600">B2B: {state.b2bLeads.length} lead · {b2bStatusCounts.paying} khách trả phí.</p>
              </div>
              <div className="rounded-[22px] border border-amber-100 bg-amber-50/70 p-5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">3 · Milestone</span>
                <p className="mt-2 text-2xl font-black text-slate-950">{completedMilestones}/{allMilestones.length} cột mốc</p>
                <p className="mt-1 text-xs text-slate-600">Nhịp routine 15 ngày: {routinesRatio}%. {routinesRatio >= 70 ? "Đang bền vững." : "Nên thu nhỏ mức tối thiểu."}</p>
              </div>
            </section>

            {pendingOutcomes.length > 0 && <section className="rounded-[24px] border border-violet-200 bg-white p-5 shadow-sm md:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="life-kicker text-violet-600">Chờ kết quả</p><h3 className="mt-1 text-lg font-black text-slate-950">{pendingOutcomes.length} hoạt động cần kiểm tra lại</h3><p className="mt-1 text-xs text-slate-500">Hoạt động đã xong; app đang chờ tín hiệu để biết cách làm có hiệu quả hay không.</p></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-800">{pendingOutcomes.filter(item => item.outcomeReviewDate && item.outcomeReviewDate <= new Date().toISOString().split('T')[0]).length} đến hạn</span></div><div className="mt-4 space-y-3">{pendingOutcomes.slice(0, 5).map(activity => <div key={activity.id} className="grid gap-3 rounded-2xl border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)_auto] md:items-center"><div><p className="text-xs font-black text-slate-900">{activity.activity}</p><p className="mt-1 text-[11px] text-slate-500">Kiểm tra: {activity.outcomeReviewDate ? formatDisplayDate(activity.outcomeReviewDate) : 'chưa đặt ngày'}</p></div><input value={outcomeDrafts[activity.id] || ''} onChange={event => setOutcomeDrafts({ ...outcomeDrafts, [activity.id]: event.target.value })} placeholder="Kết quả thực tế là gì?" className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-violet-400" /><button disabled={!outcomeDrafts[activity.id]?.trim() || !onChangeState} onClick={() => { if (!onChangeState) return; onChangeState({ ...state, activities: state.activities.map(item => item.id === activity.id ? { ...item, outcome: { result: outcomeDrafts[activity.id].trim() }, outcomeStatus: 'measured', outcomeReviewDate: null, updatedTimestamp: Date.now() } : item) }); setOutcomeDrafts(current => ({ ...current, [activity.id]: '' })); }} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Lưu kết quả</button></div>)}</div></section>}

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Card 1: Phân bổ nỗ lực thực tế (col-span-8) */}
              <div className="md:col-span-8 bg-white border border-slate-200/80 rounded-[24px] p-6 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">PHÂN BỔ NỖ LỰC THỰC TẾ</h4>
                  <h3 className="font-display font-bold text-base text-slate-900">Hành động và kết quả</h3>
                  <p className="text-xs text-slate-500">Số lượng hành động và phản hồi được AI bóc tách từ check-in giọng nói của bạn.</p>
                </div>

                {/* SVG/CSS Bar Chart for Activity vs Outcome */}
                <div className="pt-6 space-y-4">
                  {state.goals.map(g => {
                    const actCount = state.activities.filter(a => a.goalId === g.id).length;
                    const otcCount = state.activities.filter(a => a.goalId === g.id && Object.keys(a.outcome).length > 0).length;
                    
                    const maxCount = Math.max(...state.goals.map(goal => state.activities.filter(a => a.goalId === goal.id).length), 1);
                    const actWidth = (actCount / maxCount) * 100;
                    const otcWidth = (otcCount / maxCount) * 100;

                    return (
                      <div key={g.id} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-800">{g.name}</span>
                          <span className="text-slate-500 font-mono">Hành động: {actCount} · Có kết quả: {otcCount}</span>
                        </div>
                        <div className="space-y-1">
                          {/* Actions Bar */}
                          <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                            <div className="h-full bg-slate-400 rounded-full transition-all duration-300" style={{ width: `${actWidth}%` }} />
                          </div>
                          {/* Outcomes Bar */}
                          <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${otcWidth}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: Sự phân bổ tâm trí theo mục tiêu (col-span-4) */}
              <div className="md:col-span-4 bg-white border border-slate-200/80 rounded-[24px] p-6 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">PHÂN BỔ TÂM TRÍ</h4>
                  <h3 className="font-display font-bold text-base text-slate-900">Phân bổ sự chú ý</h3>
                </div>

                {/* Nice CSS-based donut/stat circle representation */}
                <div className="py-6 flex flex-col items-center justify-center space-y-4">
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-purple-600" strokeDasharray={`${fundMindshare}, 100`} strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="absolute text-center space-y-0.5">
                      <span className="text-xl font-black text-slate-900 font-mono">{fundMindshare}%</span>
                      <span className="text-[8px] uppercase font-bold tracking-widest text-slate-400 block font-mono">Fund</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 w-full text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="flex items-center gap-2"><CandlestickChart className="w-4 h-4 text-purple-500" /> Fund & Backtest</span>
                      <span className="font-bold">{fundMindshare}%</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="flex items-center gap-2"><BriefcaseBusiness className="w-4 h-4 text-indigo-600" /> B2B Marketing</span>
                      <span className="font-bold">{b2bMindshare}%</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="flex items-center gap-2"><HeartPulse className="w-4 h-4 text-emerald-500" /> Health & Beauty</span>
                      <span className="font-bold">{healthMindshare}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Cân nặng & Thể chất (col-span-5) */}
              <div className="md:col-span-5 bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">CÂN NẶNG & THỂ CHẤT</h4>
                  <h3 className="font-display font-bold text-base text-slate-900">Theo dõi sức khỏe</h3>
                </div>

                {renderWeightChart()}

                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-slate-400 text-[10px] block font-semibold uppercase">ĐÃ GIẢM CÂN</span>
                    <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block">{weightRecords.length ? `${g3WeightLoss} kg` : 'Chưa ghi'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-slate-400 text-[10px] block font-semibold uppercase">ĐI BỘ TRUNG BÌNH</span>
                    <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block">{g3AvgSteps} bước</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Hiệu suất Phễu Outreach (col-span-7) */}
              <div className="md:col-span-7 bg-white border border-slate-200/80 rounded-[24px] p-6 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">HIỆU SUẤT PHỄU OUTREACH</h4>
                  <h3 className="font-display font-bold text-base text-slate-900">Chuyển đổi B2B</h3>
                  <p className="text-xs text-slate-500">Tỷ lệ chuyển đổi từ Outreach của các đối tác tiềm năng.</p>
                </div>

                {state.b2bLeads.length === 0 ? (
                  <div className="my-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <p className="text-sm font-black text-slate-700">Chưa có dữ liệu outreach</p>
                    <p className="mt-1 text-xs text-slate-500">Thêm lead hoặc ghi nhận hoạt động tiếp cận đầu tiên để bắt đầu đo phễu.</p>
                  </div>
                ) : <div className="py-4 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Tổng số leads đã tiếp cận:</span>
                    <span className="font-bold text-slate-900 font-mono">{state.b2bLeads.length} leads</span>
                  </div>
                  
                  {/* Visual funnel levels */}
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="font-medium text-slate-600">Đã gửi Outreach</span>
                      <span className="font-bold text-slate-800">{b2bStatusCounts.outreached}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-indigo-50/50 rounded-lg border border-indigo-100">
                      <span className="font-medium text-indigo-700">Đã phản hồi (Replied)</span>
                      <span className="font-bold text-indigo-800">{b2bStatusCounts.replied}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                      <span className="font-medium text-emerald-700">Hợp đồng pilot / Paying</span>
                      <span className="font-bold text-emerald-800">{b2bStatusCounts.paying}</span>
                    </div>
                  </div>
                </div>}

                <div className="text-[10px] text-slate-400 italic text-center pt-2 border-t border-slate-100">
                  Dữ liệu được tự động cập nhật từ các hoạt động ghi nhận check-in hàng ngày.
                </div>
              </div>

              {/* Card 5: Routine Consistency Contribution Grid (col-span-12) */}
              <div className="md:col-span-12">
                {renderRoutineHeatmap()}
              </div>

            </div>
          </motion.div>
        )}

        {/* PIPELINES TAB */}
        {activeTab === 'pipelines' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Column 1: B2B Leads pipeline */}
            <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-display font-bold text-lg text-slate-900">Phễu khách hàng · {b2bGoal?.name || "B2B Marketing"}</h3>
                <p className="text-xs text-slate-500 mt-1">Danh sách đối tác dịch vụ tiếp cận được cập nhật tự động từ check-in AI hoặc thêm tay.</p>
              </div>

              {/* Quick lead add form */}
              <div className="bg-[#f8fafc] border border-slate-150 rounded-xl p-4 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Thêm lead mới</span>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Tên công ty tiềm năng..." 
                    value={newLeadCompany}
                    onChange={e => setNewLeadCompany(e.target.value)}
                    className="bg-white border border-slate-200 text-xs rounded-lg px-3 py-2 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                  />
                  <select
                    value={newLeadStatus}
                    onChange={e => setNewLeadStatus(e.target.value as any)}
                    className="bg-white border border-slate-200 text-xs rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                  >
                    <option value="lead">Chờ liên hệ</option>
                    <option value="outreached">Đã outreach</option>
                    <option value="replied">Đã phản hồi</option>
                    <option value="paying">Paying / Pilot</option>
                  </select>
                  <button 
                    onClick={handleAddLead}
                    className="bg-[#0b0f19] text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              {/* Leads List */}
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {state.b2bLeads.length === 0 ? (
                  <p className="text-xs text-slate-400 py-10 text-center border border-dashed border-slate-150 rounded-xl bg-slate-50/50">Chưa ghi nhận B2B Lead nào.</p>
                ) : (
                  state.b2bLeads.map(l => (
                    <div key={l.id} className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4 hover:border-slate-300">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-900 block">{l.companyName}</span>
                        <p className="text-[10px] text-slate-400">{l.notes}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          l.status === 'paying' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          l.status === 'replied' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                          "bg-slate-50 text-slate-600 border-slate-200"
                        }`}>
                          {l.status}
                        </span>
                        <button 
                          onClick={() => handleDeleteLead(l.id)}
                          className="text-slate-300 hover:text-rose-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 2: Job Applications pipeline */}
            <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-display font-bold text-lg text-slate-900">Cơ hội nghề nghiệp trên 30 triệu net</h3>
                <p className="text-xs text-slate-500 mt-1">{careerGoal?.name || "Theo dõi ứng tuyển, phỏng vấn và offer riêng với phễu khách hàng B2B."}</p>
              </div>

              {/* Quick job add form */}
              <div className="bg-[#f8fafc] border border-slate-150 rounded-xl p-4 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Thêm ứng tuyển mới</span>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="Tên công ty..." 
                    value={newJobCompany}
                    onChange={e => setNewJobCompany(e.target.value)}
                    className="bg-white border border-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                  />
                  <input 
                    type="text" 
                    placeholder="Vị trí (Role)..." 
                    value={newJobRole}
                    onChange={e => setNewJobRole(e.target.value)}
                    className="bg-white border border-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                  />
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Mức lương..." 
                    value={newJobSalary}
                    onChange={e => setNewJobSalary(e.target.value)}
                    className="bg-white border border-slate-200 text-xs rounded-lg px-3 py-2 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                  />
                  <select
                    value={newJobStatus}
                    onChange={e => setNewJobStatus(e.target.value as any)}
                    className="bg-white border border-slate-200 text-xs rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                  >
                    <option value="applied">Đã nộp đơn</option>
                    <option value="interviewing">Phỏng vấn</option>
                    <option value="offered">Có offer</option>
                    <option value="rejected">Từ chối</option>
                  </select>
                  <button 
                    onClick={handleAddJob}
                    className="bg-[#0b0f19] text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              {/* Jobs list */}
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {state.jobApplications.length === 0 ? (
                  <p className="text-xs text-slate-400 py-10 text-center border border-dashed border-slate-150 rounded-xl bg-slate-50/50">Chưa có ứng tuyển nào.</p>
                ) : (
                  state.jobApplications.map(j => (
                    <div key={j.id} className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4 hover:border-slate-300">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-900 block">{j.companyName} — {j.role}</span>
                        <p className="text-[10px] text-slate-400 font-mono">Lương: {j.salary}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          j.status === 'offered' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          j.status === 'interviewing' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                          "bg-slate-50 text-slate-600 border-slate-200"
                        }`}>
                          {j.status}
                        </span>
                        <button 
                          onClick={() => handleDeleteJob(j.id)}
                          className="text-slate-300 hover:text-rose-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* HEALTH TAB */}
        {activeTab === 'health' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* Weight trends card */}
            <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">Lịch sử Health & Beauty</h3>
                <p className="text-xs text-slate-500 mt-0.5">Biểu đồ tiến độ an toàn từ {g3InitialWeight} kg về {g3TargetWeight} kg.</p>
              </div>
              {renderWeightChart()}
            </div>

            {/* Health Logs List */}
            <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">Chi tiết nhật ký sức khỏe & Giấc ngủ</h3>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {healthLogsSorted.length === 0 ? (
                  <p className="text-xs text-slate-400 py-10 text-center">Chưa ghi nhận nhật ký sức khỏe nào.</p>
                ) : (
                  healthLogsSorted.map(log => (
                    <div key={log.date} className="p-3.5 bg-[#f8fafc] border border-slate-150 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{formatDisplayDate(log.date)}</span>
                        <div className="flex gap-3 text-[10px] text-slate-500 mt-1">
                          <span>Cân nặng: <strong className="text-slate-700">{log.weight || "N/A"} kg</strong></span>
                          <span>Ngủ: <strong className="text-slate-700">{log.sleepHours || "N/A"} giờ</strong></span>
                          <span>Vận động: <strong className="text-slate-700">{log.steps || 0} bước</strong></span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {log.strengthSession && <span className="bg-red-50 text-red-600 border border-red-100 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded">Strength</span>}
                        {log.eatOnPlan && <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded">Eat Clean</span>}
                        {log.skincare && <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded">Skincare</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* TRADING TAB */}
        {activeTab === 'trading' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">Báo cáo Fund & Backtest</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Yêu cầu kỷ luật và quản trị rủi ro tuyệt đối trước khi thi tuyển.</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-3 py-1 rounded-full font-bold block uppercase">
                    Compliance: {g5ComplianceRate}%
                  </span>
                  <span className="text-xs text-slate-500 font-semibold block mt-1">Tổng kết quả: {g5TotalTradeR >= 0 ? "+" : ""}{g5TotalTradeR}R</span>
                </div>
              </div>

              {/* Warning label if violations found */}
              {state.batchTestRecords.some(t => t.ruleViolations.length > 0) && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <div>
                    <strong className="font-bold block mb-0.5">Cảnh báo vi phạm kỷ luật giao dịch!</strong>
                    Có một vài lệnh vi phạm nguyên tắc quản trị rủi ro. Hãy điều chỉnh kế hoạch và tuân thủ checklist nghiêm ngặt hơn.
                  </div>
                </div>
              )}

              {/* Trade records list */}
              <div className="space-y-3">
                {state.batchTestRecords.length === 0 ? (
                  <p className="text-xs text-slate-400 py-10 text-center border border-dashed border-slate-150 rounded-xl bg-slate-50/50">Chưa ghi nhận trade nào.</p>
                ) : (
                  state.batchTestRecords.map(tr => (
                    <div key={tr.id} className="p-4 bg-[#f8fafc] border border-slate-150 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800">{formatDisplayDate(tr.date)}</span>
                        <span className={`font-mono font-bold ${tr.resultR >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {tr.resultR >= 0 ? "+" : ""}{tr.resultR} R
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 grid grid-cols-2 gap-2 text-[11px]">
                        <div>Sử dụng công cụ: <strong className="text-slate-800">{tr.instrument}</strong></div>
                        <div>Rủi ro kế hoạch: <strong className="text-slate-800">{tr.plannedRisk}%</strong></div>
                      </div>
                      {tr.ruleViolations.length > 0 && (
                        <div className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100">
                          <strong>Lỗi kỷ luật:</strong> {tr.ruleViolations.join(", ")}
                        </div>
                      )}
                      <p className="text-[11px] text-slate-500 italic">Bài học: {tr.lessons}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
