export interface Milestone {
  id: string;
  goalId?: string; // or journeyId
  title: string;
  description?: string;
  type?: 'numeric' | 'completion' | 'repetition' | 'date_based';
  targetValue: string;
  currentValue: string;
  unit?: string;
  order?: number;
  dueDate: string;
  status?: 'locked' | 'active' | 'completed' | 'skipped';
  completedAt?: string | null;
  achieved: boolean;
  badge?: string;
  celebrationMessage?: string;
}

export type GoalCategory =
  | "business"
  | "marketing"
  | "fund_backtest"
  | "health"
  | "career"
  | "learning"
  | "finance"
  | "home"
  | "habit"
  | "project"
  | "custom";

export type GoalIconName =
  | "briefcase"
  | "megaphone"
  | "chart"
  | "heart"
  | "career"
  | "learning"
  | "finance"
  | "home"
  | "habit"
  | "project"
  | "target"
  | "rocket"
  | "dumbbell"
  | "globe"
  | "laptop"
  | "book"
  | "sparkles";

export interface Goal {
  id: string;
  name: string;
  description?: string; // standard journey description
  desiredOutcome: string;
  priority: 'highest' | 'secondary' | 'normal';
  deadline: string;
  startDate?: string;
  mainMetric: string;
  currentProgress: number; // 0 to 100
  currentMilestone: string;
  currentMilestoneId?: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  nextAction: string | null;
  accentColor: string; // Tailwind class e.g. blue, emerald, amber, purple, rose
  icon?: GoalIconName;
  category?: GoalCategory;
  milestones: Milestone[];
  notes: string;
}

export interface ActivityEntry {
  id: string;
  date: string; // YYYY-MM-DD
  goalId: string | null;
  milestoneId?: string | null;
  source?: 'voice' | 'text' | 'manual';
  originalTranscript?: string;
  activity: string;
  output: Record<string, any>;
  outcome: Record<string, any>;
  outcomeStatus?: 'pending' | 'measured' | 'not_applicable';
  outcomeReviewDate?: string | null;
  outcomeDecision?: 'continue' | 'adjust' | 'pause' | 'insufficient_data' | null;
  insight: string | null;
  nextAction: string | null;
  confidence: number;
  createdTimestamp: number;
  updatedTimestamp: number;
}

export interface Routine {
  id: string;
  goalId: string;
  name: string;
  frequency: string;
  minimumDay: string;
  target: string;
  evidence: string;
  status: 'completed' | 'pending' | 'missed';
  active?: boolean;
  /** 0 = Chủ nhật, 1 = Thứ hai ... 6 = Thứ bảy. Bỏ trống nghĩa là mỗi ngày. */
  scheduleDays?: number[];
  /** Giờ cố định và quy luật dùng để sinh lịch trong toàn bộ chu kỳ. */
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  recurrence?: 'daily' | 'weekly_days' | 'interval';
  intervalDays?: number;
  recurrenceStartDate?: string;
  calendarEnabled?: boolean;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'any';
  /** Các routine cùng nhóm có thể thay thế nhau trong một ngày. */
  substitutionGroup?: 'movement';
}

export interface WeeklyAvailability {
  dayOfWeek: number;
  mode: 'office' | 'home' | 'rest';
  label: string;
  blockedStart?: string;
  blockedEnd?: string;
}

export interface RoutineLog {
  id: string;
  routineId: string;
  goalId: string;
  date: string;
  status: 'minimum' | 'completed' | 'missed' | 'skipped';
  source: 'manual' | 'voice' | 'text' | 'ai';
  evidence?: string;
  activityId?: string | null;
  createdTimestamp: number;
  updatedTimestamp: number;
}

export type ChoreCategory = 'home' | 'pet' | 'errand' | 'self_care' | 'admin';
export type ChoreFrequency = 'daily' | 'weekly' | 'one_time';

export interface Chore {
  id: string;
  title: string;
  category: ChoreCategory;
  frequency: ChoreFrequency;
  dueDate?: string | null;
  dueTime?: string | null;
  completed: boolean;
  lastCompletedDate?: string | null;
  notes?: string;
  createdAt: string;
}

export type LifeAnchorIcon = 'cat' | 'spiritual' | 'meal' | 'self_care' | 'connection';

export interface LifeAnchor {
  id: string;
  title: string;
  description: string;
  icon: LifeAnchorIcon;
  frequency: 'daily' | 'weekly';
  lastCompletedDate?: string | null;
  active: boolean;
}

export interface Experiment {
  id: string;
  goalId: string;
  hypothesis: string;
  variable: string;
  startDate: string;
  reviewDate: string;
  mainMetric: string;
  guardrail: string;
  baseline: string;
  result: string | null;
  confidence: number;
  decision: 'continue' | 'adjust' | 'stop' | null;
  reason: string | null;
}

export interface WeeklyReview {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  planned: string;
  actual: string;
  outputs: Record<string, any>;
  outcomes: Record<string, any>;
  timeAllocation: Record<string, number>; // goalId -> percentage (0-100)
  wins: string;
  problems: string;
  lessons: string;
  adjustments: string;
  status: 'continue' | 'adjust' | 'paused' | 'stop';
  submitted: boolean;
}

export interface Recommendation {
  id: string;
  goalId: string;
  title: string;
  reason: string;
  minimumDayAlternative: string;
  type: 'outreach' | 'recuperate' | 'health' | 'routine' | 'warning';
}

