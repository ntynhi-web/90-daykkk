import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  X, ChevronLeft, ChevronRight, Check, ArrowUp, ArrowDown, Trash2, Plus, Sparkles,
  Briefcase, Megaphone, LineChart, Heart, User, GraduationCap, Wallet, Home, Repeat, FolderKanban, Target, Info
} from "lucide-react";
import { AppState, Goal, Milestone, GoalCategory, GoalIconName } from "../types";
import GoalIcon, { GOAL_ICON_MAP, COLOR_MAP } from "./GoalIcon";
import { JourneyPreset } from "./JourneyEmptyState";

interface JourneySetupWizardProps {
  state: AppState;
  onClose: () => void;
  onSave: (newGoal: Goal, initialPlan?: {
    firstTask?: string;
    habit?: string;
    scheduleTime?: string;
    duration?: number;
    notes?: string;
  }) => void;
  initialPreset?: JourneyPreset | null;
}

const CATEGORY_LIST: Array<{ id: GoalCategory; label: string; defaultIcon: GoalIconName; defaultColor: string }> = [
  { id: "business", label: "Kinh doanh", defaultIcon: "briefcase", defaultColor: "indigo" },
  { id: "marketing", label: "Marketing", defaultIcon: "megaphone", defaultColor: "blue" },
  { id: "fund_backtest", label: "Fund & Backtest", defaultIcon: "chart", defaultColor: "purple" },
  { id: "health", label: "Sức khỏe", defaultIcon: "heart", defaultColor: "rose" },
  { id: "career", label: "Sự nghiệp", defaultIcon: "career", defaultColor: "emerald" },
  { id: "learning", label: "Học tập", defaultIcon: "learning", defaultColor: "cyan" },
  { id: "finance", label: "Tài chính", defaultIcon: "finance", defaultColor: "amber" },
  { id: "home", label: "Gia đình", defaultIcon: "home", defaultColor: "pink" },
  { id: "habit", label: "Thói quen", defaultIcon: "habit", defaultColor: "blue" },
  { id: "project", label: "Dự án cá nhân", defaultIcon: "project", defaultColor: "indigo" },
  { id: "custom", label: "Khác", defaultIcon: "target", defaultColor: "purple" }
];

const SUGGESTED_MILESTONES: Record<GoalCategory, Array<{ title: string; targetValue: string; type: any }>> = {
  business: [
    { title: "Nghiên cứu thị trường & ICP", targetValue: "Hoàn thành", type: "completion" },
    { title: "Xây dựng Offer & Landing Page", targetValue: "Hoàn thành", type: "completion" },
    { title: "Tiếp cận 50 Leads đầu tiên", targetValue: "50 leads", type: "numeric" },
    { title: "Ký kết hợp đồng trả phí đầu tiên", targetValue: "1 khách hàng", type: "completion" }
  ],
  marketing: [
    { title: "Hoàn thiện kế hoạch nội dung", targetValue: "1 kế hoạch", type: "completion" },
    { title: "Thiết lập các kênh Social Media", targetValue: "3 kênh", type: "completion" },
    { title: "Đạt mốc 10,000 lượt tiếp cận", targetValue: "10,000 reach", type: "numeric" }
  ],
  fund_backtest: [
    { title: "Thiết lập hệ thống & Quản trị rủi ro", targetValue: "Hoàn thành", type: "completion" },
    { title: "Hoàn thành 50 backtests demo", targetValue: "50", type: "numeric" },
    { title: "Đạt mốc 100 backtests hoàn chỉnh", targetValue: "100", type: "numeric" }
  ],
  health: [
    { title: "Giảm cân chặng 1 về mốc 61kg", targetValue: "61 kg", type: "numeric" },
    { title: "Duy trì tập luyện thể chất 20 buổi", targetValue: "20 buổi", type: "repetition" },
    { title: "Đạt cân nặng mục tiêu 55kg", targetValue: "55 kg", type: "numeric" }
  ],
  career: [
    { title: "Cập nhật CV & Portfolio cá nhân", targetValue: "Hoàn thành", type: "completion" },
    { title: "Nộp hồ sơ ứng tuyển 10 công ty", targetValue: "10 công ty", type: "numeric" },
    { title: "Vượt qua vòng phỏng vấn chuyên môn", targetValue: "Nhận offer", type: "completion" }
  ],
  learning: [
    { title: "Hoàn thành 30% nội dung khóa học", targetValue: "30%", type: "numeric" },
    { title: "Đạt chứng chỉ hoàn thành học phần", targetValue: "1 chứng chỉ", type: "completion" },
    { title: "Thực hành dự án thực tế đầu tiên", targetValue: "1 dự án", type: "completion" }
  ],
  finance: [
    { title: "Lập ngân sách thu chi cá nhân", targetValue: "Xong file", type: "completion" },
    { title: "Tích lũy quỹ dự phòng khẩn cấp", targetValue: "10 triệu", type: "numeric" },
    { title: "Hoàn thành kế hoạch tiết kiệm quý", targetValue: "Đạt 100%", type: "completion" }
  ],
  home: [
    { title: "Dọn dẹp tổng thể nhà cửa (Declutter)", targetValue: "Gọn gàng", type: "completion" },
    { title: "Lắp đặt trang trí thêm góc làm việc", targetValue: "Đầy đủ", type: "completion" },
    { title: "Thiết lập lịch dọn dẹp hàng tuần", targetValue: "Ổn định", type: "completion" }
  ],
  habit: [
    { title: "Duy trì thói quen tuần đầu tiên", targetValue: "7 ngày liên tục", type: "repetition" },
    { title: "Duy trì thói quen tháng đầu tiên", targetValue: "30 ngày", type: "repetition" }
  ],
  project: [
    { title: "Phác thảo ý tưởng & Mockup", targetValue: "Hoàn thành", type: "completion" },
    { title: "Xây dựng phiên bản MVP đầu tiên", targetValue: "Chạy thử", type: "completion" },
    { title: "Ra mắt giới thiệu dự án", targetValue: "10 người dùng", type: "numeric" }
  ],
  custom: [
    { title: "Chặng xuất phát ban đầu", targetValue: "Đạt chỉ tiêu", type: "completion" },
    { title: "Về đích thành công rực rỡ", targetValue: "Đạt mốc", type: "completion" }
  ]
};

