import { AppState, Goal, Routine, ActivityEntry, B2BLead, JobApplication, HealthRecord, LifestyleRecord, BatchTestRecord, Experiment, WeeklyReview, Recommendation, Chore, ScheduleItem } from "./types";

// Helper to format Date to YYYY-MM-DD
export function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Helper to format Date for Vietnamese display: DD/MM/YYYY
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function isScheduleValidForDate(item: ScheduleItem): boolean {
  const weekday = new Date(`${item.date}T12:00:00`).getDay();
  const rules: Array<[string, number[]]> = [
    ["confirmed_office_prep_", [1, 3, 5]], ["confirmed_office_", [1, 3, 5]],
    ["confirmed_wfh_", [2, 4]], ["confirmed_yoga_mon_", [1]], ["confirmed_yoga_evening_", [2, 4]],
    ["confirmed_fund_mon_open_", [1]], ["confirmed_fund_mwf_", [1, 3, 5]], ["confirmed_fund_tt_", [2, 4]],
    ["confirmed_b2b_career_", [1, 3, 5]], ["confirmed_home_reset_office_", [1, 3, 5]],
    ["confirmed_home_reset_home_", [2, 4]], ["confirmed_laundry_tue_", [2]], ["confirmed_laundry_sat_", [6]],
    ["confirmed_cooking_tt_", [2, 4]], ["confirmed_cooking_sat_", [6]], ["confirmed_home_clean_", [0, 2]],
    ["confirmed_shopping_", [4]], ["confirmed_market_", [6]], ["confirmed_haircare_", [0, 1, 3, 5]],
    ["confirmed_skincare_pm_", [0, 1, 2, 3, 4, 5, 6]], ["confirmed_sleep_", [0, 1, 2, 3, 4, 5, 6]],
    ["rainy_", [6]], ["fund_weekly_", [6]]
  ];
  const rule = rules.find(([prefix]) => item.id.startsWith(prefix));
  return !rule || rule[1].includes(weekday);
}

export const getPersonalFixedSchedule = (startDate: string, endDate: string): ScheduleItem[] => {
  const templates = [
    { key: 'office', title: 'Đi làm tại công ty', days: [1, 3, 5], startTime: '08:00', endTime: '18:00', type: 'personal' as const, notes: 'Khung làm việc cố định; cho phép tối đa 2 việc phát sinh có xác nhận.' },
    { key: 'home', title: 'Làm việc tại nhà', days: [2, 4], startTime: '09:00', endTime: '17:30', type: 'personal' as const, notes: 'Khung làm việc cố định tại nhà; có thể chỉnh lại giờ trong Lịch biểu.' },
    { key: 'cat_bath', title: 'Tắm cho 2 mèo', days: [6], startTime: '10:00', endTime: '11:00', type: 'habit' as const, notes: 'Thực hiện mỗi thứ Bảy.' }
  ];
  const result: ScheduleItem[] = [];
  for (let cursor = startDate; cursor <= endDate;) {
    const weekday = new Date(`${cursor}T12:00:00`).getDay();
    templates.forEach(template => {
      if (template.days.includes(weekday)) result.push({
        id: `fixed_${template.key}_${cursor}`,
        title: template.title,
        date: cursor,
        startTime: template.startTime,
        endTime: template.endTime,
        estimatedMinutes: (() => {
          const [sh, sm] = template.startTime.split(':').map(Number);
          const [eh, em] = template.endTime.split(':').map(Number);
          return (eh * 60 + em) - (sh * 60 + sm);
        })(),
        goalId: null,
        journeyId: null,
        type: template.type,
        locked: template.key === 'office' || template.key === 'home',
        lockedCapacity: template.key === 'office' || template.key === 'home' ? 2 : undefined,
        notes: template.notes,
        completed: false
      });
    });
    const date = new Date(`${cursor}T12:00:00`);
    date.setDate(date.getDate() + 1);
    cursor = formatDateStr(date);
  }
  return result;
};

// Automatically calculate end date based on a 90-day cycle
export function calculateEndDate(startDateStr: string): string {
  try {
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return "";
    const end = new Date(start.getTime() + (89 * 24 * 60 * 60 * 1000)); // 90 days total including start date
    return formatDateStr(end);
  } catch {
    return "";
  }
}

// Calculate current day index and days remaining
export function getCycleStats(startDateStr: string, currentDateStr: string, endDateStr?: string): { currentDay: number; daysRemaining: number; totalDays: number } {
  try {
    const start = new Date(startDateStr);
    const current = new Date(currentDateStr);
    
    // Normalize times to midnight for accurate day calculations
    start.setHours(0,0,0,0);
    current.setHours(0,0,0,0);
    
    const end = endDateStr ? new Date(endDateStr) : new Date(start.getTime() + (89 * 24 * 60 * 60 * 1000));
    end.setHours(0,0,0,0);
    const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    const diffTime = current.getTime() - start.getTime();
    const currentDay = current < start ? 0 : Math.floor(diffTime / (24 * 60 * 60 * 1000)) + 1;
    const daysRemaining = Math.max(0, totalDays - currentDay);
    
    return {
      currentDay: Math.min(totalDays, currentDay),
      daysRemaining,
      totalDays
    };
  } catch {
    return { currentDay: 0, daysRemaining: 90, totalDays: 90 };
  }
}

