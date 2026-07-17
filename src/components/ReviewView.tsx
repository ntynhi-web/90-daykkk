import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Download, Upload, RefreshCw, Trash2, Plus, Sparkles, CheckCircle2, FlaskConical, AlertTriangle, HelpCircle, Save, Check, FileSpreadsheet, Layers, Play,
  BookOpenCheck, History, HardDriveDownload, ChevronRight
} from "lucide-react";
import { AppState, WeeklyReview, Experiment } from "../types";
import { getSeededAppState, getDefaultAppState, exportStateToJSON, convertToCSV, triggerFileDownload, formatDisplayDate } from "../utils";

interface ReviewViewProps {
  state: AppState;
  onChangeState: (newState: AppState) => void;
}

export default function ReviewView({ state, onChangeState }: ReviewViewProps) {
  const [activeReviewTab, setActiveReviewTab] = useState<'review' | 'experiments' | 'database' | 'recommendations'>('review');
  const [isAddingExperiment, setIsAddingExperiment] = useState(false);
  const [isCreatingWeeklyReview, setIsCreatingWeeklyReview] = useState(false);

  const reviewTabs = [
    { id: 'review' as const, label: 'Đánh giá', description: 'Nhìn lại và điều chỉnh', icon: BookOpenCheck },
    { id: 'experiments' as const, label: 'Thử nghiệm', description: 'Kiểm chứng cách làm mới', icon: FlaskConical },
    { id: 'recommendations' as const, label: 'Lịch sử đề xuất', description: 'Xem lời khuyên đã nhận', icon: History },
    { id: 'database' as const, label: 'Sao lưu', description: 'Bảo vệ và xuất dữ liệu', icon: HardDriveDownload }
  ];

  // Weekly review form state
  const [weeklyForm, setWeeklyForm] = useState({
    date: new Date().toISOString().split('T')[0],
    planned: "",
    actual: "",
    wins: "",
    problems: "",
    lessons: "",
    adjustments: "",
    status: "continue" as 'continue' | 'adjust' | 'paused' | 'stop'
  });

  // Experiment form state
  const [expForm, setExpForm] = useState({
    goalId: state.goals[0]?.id || "G1",
    hypothesis: "",
    variable: "",
    startDate: new Date().toISOString().split('T')[0],
    reviewDate: "",
    mainMetric: "",
    guardrail: "",
    baseline: "",
    result: "",
    confidence: 0.9,
    decision: "continue" as 'continue' | 'adjust' | 'stop' | null,
    reason: ""
  });

  // Handle Export to JSON
  const handleExportJSON = () => {
    const jsonStr = exportStateToJSON(state);
    triggerFileDownload(jsonStr, `90day_life_os_backup_${Date.now()}.json`, "application/json");
  };

  // Handle Import JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Cảnh báo: Thao tác này sẽ ghi đè toàn bộ dữ liệu hiện tại bằng dữ liệu từ tệp tin đã chọn. Bạn có chắc chắn muốn tiếp tục?")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.startDate && parsed.goals && parsed.activities) {
          onChangeState(parsed);
          alert("Nhập dữ liệu thành công!");
        } else {
          alert("Lỗi: Tệp tin sao lưu không đúng định dạng 90-Day Life OS.");
        }
      } catch (err) {
        alert("Lỗi: Không thể phân tích tệp tin JSON này.");
      }
    };
    reader.readAsText(file);
  };

  // Handle CSV Exports
  const handleExportLeadsCSV = () => {
    const headers = ["ID", "CompanyName", "ContactPerson", "Status", "Notes", "UpdatedAt"];
    const keys = ["id", "companyName", "contactPerson", "status", "notes", "updatedAt"];
    const csvStr = convertToCSV(state.b2bLeads, headers, keys);
    triggerFileDownload(csvStr, "b2b_saas_leads.csv", "text/csv;charset=utf-8;");
  };

  const handleExportJobsCSV = () => {
    const headers = ["ID", "CompanyName", "Role", "Salary", "Status", "Notes", "UpdatedAt"];
    const keys = ["id", "companyName", "role", "salary", "status", "notes", "updatedAt"];
    const csvStr = convertToCSV(state.jobApplications, headers, keys);
    triggerFileDownload(csvStr, "job_applications.csv", "text/csv;charset=utf-8;");
  };

  const handleExportHealthCSV = () => {
    const healthLogs = Object.values(state.healthRecords);
    const headers = ["Date", "WeightKg", "SleepHours", "EnergyScale", "StepsCounted", "StrengthSession", "EatOnPlan", "Skincare", "Notes"];
    const keys = ["date", "weight", "sleepHours", "energy", "steps", "strengthSession", "eatOnPlan", "skincare", "notes"];
    const csvStr = convertToCSV(healthLogs, headers, keys);
    triggerFileDownload(csvStr, "health_fitness_logs.csv", "text/csv;charset=utf-8;");
  };

  // Trigger seeding demo data
  const handleSeedData = () => {
    if (window.confirm("Bấm xác nhận để tải ngay 14 ngày dữ liệu mẫu tiếng Việt cực kỳ chi tiết bao gồm nhật ký, cân nặng, leads B2B, phỏng vấn và các lệnh giao dịch demo.")) {
      const seeded = getSeededAppState();
      onChangeState(seeded);
      alert("Đã kích hoạt chế độ dữ liệu mẫu thành công!");
    }
  };

  // Trigger factory reset
  const handleResetData = () => {
    if (window.confirm("Cảnh báo ĐỎ: Hành động này sẽ xóa vĩnh viễn toàn bộ nhật ký, cân nặng, thói quen và mục tiêu hiện tại của bạn. Bạn có chắc chắn muốn cài đặt lại từ đầu?")) {
      const emptyState = getDefaultAppState();
      onChangeState(emptyState);
      alert("Đã khôi phục cài đặt gốc thành công!");
    }
  };

  // Submit a true weekly review: one record represents Monday–Sunday, not one day.
  const handleSubmitWeeklyReview = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedDate = new Date(`${weeklyForm.date}T12:00:00`);
    const mondayOffset = (selectedDate.getDay() + 6) % 7;
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - mondayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const toDate = (date: Date) => date.toISOString().split('T')[0];
    const startDate = toDate(weekStart);
    const endDate = toDate(weekEnd);
    const cycleStart = new Date(`${state.startDate}T12:00:00`);
    const weekNumber = Math.max(1, Math.floor((weekStart.getTime() - cycleStart.getTime()) / (7 * 86_400_000)) + 1);
    const weekActivities = state.activities.filter(activity => activity.date >= startDate && activity.date <= endDate);
    const activityCount = weekActivities.length || 1;
    const timeAllocation = state.goals.reduce((acc, goal) => ({
      ...acc,
      [goal.id]: Math.round((weekActivities.filter(activity => activity.goalId === goal.id).length / activityCount) * 100)
    }), {} as Record<string, number>);

    const newReview: WeeklyReview = {
      id: `rev_${Date.now()}`,
      weekNumber,
      startDate,
      endDate,
      planned: weeklyForm.planned,
      actual: weeklyForm.actual,
      wins: weeklyForm.wins,
      problems: weeklyForm.problems,
      lessons: weeklyForm.lessons,
      adjustments: weeklyForm.adjustments,
      status: weeklyForm.status,
      timeAllocation,
      outputs: { activities: weekActivities.length },
      outcomes: { withOutcome: weekActivities.filter(activity => Object.keys(activity.outcome || {}).length > 0).length },
      submitted: true
    };

    const nextReviews = [newReview, ...state.weeklyReviews];
    onChangeState({ ...state, weeklyReviews: nextReviews });
    setIsCreatingWeeklyReview(false);
    
    // Reset form
    setWeeklyForm({
      date: new Date().toISOString().split('T')[0],
      planned: "",
      actual: "",
      wins: "",
      problems: "",
      lessons: "",
      adjustments: "",
      status: "continue"
    });

    alert("Đã lưu đánh giá tuần. Phân bổ nỗ lực được tính từ dữ liệu check-in thật trong tuần này.");
  };

  // Submit Experiment
  const handleSubmitExperiment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expForm.hypothesis || !expForm.variable) {
      alert("Vui lòng điền đủ giả thuyết và biến số thay đổi.");
      return;
    }

    const newExp: Experiment = {
      id: `exp_${Date.now()}`,
      goalId: expForm.goalId,
      hypothesis: expForm.hypothesis,
      variable: expForm.variable,
      startDate: expForm.startDate,
      reviewDate: expForm.reviewDate || state.endDate,
      mainMetric: expForm.mainMetric,
      guardrail: expForm.guardrail,
      baseline: expForm.baseline,
      result: expForm.result || null,
      confidence: expForm.confidence,
      decision: expForm.decision,
      reason: expForm.reason || null
    };

    const nextExperiments = [newExp, ...state.experiments];
    onChangeState({ ...state, experiments: nextExperiments });
    setIsAddingExperiment(false);
    alert("Đã lưu thiết lập thử nghiệm cải tiến thành công!");
  };

  return (
    <div id="review-view" className="space-y-6">
      
      {/* Title Header */}
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="relative border-b border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white md:p-8">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-indigo-200"><BookOpenCheck className="h-6 w-6" /></span>
            <div>
              <p className="life-kicker mb-2 text-indigo-300">Review workspace</p>
              <h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">Đánh giá & Điều chỉnh</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Nhìn lại dữ liệu, chọn điều cần thay đổi, sau đó mới lưu hoặc xuất dữ liệu. Mỗi tab có một nhiệm vụ rõ ràng.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 p-3 sm:grid-cols-2 md:grid-cols-4 md:p-4">
          {reviewTabs.map(tab => {
            const Icon = tab.icon;
            const active = activeReviewTab === tab.id;
            return (
            <button
              key={tab.id}
              onClick={() => setActiveReviewTab(tab.id)}
              className={`group flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                active
                  ? "border-indigo-200 bg-indigo-50 text-indigo-950 shadow-sm"
                  : "border-transparent bg-slate-50/80 text-slate-600 hover:border-slate-200 hover:bg-white"
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-indigo-600 text-white" : "bg-white text-slate-500 shadow-xs"}`}><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold">{tab.label}</span>
                <span className="mt-0.5 block truncate text-[10px] text-slate-400">{tab.description}</span>
              </span>
              <ChevronRight className={`h-4 w-4 shrink-0 transition ${active ? "text-indigo-600" : "text-slate-300 group-hover:text-slate-500"}`} />
            </button>
          );})}
        </div>
      </section>

      <AnimatePresence mode="wait">
        
        {/* REVIEW TAB */}
        {activeReviewTab === 'review' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* Split layout if creating, else show summary list */}
            {isCreatingWeeklyReview ? (
              <form onSubmit={handleSubmitWeeklyReview} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Column: Reflection Inputs (col-span-8) */}
                <div className="lg:col-span-8 space-y-6 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                  <div className="border-b border-slate-100 pb-4">
                    <span className="text-[10px] font-bold text-[#4648d4] uppercase tracking-wider block">PHẢN TƯ ĐỊNH TÍNH</span>
                    <h3 className="font-display font-bold text-lg text-slate-900 mt-1">Đánh giá tuần</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Nhìn lại dữ liệu của cả tuần để quyết định tuần tới, thay vì đánh giá cảm tính từng ngày.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Chọn một ngày trong tuần cần đánh giá</label>
                      <input 
                        type="date" 
                        value={weeklyForm.date}
                        onChange={e => setWeeklyForm({ ...weeklyForm, date: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:ring-1 focus:ring-indigo-500/25"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">0. Tuần này tôi đã định hoàn thành điều gì?</label>
                      <textarea
                        placeholder="Ví dụ: hoàn thiện checklist Setup 1, có 10 cuộc trò chuyện B2B chất lượng..."
                        value={weeklyForm.planned}
                        onChange={e => setWeeklyForm({ ...weeklyForm, planned: e.target.value })}
                        className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-indigo-500/25"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">1. Điều gì đã làm tốt nhất tuần này?</label>
                      <textarea 
                        placeholder="Ví dụ: Gửi đầy đủ 15 email outreach B2B, hoàn thành 6.000 bước đi bộ và skincare đúng giờ..."
                        value={weeklyForm.wins}
                        onChange={e => setWeeklyForm({ ...weeklyForm, wins: e.target.value })}
                        className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-indigo-500/25"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">2. Hành động nào trực tiếp tạo ra kết quả? (What created results)</label>
                      <textarea 
                        placeholder="Ví dụ: Việc tập trung viết lại offer B2B giúp thu hút phản hồi tốt hơn từ 2 leads..."
                        value={weeklyForm.actual}
                        onChange={e => setWeeklyForm({ ...weeklyForm, actual: e.target.value })}
                        className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-indigo-500/25"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">3. Điều gì chưa hiệu quả & gặp trở ngại? (What did not work)</label>
                      <textarea 
                        placeholder="Ví dụ: Giao dịch tài chính (G5) bị vội vã, vi phạm checklist quản lý rủi ro..."
                        value={weeklyForm.problems}
                        onChange={e => setWeeklyForm({ ...weeklyForm, problems: e.target.value })}
                        className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-indigo-500/25"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">4. Bài học kinh nghiệm quý giá rút ra (Lessons learned)</label>
                      <textarea 
                        placeholder="Ví dụ: Không bao giờ được đặt lệnh giao dịch khi chưa kiểm tra kỹ checklist rủi ro..."
                        value={weeklyForm.lessons}
                        onChange={e => setWeeklyForm({ ...weeklyForm, lessons: e.target.value })}
                        className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-indigo-500/25"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">5. Tuần tới sẽ điều chỉnh điều gì?</label>
                      <textarea 
                        placeholder="Ví dụ: Sẽ in checklist giao dịch ra giấy đặt trên bàn, đi ngủ trước 12h..."
                        value={weeklyForm.adjustments}
                        onChange={e => setWeeklyForm({ ...weeklyForm, adjustments: e.target.value })}
                        className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-indigo-500/25"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Decision Dashboard (col-span-4) */}
                <div className="lg:col-span-4 space-y-6 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                  <div className="border-b border-slate-100 pb-4">
                    <span className="text-[10px] font-bold text-[#4648d4] uppercase tracking-wider block">QUYẾT ĐỊNH CHIẾN LƯỢC</span>
                    <h3 className="font-display font-bold text-base text-slate-900 mt-1">Hành Động Chiến Lược</h3>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        key: "continue",
                        title: "Tiếp tục",
                        desc: "Duy trì kế hoạch gốc, tập trung thói quen cốt lõi.",
                        colorClass: "border-emerald-250 hover:bg-emerald-50/20 text-emerald-900",
                        activeClass: "bg-emerald-50 border-emerald-500 text-emerald-900"
                      },
                      {
                        key: "adjust",
                        title: "Điều chỉnh",
                        desc: "Tối ưu hóa hành động, thay đổi mục tiêu phụ.",
                        colorClass: "border-amber-250 hover:bg-amber-50/20 text-amber-900",
                        activeClass: "bg-amber-50 border-amber-500 text-amber-900"
                      },
                      {
                        key: "paused",
                        title: "Tạm dừng",
                        desc: "Tạm dừng chu kỳ, bảo lưu tiến trình hiện tại.",
                        colorClass: "border-yellow-250 hover:bg-yellow-50/20 text-yellow-900",
                        activeClass: "bg-yellow-50 border-yellow-500 text-yellow-900"
                      },
                      {
                        key: "stop",
                        title: "Dừng",
                        desc: "Chốt chu kỳ, tổng kết bài học xương máu.",
                        colorClass: "border-rose-250 hover:bg-rose-50/20 text-rose-900",
                        activeClass: "bg-rose-50 border-rose-500 text-rose-900"
                      }
                    ].map(btn => {
                      const isSelected = weeklyForm.status === btn.key;
                      return (
                        <button
                          key={btn.key}
                          type="button"
                          onClick={() => setWeeklyForm({ ...weeklyForm, status: btn.key as any })}
                          className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col space-y-1 cursor-pointer ${
                            isSelected ? btn.activeClass + " shadow-3xs" : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <span className="text-xs font-bold">{btn.title}</span>
                          <span className="text-[10px] text-slate-500 leading-normal">{btn.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsCreatingWeeklyReview(false)}
                      className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all flex-1 cursor-pointer"
                    >
                      Huỷ
                    </button>
                    <button
                      type="submit"
                      className="bg-[#0b0f19] text-white hover:bg-slate-800 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all flex-1 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Save className="w-4 h-4" /> Lưu Đánh Giá
                    </button>
                  </div>
                </div>

              </form>
            ) : (
              // List of completed reviews
              <div className="space-y-6">
                <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-display font-bold text-lg text-slate-900">Nhật ký đánh giá tuần</h3>
                    <p className="text-xs text-slate-500 mt-1">Mỗi tuần một lần: so sánh kế hoạch, hành động, kết quả và quyết định điều chỉnh.</p>
                  </div>
                  <button
                    onClick={() => setIsCreatingWeeklyReview(true)}
                    className="bg-[#0b0f19] hover:bg-slate-800 text-white rounded-xl px-5 py-2.5 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Đánh giá tuần này
                  </button>
                </div>

                <div className="space-y-4">
                  {state.weeklyReviews.length === 0 ? (
                    <div className="mx-auto max-w-lg space-y-4 rounded-[24px] border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
                      <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-150">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800">Chưa có bài review nào</h4>
                        <p className="text-xs text-slate-500">Kết thúc tuần, hãy dành 10 phút nhìn lại dữ liệu trước khi lập tuần mới.</p>
                      </div>
                      <button 
                        onClick={() => setIsCreatingWeeklyReview(true)}
                        className="bg-[#0b0f19] text-white text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer hover:bg-slate-800"
                      >
                        Bắt đầu viết
                      </button>
                    </div>
                  ) : (
                    state.weeklyReviews.map(rev => (
                      <div key={rev.id} className="space-y-5 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                          <div className="space-y-1">
                            <h4 className="font-display font-bold text-slate-900 text-base">Tuần {rev.weekNumber}</h4>
                            <span className="text-[10px] text-slate-400 font-mono">{formatDisplayDate(rev.startDate)} – {formatDisplayDate(rev.endDate)}</span>
                          </div>
                          <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full border ${
                            rev.status === 'continue' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            rev.status === 'adjust' ? "bg-amber-50 text-amber-700 border-amber-100" :
                            "bg-rose-50 text-rose-700 border-rose-100"
                          }`}>
                            Quyết định: {rev.status === 'continue' ? "Tiếp tục" : rev.status === 'adjust' ? "Điều chỉnh" : "Tạm dừng"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700 leading-relaxed">
                          <div className="space-y-1.5">
                            <span className="font-bold text-slate-900 block">🏆 Việc tốt nhất đã làm:</span>
                            <p className="bg-slate-50 border border-slate-100 p-3 rounded-xl italic">{rev.wins}</p>
                          </div>
                          <div className="space-y-1.5">
                            <span className="font-bold text-slate-900 block">⚠️ Khó khăn & Chưa hiệu quả:</span>
                            <p className="bg-slate-50 border border-slate-100 p-3 rounded-xl italic">{rev.problems}</p>
                          </div>
                          <div className="space-y-1.5">
                            <span className="font-bold text-slate-900 block">💡 Bài học rút ra:</span>
                            <p className="bg-slate-50 border border-slate-100 p-3 rounded-xl">{rev.lessons}</p>
                          </div>
                          <div className="space-y-1.5">
                            <span className="font-bold text-slate-900 block">🔄 Điều chỉnh thói quen kế hoạch tiếp:</span>
                            <p className="bg-slate-50 border border-slate-100 p-3 rounded-xl">{rev.adjustments}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* EXPERIMENTS TAB */}
        {activeReviewTab === 'experiments' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">Thiết lập Thử nghiệm Hành vi & Tối ưu hóa</h3>
                <p className="text-xs text-slate-500 mt-1">Chạy thử nghiệm tối ưu thói quen trong 2-3 tuần để tìm kiếm sự đột phá năng suất.</p>
              </div>
              <button
                onClick={() => setIsAddingExperiment(true)}
                className="bg-[#0b0f19] hover:bg-slate-800 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thử nghiệm mới
              </button>
            </div>

            {/* Add Experiment Form Modal Inline */}
            {isAddingExperiment && (
              <form onSubmit={handleSubmitExperiment} className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-900 text-sm">Thiết lập tham số thử nghiệm mới</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Thuộc mục tiêu</label>
                    <select
                      value={expForm.goalId}
                      onChange={e => setExpForm({ ...expForm, goalId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                    >
                      {state.goals.map(g => (
                        <option key={g.id} value={g.id}>{g.id} — {g.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Biến số thay đổi (Variable)</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: Đặt điện thoại ngoài phòng ngủ từ 11h đêm"
                      value={expForm.variable}
                      onChange={e => setExpForm({ ...expForm, variable: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Giả thuyết khoa học (Hypothesis)</label>
                  <textarea 
                    placeholder="Ví dụ: Nếu cất điện thoại ngoài phòng, chất lượng giấc ngủ sẽ tăng (ngủ đủ 7h) và thức dậy tràn đầy năng lượng..."
                    value={expForm.hypothesis}
                    onChange={e => setExpForm({ ...expForm, hypothesis: e.target.value })}
                    className="w-full h-16 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-850"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Chỉ số cốt lõi đo lường (Metric)</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: Giờ ngủ sâu"
                      value={expForm.mainMetric}
                      onChange={e => setExpForm({ ...expForm, mainMetric: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Ngày đánh giá lại</label>
                    <input 
                      type="date" 
                      value={expForm.reviewDate}
                      onChange={e => setExpForm({ ...expForm, reviewDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-850"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingExperiment(false)}
                    className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    className="bg-[#0b0f19] text-white hover:bg-slate-800 rounded-lg px-5 py-2 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Lưu Thử Nghiệm
                  </button>
                </div>
              </form>
            )}

            {/* Experiments list */}
            <div className="space-y-4">
              {state.experiments.length === 0 ? (
                <div className="space-y-3 rounded-[24px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
                  <FlaskConical className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400">Chưa thiết lập thử nghiệm hành vi nào.</p>
                </div>
              ) : (
                state.experiments.map(ex => (
                  <div key={ex.id} className="space-y-3.5 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">{ex.goalId}</span>
                        <span className="text-xs text-slate-400">Khởi chạy: {formatDisplayDate(ex.startDate)}</span>
                      </div>
                      <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase">
                        Đang thử nghiệm
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">GIẢ THUYẾT CHIẾN LƯỢC</span>
                      <p className="text-xs text-slate-800 font-semibold">{ex.hypothesis}</p>
                    </div>

                    <div className="text-xs text-slate-600 grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>Biến số thay thế: <strong className="text-slate-800">{ex.variable}</strong></div>
                      <div>Chỉ số kiểm chứng: <strong className="text-slate-800">{ex.mainMetric}</strong></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* DATABASE TAB */}
        {activeReviewTab === 'database' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Database backups & Seed */}
            <div className="space-y-6 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-display font-bold text-lg text-slate-900">Sao lưu & Đồng bộ Dữ liệu</h3>
                <p className="text-xs text-slate-500 mt-1">Xuất lưu dữ liệu thô dạng JSON để bảo mật dữ liệu thói quen trên máy cá nhân.</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleExportJSON}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left transition-all hover:border-indigo-200 hover:bg-white"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 block">Tải về sao lưu (.json)</span>
                    <span className="text-[10px] text-slate-400">Xuất toàn bộ goals, activities, thói quen và logs.</span>
                  </div>
                  <Download className="w-5 h-5 text-slate-400" />
                </button>

                <div className="relative flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left transition-all hover:border-indigo-200 hover:bg-white">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 block">Nhập sao lưu (.json)</span>
                    <span className="text-[10px] text-slate-400">Chọn tệp sao lưu đã lưu từ máy của bạn.</span>
                  </div>
                  <Upload className="w-5 h-5 text-slate-400" />
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Developer panel / seed */}
              <details className="group border-t border-slate-100 pt-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-800">
                  Công cụ nâng cao
                  <ChevronRight className="h-4 w-4 transition group-open:rotate-90" />
                </summary>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleSeedData}
                    className="mt-4 flex flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-center text-xs font-bold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin-slow text-indigo-500" />
                    Tải 14 Ngày Mẫu 🧬
                  </button>
                  <button 
                    onClick={handleResetData}
                    className="mt-4 flex flex-col items-center justify-center gap-1 rounded-2xl border border-rose-100 bg-rose-50/50 p-3.5 text-center text-xs font-bold text-rose-700 transition hover:border-rose-200 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    Xóa Hết Dữ Liệu 🚨
                  </button>
                </div>
              </details>
            </div>

            {/* Column 2: CSV Exports */}
            <div className="space-y-6 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-display font-bold text-lg text-slate-900">Xuất báo cáo dạng bảng (CSV)</h3>
                <p className="text-xs text-slate-500 mt-1">Chuyển dữ liệu Life OS sang Google Sheets hoặc Excel để phân tích nâng cao.</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleExportLeadsCSV}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-white"
                >
                  <span>Xuất danh sách B2B Leads (.csv)</span>
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={handleExportJobsCSV}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-white"
                >
                  <span>Xuất lịch sử Ứng tuyển CV (.csv)</span>
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={handleExportHealthCSV}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-white"
                >
                  <span>Xuất Logs Sức khỏe & Cân nặng (.csv)</span>
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* RECOMMENDATIONS TAB */}
        {activeReviewTab === 'recommendations' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="life-kicker mb-2 text-indigo-600">Lịch sử tư vấn</p>
                <h3 className="font-display text-lg font-extrabold text-slate-900">Những đề xuất bạn đã nhận</h3>
                <p className="mt-1 text-xs text-slate-500">Xem lại lời khuyên, bằng chứng và quyết định đã áp dụng — trước khi chuyển sang sao lưu dữ liệu.</p>
              </div>
              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[10px] font-black text-indigo-700">{(state.evidenceRecommendations || []).length} đề xuất</span>
            </div>

            <div className="space-y-4">
              {(state.evidenceRecommendations || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-12 text-center">
                  <History className="mx-auto h-6 w-6 text-slate-300" />
                  <p className="mt-3 text-xs font-semibold text-slate-500">Chưa có đề xuất nào trong lịch sử.</p>
                  <p className="mt-1 text-[10px] text-slate-400">Các lời khuyên đã lưu từ Life OS Coach sẽ xuất hiện tại đây.</p>
                </div>
              ) : (
                (state.evidenceRecommendations || []).map(rec => (
                  <div key={rec.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-xs transition hover:border-indigo-200 hover:bg-white">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-150">{rec.goalId}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        rec.status === 'accepted' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                        rec.status === 'rejected' ? "bg-rose-50 text-rose-700 border-rose-100" :
                        "bg-amber-50 text-amber-700 border-amber-100"
                      }`}>
                        {rec.status === 'accepted' ? "Đã áp dụng" : rec.status === 'rejected' ? "Đã từ chối" : "Đang cân nhắc"}
                      </span>
                    </div>
                    <div>
                      <strong className="text-slate-800 block mb-0.5">{rec.recommendedAction}</strong>
                      <p className="text-slate-500">{rec.reason}</p>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Khởi tạo ngày: {formatDisplayDate(rec.createdDate)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
