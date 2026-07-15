import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Download, Upload, RefreshCw, Trash2, Plus, Sparkles, CheckCircle2, FlaskConical, AlertTriangle, HelpCircle, Save, Check, FileSpreadsheet, Layers, Play
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

  // Daily review form state
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

  // Submit Daily Review
  const handleSubmitWeeklyReview = (e: React.FormEvent) => {
    e.preventDefault();
    const nextDayNumber = state.weeklyReviews.length + 1;

    const newReview: WeeklyReview = {
      id: `rev_${Date.now()}`,
      weekNumber: nextDayNumber,
      startDate: weeklyForm.date,
      endDate: weeklyForm.date,
      planned: weeklyForm.planned,
      actual: weeklyForm.actual,
      wins: weeklyForm.wins,
      problems: weeklyForm.problems,
      lessons: weeklyForm.lessons,
      adjustments: weeklyForm.adjustments,
      status: weeklyForm.status,
      timeAllocation: state.goals.reduce((acc, g) => ({ ...acc, [g.id]: Math.round(100 / (state.goals.length || 1)) }), {}),
      outputs: {},
      outcomes: {},
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

    alert("Ghi nhận đánh giá thành công! Hệ điều hành đã cập nhật kế hoạch hành động chiến lược.");
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
    <div id="review-view" className="space-y-8">
      
      {/* Title Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display font-extrabold text-3xl text-[#0b0f19] tracking-tight">Đánh Giá & Chiến Lược</h2>
          <p className="text-sm text-slate-500 max-w-xl">
            Rà soát năng suất, tối ưu hóa các thói quen cốt lõi và chạy thử nghiệm.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-[#f1f5f9] p-1 rounded-xl border border-slate-200 shrink-0">
          {(['review', 'experiments', 'database', 'recommendations'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveReviewTab(tab)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeReviewTab === tab 
                  ? "bg-white text-[#0b0f19] shadow-xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab === 'review' ? "Review Ngày" :
               tab === 'experiments' ? "Thử nghiệm" :
               tab === 'database' ? "Dữ liệu & Sao lưu" : "Lịch sử Đề xuất"}
            </button>
          ))}
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
                <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-[24px] p-6 md:p-8 space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <span className="text-[10px] font-bold text-[#4648d4] uppercase tracking-wider block">PHẢN TƯ ĐỊNH TÍNH</span>
                    <h3 className="font-display font-bold text-lg text-slate-900 mt-1">Viết Review Tầm Nhìn Ngày</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Thành thực với chính mình là chìa khóa của sự tiến bộ bền vững.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Ngày đánh giá</label>
                      <input 
                        type="date" 
                        value={weeklyForm.date}
                        onChange={e => setWeeklyForm({ ...weeklyForm, date: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:ring-1 focus:ring-indigo-500/25"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">1. Điều gì đã làm tốt nhất hôm nay? (What went well)</label>
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
                      <label className="text-[10px] font-bold text-slate-500 uppercase">5. Đề xuất điều chỉnh thói quen ngày mai (Proposed adjustments)</label>
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
                <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-6">
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
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-center">
                  <div>
                    <h3 className="font-display font-bold text-lg text-slate-900">Nhật ký Đánh giá Tầm nhìn</h3>
                    <p className="text-xs text-slate-500 mt-1">Lưu trữ các đánh giá và quyết định điều chỉnh thói quen qua từng chu kỳ.</p>
                  </div>
                  <button
                    onClick={() => setIsCreatingWeeklyReview(true)}
                    className="bg-[#0b0f19] hover:bg-slate-800 text-white rounded-xl px-5 py-2.5 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Viết Review mới
                  </button>
                </div>

                <div className="space-y-4">
                  {state.weeklyReviews.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4 shadow-xs max-w-lg mx-auto">
                      <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-150">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800">Chưa có bài review nào</h4>
                        <p className="text-xs text-slate-500">Hãy bắt đầu viết bài đánh giá ngày hôm nay để ghi lại tiến trình kỷ luật.</p>
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
                      <div key={rev.id} className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 space-y-5 shadow-xs">
                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                          <div className="space-y-1">
                            <h4 className="font-display font-bold text-slate-900 text-base">Đánh giá ngày thứ #{rev.weekNumber}</h4>
                            <span className="text-[10px] text-slate-400 font-mono">Thời gian ghi nhận: {formatDisplayDate(rev.startDate)}</span>
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
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-center">
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
              <form onSubmit={handleSubmitExperiment} className="bg-white border border-slate-200/80 rounded-[24px] p-6 space-y-4 shadow-sm">
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
                <div className="bg-white border border-slate-200/80 rounded-[24px] p-10 text-center space-y-3">
                  <FlaskConical className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400">Chưa thiết lập thử nghiệm hành vi nào.</p>
                </div>
              ) : (
                state.experiments.map(ex => (
                  <div key={ex.id} className="bg-white border border-slate-200 rounded-[24px] p-6 space-y-3.5 shadow-xs">
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
            <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 md:p-8 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-display font-bold text-lg text-slate-900">Sao lưu & Đồng bộ Dữ liệu</h3>
                <p className="text-xs text-slate-500 mt-1">Xuất lưu dữ liệu thô dạng JSON để bảo mật dữ liệu thói quen trên máy cá nhân.</p>
              </div>

              <div className="space-y-3.5">
                <button
                  onClick={handleExportJSON}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl p-4 text-left flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 block">Tải về sao lưu (.json)</span>
                    <span className="text-[10px] text-slate-400">Xuất toàn bộ goals, activities, thói quen và logs.</span>
                  </div>
                  <Download className="w-5 h-5 text-slate-400" />
                </button>

                <div className="relative w-full bg-[#f8fafc] border border-slate-200 rounded-xl p-4 text-left flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer">
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
              <div className="pt-6 border-t border-slate-150 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Bảng điều khiển Nhà phát triển</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleSeedData}
                    className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs p-3.5 rounded-xl hover:bg-indigo-100 transition-all cursor-pointer text-center flex flex-col justify-center items-center gap-1 shadow-3xs"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin-slow text-indigo-500" />
                    Tải 14 Ngày Mẫu 🧬
                  </button>
                  <button 
                    onClick={handleResetData}
                    className="bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs p-3.5 rounded-xl hover:bg-rose-100 transition-all cursor-pointer text-center flex flex-col justify-center items-center gap-1 shadow-3xs"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    Xóa Hết Dữ Liệu 🚨
                  </button>
                </div>
              </div>
            </div>

            {/* Column 2: CSV Exports */}
            <div className="bg-white border border-slate-200/80 rounded-[24px] p-6 md:p-8 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-display font-bold text-lg text-slate-900">Xuất báo cáo dạng bảng (CSV)</h3>
                <p className="text-xs text-slate-500 mt-1">Chuyển dữ liệu Life OS sang Google Sheets hoặc Excel để phân tích nâng cao.</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleExportLeadsCSV}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl p-3.5 text-left flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer text-xs font-bold text-slate-700"
                >
                  <span>Xuất danh sách B2B Leads (.csv)</span>
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={handleExportJobsCSV}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl p-3.5 text-left flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer text-xs font-bold text-slate-700"
                >
                  <span>Xuất lịch sử Ứng tuyển CV (.csv)</span>
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={handleExportHealthCSV}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl p-3.5 text-left flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer text-xs font-bold text-slate-700"
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
            className="bg-white border border-slate-200/80 rounded-[24px] p-6 md:p-8 space-y-6"
          >
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900">Nhật ký Đề xuất từ Động cơ AI (Evidence-Based Logs)</h3>
              <p className="text-xs text-slate-500 mt-1">Lưu trữ toàn bộ các đề xuất tối ưu thói quen dựa trên nguyên lý khoa học và thực trạng năng lượng.</p>
            </div>

            <div className="space-y-4">
              {(state.evidenceRecommendations || []).length === 0 ? (
                <p className="text-xs text-slate-400 py-10 text-center">Chưa có đề xuất nào được lưu trữ trong lịch sử.</p>
              ) : (
                (state.evidenceRecommendations || []).map(rec => (
                  <div key={rec.id} className="p-4 bg-[#f8fafc] border border-slate-200 rounded-xl space-y-2 text-xs">
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