// Get Default App State
export function getDefaultAppState(): AppState {
  const startDate = formatDateStr(new Date());
  const endDate = calculateEndDate(startDate);

  const dateAfter = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return formatDateStr(date);
  };

  const goals: Goal[] = [
    {
      id: "G1",
      name: "Fund & Backtest",
      desiredOutcome: "Xây dựng một hệ thống backtest có kỷ luật, hoàn thành 100 mẫu thử trước khi đánh giá thử thách quỹ.",
      priority: "highest",
      deadline: endDate,
      mainMetric: "Số backtest & mức tuân thủ checklist",
      currentProgress: 0,
      currentMilestone: "Hoàn thiện Setup 1 và backtest mẫu đầu tiên",
      status: "active",
      nextAction: "Viết checklist Setup 1 và hoàn thành backtest đầu tiên",
      accentColor: "purple",
      category: "fund_backtest",
      icon: "chart",
      notes: "Ưu tiên quy trình, quản trị rủi ro và chất lượng dữ liệu; không khuyến khích giao dịch mạo hiểm.",
      milestones: [
        { id: "m1_1", title: "Hoàn thiện Setup 1", targetValue: "Checklist hoàn chỉnh", currentValue: "Chưa bắt đầu", achieved: false, dueDate: dateAfter(7) },
        { id: "m1_2", title: "Backtest đầu tiên", targetValue: "1 backtest", currentValue: "0", achieved: false, dueDate: dateAfter(10) },
        { id: "m1_3", title: "Xác nhận tính nhất quán", targetValue: "10 backtests", currentValue: "0", achieved: false, dueDate: dateAfter(25) },
        { id: "m1_4", title: "Mở rộng bộ dữ liệu", targetValue: "50 backtests", currentValue: "0", achieved: false, dueDate: dateAfter(55) },
        { id: "m1_5", title: "Hoàn thành vòng đánh giá", targetValue: "100 backtests", currentValue: "0", achieved: false, dueDate: dateAfter(85) }
      ]
    },
    {
      id: "G2",
      name: "B2B Marketing",
      desiredOutcome: "Xây dựng hiện diện B2B rõ ràng và tạo được khách hàng pilot hoặc khách hàng trả phí đầu tiên.",
      priority: "secondary",
      deadline: endDate,
      mainMetric: "Tài sản marketing, leads & khách hàng",
      currentProgress: 0,
      currentMilestone: "Hoàn thiện website giới thiệu dịch vụ",
      status: "active",
      nextAction: "Viết nội dung trang chủ và lời đề nghị giá trị",
      accentColor: "emerald",
      category: "business",
      icon: "briefcase",
      notes: "Tập trung vào một phân khúc khách hàng và một lời đề nghị có thể kiểm chứng.",
      milestones: [
        { id: "m2_1", title: "Website", targetValue: "Website xuất bản", currentValue: "Chưa bắt đầu", achieved: false, dueDate: dateAfter(14) },
        { id: "m2_2", title: "Social", targetValue: "3 kênh được chuẩn hóa", currentValue: "0", achieved: false, dueDate: dateAfter(28) },
        { id: "m2_3", title: "Portfolio", targetValue: "3 case study", currentValue: "0", achieved: false, dueDate: dateAfter(42) },
        { id: "m2_4", title: "Outreach", targetValue: "50 leads phù hợp", currentValue: "0", achieved: false, dueDate: dateAfter(65) },
        { id: "m2_5", title: "Khách hàng đầu tiên", targetValue: "1 khách hàng", currentValue: "0", achieved: false, dueDate: dateAfter(85) }
      ]
    },
    {
      id: "G3",
      name: "Health & Beauty",
      desiredOutcome: "Cải thiện sức khỏe, vóc dáng, giảm cân từ 64,5 kg về 54 kg một cách an toàn.",
      priority: "normal",
      deadline: endDate,
      mainMetric: "Cân nặng (kg) & Số bước chân",
      currentProgress: 10,
      currentMilestone: "Giảm từ 64,5 kg xuống 62 kg an toàn",
      status: "active",
      nextAction: "Chuẩn bị bữa ăn lành mạnh cho ngày mai và skincare tối",
      accentColor: "rose",
      category: "health",
      icon: "heart",
      notes: "Không ép cân cực đoan. Lắng nghe cơ thể, nếu chóng mặt mệt mỏi kéo dài cần điều chỉnh ngay.",
      milestones: [
        { id: "m3_1", title: "Mốc 62 kg", targetValue: "62 kg", currentValue: "64,5 kg", achieved: false, dueDate: dateAfter(20) },
        { id: "m3_2", title: "Mốc 60 kg", targetValue: "60 kg", currentValue: "64,5 kg", achieved: false, dueDate: dateAfter(40) },
        { id: "m3_3", title: "Mốc 58 kg", targetValue: "58 kg", currentValue: "64,5 kg", achieved: false, dueDate: dateAfter(60) },
        { id: "m3_4", title: "Mốc 56 kg", targetValue: "56 kg", currentValue: "64,5 kg", achieved: false, dueDate: dateAfter(78) },
        { id: "m3_5", title: "Mục tiêu 54 kg", targetValue: "54 kg", currentValue: "64,5 kg", achieved: false, dueDate: dateAfter(89) }
      ]
    }
  ];

  const routines: Routine[] = [
    { id: "r1", goalId: "G1", name: "Backtest có checklist", frequency: "Hàng ngày", minimumDay: "Hoàn thành 1 backtest", target: "Hoàn thành 3 backtests chất lượng", evidence: "Số backtest và checklist", status: "pending" },
    { id: "r2", goalId: "G1", name: "Trading Journal", frequency: "Hàng ngày", minimumDay: "Ghi 1 bài học", target: "Ghi đầy đủ setup, rủi ro và kết quả", evidence: "Nhật ký đã lưu", status: "pending" },
    { id: "r3", goalId: "G2", name: "Deep work B2B", frequency: "Hàng ngày", minimumDay: "Tập trung 30 phút", target: "Tập trung 90 phút", evidence: "Số phút deep work", status: "pending" },
    { id: "r4", goalId: "G2", name: "B2B Outreach", frequency: "Hàng ngày", minimumDay: "Liên hệ 1 lead", target: "Liên hệ 5 leads phù hợp", evidence: "Số leads đã liên hệ", status: "pending" },
    { id: "r5", goalId: "G3", name: "Giấc ngủ phục hồi", frequency: "Hàng ngày", minimumDay: "Ngủ trước 00:00", target: "Ngủ đủ 7-8 tiếng", evidence: "Số giờ ngủ", status: "pending" },
    { id: "r6", goalId: "G3", name: "Đi bộ vận động", frequency: "Ngày không tập yoga hoặc dọn nhà nặng", minimumDay: "Đi bộ 15 phút", target: "Đi bộ 30 phút", evidence: "Số phút hoặc số bước", status: "pending", substitutionGroup: "movement" },
    { id: "r8", goalId: "G3", name: "Yoga", frequency: "3 buổi/tuần · T2, T3, T5", minimumDay: "Tập yoga 15 phút", target: "Hoàn thành buổi yoga theo lịch", evidence: "Số phút tập", status: "pending", scheduleDays: [1, 2, 4], timeOfDay: "any", substitutionGroup: "movement" },
    { id: "r7", goalId: "G3", name: "Health & Beauty routine", frequency: "Hàng ngày", minimumDay: "Rửa mặt và uống đủ nước", target: "Ăn đúng kế hoạch và skincare sáng/tối", evidence: "Checklist hoàn thành", status: "pending" }
  ];

  const lifeAnchors = [
    {
      id: "anchor_cats",
      title: "Chăm sóc và yêu thương hai bé mèo",
      description: "Cho ăn, quan sát sức khỏe và dành thời gian kết nối.",
      icon: "cat" as const,
      frequency: "daily" as const,
      lastCompletedDate: null,
      active: true
    },
    {
      id: "anchor_spiritual",
      title: "Khoảng lặng tinh thần",
      description: "Thắp nhang và dành vài phút tĩnh tâm.",
      icon: "spiritual" as const,
      frequency: "daily" as const,
      lastCompletedDate: null,
      active: true
    }
  ];

  const chores: Chore[] = [
    {
      id: "chore_cat_litter",
      title: "Dọn khay cát cho mèo",
      category: "pet",
      frequency: "daily",
      dueDate: startDate,
      dueTime: "20:00",
      completed: false,
      lastCompletedDate: null,
      createdAt: new Date().toISOString()
    },
    {
      id: "chore_bathe_two_cats",
      title: "Tắm cho 2 mèo",
      category: "pet",
      frequency: "weekly",
      dueDate: startDate,
      dueTime: "10:00",
      completed: false,
      lastCompletedDate: null,
      notes: "Mỗi thứ Bảy, 10:00–11:00.",
      createdAt: new Date().toISOString()
    },
    {
      id: "chore_buy_body_wash",
      title: "Mua sữa tắm",
      category: "errand",
      frequency: "one_time",
      dueDate: startDate,
      completed: false,
      lastCompletedDate: null,
      createdAt: new Date().toISOString()
    }
  ];

  return {
    startDate,
    endDate,
    personalScheduleSeedVersion: 3,
    weeklyFocusGoalId: "G1",
    weeklySupportGoalIds: ["G2", "G3"],
    onboardingCompleted: false,
    activeFocusSession: null,
    dailyMode: 'normal',
    dailyModeDate: startDate,
    goals: goals.map((g, index) => {
      // Ensure description and milestones types/statuses are properly configured
      const updatedMilestones = g.milestones.map((m, idx) => ({
        ...m,
        goalId: g.id,
        status: m.achieved ? "completed" as const : (idx === 0 ? "active" : "locked") as any,
        type: "completion" as const,
        currentValue: m.achieved ? m.targetValue : "0",
        order: idx
      }));
      return {
        ...g,
        description: g.desiredOutcome,
        startDate,
        currentMilestoneId: updatedMilestones.find(m => !m.achieved)?.id || updatedMilestones[0]?.id || null,
        milestones: updatedMilestones
      };
    }),
    activities: [],
    routines,
    routineLogs: [],
    lifeAnchors,
    chores,
    experiments: [],
    weeklyReviews: [],
    b2bLeads: [],
    jobApplications: [],
    healthRecords: {},
    lifestyleRecords: {},
    batchTestRecords: [],
    evidenceRecommendations: [],
    aiChangeHistory: [],
    coachHistory: [],
    priorityTasks: [
      {
        id: "task_default_1",
        title: "Hoàn thiện checklist Setup 1 và chạy backtest đầu tiên",
        description: "Ghi rõ điều kiện vào lệnh, thoát lệnh và quản trị rủi ro",
        goalId: "G1",
        milestoneId: "m1_1",
        priority: "important_urgent",
        estimatedMinutes: 45,
        scheduledStart: "14:00",
        scheduledEnd: "14:45",
        completed: false,
        createdAt: new Date().toISOString()
      },
      {
        id: "task_default_2",
        title: "Viết nội dung trang chủ B2B Marketing",
        description: "Làm rõ khách hàng mục tiêu, vấn đề và lời đề nghị giá trị",
        goalId: "G2",
        milestoneId: "m2_1",
        priority: "important_urgent",
        estimatedMinutes: 60,
        scheduledStart: "09:00",
        scheduledEnd: "10:00",
        completed: false,
        createdAt: new Date().toISOString()
      },
      {
        id: "task_default_3",
        title: "Đi bộ 6.000 bước và chuẩn bị bữa ăn lành mạnh",
        description: "Ưu tiên tiến độ bền vững thay vì ép cân",
        goalId: "G3",
        milestoneId: "m3_1",
        priority: "urgent",
        estimatedMinutes: 30,
        scheduledStart: "18:00",
        scheduledEnd: "18:30",
        completed: false,
        createdAt: new Date().toISOString()
      }
    ],
    scheduleItems: [
      {
        id: "sched_default_1",
        title: "Fund: Setup 1 & Backtest",
        date: startDate,
        startTime: "09:00",
        endTime: "10:00",
        estimatedMinutes: 60,
        goalId: "G1",
        milestoneId: "m1_1",
        taskId: "task_default_1",
        type: "task",
        notes: "Ghi chép đầy đủ rủi ro và tỷ lệ R/R.",
        completed: false
      },
      {
        id: "sched_default_2",
        title: "B2B: Website & Offer",
        date: startDate,
        startTime: "14:00",
        endTime: "15:30",
        estimatedMinutes: 90,
        goalId: "G2",
        milestoneId: "m2_1",
        taskId: "task_default_2",
        type: "task",
        notes: "Tìm leads trên LinkedIn và gửi.",
        completed: false
      },
      {
        id: "sched_default_3",
        title: "Đi bộ thể thao 30 phút",
        date: startDate,
        startTime: "18:00",
        endTime: "18:30",
        estimatedMinutes: 30,
        goalId: "G3",
        milestoneId: "m3_1",
        taskId: "task_default_3",
        type: "habit",
        notes: "Uông nước và nghe nhạc nhẹ nhàng.",
        completed: false
      },
      ...getPersonalFixedSchedule(startDate, endDate)
    ],
    weeklyAvailability: [
      { dayOfWeek: 1, mode: "office", label: "Làm tại công ty", blockedStart: "08:00", blockedEnd: "18:40" },
      { dayOfWeek: 2, mode: "home", label: "Làm việc tại nhà" },
      { dayOfWeek: 3, mode: "office", label: "Làm tại công ty", blockedStart: "08:00", blockedEnd: "18:40" },
      { dayOfWeek: 4, mode: "home", label: "Làm việc tại nhà" },
      { dayOfWeek: 5, mode: "office", label: "Làm tại công ty", blockedStart: "08:00", blockedEnd: "18:40" },
      { dayOfWeek: 6, mode: "rest", label: "Nghỉ và phục hồi" },
      { dayOfWeek: 0, mode: "rest", label: "Nghỉ và chuẩn bị tuần mới" }
    ]
  };
}

const getConfirmedRoutines = (): Routine[] => [
  { id: "routine_freelance_focus", goalId: "G3", name: "Freelancer · Outlier hoặc tối ưu hồ sơ", frequency: "Mỗi ngày · 1–2 giờ", minimumDay: "60 phút: làm course/task; nếu chưa pass thì tối ưu Upwork hoặc LinkedIn", target: "Pass Outlier, làm task và đạt tối thiểu 8 USD/ngày", evidence: "Course/task, hồ sơ đã tối ưu hoặc doanh thu USD", status: "pending", scheduleDays: [0,1,2,3,4,5,6], durationMinutes: 60, active: true },
  { id: "routine_fund_morning", goalId: "G1", name: "Fund · Practice buổi sáng", frequency: "Thứ 2–Thứ 6 · 07:30–08:15", minimumDay: "Hoàn thành block quan sát/practice 45 phút", target: "Theo process Fund hiện tại và lưu bằng chứng", evidence: "Video/checklist/chart/demo/journal", status: "pending", scheduleDays: [1,2,3,4,5], startTime: "07:30", endTime: "08:15", durationMinutes: 45, active: true },
  { id: "routine_fund_evening", goalId: "G1", name: "Fund · Practice buổi tối", frequency: "Thứ 2–Thứ 6 · 20:00–22:30", minimumDay: "Thực hành tối thiểu 2 giờ trong block", target: "Hoàn thành block 150 phút theo process", evidence: "Checklist, chart, backtest, demo hoặc journal", status: "pending", scheduleDays: [1,2,3,4,5], startTime: "20:00", endTime: "22:30", durationMinutes: 150, active: true },
  { id: "routine_b2b_daily", goalId: "G2", name: "B2B · Tiến process mỗi ngày", frequency: "Mỗi ngày · tối thiểu 30 phút", minimumDay: "30 phút cho đúng bước B2B đang mở", target: "Contact standard → Fix page → Theme blog → SEO → B2B Audit Page", evidence: "URL, bản nháp hoặc số phút thực hiện", status: "pending", scheduleDays: [0,1,2,3,4,5,6], durationMinutes: 30, active: true },
  { id: "routine_b2b_affiliate_ms", goalId: "G2", name: "B2B · Affiliate domain MS", frequency: "Thứ 7 · 2 giờ", minimumDay: "Hoàn thành block Affiliate MS 120 phút", target: "Tạo tiến triển đo được cho domain MS", evidence: "URL, nội dung hoặc thay đổi đã public", status: "pending", scheduleDays: [6], durationMinutes: 120, active: true },
  { id: "routine_english", goalId: "G3", name: "Freelancer · English-first", frequency: "Lồng vào công việc, không phải checklist riêng", minimumDay: "Ưu tiên một tài liệu hoặc trao đổi bằng tiếng Anh", target: "Dùng tiếng Anh trong công việc thật", evidence: "Tài liệu hoặc trao đổi", status: "pending", active: false },
  { id: "routine_running_park", goalId: "G4", name: "Health · Chạy bộ công viên", frequency: "Mỗi sáng · 05:45–06:30", minimumDay: "Vận động tối thiểu 30 phút", target: "Chạy bộ công viên 45 phút", evidence: "Phút, quãng đường hoặc bước", status: "pending", scheduleDays: [0,1,2,3,4,5,6], startTime: "05:45", endTime: "06:30", durationMinutes: 45, substitutionGroup: "movement", active: true },
  { id: "routine_health_foundation", goalId: "G4", name: "Health · Nền sức khỏe", frequency: "Hàng ngày", minimumDay: "Chọn 1: ăn tốt hơn, uống đủ nước hoặc ngủ trước 23:00", target: "Ăn điều độ, đủ nước và ngủ phục hồi", evidence: "Một ghi chú ngắn", status: "pending", active: true },
  { id: "routine_beauty_foundation", goalId: "G4", name: "Beauty · Skincare buổi tối", frequency: "Mỗi ngày · 22:30–22:45", minimumDay: "Skincare đủ 15 phút", target: "Làm sạch, dưỡng ẩm và chăm sóc theo routine", evidence: "Check-in gọn", status: "pending", scheduleDays: [0,1,2,3,4,5,6], startTime: "22:30", endTime: "22:45", durationMinutes: 15, active: true }
];

