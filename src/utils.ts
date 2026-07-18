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
    const currentDay = Math.max(1, Math.floor(diffTime / (24 * 60 * 60 * 1000)) + 1);
    const daysRemaining = Math.max(0, totalDays - currentDay);
    
    return {
      currentDay: Math.min(totalDays, currentDay),
      daysRemaining,
      totalDays
    };
  } catch {
    return { currentDay: 1, daysRemaining: 89, totalDays: 90 };
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
  { id: "routine_fund_daily", goalId: "G1", name: "Fund · Giao dịch & review", frequency: "Thứ 2–6", minimumDay: "Review checklist 15 phút", target: "Hoàn thành block Fund theo lịch và ghi journal", evidence: "Checklist + journal", status: "pending", scheduleDays: [1,2,3,4,5], active: true },
  { id: "routine_fund_weekly", goalId: "G1", name: "Fund · Review tuần", frequency: "Thứ 7 · 4 giờ", minimumDay: "Tổng kết 1 giờ", target: "Review tuần đủ 4 giờ", evidence: "Bài học, lỗi và kế hoạch tuần mới", status: "pending", scheduleDays: [6], active: true },
  { id: "routine_b2b_career", goalId: "G2", name: "B2B/Career · Focus block", frequency: "T2, T4, T6 · 60 phút", minimumDay: "30 phút hoặc 1 đầu ra", target: "60 phút cho B2B, CV hoặc freelance", evidence: "Asset, proposal hoặc application", status: "pending", scheduleDays: [1,3,5], active: true },
  { id: "routine_english", goalId: "G3", name: "Career · English-first", frequency: "Hàng ngày", minimumDay: "30 phút nội dung tiếng Anh", target: "Ưu tiên nghe, nói và làm việc bằng tiếng Anh", evidence: "Phút thực hành", status: "pending", active: true },
  { id: "routine_yoga", goalId: "G4", name: "Health · Yoga", frequency: "T2 sáng · T3/T5 tối", minimumDay: "15 phút", target: "Hoàn thành buổi theo lịch", evidence: "Số phút", status: "pending", scheduleDays: [1,2,4], substitutionGroup: "movement", active: true },
  { id: "routine_walk", goalId: "G4", name: "Health · Đi bộ", frequency: "T4, T6, T7/CN nếu không dọn nặng", minimumDay: "15 phút", target: "30 phút", evidence: "Phút hoặc bước", status: "pending", scheduleDays: [0,3,5,6], substitutionGroup: "movement", active: true },
  { id: "routine_healthy_eating", goalId: "G4", name: "Health · Ăn uống lành mạnh", frequency: "Hàng ngày", minimumDay: "Một lựa chọn ăn uống tốt hơn", target: "Ăn đủ chất và hạn chế thực phẩm gây hại", evidence: "Ghi chú ngắn", status: "pending", active: true },
  { id: "routine_skincare_am", goalId: "G4", name: "Beauty · Skincare sáng", frequency: "Hàng ngày", minimumDay: "Làm sạch và chống nắng", target: "Routine sáng đầy đủ", evidence: "Checklist", status: "pending", active: true },
  { id: "routine_skincare_pm", goalId: "G4", name: "Beauty · Skincare tối", frequency: "Hàng ngày · 22:30", minimumDay: "Làm sạch và dưỡng ẩm", target: "Face + body", evidence: "Checklist", status: "pending", active: true },
  { id: "routine_haircare", goalId: "G4", name: "Beauty · Tắm gội & da đầu", frequency: "T2, T4, T6, CN", minimumDay: "Gội và làm sạch da đầu", target: "Hoàn thành routine tóc/da đầu", evidence: "Checklist", status: "pending", scheduleDays: [0,1,3,5], active: true },
  { id: "routine_sleep", goalId: "G4", name: "Health · Ngủ phục hồi", frequency: "Hàng ngày · 22:45–05:30", minimumDay: "Lên giường trước 23:00", target: "Ngủ 22:45–05:30", evidence: "Giờ ngủ và thức dậy", status: "pending", active: true }
];