export default function JourneySetupWizard({ state, onClose, onSave, initialPreset }: JourneySetupWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [name, setName] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [category, setCategory] = useState<GoalCategory>("business");
  const [icon, setIcon] = useState<GoalIconName>("briefcase");
  const [accentColor, setAccentColor] = useState("indigo");

  const [startingValue, setStartingValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [finalTarget, setFinalTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [mainMetric, setMainMetric] = useState("");
  const [startDate, setStartDate] = useState(state.startDate || "2026-07-13");
  const [deadline, setDeadline] = useState(state.endDate || "2026-10-10");
  const [priority, setPriority] = useState<'highest' | 'secondary' | 'normal'>("normal");

  const [milestones, setMilestones] = useState<Milestone[]>([]);

  // Action plan states
  const [firstTask, setFirstTask] = useState("");
  const [habit, setHabit] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [duration, setDuration] = useState<number>(30);
  const [notes, setNotes] = useState("");

  // Validation feedback
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill if preset or initialPreset selected
  useEffect(() => {
    if (initialPreset) {
      setName(initialPreset.name);
      setDesiredOutcome(initialPreset.desiredOutcome);
      setCategory(initialPreset.category);
      setIcon(initialPreset.icon);
      setAccentColor(initialPreset.accentColor);
      setMainMetric(initialPreset.mainMetric);
      setNotes(initialPreset.notes);

      // Map preset milestones
      const mappedMilestones: Milestone[] = initialPreset.milestones.map((m, idx) => ({
        id: `mile_preset_${idx}_${Date.now()}`,
        title: m.title,
        targetValue: m.targetValue,
        currentValue: "Chưa đạt",
        achieved: false,
        dueDate: m.dueDate || state.endDate,
        type: "completion",
        status: idx === 0 ? "active" : "locked",
        order: idx
      }));
      setMilestones(mappedMilestones);
    } else {
      // Set suggested milestones for default "business" category
      triggerSuggestedMilestones("business");
    }
  }, [initialPreset]);

  // When category changes, auto recommend icon and suggest milestones
  const handleCategoryChange = (cat: GoalCategory) => {
    setCategory(cat);
    const config = CATEGORY_LIST.find(c => c.id === cat);
    if (config) {
      setIcon(config.defaultIcon);
      setAccentColor(config.defaultColor);
    }
    triggerSuggestedMilestones(cat);
  };

  const triggerSuggestedMilestones = (cat: GoalCategory) => {
    const suggestions = SUGGESTED_MILESTONES[cat] || SUGGESTED_MILESTONES["custom"];
    const mapped: Milestone[] = suggestions.map((s, idx) => ({
      id: `mile_suggested_${idx}_${Date.now()}`,
      title: s.title,
      targetValue: s.targetValue,
      currentValue: "Chưa đạt",
      achieved: false,
      dueDate: deadline,
      type: s.type,
      status: idx === 0 ? "active" : "locked",
      order: idx
    }));
    setMilestones(mapped);
  };

  // Milestone inline states
  const [tempTitle, setTempTitle] = useState("");
  const [tempTarget, setTempTarget] = useState("");
  const [tempUnit, setTempUnit] = useState("");
  const [tempType, setTempType] = useState<'numeric' | 'completion' | 'repetition' | 'date_based'>("completion");
  const [tempDueDate, setTempDueDate] = useState("");

  const handleAddMilestone = () => {
    if (!tempTitle.trim()) return;
    const newMile: Milestone = {
      id: `mile_user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: tempTitle,
      targetValue: tempTarget || "Đạt",
      currentValue: "Chưa đạt",
      achieved: false,
      dueDate: tempDueDate || deadline,
      type: tempType,
      unit: tempUnit || undefined,
      status: milestones.length === 0 ? "active" : "locked",
      order: milestones.length
    };
    setMilestones([...milestones, newMile]);
    setTempTitle("");
    setTempTarget("");
    setTempUnit("");
    setTempDueDate("");
  };

  const handleRemoveMilestone = (id: string) => {
    const filtered = milestones.filter(m => m.id !== id);
    // Recalculate orders and active states
    const updated = filtered.map((m, idx) => ({
      ...m,
      order: idx,
      status: idx === 0 ? ("active" as const) : ("locked" as const)
    }));
    setMilestones(updated);
  };

  const handleMoveMilestone = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === milestones.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...milestones];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    // Fix order property
    const final = updated.map((m, i) => ({
      ...m,
      order: i,
      status: i === 0 ? ("active" as const) : ("locked" as const)
    }));
    setMilestones(final);
  };

  // Validation
  const validateStep = (s: number): boolean => {
    const currentErrors: Record<string, string> = {};
    if (s === 1) {
      if (!name.trim()) currentErrors.name = "Vui lòng nhập tên hành trình.";
      if (!desiredOutcome.trim()) currentErrors.desiredOutcome = "Vui lòng mô tả kết quả 90 ngày mong muốn.";
    } else if (s === 2) {
      if (!finalTarget.trim()) currentErrors.finalTarget = "Vui lòng nhập đích đến cuối cùng.";
      if (!mainMetric.trim()) currentErrors.mainMetric = "Vui lòng nhập chỉ số đo lường chính.";
      if (!startDate) currentErrors.startDate = "Vui lòng chọn ngày bắt đầu.";
      if (!deadline) currentErrors.deadline = "Vui lòng chọn hạn chót.";
    }
    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step < 4) {
        setStep((step + 1) as any);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as any);
    }
  };

  const handleConfirmSave = () => {
    // Construct final Goal object
    const finalId = `G_custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const updatedMilestones = milestones.map(m => ({ ...m, goalId: finalId }));

    const newGoal: Goal = {
      id: finalId,
      name,
      desiredOutcome,
      description: desiredOutcome,
      category,
      icon,
      accentColor,
      priority,
      startDate,
      deadline,
      mainMetric,
      currentProgress: 0,
      currentMilestone: updatedMilestones[0]?.title || "",
      currentMilestoneId: updatedMilestones[0]?.id || null,
      status: "active",
      nextAction: firstTask || null,
      milestones: updatedMilestones,
      notes: notes || ""
    };

    onSave(newGoal, {
      firstTask: firstTask || undefined,
      habit: habit || undefined,
      scheduleTime: scheduleTime || undefined,
      duration: duration || undefined,
      notes: notes || undefined
    });
  };

  return (
    <div id="journey-setup-wizard" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex md:items-center justify-center p-0 md:p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="bg-white w-full md:max-w-3xl md:rounded-[24px] min-h-screen md:min-h-0 flex flex-col shadow-2xl overflow-hidden relative"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
              Bước {step}/4
            </span>
            <h3 className="font-display font-bold text-slate-900 text-lg mt-1">
              Tạo hành trình mới
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="h-1 bg-slate-100 w-full shrink-0">
          <div 
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-h-[calc(100vh-140px)] md:max-h-[70vh]">
          
          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h4 className="font-display font-extrabold text-xl text-slate-900">
                  Bạn muốn đạt được điều gì?
                </h4>
                <p className="text-xs text-slate-500">
                  Lập mục tiêu rõ ràng giúp bạn dễ dàng tập trung tối đa trong 90 ngày.
                </p>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Tên hành trình *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Xây dựng hệ thống Fund & Backtest"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors({ ...errors, name: "" });
                  }}
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 ${errors.name ? 'border-red-400' : 'border-slate-200'}`}
                />
                {errors.name && <p className="text-xs text-red-500 font-medium mt-1">{errors.name}</p>}
              </div>

              {/* Desired Outcome */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Kết quả mong muốn sau 90 ngày *</label>
                <textarea
                  placeholder="Ví dụ: Hoàn thành 100 backtest và xây dựng bộ quy tắc giao dịch có tỷ lệ R/R ổn định."
                  value={desiredOutcome}
                  onChange={(e) => {
                    setDesiredOutcome(e.target.value);
                    if (errors.desiredOutcome) setErrors({ ...errors, desiredOutcome: "" });
                  }}
                  className={`w-full h-24 bg-slate-50 border rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 ${errors.desiredOutcome ? 'border-red-400' : 'border-slate-200'}`}
                />
                {errors.desiredOutcome && <p className="text-xs text-red-500 font-medium mt-1">{errors.desiredOutcome}</p>}
              </div>

              {/* Category selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Chủ đề hành trình</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {CATEGORY_LIST.map((catItem) => {
                    const isSelected = category === catItem.id;
                    return (
                      <div
                        key={catItem.id}
                        onClick={() => handleCategoryChange(catItem.id)}
                        className={`p-3 border rounded-xl flex items-center gap-2.5 cursor-pointer transition-all ${
                          isSelected 
                            ? "bg-indigo-50/50 border-indigo-400 text-indigo-700 shadow-3xs" 
                            : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                        }`}
                      >
                        <GoalIcon icon={catItem.defaultIcon} color={catItem.defaultColor} size={14} className="p-1.5" />
                        <span className="text-xs font-bold">{catItem.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Icon & Color selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {/* Icon picker */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">Biểu tượng</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-[120px] overflow-y-auto">
                    {Object.keys(GOAL_ICON_MAP).map((iconKey) => {
                      const isIconSelected = icon === iconKey;
                      const IconComponent = GOAL_ICON_MAP[iconKey];
                      return (
                        <div
                          key={iconKey}
                          onClick={() => setIcon(iconKey as GoalIconName)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border transition-all ${
                            isIconSelected
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-600"
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Color picker */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">Màu nhận diện</label>
                  <div className="flex flex-wrap gap-3.5 p-4 bg-slate-50 rounded-xl border border-slate-200 justify-start items-center">
                    {Object.keys(COLOR_MAP).map((colorKey) => {
                      const isColorSelected = accentColor === colorKey;
                      const colors = COLOR_MAP[colorKey];
                      return (
                        <div
                          key={colorKey}
                          onClick={() => setAccentColor(colorKey)}
                          className={`w-7 h-7 rounded-full cursor-pointer flex items-center justify-center border-2 transition-all hover:scale-105`}
                          style={{ 
                            backgroundColor: colors.rawHex,
                            borderColor: isColorSelected ? "#0F172A" : "transparent"
                          }}
                        >
                          {isColorSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: START AND TARGET */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h4 className="font-display font-extrabold text-xl text-slate-900">
                  Điểm bắt đầu và đích đến
                </h4>
                <p className="text-xs text-slate-500">
                  Định lượng các thông số để việc đo lường tiến độ đạt kết quả cao nhất.
                </p>
              </div>

              {/* Start, current and Final target */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Điểm bắt đầu (Bắt đầu - Tùy chọn)</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 0"
                    value={startingValue}
                    onChange={(e) => setStartingValue(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4.5 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Giá trị hiện tại (Tùy chọn)</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 0"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4.5 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Đích đến cuối cùng *</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 100"
                    value={finalTarget}
                    onChange={(e) => {
                      setFinalTarget(e.target.value);
                      if (errors.finalTarget) setErrors({ ...errors, finalTarget: "" });
                    }}
                    className={`w-full bg-slate-50 border rounded-xl px-4.5 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 ${errors.finalTarget ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {errors.finalTarget && <p className="text-xs text-red-500 font-medium mt-1">{errors.finalTarget}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Đơn vị đo lường (Tùy chọn)</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: backtest, kg, khách hàng"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4.5 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Chỉ số đo lường chính *</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Số bài test thành công"
                    value={mainMetric}
                    onChange={(e) => {
                      setMainMetric(e.target.value);
                      if (errors.mainMetric) setErrors({ ...errors, mainMetric: "" });
                    }}
                    className={`w-full bg-slate-50 border rounded-xl px-4.5 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 ${errors.mainMetric ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {errors.mainMetric && <p className="text-xs text-red-500 font-medium mt-1">{errors.mainMetric}</p>}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Ngày bắt đầu *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (errors.startDate) setErrors({ ...errors, startDate: "" });
                    }}
                    className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 ${errors.startDate ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {errors.startDate && <p className="text-xs text-red-500 font-medium mt-1">{errors.startDate}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Hạn chót *</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => {
                      setDeadline(e.target.value);
                      if (errors.deadline) setErrors({ ...errors, deadline: "" });
                    }}
                    className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 ${errors.deadline ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {errors.deadline && <p className="text-xs text-red-500 font-medium mt-1">{errors.deadline}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Độ ưu tiên hành trình</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                  >
                    <option value="highest">Ưu tiên cao nhất (highest)</option>
                    <option value="secondary">Ưu tiên phụ (secondary)</option>
                    <option value="normal">Ưu tiên thường (normal)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: MILESTONES */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h4 className="font-display font-extrabold text-xl text-slate-900">
                  Chia thành những chặng nhỏ (Cột mốc)
                </h4>
                <p className="text-xs text-slate-500">
                  Phân chia mục tiêu lớn thành các chặng nhỏ có hạn chót để theo sát tiến độ.
                </p>
              </div>

              {/* Add milestone inline card */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-[18px] space-y-4">
                <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-indigo-600" /> Thêm cột mốc mới
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 block">Tên cột mốc</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Đạt 10 backtests đầu tiên"
                      value={tempTitle}
                      onChange={(e) => setTempTitle(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 block">Chỉ tiêu đích đến</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 10"
                      value={tempTarget}
                      onChange={(e) => setTempTarget(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 block">Loại hình cột mốc</label>
                    <select
                      value={tempType}
                      onChange={(e: any) => setTempType(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="completion">Hoàn thành (Completion)</option>
                      <option value="numeric">Định lượng số (Numeric)</option>
                      <option value="repetition">Thói quen lặp lại (Repetition)</option>
                      <option value="date_based">Dựa trên ngày (Date-based)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 block">Đơn vị (Không bắt buộc)</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: backtest, kg"
                      value={tempUnit}
                      onChange={(e) => setTempUnit(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 block">Hạn hoàn thành</label>
                    <input
                      type="date"
                      value={tempDueDate}
                      onChange={(e) => setTempDueDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Thêm chặng
                  </button>
                </div>
              </div>

              {/* Milestones list with reorder */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">HÀNH TRÌNH CỘT MỐC CỦA BẠN</span>
                {milestones.length === 0 ? (
                  <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                    Chưa có chặng nào. Bạn có thể tự thêm ở trên.
                  </div>
                ) : (
                  <div className="relative border-l-2 border-indigo-100 pl-6 ml-4 space-y-4">
                    {milestones.map((mile, idx) => (
                      <div key={mile.id} className="relative group bg-white border border-slate-150 p-4 rounded-xl shadow-3xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        {/* Bullet indicator */}
                        <div className="absolute -left-[31px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-indigo-500 bg-white flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase">Chặng {idx + 1}</span>
                            <span className="text-[9px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">{mile.type}</span>
                          </div>
                          <h5 className="font-bold text-sm text-slate-900">{mile.title}</h5>
                          <p className="text-xs text-slate-500">Chỉ tiêu: <strong className="text-slate-700">{mile.targetValue} {mile.unit || ""}</strong> | Hạn: {mile.dueDate}</p>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveMilestone(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded border border-slate-200 disabled:opacity-30 disabled:pointer-events-none"
                            title="Di chuyển lên"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveMilestone(idx, 'down')}
                            disabled={idx === milestones.length - 1}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded border border-slate-200 disabled:opacity-30 disabled:pointer-events-none"
                            title="Di chuyển xuống"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveMilestone(mile.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-slate-200"
                            title="Xóa cột mốc"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: ACTION PLAN & CONFIRMATION */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h4 className="font-display font-extrabold text-xl text-slate-900">
                  Lập kế hoạch hành động & Xác nhận
                </h4>
                <p className="text-xs text-slate-500">
                  Thiết lập các hành động nhỏ và xem lại tổng quan trước khi khởi chạy.
                </p>
              </div>

              {/* Action plan inputs */}
              <div className="p-5 bg-indigo-50/20 border border-indigo-100 rounded-2xl space-y-4">
                <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" /> ĐỊNH HƯỚNG BAN ĐẦU (TÙY CHỌN)
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Việc quan trọng đầu tiên</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Cài đặt công cụ và soạn thảo 5 emails đầu tiên"
                      value={firstTask}
                      onChange={(e) => setFirstTask(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500/25"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Thói quen nhỏ nhất cần duy trì</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Gửi ít nhất 1 email tiếp cận mỗi ngày"
                      value={habit}
                      onChange={(e) => setHabit(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500/25"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Lịch thực hiện ưa thích</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Thời lượng dự kiến (phút)</label>
                    <input
                      type="number"
                      min="5"
                      max="480"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4.5 py-2.5 text-xs text-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Ghi chú bổ sung</label>
                    <input
                      type="text"
                      placeholder="Lưu ý quan trọng..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* FINAL SUMMARY PREVIEW */}
              <div className="p-5 border border-slate-200 rounded-2xl space-y-4 bg-white">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">BẢN TỔNG QUAN HÀNH TRÌNH</span>
                
                <div className="flex items-start gap-4">
                  <GoalIcon icon={icon} color={accentColor} size={24} className="p-3 bg-slate-50 border-slate-200" />
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                        {CATEGORY_LIST.find(c => c.id === category)?.label || category}
                      </span>
                      <span className="text-xs font-bold text-slate-400 font-mono">Độ ưu tiên: {priority}</span>
                    </div>
                    <h4 className="font-display font-black text-slate-900 text-lg">{name || "Chưa đặt tên"}</h4>
                    <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed italic">
                      &ldquo;{desiredOutcome || "Chưa thiết lập mô tả kết quả mong muốn."}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Milestone summary row */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">LỘ TRÌNH CỘT MỐC ({milestones.length})</span>
                  {milestones.length === 0 ? (
                    <p className="text-xs text-slate-400">Chưa có cột mốc.</p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {milestones.map((mile, i) => (
                        <React.Fragment key={mile.id}>
                          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <span className="w-4 h-4 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-[9px] font-bold">{i+1}</span>
                            {mile.title} ({mile.targetValue})
                          </div>
                          {i < milestones.length - 1 && <span className="text-slate-300 text-xs">&rarr;</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Items Summary */}
                {(firstTask || habit || notes) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs">
                    {firstTask && (
                      <div className="space-y-0.5">
                        <strong className="text-slate-500 block uppercase text-[9px]">Việc quan trọng đầu tiên:</strong>
                        <span className="text-slate-800 font-medium">{firstTask}</span>
                      </div>
                    )}
                    {habit && (
                      <div className="space-y-0.5">
                        <strong className="text-slate-500 block uppercase text-[9px]">Thói quen tối thiểu cần duy trì:</strong>
                        <span className="text-slate-800 font-medium">{habit}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Sticky Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="border border-slate-200 bg-white hover:bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" /> Quay lại
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2.5 text-xs font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
            >
              Tiếp tục <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 py-2.5 text-xs font-extrabold flex items-center gap-1 shadow-md hover:shadow-lg cursor-pointer"
            >
              Tạo hành trình
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