const getConfirmedLifeAnchors = () => [
  { id: "anchor_cats", title: "Chăm sóc và yêu thương hai bé mèo", description: "Cho Ranny và Lacky ăn, quan sát sức khỏe và dành thời gian kết nối.", icon: "cat" as const, frequency: "daily" as const, lastCompletedDate: null, active: true },
  { id: "anchor_spiritual", title: "Khoảng lặng tinh thần", description: "Thắp nhang và dành vài phút tĩnh tâm.", icon: "spiritual" as const, frequency: "daily" as const, lastCompletedDate: null, active: true },
  { id: "anchor_law_of_attraction", title: "Đọc Law of Attraction", description: "Đọc và suy ngẫm hằng ngày để nuôi dưỡng niềm tin, sự tập trung và tư duy thịnh vượng.", icon: "spiritual" as const, frequency: "daily" as const, lastCompletedDate: null, active: true }
];

const getConfirmedChores = (): Chore[] => [
  { id: "chore_cat_litter", title: "Dọn khay cát cho mèo", category: "pet", frequency: "daily", dueDate: "2026-08-01", dueTime: "18:45", completed: false, lastCompletedDate: null, createdAt: new Date().toISOString() },
  { id: "chore_home_reset", title: "Reset một khu vực nhà 15–20 phút", category: "home", frequency: "daily", dueDate: "2026-08-01", dueTime: "18:45", completed: false, lastCompletedDate: null, notes: "Nhà 80 m², hai tầng: dọn theo khu vực; không ép hoàn thành cả nhà trong một lần.", createdAt: new Date().toISOString() },
  { id: "chore_shopping", title: "Kiểm tra và mua đồ dùng cần thiết", category: "errand", frequency: "weekly", dueDate: "2026-08-06", dueTime: "17:30", completed: false, lastCompletedDate: null, notes: "Kiểm tra vào thứ Năm; chọn nơi nhận phù hợp.", createdAt: new Date().toISOString() },
  { id: "chore_market", title: "Đi chợ và chuẩn bị thực phẩm", category: "errand", frequency: "weekly", dueDate: "2026-08-01", dueTime: "16:00", completed: false, lastCompletedDate: null, notes: "Ưu tiên thứ Bảy, có thể chuyển sang Chủ nhật.", createdAt: new Date().toISOString() },
  { id: "chore_vacuum", title: "Vệ sinh máy hút bụi", category: "home", frequency: "weekly", dueDate: "2026-08-01", dueTime: "14:00", completed: false, lastCompletedDate: null, createdAt: new Date().toISOString() }
];