/** Confirmed personal plan captured on 18/07/2026. Applied once to each personal workspace. */
function applyConfirmedPersonalPlan(state: AppState): AppState {
  const startDate = "2026-07-18";
  const endDate = "2026-10-13";
  const milestone = (goalId: string, id: string, title: string, targetValue: string, dueDate: string, order: number): any => ({
    id, goalId, title, targetValue, currentValue: "0", dueDate, order,
    type: "completion", status: order === 0 ? "active" : "locked", achieved: false
  });

  const goals: Goal[] = [
    {
      id: "G1", name: "Fund & Trading System", description: "Ôn kiến thức, kiểm chứng setup và chỉ mua tài khoản quỹ sau khi vượt cổng đánh giá.",
      desiredOutcome: "Có một setup nhất quán, checklist rõ ràng, dữ liệu backtest và demo đủ tin cậy để đánh giá tài khoản quỹ 10.000 USD.",
      priority: "highest", deadline: endDate, startDate, mainMetric: "Checklist · Backtest · Tuân thủ · Drawdown", currentProgress: 0,
      currentMilestone: "Ôn kiến thức và hoàn thiện checklist", currentMilestoneId: "fund_knowledge", status: "active",
      nextAction: "Đọc lại kiến thức và viết checklist Setup 1", accentColor: "purple", category: "fund_backtest", icon: "chart",
      notes: "Không mua tài khoản chỉ vì hết hai tuần; chỉ chuyển bước khi dữ liệu backtest và demo đạt ngưỡng đã định.",
      milestones: [
        milestone("G1", "fund_knowledge", "Ôn lại kiến thức và trading plan", "Kiến thức được hệ thống hóa", "2026-07-25", 0),
        milestone("G1", "fund_checklist", "Hoàn thiện checklist Setup 1", "1 checklist dùng được", "2026-07-31", 1),
        milestone("G1", "fund_backtest", "Backtest và ghi trading journal", "Bộ dữ liệu đủ để đánh giá setup", "2026-08-08", 2),
        milestone("G1", "fund_demo", "Thực hành demo nhất quán", "Tuân thủ rủi ro và drawdown", "2026-08-18", 3),
        milestone("G1", "fund_gate", "Vượt cổng đánh giá trước khi mua quỹ", "Đủ điều kiện theo checklist", "2026-08-31", 4),
        milestone("G1", "fund_account", "Đánh giá và mua tài khoản quỹ", "Quyết định dựa trên bằng chứng", "2026-09-05", 5)
      ]
    },
    {
      id: "G2", name: "B2B Marketing Agency", description: "Xây nền tảng tiếng Việt, portfolio agency, outreach, SEO và social.",
      desiredOutcome: "Có website, portfolio, hệ thống tiếp cận khách hàng và ít nhất một cơ hội B2B đủ điều kiện.",
      priority: "secondary", deadline: endDate, startDate, mainMetric: "Website · Case study · Proposal · Qualified calls", currentProgress: 0,
      currentMilestone: "Xây website tiếng Việt và định vị offer", currentMilestoneId: "b2b_foundation", status: "active",
      nextAction: "Chốt ICP, offer và cấu trúc website tiếng Việt", accentColor: "blue", category: "business", icon: "briefcase",
      notes: "Outreach dùng chung một pipeline, gắn nhãn B2B Agency để không đếm trùng Career/Freelance.",
      milestones: [
        milestone("G2", "b2b_foundation", "Chốt ICP, offer và website tiếng Việt", "Website foundation hoàn chỉnh", "2026-08-01", 0),
        milestone("G2", "b2b_portfolio", "Hoàn thiện portfolio agency", "Case study và bằng chứng rõ ràng", "2026-08-15", 1),
        milestone("G2", "b2b_proposal", "Khởi chạy proposal B2B", "5 proposal phù hợp mỗi tuần", "2026-08-22", 2),
        milestone("G2", "b2b_seo", "Vận hành SEO theo cụm chủ đề", "1 bài trụ cột + 1 bài hỗ trợ/tuần", "2026-09-15", 3),
        milestone("G2", "b2b_social", "Đồng bộ LinkedIn và social", "Kênh, hồ sơ và CTA nhất quán", "2026-09-20", 4),
        milestone("G2", "b2b_pipeline", "Tạo cơ hội khách hàng đủ điều kiện", "Có cuộc hẹn/proposal thương lượng", "2026-10-13", 5)
      ]
    },
    {
      id: "G3", name: "Career 30M+", description: "CV, portfolio và pipeline ứng tuyển/freelance cho công việc net trên 30 triệu.",
      desiredOutcome: "Nhận được offer công việc phù hợp với mức lương net từ 30 triệu hoặc pipeline freelance tương đương.",
      priority: "secondary", deadline: endDate, startDate, mainMetric: "CV · Case study · Applications · Interviews · Offer", currentProgress: 0,
      currentMilestone: "Chỉnh lại CV theo vị trí mục tiêu", currentMilestoneId: "career_cv", status: "active",
      nextAction: "Chốt vị trí mục tiêu và viết lại thành tích trong CV bằng số liệu", accentColor: "emerald", category: "career", icon: "career",
      notes: "Mục tiêu outreach chung: Career/Freelance 10 hồ sơ/tuần và B2B 5 proposal/tuần.",
      milestones: [
        milestone("G3", "career_cv", "Hoàn thiện CV", "1 CV chính và phiên bản theo vai trò", "2026-07-26", 0),
        milestone("G3", "career_clients", "Tổng hợp khách hàng và dự án đã làm", "Danh mục đầy đủ", "2026-07-31", 1),
        milestone("G3", "career_results", "Tổng hợp kết quả và bằng chứng", "Thành tích được lượng hóa", "2026-08-05", 2),
        milestone("G3", "career_portfolio", "Hoàn thiện portfolio", "Case study dễ đọc và dễ gửi", "2026-08-12", 3),
        milestone("G3", "career_outreach", "Vận hành ứng tuyển và proposal", "10 hồ sơ Career/Freelance mỗi tuần", "2026-09-01", 4),
        milestone("G3", "career_offer", "Đạt offer net 30M+", "Ít nhất 1 offer phù hợp", "2026-10-13", 5)
      ]
    },
    {
      id: "G4", name: "Health & Beauty", description: "Giảm cân an toàn và duy trì hệ thống chăm sóc sức khỏe, da, tóc và vóc dáng.",
      desiredOutcome: "Tiến gần mục tiêu 54 kg với nhịp sống bền vững, ngủ đủ, vận động đều và chăm sóc cá nhân nhất quán.",
      priority: "normal", deadline: endDate, startDate, mainMetric: "Cân nặng · Vòng eo · Giấc ngủ · Routine", currentProgress: 0,
      currentMilestone: "Thiết lập baseline và routine 14 ngày", currentMilestoneId: "health_baseline", status: "active",
      nextAction: "Ghi cân nặng, vòng eo và hoàn thành skincare sáng/tối", accentColor: "rose", category: "health", icon: "heart",
      notes: "Mốc 54 kg là định hướng; ưu tiên tốc độ an toàn, năng lượng và khả năng duy trì.",
      milestones: [
        milestone("G4", "health_baseline", "Baseline và routine 14 ngày", "Cân nặng, vòng eo, ảnh và checklist", "2026-08-01", 0),
        milestone("G4", "health_62", "Mốc 62 kg", "62 kg", "2026-08-15", 1),
        milestone("G4", "health_60", "Mốc 60 kg", "60 kg", "2026-09-01", 2),
        milestone("G4", "health_58", "Mốc 58 kg", "58 kg", "2026-09-18", 3),
        milestone("G4", "health_56", "Mốc 56 kg", "56 kg", "2026-10-03", 4),
        milestone("G4", "health_54", "Mục tiêu 54 kg", "54 kg hoặc mức an toàn được điều chỉnh", "2026-10-13", 5)
      ]
    }
  ];

  const routines: Routine[] = getConfirmedRoutines();

  type Template = { key: string; title: string; days: number[]; startTime: string; endTime: string; goalId?: string | null; type?: ScheduleItem["type"]; locked?: boolean; notes?: string };
  const templates: Template[] = [
    { key: "office_prep", title: "Chuẩn bị đi làm", days: [1,3,5], startTime: "08:00", endTime: "08:30", type: "personal" },
    { key: "office", title: "Đi làm tại công ty", days: [1,3,5], startTime: "08:30", endTime: "18:30", type: "personal", locked: true, notes: "Khóa lịch; chỉ cho phép tối đa 2 việc phát sinh có xác nhận." },
    { key: "wfh", title: "Làm việc tại nhà", days: [2,4], startTime: "09:00", endTime: "18:00", type: "personal", locked: true, notes: "Có thể xử lý việc nhà ngắn trong khung linh hoạt." },
    { key: "yoga_mon", title: "Yoga sáng", days: [1], startTime: "05:45", endTime: "06:45", goalId: "G4", type: "habit" },
    { key: "yoga_evening", title: "Yoga tối", days: [2,4], startTime: "18:15", endTime: "19:20", goalId: "G4", type: "habit" },
    { key: "fund_mon_open", title: "Fund: xem thị trường đầu tuần", days: [1], startTime: "07:15", endTime: "08:00", goalId: "G1", type: "review" },
    { key: "fund_mwf", title: "Fund: giao dịch và review", days: [1,3,5], startTime: "21:00", endTime: "22:30", goalId: "G1", type: "review" },
    { key: "fund_tt", title: "Fund: deep practice", days: [2,4], startTime: "19:30", endTime: "22:30", goalId: "G1", type: "review" },
    { key: "b2b_career", title: "B2B · CV · Freelance", days: [1,3,5], startTime: "19:00", endTime: "20:00", goalId: "G2", type: "task" },
    { key: "home_reset_office", title: "Reset nhà và dọn khay cát", days: [1,3,5], startTime: "18:30", endTime: "19:00", type: "habit" },
    { key: "home_reset_home", title: "Reset nhà và dọn khay cát", days: [2,4], startTime: "18:00", endTime: "18:15", type: "habit" },
    { key: "laundry_tue", title: "Giặt đồ", days: [2], startTime: "11:00", endTime: "11:30", type: "habit" },
    { key: "laundry_sat", title: "Giặt đồ", days: [6], startTime: "13:15", endTime: "13:45", type: "habit" },
    { key: "cooking_tt", title: "Nấu ăn và rửa chén", days: [2,4], startTime: "12:00", endTime: "13:00", type: "habit" },
    { key: "cooking_sat", title: "Nấu ăn và rửa chén", days: [6], startTime: "15:00", endTime: "16:00", type: "habit" },
    { key: "home_clean", title: "Vệ sinh nhà", days: [2,0], startTime: "16:30", endTime: "17:00", type: "habit" },
    { key: "shopping", title: "Mua đồ dùng cần thiết", days: [4], startTime: "17:30", endTime: "18:00", type: "personal" },
    { key: "market", title: "Đi chợ", days: [6], startTime: "16:00", endTime: "17:00", type: "personal" },
    { key: "haircare", title: "Tắm gội và chăm sóc da đầu", days: [1,3,5,0], startTime: "20:00", endTime: "20:30", goalId: "G4", type: "habit" },
    { key: "skincare_pm", title: "Skincare tối", days: [0,1,2,3,4,5,6], startTime: "22:30", endTime: "22:45", goalId: "G4", type: "habit" },
    { key: "sleep", title: "Ngủ phục hồi", days: [0,1,2,3,4,5,6], startTime: "22:45", endTime: "23:59", goalId: "G4", type: "habit" }
  ];

  const scheduleItems: ScheduleItem[] = [];
  for (let cursor = startDate; cursor <= endDate;) {
    const weekday = new Date(`${cursor}T12:00:00`).getDay();
    templates.filter(item => item.days.includes(weekday)).forEach(item => scheduleItems.push({
      id: `confirmed_${item.key}_${cursor}`, title: item.title, date: cursor, startTime: item.startTime, endTime: item.endTime,
      goalId: item.goalId || null, journeyId: item.goalId || null, type: item.type || "personal", locked: item.locked,
      lockedCapacity: item.locked ? 2 : undefined, notes: item.notes, completed: false
    }));
    const date = new Date(`${cursor}T12:00:00`); date.setDate(date.getDate() + 1); cursor = formatDateStr(date);
  }
  const addOnce = (id: string, title: string, date: string, startTime: string, endTime: string, goalId: string | null, type: ScheduleItem["type"], notes?: string) => scheduleItems.push({ id, title, date, startTime, endTime, goalId, journeyId: goalId, type, notes, completed: false });
  for (let date = "2026-07-18"; date <= endDate;) {
    addOnce(`rainy_${date}`, "Tắm Rainy", date, "10:00", "11:00", null, "habit", "Lặp mỗi 7 ngày, thứ Bảy.");
    const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + 7); date = formatDateStr(next);
  }
  for (let date = "2026-07-21"; date <= endDate;) {
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
  for (let date = startDate; date <= endDate;) {
    addOnce(`fund_weekly_a_${date}`, "Review Fund tuần · Phần 1", date, "08:00", "10:00", "G1", "review");
    addOnce(`fund_weekly_b_${date}`, "Review Fund tuần · Phần 2", date, "11:00", "13:00", "G1", "review", "Tổng 4 giờ; tách quanh lịch tắm Rainy.");
    const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + 7); date = formatDateStr(next);
  }

  const legacyGoals: Goal[] = (state.goals || []).map((goal, index) => {
    const legacyId = `legacy_${goal.id}_${index}`;
    return {
      ...goal,
      id: legacyId,
      name: `${goal.name} · kế hoạch trước`,
      status: "archived",
      currentMilestoneId: null,
      milestones: (goal.milestones || []).map(item => ({ ...item, id: `legacy_${item.id}`, goalId: legacyId }))
    };
  });
  const newRoutineIds = new Set(routines.map(item => item.id));
  const preservedRoutines = (state.routines || []).filter(item => !newRoutineIds.has(item.id)).map(item => ({ ...item, active: false }));
  const scheduleKey = (item: ScheduleItem) => `${item.title.trim().toLowerCase()}|${item.date}|${item.startTime}|${item.endTime}`;
  const combinedSchedule = new Map<string, ScheduleItem>();
  const inactiveRoutineIds = new Set(preservedRoutines.map(item => item.id));
  const staleTitles = ["b2b: icp & offer deep work", "yoga chiều", "fund: setup 1 & backtest", "b2b: website & offer", "đi bộ thể thao 30 phút", "tắm cho 2 mèo"];
  (state.scheduleItems || [])
    .filter(item => !inactiveRoutineIds.has(item.routineId || ""))
    .filter(item => !item.id.startsWith("sched_default_") && !item.id.startsWith("fixed_"))
    .filter(item => !staleTitles.includes(item.title.trim().toLowerCase()))
    .forEach(item => combinedSchedule.set(scheduleKey(item), item));
  scheduleItems.forEach(item => {
    const existing = combinedSchedule.get(scheduleKey(item));
    combinedSchedule.set(scheduleKey(item), existing ? { ...item, id: existing.id, completed: existing.completed } : item);
  });
  const newTasks = [
    { id: "task_fund_checklist", title: "Ôn kiến thức và viết checklist Setup 1", description: "Đầu ra: trading plan và checklist có thể dùng khi backtest", goalId: "G1", milestoneId: "fund_knowledge", priority: "important_urgent" as const, estimatedMinutes: 90, completed: false, createdAt: new Date().toISOString() },
    { id: "task_b2b_foundation", title: "Chốt ICP, offer và sitemap website", description: "Đầu ra: foundation website tiếng Việt", goalId: "G2", milestoneId: "b2b_foundation", priority: "important" as const, estimatedMinutes: 60, completed: false, createdAt: new Date().toISOString() },
    { id: "task_career_cv", title: "Chỉnh CV cho vị trí net 30M+", description: "Đầu ra: CV định vị rõ và thành tích có số liệu", goalId: "G3", milestoneId: "career_cv", priority: "important" as const, estimatedMinutes: 60, completed: false, createdAt: new Date().toISOString() },
    { id: "task_health_baseline", title: "Ghi baseline Health & Beauty", description: "Cân nặng, vòng eo, ảnh và routine sáng/tối", goalId: "G4", milestoneId: "health_baseline", priority: "urgent" as const, estimatedMinutes: 20, completed: false, createdAt: new Date().toISOString() }
  ];
  const newTaskIds = new Set(newTasks.map(item => item.id));

  return {
    ...state, startDate, endDate, personalScheduleSeedVersion: 6, personalPlanStartedAt: new Date().toISOString(),
    weeklyFocusGoalId: "G1", weeklySupportGoalIds: ["G2", "G3"], dailyFocusGoalId: "G1", goals: [...goals, ...legacyGoals], routines: [...routines, ...preservedRoutines],
    priorityTasks: [...newTasks, ...(state.priorityTasks || []).filter(item => !newTaskIds.has(item.id))],
    scheduleItems: [...combinedSchedule.values()].sort((a,b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    weeklyAvailability: [
      { dayOfWeek: 1, mode: "office", label: "Làm tại công ty", blockedStart: "08:30", blockedEnd: "18:30" },
      { dayOfWeek: 2, mode: "home", label: "Làm việc tại nhà", blockedStart: "09:00", blockedEnd: "18:00" },
      { dayOfWeek: 3, mode: "office", label: "Làm tại công ty", blockedStart: "08:30", blockedEnd: "18:30" },
      { dayOfWeek: 4, mode: "home", label: "Làm việc tại nhà", blockedStart: "09:00", blockedEnd: "18:00" },
      { dayOfWeek: 5, mode: "office", label: "Làm tại công ty", blockedStart: "08:30", blockedEnd: "18:30" },
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

  // Recommendation 1: G1 Outreach
  const g1Acts = state.activities.filter(a => a.goalId === "G1");
  if (g1Acts.length === 0) {
    recommendations.push({
      id: "rec_g1_start",
      goalId: "G1",
      title: "Khởi động tiếp cận khách hàng B2B",
      reason: "B2B SaaS là mục tiêu có độ ưu tiên cao nhất của bạn. Bạn chưa ghi nhận hoạt động outreach nào trong chu kỳ này.",
      minimumDayAlternative: "Lưu thông tin 1 lead tiềm năng và viết 1 câu mở đầu độc đáo.",
      type: "outreach"
    });
  } else {
    recommendations.push({
      id: "rec_g1_continue",
      goalId: "G1",
      title: "Gửi 15 email tiếp cận theo ICP",
      reason: "Tăng lượng outreach đều đặn để lấp đầy phễu khách hàng. G1 đang có sự tiến triển tốt.",
      minimumDayAlternative: "Gửi duy nhất 1 email chất lượng cao đã cá nhân hóa.",
      type: "outreach"
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