export interface B2BLead {
  id: string;
  companyName: string;
  contactPerson: string;
  status: 'lead' | 'outreached' | 'replied' | 'meeting' | 'proposal' | 'pilot' | 'paying';
  notes: string;
  updatedAt: string;
}

export interface JobApplication {
  id: string;
  companyName: string;
  role: string;
  salary: string;
  status: 'applied' | 'interviewing' | 'offered' | 'rejected';
  notes: string;
  updatedAt: string;
}

export interface HealthRecord {
  date: string; // YYYY-MM-DD
  weight: number | null;
  sleepHours: number | null;
  energy: number | null; // 1 to 5
  steps: number | null;
  strengthSession: boolean;
  eatOnPlan: boolean;
  skincare: boolean;
  styleAndAppearance: boolean;
  notes: string;
}

export interface LifestyleRecord {
  date: string; // YYYY-MM-DD
  homeReset15m: boolean;
  kitchenReset: boolean;
  laundry: boolean;
  mealPrep: boolean;
  catCare: boolean;
  deepClean: boolean;
  declutter: boolean;
  dateNight: boolean;
  weeklyReview: boolean;
}

export interface BatchTestRecord {
  id: string;
  date: string; // YYYY-MM-DD
  setup: string;
  instrument: string;
  plannedRisk: number; // e.g. 0.5% or 1%
  riskRewardRatio: number; // e.g. 2 or 3
  resultR: number; // e.g. +3 or -1
  checklistCompliance: boolean;
  ruleViolations: string[];
  simulatedEquity: number;
  lessons: string;
  eligibilityStatus: 'eligible' | 'warning' | 'failed';
}

export interface EvidenceRecommendation {
  id: string;
  goalId: string;
  recommendedAction: string;
  reason: string;
  userEvidence: string;
  patternOrPrinciple: string;
  expectedOutcome: string;
  successMetric: string;
  reviewDate: string;
  confidence: 'Low' | 'Medium' | 'High';
  minimumDay: string;
  status: 'pending' | 'accepted' | 'postponed' | 'rejected';
  createdDate: string; // YYYY-MM-DD
  decisionNotes?: string;
  feedback?: string;
}

export interface PriorityTask {
  id: string;
  title: string;
  description?: string;
  goalId?: string | null; // can be goalId or journeyId
  journeyId?: string | null;
  milestoneId?: string | null;
  priority: 'important_urgent' | 'important' | 'urgent' | 'later';
  estimatedMinutes?: number;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  dueDate?: string | null;
  completed: boolean;
  createdAt?: string;
  completedAt?: string | null;
  startedAt?: string | null;
  status?: 'ready' | 'in_progress' | 'blocked' | 'waiting' | 'completed' | 'dropped';
  blockedReason?: string | null;
  waitingUntil?: string | null;
  requiresOutcome?: boolean;
  successMetric?: string | null;
  activityType?: 'execution' | 'experiment' | 'outreach' | 'application' | 'health' | 'maintenance';
}

export interface FocusSession {
  id: string;
  title: string;
  taskId?: string | null;
  goalId: string;
  milestoneId?: string | null;
  date: string;
  plannedMinutes: number;
  startedAt: string;
  elapsedSeconds: number;
  status: 'active' | 'paused';
}

export interface ScheduleItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  estimatedMinutes?: number;
  goalId?: string | null;
  journeyId?: string | null;
  milestoneId?: string | null;
  taskId?: string | null;
  routineId?: string | null;
  type?: 'task' | 'habit' | 'review' | 'milestone' | 'personal';
  notes?: string;
  completed?: boolean;
  reminderMinutes?: number;
}

export interface AIChangeRecord {
  id: string;
  createdAt: string;
  summary: string;
  source: 'voice' | 'text' | 'coach';
  status: 'applied' | 'undone';
  beforeState: string;
  counts: {
    activities: number;
    tasks: number;
    schedules: number;
  };
}

export interface CoachHistoryEntry {
  id: string;
  createdAt: string;
  expertLens: string;
  question: string;
  diagnosis: string;
  nextAction: string;
  successMetric: string;
  reasoning?: string;
  status: 'saved' | 'applied';
}

export interface AppState {
  startDate: string;
  endDate: string;
  personalScheduleSeedVersion?: number;
  dailyFocusGoalId?: string | null;
  dailyFocusDate?: string | null;
  weeklyFocusGoalId?: string | null;
  weeklySupportGoalIds?: string[];
  onboardingCompleted?: boolean;
  activeFocusSession?: FocusSession | null;
  dailyMode?: 'normal' | 'busy' | 'recovery';
  dailyModeDate?: string | null;
  goals: Goal[];
  activities: ActivityEntry[];
  routines: Routine[];
  routineLogs?: RoutineLog[];
  lifeAnchors?: LifeAnchor[];
  chores?: Chore[];
  experiments: Experiment[];
  weeklyReviews: WeeklyReview[];
  b2bLeads: B2BLead[];
  jobApplications: JobApplication[];
  healthRecords: Record<string, HealthRecord>; // date string -> Record
  lifestyleRecords: Record<string, LifestyleRecord>; // date string -> Record
  batchTestRecords: BatchTestRecord[];
  evidenceRecommendations?: EvidenceRecommendation[];
  aiChangeHistory?: AIChangeRecord[];
  coachHistory?: CoachHistoryEntry[];
  priorityTasks?: PriorityTask[];
  scheduleItems?: ScheduleItem[];
  weeklyAvailability?: WeeklyAvailability[];
}