/** Latest confirmed personal plan, clean cycle restarted on 01/08/2026. */
function applyConfirmedPersonalPlan(state: AppState): AppState {
  const startDate = "2026-08-01";
  const endDate = "2026-10-13";
  const milestone = (goalId: string, id: string, title: string, targetValue: string, dueDate: string, order: number): any => ({
    id, goalId, title, targetValue, currentValue: "0", dueDate, order,
    type: "completion", status: order === 0 ? "active" : "locked", achieved: false
  });

  const goals: Goal[] = [
    {
      id: "G1", name: "Fund & Trading System", description: "Ôn kiến thức, kiểm chứng setup và chỉ mua tài khoản quỹ sau khi vượt cổng đánh giá.",
      desiredOutcome: "Có một setup nhất quán, checklist rõ ràng, dữ liệu backtest và demo đủ tin cậy để đánh giá tài khoản quỹ 10.000 USD.",
      priority: "secondary", deadline: endDate, startDate, mainMetric: "Checklist · Backtest · Tuân thủ · Drawdown", currentProgress: 0,
      currentMilestone: "Học video", currentMilestoneId: "fund_video", status: "active",
      nextAction: "Học video trong block Fund và ghi lại điểm cần đưa vào checklist", accentColor: "purple", category: "fund_backtest", icon: "chart",
      notes: "Không mua tài khoản chỉ vì hết hai tuần; chỉ chuyển bước khi dữ liệu backtest và demo đạt ngưỡng đã định.",
      milestones: [
        milestone("G1", "fund_video", "Học video", "Nắm nội dung và ghi chú trọng tâm", "2026-08-03", 0),
        milestone("G1", "fund_checklist", "Viết checklist", "Một checklist dùng được", "2026-08-07", 1),
        milestone("G1", "fund_watch_demo", "Xem demo", "Hiểu cách áp dụng checklist", "2026-08-10", 2),
        milestone("G1", "fund_backtest", "Backtest", "Bộ dữ liệu đủ để đánh giá setup", "2026-08-17", 3),
        milestone("G1", "fund_journal", "Ghi Trading Journal", "Có journal lỗi, bài học và tuân thủ", "2026-08-24", 4),
        milestone("G1", "fund_demo_gate", "Đặt tiêu chí và đánh giá demo", "Tiêu chí pass/fail rõ ràng", "2026-08-31", 5),
        milestone("G1", "fund_account", "Chốt điều kiện mua tài khoản quỹ", "Quyết định dựa trên bằng chứng", "2026-09-05", 6)
      ]
    },
    {
      id: "G2", name: "B2B · Chế độ duy trì", description: "Duy trì tài sản B2B bằng nội dung chỉn chu, entity và cải tiến website; chưa ép tìm khách hằng ngày.",
      desiredOutcome: "Website và hệ thống entity ngày càng mạnh, có nội dung đều và sẵn sàng thu lead khi thị trường phản hồi.",
      priority: "normal", deadline: endDate, startDate, mainMetric: "Website · Case study · Proposal · Qualified calls", currentProgress: 0,
      currentMilestone: "Contact standard", currentMilestoneId: "b2b_contact_standard", status: "active",
      nextAction: "Dành tối thiểu 30 phút cho Contact standard", accentColor: "blue", category: "business", icon: "briefcase",
      notes: "Không đặt KPI outreach hằng ngày. Chu kỳ 2–3 ngày tạo một tiến triển; phễu thu lead chỉ được nghiên cứu nhẹ.",
      milestones: [
        milestone("G2", "b2b_contact_standard", "Contact standard", "Chuẩn contact được chốt", "2026-08-03", 0),
        milestone("G2", "b2b_fix_page", "Fix page", "Hoàn thành tổng cộng 20 giờ", "2026-08-16", 1),
        milestone("G2", "b2b_theme_blog", "Theme blog", "Giao diện blog hoàn chỉnh", "2026-08-23", 2),
        milestone("G2", "b2b_seo", "Write SEO", "Mỗi bài có block 3 giờ", "2026-09-15", 3),
        milestone("G2", "b2b_audit_page", "Develop B2B Audit Page", "Trang đúng keyword và có CTA", "2026-09-30", 4),
        milestone("G2", "b2b_affiliate_ms", "Affiliate domain MS", "Duy trì block thứ Bảy 2 giờ", "2026-10-13", 5)
      ]
    },
    {
      id: "G3", name: "Freelancer · Thu nhập trước", description: "Ưu tiên dự án freelance có khả năng tạo tiền gần nhất, bao gồm Reel và các đầu việc có thể nghiệm thu.",
      desiredOutcome: "Có ít nhất một dự án freelance được giao đúng hạn, được thanh toán và tạo nền cho nguồn thu lặp lại.",
      priority: "highest", deadline: endDate, startDate, mainMetric: "Đầu ra giao được · Proposal · Khách trả tiền · Doanh thu", currentProgress: 0,
      currentMilestone: "Làm course Outlier", currentMilestoneId: "outlier_course", status: "active",
      nextAction: "Làm Outlier 1–2 giờ; nếu pass thì nhận task, nếu chưa pass thì tối ưu Upwork và LinkedIn", accentColor: "emerald", category: "career", icon: "career",
      notes: "Freelancer có deadline và doanh thu được ưu tiên trước. Không đặt KPI gửi hồ sơ cứng khi đang có dự án cần bàn giao.",
      milestones: [
        milestone("G3", "outlier_course", "Làm course Outlier", "Hoàn thành course hiện tại", "2026-08-03", 0),
        milestone("G3", "outlier_gate", "Kiểm tra kết quả", "Xác định pass hay chuyển hướng", "2026-08-05", 1),
        milestone("G3", "outlier_task", "Nếu pass: làm task", "Có task được nghiệm thu", "2026-08-15", 2),
        milestone("G3", "freelance_fallback", "Nếu chưa pass: tối ưu Upwork & LinkedIn", "Hai hồ sơ sẵn sàng tìm việc", "2026-08-15", 3),
        milestone("G3", "freelance_daily_income", "Đạt tối thiểu 8 USD/ngày", "Doanh thu ngày đạt 8 USD", "2026-09-15", 4),
        milestone("G3", "career_offer", "Ổn định nguồn thu phụ", "Có task/khách và doanh thu lặp lại", "2026-10-13", 5)
      ]
    },
    {
      id: "G4", name: "Health & Beauty", description: "Giảm cân an toàn và duy trì hệ thống chăm sóc sức khỏe, da, tóc và vóc dáng.",
      desiredOutcome: "Tiến gần mục tiêu 54 kg với nhịp sống bền vững, ngủ đủ, vận động đều và chăm sóc cá nhân nhất quán.",
      priority: "normal", deadline: endDate, startDate, mainMetric: "Năng lượng · Ăn uống · Giấc ngủ · Chăm sóc tối thiểu", currentProgress: 0,
      currentMilestone: "Giữ nền sức khỏe ổn định", currentMilestoneId: "health_baseline", status: "active",
      nextAction: "Chọn đúng một hành động nền: ăn tốt hơn, vận động nhẹ hoặc skincare", accentColor: "rose", category: "health", icon: "heart",
      notes: "Health & Beauty là nền ổn định, không cạnh tranh với Freelancer và Fund. Không ép giảm cân nhanh hay hoàn thành nhiều checklist.",
      milestones: [
        milestone("G4", "health_baseline", "Baseline và routine 14 ngày", "Cân nặng, vòng eo, ảnh và checklist", "2026-08-14", 0),
        milestone("G4", "health_62", "Mốc 62 kg", "62 kg", "2026-08-15", 1),
        milestone("G4", "health_60", "Mốc 60 kg", "60 kg", "2026-09-01", 2),
        milestone("G4", "health_58", "Mốc 58 kg", "58 kg", "2026-09-18", 3),
        milestone("G4", "health_56", "Mốc 56 kg", "56 kg", "2026-10-03", 4),
        milestone("G4", "health_54", "Mục tiêu 54 kg", "54 kg hoặc mức an toàn được điều chỉnh", "2026-10-13", 5)
      ]
    }
  ];

  const routines: Routine[] = getConfirmedRoutines();

  type Template = { key: string; title: string; days: number[]; startTime: string; endTime: string; goalId?: string | null; routineId?: string; type?: ScheduleItem["type"]; locked?: boolean; notes?: string };
  const templates: Template[] = [
    { key: "morning_reset", title: "Thức dậy · vệ sinh cá nhân", days: [0,1,2,3,4,5,6], startTime: "05:15", endTime: "05:30", type: "personal" },
    { key: "morning_mindset", title: "Law of Attraction · thắp nhang · nước ấm", days: [0,1,2,3,4,5,6], startTime: "05:30", endTime: "05:45", type: "habit" },
    { key: "health_run", title: "Health: Chạy bộ công viên", days: [0,1,2,3,4,5,6], startTime: "05:45", endTime: "06:30", goalId: "G4", routineId: "routine_running_park", type: "habit", notes: "Ưu tiên sức khỏe; tối thiểu 30 phút, mục tiêu 45 phút." },
    { key: "fund_morning", title: "Fund: Practice buổi sáng", days: [1,2,3,4,5], startTime: "07:30", endTime: "08:15", goalId: "G1", routineId: "routine_fund_morning", type: "review", notes: "Block bắt buộc thứ Hai–thứ Sáu." },
    { key: "office_prep", title: "Chuẩn bị đi làm", days: [1,3,5], startTime: "08:00", endTime: "08:10", type: "personal" },
    { key: "office", title: "Đi làm tại công ty", days: [1,3,5], startTime: "08:10", endTime: "18:40", type: "personal", locked: true, notes: "Khóa lịch; chỉ cho phép tối đa 2 việc phát sinh có xác nhận." },
    { key: "wfh", title: "Làm việc tại nhà", days: [2,4], startTime: "09:00", endTime: "18:00", type: "personal", locked: true, notes: "Có thể xử lý việc nhà ngắn trong khung linh hoạt." },
    { key: "exercise_weekend", title: "Vận động 30–35 phút", days: [0,6], startTime: "06:30", endTime: "07:05", goalId: "G4", type: "habit", notes: "Đi bộ/chạy nhẹ; hướng tới 5.000 bước, không ép mục tiêu 1.000 kcal." },
    { key: "freelance_focus", title: "Freelancer: Outlier / Upwork / LinkedIn", days: [0,1,2,3,4,5,6], startTime: "18:30", endTime: "19:30", goalId: "G3", routineId: "routine_freelance_focus", type: "task", notes: "1–2 giờ/ngày; nếu pass Outlier thì làm task, nếu chưa pass thì tối ưu Upwork/LinkedIn; mục tiêu 8 USD/ngày." },
    { key: "fund_evening", title: "Fund: Practice buổi tối", days: [1,2,3,4,5], startTime: "20:00", endTime: "22:30", goalId: "G1", routineId: "routine_fund_evening", type: "review", notes: "Block bắt buộc thứ Hai–thứ Sáu; tối thiểu 2 giờ thực hành." },
    { key: "b2b_daily", title: "B2B: 30 phút theo process", days: [0,1,2,3,4,5,6], startTime: "19:30", endTime: "20:00", goalId: "G2", routineId: "routine_b2b_daily", type: "task", notes: "Contact standard → Fix page (20 giờ) → Theme blog → SEO (3 giờ/bài) → B2B Audit Page." },
    { key: "b2b_affiliate_ms", title: "B2B: Affiliate domain MS", days: [6], startTime: "09:00", endTime: "11:00", goalId: "G2", routineId: "routine_b2b_affiliate_ms", type: "task", notes: "Block riêng thứ Bảy, 2 giờ; không thay thế 30 phút B2B hằng ngày." },
    { key: "home_reset_office", title: "Reset một khu vực nhà và dọn khay cát", days: [1,3,5], startTime: "18:40", endTime: "19:10", type: "habit" },
    { key: "home_reset_home", title: "Reset nhà và dọn khay cát", days: [2,4], startTime: "18:00", endTime: "18:15", type: "habit" },
    { key: "laundry_tue", title: "Giặt đồ", days: [2], startTime: "11:00", endTime: "11:30", type: "habit" },
    { key: "laundry_sat", title: "Giặt đồ", days: [6], startTime: "13:15", endTime: "13:45", type: "habit" },
    { key: "cooking_tt", title: "Nấu ăn và rửa chén", days: [2,4], startTime: "12:00", endTime: "13:00", type: "habit" },
    { key: "cooking_sat", title: "Nấu ăn và rửa chén", days: [6], startTime: "15:00", endTime: "16:00", type: "habit" },
    { key: "home_clean", title: "Vệ sinh nhà", days: [2,0], startTime: "16:30", endTime: "17:00", type: "habit" },
    { key: "shopping", title: "Mua đồ dùng cần thiết", days: [4], startTime: "17:30", endTime: "18:00", type: "personal" },
    { key: "market", title: "Đi chợ", days: [6], startTime: "16:00", endTime: "17:00", type: "personal" },
    { key: "haircare", title: "Tắm gội và chăm sóc da đầu", days: [1,3,5,0], startTime: "22:45", endTime: "23:15", goalId: "G4", type: "habit" },
    { key: "skincare", title: "Beauty: Skincare", days: [0,1,2,3,4,5,6], startTime: "22:30", endTime: "22:45", goalId: "G4", routineId: "routine_beauty_foundation", type: "habit", notes: "Routine mỗi ngày, 15 phút." },
    { key: "health_minimum", title: "Health: ăn uống, nước và phục hồi", days: [0,1,2,3,4,5,6], startTime: "22:45", endTime: "23:00", goalId: "G4", routineId: "routine_health_foundation", type: "habit", notes: "Giữ health plan cũ vì sức khỏe là ưu tiên." },
    { key: "sleep", title: "Ngủ phục hồi", days: [0,1,2,3,4,5,6], startTime: "23:00", endTime: "23:59", goalId: "G4", type: "habit" }
  ];

  const scheduleItems: ScheduleItem[] = [];
  for (let cursor = startDate; cursor <= endDate;) {
    const weekday = new Date(`${cursor}T12:00:00`).getDay();
    templates.filter(item => item.days.includes(weekday)).forEach(item => scheduleItems.push({
      id: `confirmed_${item.key}_${cursor}`, title: item.title, date: cursor, startTime: item.startTime, endTime: item.endTime,
      goalId: item.goalId || null, journeyId: item.goalId || null, type: item.type || "personal", locked: item.locked,
      routineId: item.routineId, lockedCapacity: item.locked ? 2 : undefined, notes: item.notes, completed: false
    }));
    const date = new Date(`${cursor}T12:00:00`); date.setDate(date.getDate() + 1); cursor = formatDateStr(date);
  }
  const addOnce = (id: string, title: string, date: string, startTime: string, endTime: string, goalId: string | null, type: ScheduleItem["type"], notes?: string) => scheduleItems.push({ id, title, date, startTime, endTime, goalId, journeyId: goalId, type, notes, completed: false });
  addOnce(
    "prep_scope_20260729",
    "Freelancer: Hoàn thành course Outlier đầu tiên",
    "2026-07-29",
    "19:30",
    "20:30",
    "G3",
    "task",
    "Việc quan trọng nhất hôm nay; hoàn thành course đầu tiên trên Outlier."
  );
  addOnce("today_yoga_20260729", "Healthy & Beauty: Tập yoga", "2026-07-29", "20:30", "21:00", "G4", "habit", "Hoạt động buổi tối; giờ có thể điều chỉnh trong app.");
  addOnce(
    "prep_sequence_20260730",
    "Đưa mẹ đi khám bệnh",
    "2026-07-30",
    "00:00",
    "23:59",
    null,
    "personal",
    "Việc gia đình quan trọng; chưa chốt giờ cụ thể."
  );
  addOnce(
    "prep_ready_20260731",
    "Kiểm tra lịch và chốt kế hoạch Day 1",
    "2026-07-31",
    "19:30",
    "20:00",
    null,
    "review",
    "Đảm bảo lịch không chồng chéo và chỉ giữ những block có thể thực hiện từ 01/08."
  );
  addOnce("finance_summary_20260801", "Tổng hợp tài chính", "2026-08-01", "10:00", "11:00", null, "review", "Review thu nhập, chi phí, ngân sách và kế hoạch tháng 8; ngày đã chốt là 01/08/2026.");
  for (let date = "2026-08-04"; date <= endDate;) {
    addOnce(`ranny_${date}`, "Tắm Ranny", date, "11:00", "12:00", null, "habit", "Lặp mỗi 7 ngày; mốc đã xác nhận là thứ Ba.");
    const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + 7); date = formatDateStr(next);
  }
  for (let date = "2026-08-10"; date <= endDate;) {
    const originalDate = date;
    let scheduledDate = originalDate;
    const weekday = new Date(`${scheduledDate}T12:00:00`).getDay();
    if ([1,3,5].includes(weekday)) {
      const shifted = new Date(`${scheduledDate}T12:00:00`);
      shifted.setDate(shifted.getDate() + (weekday === 5 ? 1 : 1));
      scheduledDate = formatDateStr(shifted);
    }
    addOnce(`lacky_${originalDate}`, "Tắm Lacky", scheduledDate, "11:00", "12:00", null, "habit", `Mốc chu kỳ 10 ngày: ${originalDate}; chuyển sang ngày rảnh gần nhất nếu trùng lịch công ty.`);
    const next = new Date(`${originalDate}T12:00:00`); next.setDate(next.getDate() + 10); date = formatDateStr(next);
  }
  const scheduleKey = (item: ScheduleItem) => `${item.title.trim().toLowerCase()}|${item.date}|${item.startTime}|${item.endTime}`;
  const combinedSchedule = new Map<string, ScheduleItem>();
  scheduleItems.forEach(item => combinedSchedule.set(scheduleKey(item), item));
  const newTasks = [
    { id: "task_outlier_first_course", title: "Hoàn thành course Outlier; pass thì làm task", description: "1–2 giờ/ngày; nếu chưa pass thì tối ưu Upwork và LinkedIn; mục tiêu tối thiểu 8 USD/ngày", goalId: "G3", journeyId: "G3", milestoneId: "outlier_course", priority: "important_urgent" as const, estimatedMinutes: 60, dueDate: "2026-08-03", completed: false, createdAt: new Date().toISOString() },
    { id: "task_mom_medical_visit", title: "Đưa mẹ đi khám bệnh", description: "Việc gia đình quan trọng; chưa chốt giờ", goalId: null, journeyId: null, priority: "important" as const, dueDate: "2026-07-30", completed: false, createdAt: new Date().toISOString() },
    { id: "task_finance_august", title: "Tổng hợp tài chính", description: "Review thu nhập, chi phí, ngân sách và kế hoạch tháng 8", goalId: null, journeyId: null, priority: "important" as const, estimatedMinutes: 60, dueDate: "2026-08-01", completed: false, createdAt: new Date().toISOString() },
    { id: "task_b2b_process", title: "Tiến process B2B tối thiểu 30 phút/ngày", description: "Contact standard → Fix page 20 giờ → Theme blog → SEO 3 giờ/bài → B2B Audit Page", goalId: "G2", journeyId: "G2", milestoneId: "b2b_contact_standard", priority: "important" as const, estimatedMinutes: 30, dueDate: "2026-10-13", completed: false, createdAt: new Date().toISOString() },
    { id: "task_b2b_affiliate_ms", title: "Affiliate domain MS vào thứ Bảy", description: "Block riêng 2 giờ mỗi thứ Bảy", goalId: "G2", journeyId: "G2", milestoneId: "b2b_affiliate_ms", priority: "important" as const, estimatedMinutes: 120, completed: false, createdAt: new Date().toISOString() },
    { id: "task_yoga_20260729", title: "Tập yoga buổi tối", description: "Healthy & Beauty ngày 29/07", goalId: "G4", journeyId: "G4", milestoneId: "health_baseline", priority: "important" as const, estimatedMinutes: 30, dueDate: "2026-07-29", completed: false, createdAt: new Date().toISOString() },
    { id: "task_fund_process", title: "Thực hành Fund theo hai khung bắt buộc", description: "Thứ Hai–thứ Sáu: 07:30–08:15 và 20:00–22:30; học video → checklist → xem demo → backtest → journal → đánh giá demo → điều kiện mua quỹ", goalId: "G1", milestoneId: "fund_video", priority: "important" as const, estimatedMinutes: 195, completed: false, createdAt: new Date().toISOString() },
    { id: "task_health_minimum", title: "Giữ nền Healthy & Beauty", description: "Mỗi ngày chọn đúng một hành động tối thiểu phù hợp năng lượng; không biến sức khỏe thành dự án gây áp lực", goalId: "G4", milestoneId: "health_baseline", priority: "later" as const, estimatedMinutes: 10, completed: false, createdAt: new Date().toISOString() }
  ];
  return {
    ...state, startDate, endDate, personalScheduleSeedVersion: 18, personalPlanStartedAt: new Date().toISOString(),
    weeklyFocusGoalId: "G3", weeklySupportGoalIds: ["G1", "G2"], dailyFocusGoalId: "G3", goals, routines,
    dailyFocusDate: startDate, dailyMode: "normal", dailyModeDate: startDate, activeFocusSession: null,
    lifeAnchors: getConfirmedLifeAnchors(), chores: getConfirmedChores(), priorityTasks: newTasks,
    activities: [], routineLogs: [], weeklyReviews: [], experiments: [],
    b2bLeads: [], jobApplications: [], healthRecords: {}, lifestyleRecords: {},
    batchTestRecords: [], evidenceRecommendations: [], aiChangeHistory: [], coachHistory: [],
    scheduleItems: [...combinedSchedule.values()].sort((a,b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    weeklyAvailability: [
      { dayOfWeek: 1, mode: "office", label: "Làm tại công ty", blockedStart: "08:10", blockedEnd: "18:40" },
      { dayOfWeek: 2, mode: "home", label: "Làm việc tại nhà", blockedStart: "09:00", blockedEnd: "18:00" },
      { dayOfWeek: 3, mode: "office", label: "Làm tại công ty", blockedStart: "08:10", blockedEnd: "18:40" },
      { dayOfWeek: 4, mode: "home", label: "Làm việc tại nhà", blockedStart: "09:00", blockedEnd: "18:00" },
      { dayOfWeek: 5, mode: "office", label: "Làm tại công ty", blockedStart: "08:10", blockedEnd: "18:40" },
      { dayOfWeek: 6, mode: "rest", label: "Review, chăm nhà và phục hồi" },
      { dayOfWeek: 0, mode: "rest", label: "Nghỉ và tổng kết cá nhân" }
    ]
  };
}

export function migrateAppState(rawState: any): AppState {
  if (!rawState) return getDefaultAppState();

  const migrated: any = { ...rawState };

  if ((migrated.personalScheduleSeedVersion || 0) === 4) {
    const inactiveRoutineIds = new Set((migrated.routines || []).filter((routine: Routine) => routine.active === false).map((routine: Routine) => routine.id));
    const staleTitles = new Set(["b2b: icp & offer deep work", "yoga chiều", "fund: setup 1 & backtest", "b2b: website & offer", "đi bộ thể thao 30 phút", "tắm cho 2 mèo"]);
    migrated.scheduleItems = (migrated.scheduleItems || []).filter((item: ScheduleItem) =>
      !inactiveRoutineIds.has(item.routineId || "") &&
      !item.id.startsWith("sched_default_") &&
      !item.id.startsWith("fixed_") &&
      !staleTitles.has(item.title.trim().toLowerCase())
    );
    migrated.personalScheduleSeedVersion = 5;
  }

  if ((migrated.personalScheduleSeedVersion || 0) === 5) {
    const confirmed = getConfirmedRoutines();
    const confirmedIds = new Set(confirmed.map(routine => routine.id));
    const existingById = new Map((migrated.routines || []).map((routine: Routine) => [routine.id, routine]));
    const canonical = confirmed.map(routine => ({
      ...routine,
      status: (existingById.get(routine.id) as Routine | undefined)?.status || routine.status
    }));
    const preserved = (migrated.routines || [])
      .filter((routine: Routine) => !confirmedIds.has(routine.id))
      .map((routine: Routine) => routine.id === "routine_outreach" ? { ...routine, active: false } : routine);
    migrated.routines = [...canonical, ...preserved];
    migrated.personalScheduleSeedVersion = 6;
  }

  if ((migrated.personalScheduleSeedVersion || 0) === 6) {
    migrated.startDate = "2026-07-19";
    migrated.endDate = "2026-10-13";
    migrated.scheduleItems = (migrated.scheduleItems || []).filter((item: ScheduleItem) =>
      !((item.id.startsWith("confirmed_") || item.id.startsWith("rainy_") || item.id.startsWith("fund_weekly_")) && item.date < "2026-07-19")
    );
    migrated.personalScheduleSeedVersion = 7;
  }

  if ((migrated.personalScheduleSeedVersion || 0) === 7) {
    const activeGoalByCategory = new Map((migrated.goals || [])
      .filter((goal: Goal) => goal.status === "active" && ["G1", "G2", "G3", "G4"].includes(goal.id))
      .map((goal: Goal) => [goal.category, goal.id]));
    const historicalGoalMap = new Map((migrated.goals || [])
      .filter((goal: Goal) => !["G1", "G2", "G3", "G4"].includes(goal.id))
      .map((goal: Goal) => [goal.id, activeGoalByCategory.get(goal.category) || null]));
    const remapGoalId = (goalId?: string | null) => historicalGoalMap.get(goalId || "") || goalId;

    migrated.goals = (migrated.goals || []).filter((goal: Goal) => ["G1", "G2", "G3", "G4"].includes(goal.id));
    migrated.activities = (migrated.activities || []).map((activity: ActivityEntry) => ({ ...activity, goalId: remapGoalId(activity.goalId) || activity.goalId }));
    migrated.routineLogs = (migrated.routineLogs || []).map((log: any) => ({ ...log, goalId: remapGoalId(log.goalId) || log.goalId }));
    migrated.routines = getConfirmedRoutines();

    const allowedSchedulePrefixes = ["confirmed_", "rainy_", "lacky_", "fund_weekly_"];
    const canonicalSchedule = new Map<string, ScheduleItem>();
    (migrated.scheduleItems || [])
      .filter((item: ScheduleItem) => allowedSchedulePrefixes.some(prefix => item.id.startsWith(prefix)))
      .filter((item: ScheduleItem) => item.date >= "2026-07-19" && item.date <= "2026-10-13")
      .forEach((item: ScheduleItem) => {
        const key = `${item.title.trim().toLowerCase()}|${item.date}|${item.startTime}|${item.endTime}`;
        const previous = canonicalSchedule.get(key);
        canonicalSchedule.set(key, previous?.completed ? previous : item);
      });
    migrated.scheduleItems = [...canonicalSchedule.values()].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

    const existingAnchors = new Map((migrated.lifeAnchors || []).map((anchor: any) => [anchor.id, anchor]));
    migrated.lifeAnchors = getConfirmedLifeAnchors().map(anchor => ({ ...anchor, lastCompletedDate: (existingAnchors.get(anchor.id) as any)?.lastCompletedDate || null }));
    const existingChores = new Map((migrated.chores || []).map((chore: Chore) => [chore.id, chore]));
    migrated.chores = getConfirmedChores().map(chore => {
      const existing = existingChores.get(chore.id) as Chore | undefined;
      return { ...chore, completed: existing?.completed || false, lastCompletedDate: existing?.lastCompletedDate || null };
    });
    const canonicalTaskIds = new Set(["task_fund_checklist", "task_b2b_foundation", "task_career_cv", "task_health_baseline"]);
    migrated.priorityTasks = (migrated.priorityTasks || []).filter((task: any) => canonicalTaskIds.has(task.id));
    migrated.startDate = "2026-07-19";
    migrated.endDate = "2026-10-13";
    migrated.personalScheduleSeedVersion = 8;
  }

  if ((migrated.personalScheduleSeedVersion || 0) >= 4 && (migrated.personalScheduleSeedVersion || 0) < 9) {
    migrated.routines = getConfirmedRoutines();
    migrated.personalScheduleSeedVersion = 9;
  }

  if ((migrated.personalScheduleSeedVersion || 0) === 9) {
    migrated.scheduleItems = (migrated.scheduleItems || []).filter((item: ScheduleItem) => isScheduleValidForDate(item));
    migrated.personalScheduleSeedVersion = 10;
  }

  if ((migrated.personalScheduleSeedVersion || 0) === 10) {
    const existingAnchors = new Map((migrated.lifeAnchors || []).map((anchor: any) => [anchor.id, anchor]));
    migrated.lifeAnchors = getConfirmedLifeAnchors().map(anchor => ({
      ...anchor,
      lastCompletedDate: (existingAnchors.get(anchor.id) as any)?.lastCompletedDate || null
    }));
    migrated.personalScheduleSeedVersion = 11;
  }

  if ((migrated.personalScheduleSeedVersion || 0) === 11) {
    // Replace the previous canonical plan in one pass while preserving actual
    // check-ins, history, experiments and cloud-backed user records.
    return applyConfirmedPersonalPlan(migrated);
  }

  if ((migrated.personalScheduleSeedVersion || 0) === 12) {
    // Reprioritize active work without deleting actual check-ins or history:
    // Freelancer → Fund → B2B maintenance → Health & Beauty foundation.
    return applyConfirmedPersonalPlan(migrated);
  }

  if ((migrated.personalScheduleSeedVersion || 0) === 13) {
    // Start the latest plan as a genuinely clean cycle. Account/auth data lives
    // outside AppState, while all previous cycle records are intentionally reset.
    return applyConfirmedPersonalPlan(migrated);
  }

  if ((migrated.personalScheduleSeedVersion || 0) === 14) {
    // Move Day 1 to 01/08/2026 and generate only the latest roadmap data.
    return applyConfirmedPersonalPlan(migrated);
  }

  if ((migrated.personalScheduleSeedVersion || 0) === 15) {
    // Add the 29–31/07 preparation phase without starting plan progress early.
    return applyConfirmedPersonalPlan(migrated);
  }

  if ((migrated.personalScheduleSeedVersion || 0) === 16) {
    // Add the confirmed 29/07–August tasks and the daily-first dashboard layout.
    return applyConfirmedPersonalPlan(migrated);
  }

  if ((migrated.personalScheduleSeedVersion || 0) === 17) {
    // Install the confirmed daily processes and percentage-based daily dashboard.
    return applyConfirmedPersonalPlan(migrated);
  }

  if ((migrated.personalScheduleSeedVersion || 0) < 4) {
    return applyConfirmedPersonalPlan(migrateAppState({ ...migrated, personalScheduleSeedVersion: 4 }));
  }

  // 1. Ensure goals are formatted correctly with descriptions, startDates, and milestone fields
  if (Array.isArray(migrated.goals)) {
    migrated.goals = migrated.goals.map((goal: any, index: number) => {
      const g = { ...goal };
      if (!g.description) {
        g.description = g.desiredOutcome || "";
      }
      if (!g.startDate) {
        g.startDate = migrated.startDate || "2026-07-13";
      }
      if (!g.status) {
        g.status = "active";
      }
      
      if (Array.isArray(g.milestones)) {
        g.milestones = g.milestones.map((milestone: any, mIndex: number) => {
          const m = { ...milestone };
          if (!m.goalId) {
            m.goalId = g.id;
          }
          if (!m.status) {
            m.status = m.achieved ? "completed" as const : (mIndex === 0 ? "active" : "locked") as any;
          }
          if (!m.type) {
            m.type = "completion" as const;
          }
          if (m.currentValue === undefined || m.currentValue === null) {
            m.currentValue = m.achieved ? m.targetValue : "0";
          }
          if (m.order === undefined) {
            m.order = mIndex;
          }
          return m;
        });
      } else {
        g.milestones = [];
      }
      
      const activeMilestone = g.milestones.find((m: any) => m.status === "active") || g.milestones[0];
      if (activeMilestone && !g.currentMilestoneId) {
        g.currentMilestoneId = activeMilestone.id;
      }

      // Infer category and icon if not present
      if (!g.category || !g.icon) {
        const nameLower = (g.name || "").toLowerCase();
        if (nameLower.includes("backtest") || nameLower.includes("trading") || nameLower.includes("fund") || nameLower.includes("quỹ")) {
          g.category = g.category || "fund_backtest";
          g.icon = g.icon || "chart";
        } else if (nameLower.includes("b2b") || nameLower.includes("business") || nameLower.includes("kinh doanh")) {
          g.category = g.category || "business";
          g.icon = g.icon || "briefcase";
        } else if (nameLower.includes("marketing") || nameLower.includes("social") || nameLower.includes("website") || nameLower.includes("tiếp thị")) {
          g.category = g.category || "marketing";
          g.icon = g.icon || "megaphone";
        } else if (nameLower.includes("health") || nameLower.includes("sức khỏe") || nameLower.includes("cân") || nameLower.includes("weight") || nameLower.includes("vóc dáng")) {
          g.category = g.category || "health";
          g.icon = g.icon || "heart";
        } else if (nameLower.includes("career") || nameLower.includes("job") || nameLower.includes("việc") || nameLower.includes("tuyển")) {
          g.category = g.category || "career";
          g.icon = g.icon || "career";
        } else if (nameLower.includes("learning") || nameLower.includes("course") || nameLower.includes("học") || nameLower.includes("tiếng") || nameLower.includes("ngôn ngữ")) {
          g.category = g.category || "learning";
          g.icon = g.icon || "learning";
        } else if (nameLower.includes("home") || nameLower.includes("lifestyle") || nameLower.includes("nhà") || nameLower.includes("mèo")) {
          g.category = g.category || "home";
          g.icon = g.icon || "home";
        } else if (nameLower.includes("finance") || nameLower.includes("saving") || nameLower.includes("tài chính") || nameLower.includes("tiết kiệm")) {
          g.category = g.category || "finance";
          g.icon = g.icon || "finance";
        } else if (nameLower.includes("thói quen") || nameLower.includes("habit")) {
          g.category = g.category || "habit";
          g.icon = g.icon || "habit";
        } else if (nameLower.includes("dự án") || nameLower.includes("project")) {
          g.category = g.category || "project";
          g.icon = g.icon || "project";
        } else {
          g.category = g.category || "custom";
          g.icon = g.icon || "target";
        }
      }

      return g;
    });
  } else {
    migrated.goals = getDefaultAppState().goals;
  }

  // 2. Ensure routines are present
  const defaultRoutines = getDefaultAppState().routines;
  if (!Array.isArray(migrated.routines)) {
    migrated.routines = defaultRoutines;
  } else {
    const defaultsById = new Map(defaultRoutines.map(routine => [routine.id, routine]));
    migrated.routines = migrated.routines.map((routine: any) => ({
      ...(defaultsById.get(routine.id) || {}),
      ...routine,
      active: routine.active !== false
    }));
    defaultRoutines.forEach(routine => {
      if (!migrated.routines.some((item: any) => item.id === routine.id)) migrated.routines.push(routine);
    });
  }
  if (!Array.isArray(migrated.routineLogs)) {
    migrated.routineLogs = [];
  }
  if (!Array.isArray(migrated.lifeAnchors)) {
    migrated.lifeAnchors = getDefaultAppState().lifeAnchors || [];
  }
  if (!Array.isArray(migrated.chores)) {
    migrated.chores = getDefaultAppState().chores || [];
  }

  // 3. Ensure priorityTasks is present
  if (!Array.isArray(migrated.priorityTasks) || migrated.priorityTasks.length === 0) {
    migrated.priorityTasks = getDefaultAppState().priorityTasks;
  }

  // 4. Ensure scheduleItems is present
  if (!Array.isArray(migrated.scheduleItems) || migrated.scheduleItems.length === 0) {
    migrated.scheduleItems = getDefaultAppState().scheduleItems;
  }
  if ((migrated.personalScheduleSeedVersion || 0) < 3) {
    if (!migrated.chores.some((chore: Chore) => chore.id === 'chore_bathe_two_cats')) {
      const catBath = (getDefaultAppState().chores || []).find(chore => chore.id === 'chore_bathe_two_cats');
      if (catBath) migrated.chores.push(catBath);
    }
    const fixedSchedule = getPersonalFixedSchedule(migrated.startDate, migrated.endDate);
    const scheduleKey = (item: ScheduleItem) => `${item.title.trim().toLowerCase()}|${item.date}|${item.startTime}|${item.endTime}`;
    const uniqueExisting = new Map<string, ScheduleItem>();
    migrated.scheduleItems
      .filter((item: ScheduleItem) => !(item.id?.startsWith('fixed_office_') || (item.locked && item.title === 'Đi làm tại công ty')))
      .forEach((item: ScheduleItem) => {
      const key = scheduleKey(item);
      if (!uniqueExisting.has(key)) uniqueExisting.set(key, item);
    });
    migrated.scheduleItems = [...uniqueExisting.values()];
    const scheduleIds = new Set(migrated.scheduleItems.map((item: ScheduleItem) => item.id));
    fixedSchedule.forEach(item => {
      const sameSlot = migrated.scheduleItems.find((current: ScheduleItem) => scheduleKey(current) === scheduleKey(item));
      if (sameSlot) {
        Object.assign(sameSlot, { locked: item.locked, lockedCapacity: item.lockedCapacity, type: item.type, notes: item.notes });
      } else if (!scheduleIds.has(item.id)) migrated.scheduleItems.push(item);
    });
    migrated.personalScheduleSeedVersion = 3;
  }
  if (!Array.isArray(migrated.weeklyAvailability) || migrated.weeklyAvailability.length === 0) {
    migrated.weeklyAvailability = getDefaultAppState().weeklyAvailability;
  }
  if (!migrated.weeklyFocusGoalId || !migrated.goals.some((goal: Goal) => goal.id === migrated.weeklyFocusGoalId && goal.status === 'active')) {
    migrated.weeklyFocusGoalId = migrated.goals.find((goal: Goal) => goal.status === 'active')?.id || null;
  }
  if (!Array.isArray(migrated.weeklySupportGoalIds)) {
    migrated.weeklySupportGoalIds = migrated.goals.filter((goal: Goal) => goal.status === 'active' && goal.id !== migrated.weeklyFocusGoalId).slice(0, 2).map((goal: Goal) => goal.id);
  }
  // Existing users should not be interrupted. Only a genuinely new default state starts onboarding.
  if (typeof migrated.onboardingCompleted !== 'boolean') migrated.onboardingCompleted = true;
  if (migrated.activeFocusSession === undefined) migrated.activeFocusSession = null;
  if (!['normal', 'busy', 'recovery'].includes(migrated.dailyMode)) migrated.dailyMode = 'normal';
  if (migrated.dailyModeDate === undefined) migrated.dailyModeDate = null;

  // Fallback for other arrays
  if (!migrated.activities) migrated.activities = [];
  if (!migrated.experiments) migrated.experiments = [];
  if (!migrated.weeklyReviews) migrated.weeklyReviews = [];
  if (!migrated.b2bLeads) migrated.b2bLeads = [];
  if (!migrated.jobApplications) migrated.jobApplications = [];
  if (!migrated.healthRecords) migrated.healthRecords = {};
  if (!migrated.lifestyleRecords) migrated.lifestyleRecords = {};
  if (!migrated.batchTestRecords) migrated.batchTestRecords = [];
  if (!migrated.evidenceRecommendations) migrated.evidenceRecommendations = [];
  if (!Array.isArray(migrated.aiChangeHistory)) migrated.aiChangeHistory = [];
  if (!Array.isArray(migrated.coachHistory)) migrated.coachHistory = [];

  return migrated;
}

// Check-in helper to insert / update a custom check-in state
export function saveCheckInToState(state: AppState, payload: {
  date: string;
  summary: string;
  energy: number | null;
  entries: Array<{
    goalId: string;
    category: string;
    activity: string;
    output: Record<string, any>;
    outcome: Record<string, any>;
    insight?: string | null;
    nextAction?: string | null;
    confidence: number;
  }>;
  source: 'voice' | 'text' | 'manual';
  originalTranscript?: string;
}): AppState {
  const updatedState = { ...state };
  
  // Calculate unique base ID
  const timestamp = Date.now();
  
  // Create ActivityEntry for each classified entry
  payload.entries.forEach((ent, idx) => {
    const activityId = `act_${timestamp}_${idx}`;
    const newEntry: ActivityEntry = {
      id: activityId,
      date: payload.date,
      goalId: ent.goalId,
      source: payload.source,
      originalTranscript: payload.originalTranscript,
      activity: ent.activity,
      output: ent.output,
      outcome: ent.outcome,
      insight: ent.insight || null,
      nextAction: ent.nextAction || null,
      confidence: ent.confidence,
      createdTimestamp: timestamp,
      updatedTimestamp: timestamp
    };
    
    updatedState.activities = [newEntry, ...updatedState.activities];

    // Propagate updates to corresponding specific data structures
    const out = ent.output || {};
    const otc = ent.outcome || {};
    const targetGoal = updatedState.goals.find(goal => goal.id === ent.goalId);
    const goalCategory = targetGoal?.category;
    const activityLower = ent.activity.toLowerCase();

    // B2B / marketing: never infer this from a fixed G-number.
    if (goalCategory === "business" || goalCategory === "marketing") {
      // If outreach or replies are logged, we can dynamically add a generic lead or update goals progress
      if (out.outreach) {
        const leadId = `lead_${timestamp}_${idx}`;
        const newLead: B2BLead = {
          id: leadId,
          companyName: `Đối tác tiềm năng #${Math.floor(Math.random() * 900) + 100}`,
          contactPerson: "Chưa rõ",
          status: otc.replies ? "replied" : "outreached",
          notes: `Tự động tạo từ hoạt động outreach ngày ${formatDisplayDate(payload.date)}: ${ent.activity}`,
          updatedAt: payload.date
        };
        updatedState.b2bLeads = [newLead, ...updatedState.b2bLeads];
      }
    }

    // Career / job applications.
    if (goalCategory === "career") {
      if (out.applications || activityLower.includes("ứng tuyển") || activityLower.includes("nộp")) {
        const appId = `app_${timestamp}_${idx}`;
        const newApp: JobApplication = {
          id: appId,
          companyName: ent.activity.match(/ở\s+([A-Za-z0-9\s]+)/)?.[1]?.trim() || `Công ty SaaS tiềm năng`,
          role: "Developer / Marketer",
          salary: otc.salary || "30,000,000 VND",
          status: "applied",
          notes: `Được tạo từ hoạt động check-in ngày ${formatDisplayDate(payload.date)}`,
          updatedAt: payload.date
        };
        updatedState.jobApplications = [newApp, ...updatedState.jobApplications];
      }
    }

    // Health & beauty.
    if (goalCategory === "health") {
      const existingRecord: HealthRecord = updatedState.healthRecords[payload.date] || {
        date: payload.date,
        weight: null,
        sleepHours: null,
        energy: payload.energy,
        steps: null,
        strengthSession: false,
        eatOnPlan: false,
        skincare: false,
        styleAndAppearance: false,
        notes: ""
      };

      if (out.steps) existingRecord.steps = Number(out.steps);
      if (out.weightKg) existingRecord.weight = Number(out.weightKg);
      if (out.sleepHours) existingRecord.sleepHours = Number(out.sleepHours);
      if (out.strengthMinutes) existingRecord.strengthSession = true;
      if (activityLower.includes("skincare") || out.skincare) existingRecord.skincare = true;
      if (activityLower.includes("ăn") || activityLower.includes("dinh dưỡng")) existingRecord.eatOnPlan = true;
      existingRecord.notes = (existingRecord.notes + " " + ent.activity).trim();
      if (payload.energy) existingRecord.energy = payload.energy;

      updatedState.healthRecords[payload.date] = existingRecord;
    }

    // Home and lifestyle maintenance.
    if (goalCategory === "home" || goalCategory === "habit") {
      const existingLRecord: LifestyleRecord = updatedState.lifestyleRecords[payload.date] || {
        date: payload.date,
        homeReset15m: false,
        kitchenReset: false,
        laundry: false,
        mealPrep: false,
        catCare: false,
        deepClean: false,
        declutter: false,
        dateNight: false,
        weeklyReview: false
      };

      if (activityLower.includes("reset") || activityLower.includes("dọn dẹp")) existingLRecord.homeReset15m = true;
      if (activityLower.includes("bếp") || activityLower.includes("rửa bát")) existingLRecord.kitchenReset = true;
      if (activityLower.includes("giặt") || activityLower.includes("quần áo")) existingLRecord.laundry = true;
      if (activityLower.includes("nấu") || activityLower.includes("chuẩn bị")) existingLRecord.mealPrep = true;
      if (activityLower.includes("mèo") || activityLower.includes("cho ăn")) existingLRecord.catCare = true;
      if (activityLower.includes("declutter") || activityLower.includes("thanh lý")) existingLRecord.declutter = true;
      if (activityLower.includes("hẹn hò") || activityLower.includes("date night")) existingLRecord.dateNight = true;

      updatedState.lifestyleRecords[payload.date] = existingLRecord;
    }

    // Fund, backtest and trading evidence.
    if (goalCategory === "fund_backtest") {
      if (out.plannedRisk || out.resultR || activityLower.includes("trade") || activityLower.includes("giao dịch") || activityLower.includes("backtest")) {
        const tradeId = `trade_${timestamp}_${idx}`;
        const newTrade: BatchTestRecord = {
          id: tradeId,
          date: payload.date,
          setup: ent.activity,
          instrument: out.instrument || "BTCUSD",
          plannedRisk: Number(out.plannedRisk || 1.0),
          riskRewardRatio: Number(out.riskRewardRatio || 2.0),
          resultR: Number(out.resultR || 0.0),
          checklistCompliance: true,
          ruleViolations: [],
          simulatedEquity: 10000 + (out.resultR ? Number(out.resultR) * 100 : 0),
          lessons: ent.insight || "Tuân thủ kế hoạch giao dịch",
          eligibilityStatus: "eligible"
        };
        updatedState.batchTestRecords = [newTrade, ...updatedState.batchTestRecords];
      }
    }

    // Caring for the cats is a life anchor, not a performance KPI.
    if (activityLower.includes("mèo") || activityLower.includes("cho ăn")) {
      updatedState.lifeAnchors = (updatedState.lifeAnchors || []).map(anchor =>
        anchor.id === "anchor_cats" ? { ...anchor, lastCompletedDate: payload.date } : anchor
      );
    }

    // Update the goal's nextAction and currentProgress slightly
    if (targetGoal) {
      if (ent.nextAction) {
        targetGoal.nextAction = ent.nextAction;
      }
      // Add small progress
      targetGoal.currentProgress = Math.min(90, targetGoal.currentProgress + 2);
    }
  });

  // Turn matching check-ins into dated routine evidence. Substitutions are explicit,
  // so Yoga or a heavy cleaning day does not lower the walking consistency score.
  payload.entries.forEach(ent => {
    const activityLower = ent.activity.toLowerCase();
    const upsertRoutineLog = (routine: Routine, status: 'completed' | 'skipped', evidence: string) => {
      const existing = (updatedState.routineLogs || []).find(log => log.routineId === routine.id && log.date === payload.date);
      const nextLog = {
        id: existing?.id || `routine_log_${routine.id}_${payload.date}`,
        routineId: routine.id,
        goalId: routine.goalId,
        date: payload.date,
        status,
        source: 'ai' as const,
        evidence,
        activityId: null,
        createdTimestamp: existing?.createdTimestamp || timestamp,
        updatedTimestamp: timestamp
      };
      updatedState.routineLogs = [nextLog, ...(updatedState.routineLogs || []).filter(log => !(log.routineId === routine.id && log.date === payload.date))];
    };

    updatedState.routines = updatedState.routines.map(rot => {
      if (rot.goalId === ent.goalId) {
        const keywords = rot.name.toLowerCase().split(' ');
        const matches = keywords.some(k => k.length > 2 && activityLower.includes(k));
        if (matches) {
          upsertRoutineLog(rot, 'completed', `AI nhận diện từ check-in: ${ent.activity}`);
          return { ...rot, status: 'completed' as const };
        }
      }
      return rot;
    });

    const yogaRoutine = updatedState.routines.find(rot => rot.substitutionGroup === 'movement' && rot.name.toLowerCase().includes('yoga'));
    const walkingRoutine = updatedState.routines.find(rot => rot.substitutionGroup === 'movement' && rot.name.toLowerCase().includes('đi bộ'));
    const didYoga = activityLower.includes('yoga');
    const didHeavyCleaning = ['dọn dẹp nhiều', 'dọn nhà nhiều', 'lau dọn nhà', 'tổng vệ sinh', 'deep clean'].some(term => activityLower.includes(term));
    if (didYoga && yogaRoutine) upsertRoutineLog(yogaRoutine, 'completed', `Hoàn thành Yoga từ check-in: ${ent.activity}`);
    if ((didYoga || didHeavyCleaning) && walkingRoutine) {
      upsertRoutineLog(walkingRoutine, 'skipped', didYoga
        ? 'Được thay bằng Yoga — không tính là bỏ thói quen.'
        : 'Được thay bằng buổi dọn dẹp nhiều vận động — không tính là bỏ thói quen.');
    }
  });

  return updatedState;
}

// Generate recommendations based on goal priority and recent activity
export function getRecommendations(state: AppState): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Goal Priorities
  const g1 = state.goals.find(g => g.id === "G1");
  const g2 = state.goals.find(g => g.id === "G2");
  const g3 = state.goals.find(g => g.id === "G3");
  const g4 = state.goals.find(g => g.id === "G4");
  const g5 = state.goals.find(g => g.id === "G5");

  // Recommendation 1: current income focus
  const incomeGoal = state.goals.find(goal => goal.id === state.weeklyFocusGoalId) || g3;
  const incomeActs = state.activities.filter(activity => activity.goalId === incomeGoal?.id);
  if (incomeGoal && incomeActs.length === 0) {
    recommendations.push({
      id: "rec_income_start",
      goalId: incomeGoal.id,
      title: "Tiến một đầu việc gần doanh thu nhất",
      reason: `${incomeGoal.name} là trọng tâm hiện tại nhưng chưa có đầu ra được ghi nhận.`,
      minimumDayAlternative: "Làm 15 phút và ghi rõ một bước tiếp theo để lần sau tiếp tục ngay.",
      type: "routine"
    });
  } else if (incomeGoal) {
    recommendations.push({
      id: "rec_income_continue",
      goalId: incomeGoal.id,
      title: "Hoàn thiện đầu ra freelancer đang mở",
      reason: "Ưu tiên việc có thể bàn giao hoặc tạo doanh thu trước khi mở thêm dự án.",
      minimumDayAlternative: "Hoàn thành một phần có thể gửi để xin phản hồi.",
      type: "routine"
    });
  }

  // Recommendation 2: Check health status / warning or recovery
  const healthLogs = Object.values(state.healthRecords);
  const consecutiveSteps = healthLogs.slice(0, 3).filter(h => h.steps && h.steps < 3000);
  const lowEnergy = healthLogs.some(h => h.energy && h.energy <= 2);

  if (lowEnergy) {
    recommendations.push({
      id: "rec_g3_recovery",
      goalId: "G3",
      title: "Hồi phục sức khỏe & Ưu tiên giấc ngủ",
      reason: "Bạn ghi nhận mức năng lượng thấp gần đây. Đừng cố gắng ép bản thân quá mức.",
      minimumDayAlternative: "Ngủ trước 11h30 tối, bỏ qua buổi tập nặng, chỉ đi bộ nhẹ nhàng 2000 bước.",
      type: "recuperate"
    });
  } else {
    recommendations.push({
      id: "rec_g3_routine",
      goalId: "G3",
      title: "Duy trì đi bộ 6.000 bước",
      reason: "Duy trì hoạt động thể chất giúp duy trì năng lượng làm việc cho mục tiêu G1 và G2.",
      minimumDayAlternative: "Đi bộ nhẹ nhàng 10-15 phút quanh phòng làm việc (3.000 bước).",
      type: "health"
    });
  }

  // Recommendation 3: Neglected Goals check
  const now = Date.now();
  const goalLastAct: Record<string, number> = { G1: 0, G2: 0, G3: 0, G4: 0, G5: 0 };
  state.activities.forEach(act => {
    if (act.createdTimestamp > goalLastAct[act.goalId]) {
      goalLastAct[act.goalId] = act.createdTimestamp;
    }
  });

  const neglectedGoal = Object.entries(goalLastAct).find(([gid, ts]) => {
    // If no activities or last was more than 3 days ago (259200000 ms)
    return ts === 0 || (now - ts) > (3 * 24 * 60 * 60 * 1000);
  });

  if (neglectedGoal) {
    const gid = neglectedGoal[0];
    const targetGoalObj = state.goals.find(g => g.id === gid);
    if (targetGoalObj && targetGoalObj.status === 'active') {
      recommendations.push({
        id: `rec_neg_${gid}`,
        goalId: gid,
        title: `Phục hồi sự tập trung cho: ${targetGoalObj.name}`,
        reason: `Mục tiêu này đã bị bỏ quên hơn 3 ngày qua. Hãy kích hoạt lại bằng một hành động nhỏ nhất.`,
        minimumDayAlternative: `Thực hiện phiên bản tối thiểu (Minimum Day) của routine liên quan trong 5-10 phút.`,
        type: "warning"
      });
    }
  }

  // Ensure maximum 3 recommendations
  return recommendations.slice(0, 3);
}

