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
  source?: 'voice' | 'text' | 'manual';
  originalTranscript?: string;
  activity: string;
  output: Record<string, any>;
  outcome: Record<string, any>;
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
  type?: 'task' | 'habit' | 'review' | 'milestone' | 'personal';
  notes?: string;
  completed?: boolean;
  reminderMinutes?: number;
}

export interface AppState {
  startDate: string;
  endDate: string;
  dailyFocusGoalId?: string | null;
  dailyFocusDate?: string | null;
  goals: Goal[];
  activities: ActivityEntry[];
  routines: Routine[];
  routineLogs?: RoutineLog[];
  experiments: Experiment[];
  weeklyReviews: WeeklyReview[];
  b2bLeads: B2BLead[];
  jobApplications: JobApplication[];
  healthRecords: Record<string, HealthRecord>; // date string -> Record
  lifestyleRecords: Record<string, LifestyleRecord>; // date string -> Record
  batchTestRecords: BatchTestRecord[];
  evidenceRecommendations?: EvidenceRecommendation[];
  priorityTasks?: PriorityTask[];
  scheduleItems?: ScheduleItem[];
}