// Seed complete simulated database for Vietnamese user demonstration (past 14 days)
export function getSeededAppState(): AppState {
  const base = getDefaultAppState();
  const start = new Date(base.startDate);
  const now = new Date("2026-07-13");

  // Setup some leads
  base.b2bLeads = [
    { id: "lead_1", companyName: "SaaSify Vietnam", contactPerson: "Nguyễn Văn A (CEO)", status: "proposal", notes: "Đã gửi báo giá tối ưu hóa chuyển đổi landing page.", updatedAt: "2026-07-10" },
    { id: "lead_2", companyName: "LogiTech Solutions", contactPerson: "Trần Thị B (COO)", status: "meeting", notes: "Lên lịch demo cuộc gọi ngày 15/07.", updatedAt: "2026-07-12" },
    { id: "lead_3", companyName: "HRCloud Corp", contactPerson: "Lê Minh C (HR Manager)", status: "outreached", notes: "Đã gửi email cá nhân hóa đầu tiên.", updatedAt: "2026-07-11" },
    { id: "lead_4", companyName: "EduViet App", contactPerson: "Phạm Hùng (Founder)", status: "paying", notes: "Khách hàng đầu tiên chịu thanh toán gói pilot 5 triệu VND/tháng.", updatedAt: "2026-07-12" }
  ];

  // Setup some job applications
  base.jobApplications = [
    { id: "app_1", companyName: "VNG Group", role: "Product Owner SaaS", salary: "35,000,000 VND", status: "applied", notes: "Nộp qua LinkedIn, đang chờ phản hồi.", updatedAt: "2026-07-08" },
    { id: "app_2", companyName: "OneMount Group", role: "Senior Marketing Analyst", salary: "32,000,000 VND", status: "interviewing", notes: "Đã hoàn thành bài test năng lực, chuẩn bị phỏng vấn vòng 1 ngày 16/07.", updatedAt: "2026-07-12" }
  ];

  // Populate activities for the past 10 days to make progress dashboard look amazing and realistic
  const entriesList: ActivityEntry[] = [];
  const healthRecs: Record<string, HealthRecord> = {};
  const lifestyleRecs: Record<string, LifestyleRecord> = {};
  const batchRecords: BatchTestRecord[] = [];

  const daysToSeed = 10;
  for (let i = 0; i < daysToSeed; i++) {
    const seedDate = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000));
    const dStr = formatDateStr(seedDate);

    // Health records
    healthRecs[dStr] = {
      date: dStr,
      weight: 64.0 - (i * 0.05), // weight loss trend!
      sleepHours: 7 + (i % 2 === 0 ? 0.5 : -0.5),
      energy: i % 3 === 0 ? 3 : (i % 4 === 0 ? 5 : 4),
      steps: 4500 + (i * 250), // increasing activity trend!
      strengthSession: i % 3 === 0,
      eatOnPlan: i % 4 !== 0,
      skincare: true,
      styleAndAppearance: i % 2 === 0,
      notes: "Ăn đúng giờ, uống nhiều nước."
    };

    // Lifestyle records
    lifestyleRecs[dStr] = {
      date: dStr,
      homeReset15m: i % 2 === 0,
      kitchenReset: true,
      laundry: i % 3 === 0,
      mealPrep: i % 2 === 1,
      catCare: true,
      deepClean: i === 6,
      declutter: i === 3,
      dateNight: i === 5,
      weeklyReview: i === 7
    };

    // Activities
    entriesList.push({
      id: `act_seed_g1_${i}`,
      date: dStr,
      goalId: "G1",
      source: "voice",
      activity: `Gửi tiếp cận email B2B cho ${5 + i} leads và làm sâu nghiên cứu ICP khách hàng.`,
      output: { outreach: 5 + i },
      outcome: { replies: i % 4 === 0 ? 1 : 0 },
      insight: "Tập trung viết tiêu đề email ngắn gọn kích thích tò mò sẽ nâng cao tỉ lệ mở.",
      nextAction: "Viết sẵn các mẫu follow-up cho ngày mai",
      confidence: 0.95,
      createdTimestamp: seedDate.getTime(),
      updatedTimestamp: seedDate.getTime()
    });

    if (i % 2 === 0) {
      entriesList.push({
        id: `act_seed_g3_${i}`,
        date: dStr,
        goalId: "G3",
        source: "text",
        activity: `Đi bộ ${4500 + i * 250} bước và duy trì ăn thâm hụt calo, dưỡng da tối.`,
        output: { steps: 4500 + i * 250, weightKg: 64.0 - (i * 0.05) },
        outcome: {},
        insight: "Nên mang giày chạy bộ êm chân để hạn chế đau gót chân khi đi bộ.",
        nextAction: "Duy trì đi bộ đúng lộ trình",
        confidence: 0.98,
        createdTimestamp: seedDate.getTime(),
        updatedTimestamp: seedDate.getTime()
      });
    }

    if (i % 3 === 0) {
      entriesList.push({
        id: `act_seed_g5_${i}`,
        date: dStr,
        goalId: "G5",
        source: "manual",
        activity: "Giao dịch 1 lệnh Gold cặp XAUUSD tuân thủ nghiêm ngặt checklist giao dịch.",
        output: { plannedRisk: 0.5, riskRewardRatio: 2.0 },
        outcome: { resultR: i === 0 ? -1 : 2 },
        insight: "Không FOMO khi nến chưa đóng cửa là quyết định chính xác giữ vững kỷ luật.",
        nextAction: "Bảo toàn số vốn, phân tích kỹ nhật ký",
        confidence: 0.9,
        createdTimestamp: seedDate.getTime(),
        updatedTimestamp: seedDate.getTime()
      });

      batchRecords.push({
        id: `trade_seed_${i}`,
        date: dStr,
        setup: "Gold Pinbar pullback m15",
        instrument: "XAUUSD",
        plannedRisk: 0.5,
        riskRewardRatio: 2.0,
        resultR: i === 0 ? -1 : 2,
        checklistCompliance: true,
        ruleViolations: [],
        simulatedEquity: 10000 + (i === 0 ? -100 : 200),
        lessons: "Điểm vào hoàn hảo, quản lý khối lượng chặt chẽ.",
        eligibilityStatus: "eligible"
      });
    }
  }

  // Setup sample experiments
  base.experiments = [
    {
      id: "exp_1",
      goalId: "G1",
      hypothesis: "Chèn tiêu đề email cá nhân hóa chứa TÊN CEO sẽ cải thiện tỷ lệ mở & trả lời lên 15%.",
      variable: "Tiêu đề email chứa tên CEO (ví dụ: 'Xin chào anh A - Giải pháp SaaS cho...')",
      startDate: "2026-07-05",
      reviewDate: "2026-07-20",
      mainMetric: "Reply rate",
      guardrail: "Nếu tỷ lệ report spam tăng > 2% thì dừng.",
      baseline: "Tỷ lệ trả lời hiện tại: 5%",
      result: "Tỷ lệ trả lời đạt 12% sau khi thử nghiệm gửi 25 emails",
      confidence: 0.85,
      decision: "continue",
      reason: "Kết quả tốt vượt bậc so với baseline, tiếp tục áp dụng rộng rãi."
    }
  ];

  // Setup sample weekly review
  base.weeklyReviews = [
    {
      id: "rev_1",
      weekNumber: 1,
      startDate: "2026-07-06",
      endDate: "2026-07-12",
      planned: "Nghiên cứu ICP B2B, chuẩn bị Portfolio mẫu, nộp 1 CV và tập strength 2 buổi.",
      actual: "Đã gửi 32 emails tiếp cận (có 1 deal trả phí), nộp CV OneMount, duy trì sức khỏe tốt và giảm cân.",
      outputs: { outreach: 32, applications: 1, strength: 2, steps: 38000 },
      outcomes: { replies: 3, payingClients: 1, revenue: 5000000 },
      timeAllocation: { G1: 45, G2: 15, G3: 20, G4: 15, G5: 5 },
      wins: "Có được khách hàng trả phí pilot đầu tiên trị giá 5 triệu VND!",
      problems: "Vẫn thỉnh thoảng ngủ hơi muộn (khoảng 12h30).",
      lessons: "Cần chuẩn bị bữa tối sớm hơn để reset nhà cửa và thư giãn sớm.",
      adjustments: "Tập trung nguồn lực chăm sóc khách hàng pilot này thật tốt làm case study xuất sắc.",
      status: "continue",
      submitted: true
    }
  ];

  base.activities = entriesList;
  base.healthRecords = healthRecs;
  base.lifestyleRecords = lifestyleRecs;
  base.batchTestRecords = batchRecords;

  // Set goals progress based on simulated records
  base.goals[0].currentProgress = 35; // G1
  base.goals[1].currentProgress = 20; // G2
  base.goals[2].currentProgress = 18; // G3
  base.goals[3].currentProgress = 40; // G4
  base.goals[4].currentProgress = 15; // G5

  base.evidenceRecommendations = [
    {
      id: "rec_seed_1",
      goalId: "G1",
      recommendedAction: "Thực hiện phỏng vấn khách hàng đối tác SaaSify Vietnam trước khi nâng cấp offer.",
      reason: "Cần lấy feedback trực tiếp về pain point của họ thay vì tự suy đoán.",
      userEvidence: "Dữ liệu cho thấy SaaSify Vietnam đang ở trạng thái 'proposal' (gửi báo cáo giá) từ ngày 10/07/2026.",
      patternOrPrinciple: "Xác thực giả thuyết trực tiếp với khách hàng trước khi xây dựng/mở rộng giải pháp.",
      expectedOutcome: "Xác định rõ mong muốn thực sự của đối tác để chốt hợp đồng pilot.",
      successMetric: "Hoàn thành 1 cuộc gọi phỏng vấn 15 phút.",
      reviewDate: "2026-07-15",
      confidence: "High",
      minimumDay: "Nhắn tin hỏi đối tác xem có thắc mắc gì về proposal không.",
      status: "accepted",
      createdDate: "2026-07-11",
      decisionNotes: "Đồng ý, đã nhắn tin hẹn lịch gọi phỏng vấn."
    },
    {
      id: "rec_seed_2",
      goalId: "G3",
      recommendedAction: "Nghỉ ngơi sớm và chỉ đi bộ nhẹ nhàng 2,000 bước.",
      reason: "Ghi nhận năng lượng giảm xuống còn 3/5 vào ngày 12/07 và có dấu hiệu mỏi mệt.",
      userEvidence: "Bản ghi ngày 12/07 ghi nhận năng lượng đạt 3/5, giấc ngủ chỉ đạt 6.5 tiếng.",
      patternOrPrinciple: "Hồi phục chủ động (Active Recovery) để ngăn ngừa kiệt sức.",
      expectedOutcome: "Phục hồi năng lượng lên 4/5 vào ngày hôm sau.",
      successMetric: "Mức năng lượng ngày tiếp theo >= 4/5.",
      reviewDate: "2026-07-13",
      confidence: "Medium",
      minimumDay: "Chỉ tập trung ngủ đủ giấc và rửa mặt sạch dưỡng da trước khi ngủ.",
      status: "postponed",
      createdDate: "2026-07-12",
      decisionNotes: "Lùi lại vì hôm đó vẫn cố gắng đi bộ đủ chỉ tiêu."
    }
  ];

  return base;
}

// Export All Data as JSON
export function exportStateToJSON(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

// Convert data list to CSV string
export function convertToCSV(data: any[], headers: string[], keys: string[]): string {
  const rowSeparator = "\r\n";
  const headerLine = headers.join(",");
  const bodyLines = data.map(item => {
    return keys.map(key => {
      let val = item[key];
      if (val === undefined || val === null) {
        val = "";
      } else if (typeof val === "object") {
        val = JSON.stringify(val);
      }
      // Escape commas and quotes
      const stringified = String(val).replace(/"/g, '""');
      if (stringified.includes(",") || stringified.includes("\n") || stringified.includes('"')) {
        return `"${stringified}"`;
      }
      return stringified;
    }).join(",");
  });
  
  return [headerLine, ...bodyLines].join(rowSeparator);
}

// Download dynamic file trigger
export function triggerFileDownload(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
