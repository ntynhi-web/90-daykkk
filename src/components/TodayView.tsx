import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, MicOff, Send, HelpCircle, Flame, Calendar, Trash2, Plus, CheckCircle, 
  AlertTriangle, Play, Sparkles, AlertCircle, Edit, ArrowRight, Loader, Save, Check, Clock, Eye,
  ListTodo, Siren, Brain, Zap, Archive, Target, Repeat2, MessageSquareText, Bot, Gauge, Lightbulb, CalendarClock, Undo2
} from "lucide-react";
import { AppState, Goal, Routine, ActivityEntry, PriorityTask, ScheduleItem, Chore, ChoreCategory, ChoreFrequency, CoachHistoryEntry } from "../types";
import { calculateEndDate, getCycleStats, saveCheckInToState, formatDisplayDate, getPersonalFixedSchedule, isScheduleValidForDate } from "../utils";
import GoalIcon from "./GoalIcon";
import FocusOverview from "./FocusOverview";
import LifeOperations from "./LifeOperations";
import { expandRecurringSchedule, expandRoutine, mergeScheduleItems, ScheduleRecurrence } from "../recurrence";

interface TodayViewProps {
  state: AppState;
  onChangeState: (newState: AppState) => void;
  onOpenProgress?: () => void;
}

export default function TodayView({ state, onChangeState, onOpenProgress }: TodayViewProps) {
  // Helpers
  const getHoChiMinhDate = (daysOffset = 0) => {
    const date = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000);
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(date);
  };

  const todayStr = getHoChiMinhDate(0);
  const { currentDay, daysRemaining } = getCycleStats(state.startDate, todayStr, state.endDate);
  const beforeCycle = todayStr < state.startDate;

  const handleStartPersonalPlanToday = () => {
    if (!window.confirm(`Bắt đầu chu kỳ hiện tại từ hôm nay ${formatDisplayDate(todayStr)}? App sẽ dời deadline và lịch theo cùng số ngày, nhưng không xóa nhật ký hiện có.`)) return;
    const oldStart = new Date(`${state.startDate}T12:00:00`);
    const nextStart = new Date(`${todayStr}T12:00:00`);
    const deltaDays = Math.round((nextStart.getTime() - oldStart.getTime()) / (24 * 60 * 60 * 1000));
    const shiftDate = (value?: string | null) => {
      if (!value) return value;
      const date = new Date(`${value}T12:00:00`);
      if (Number.isNaN(date.getTime())) return value;
      date.setDate(date.getDate() + deltaDays);
      return date.toISOString().slice(0, 10);
    };
    const nextEndDate = calculateEndDate(todayStr);
    const shiftedFlexibleItems = (state.scheduleItems || [])
      .filter(item => !item.id.startsWith('fixed_') && !item.routineId)
      .map(item => ({ ...item, date: shiftDate(item.date) || item.date }));
    const fixedItems = getPersonalFixedSchedule(todayStr, nextEndDate);
    const recurringItems = state.routines.flatMap(routine => expandRoutine(routine, todayStr, nextEndDate));
    const nextSchedule = mergeScheduleItems(mergeScheduleItems(shiftedFlexibleItems, fixedItems), recurringItems);
    onChangeState({
      ...state,
      startDate: todayStr,
      endDate: nextEndDate,
      personalPlanStartedAt: new Date().toISOString(),
      dailyFocusDate: null,
      dailyModeDate: todayStr,
      weeklyFocusGoalId: 'G1',
      weeklySupportGoalIds: ['G2', 'G3'],
      goals: state.goals.map(goal => ({
        ...goal,
        startDate: todayStr,
        deadline: shiftDate(goal.deadline) || goal.deadline,
        milestones: (goal.milestones || []).map(milestone => ({ ...milestone, dueDate: shiftDate(milestone.dueDate) || milestone.dueDate }))
      })),
      priorityTasks: (state.priorityTasks || []).map(task => ({ ...task, dueDate: shiftDate(task.dueDate) })),
      scheduleItems: nextSchedule,
      chores: (state.chores || []).map(chore => ({ ...chore, dueDate: shiftDate(chore.dueDate) }))
    });
    setSaveNotice(`Đã bắt đầu chu kỳ mới từ ${formatDisplayDate(todayStr)}. Dữ liệu đang được đồng bộ vào tài khoản của bạn.`);
  };

  // Core States
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [isCoaching, setIsCoaching] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachAdvice, setCoachAdvice] = useState<any | null>(null);
  const [coachLens, setCoachLens] = useState<'auto' | 'fund_backtest' | 'b2b_marketing' | 'career' | 'health_beauty'>('auto');
  const [captureExpanded, setCaptureExpanded] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Interactive Confirmation State
  const [editableCheckIn, setEditableCheckIn] = useState<{
    summary: string;
    activities: Array<{
      activity: string;
      journeyId: string | null;
      milestoneId: string | null;
      confidence: number;
      evidence: string;
    }>;
    milestoneUpdates: Array<{
      journeyId: string;
      milestoneId: string;
      suggestedStatus: string;
      confidence: number;
      evidence: string;
    }>;
    taskSuggestions: Array<{
      title: string;
      journeyId: string | null;
      priority: 'important_urgent' | 'important' | 'urgent' | 'later';
      estimatedMinutes: number;
      dueDate: string | null;
      timeframe: 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'specific_date' | 'no_date';
    }>;
    scheduleSuggestions: Array<{
      title: string;
      date: string;
      startTime: string;
      endTime: string;
      journeyId: string | null;
      recurrence: ScheduleRecurrence;
      intervalDays?: number;
      scheduleDays?: number[];
      recurrenceEndDate?: string | null;
    }>;
    routineUpdates: Array<{
      routineId: string;
      suggestedStatus: string;
      confidence: number;
      evidence: string;
    }>;
    choreUpdates: Array<{
      choreId: string | null;
      title: string;
      category: ChoreCategory;
      frequency: ChoreFrequency;
      dueDate: string | null;
      suggestedStatus: 'completed' | 'create';
      confidence: number;
      evidence: string;
    }>;
    cycleUpdate: {
      startDate: string;
      shiftPlan: boolean;
      reason: string;
    } | null;
    unclassifiedItems: string[];
  } | null>(null);

  // Section 1: Priority Tasks States
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<'important_urgent' | 'important' | 'urgent' | 'later'>('important_urgent');
  const [newTaskJourneyId, setNewTaskJourneyId] = useState("");
  const [journalDraft, setJournalDraft] = useState({ work: "", result: "", lesson: "", goalId: "G1" });
  const [unexpectedDraft, setUnexpectedDraft] = useState({ title: "", priority: "urgent" as PriorityTask['priority'], goalId: "", startTime: "", endTime: "" });

  // Speech recognition ref
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const analyzeAfterStopRef = useRef(false);

  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognitionAPI);

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Timer for display while recording
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = () => {
    setMicError(null);
    setVoiceNotice(null);
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setMicError("Nhận diện giọng nói không được hỗ trợ trên trình duyệt này. Vui lòng thử trên Google Chrome hoặc Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "vi-VN";

      recognition.onstart = () => {
        finalTranscriptRef.current = transcript.trim();
        interimTranscriptRef.current = "";
        analyzeAfterStopRef.current = false;
        setIsRecording(true);
        setMicError(null);
        setRecordingSeconds(0);
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const phrase = event.results[index][0]?.transcript?.trim();
          if (!phrase) continue;
          if (event.results[index].isFinal) {
            finalTranscriptRef.current = `${finalTranscriptRef.current} ${phrase}`.trim();
          } else {
            interim += `${phrase} `;
          }
        }
        interimTranscriptRef.current = interim.trim();
        const captured = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
        setTranscript(captured);
        setVoiceNotice(captured ? "Đang ghi nhận nội dung giọng nói…" : null);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setMicError("Vui lòng cấp quyền truy cập Microphone cho trình duyệt để sử dụng.");
        } else if (event.error !== "no-speech" && event.error !== "aborted") {
          setMicError(`Lỗi nhận diện giọng nói: ${event.error}`);
        }
      };

      recognition.onend = () => {
        const captured = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
        if (captured) {
          setTranscript(captured);
          setVoiceNotice(analyzeAfterStopRef.current ? "Đã ghi nhận. Đang phân tích nội dung…" : "Đã ghi nhận giọng nói. Bạn có thể kiểm tra rồi gửi phân tích AI.");
        }
        setIsRecording(false);
        if (analyzeAfterStopRef.current && captured) {
          analyzeAfterStopRef.current = false;
          handleAnalyzeTranscript(captured);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (err: any) {
      console.error("Speech recognition start error:", err);
      setMicError("Không thể kích hoạt nhận dạng giọng nói.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      analyzeAfterStopRef.current = true;
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  // Spelling check using AI spelling correct
  const handleRefineTranscript = async () => {
    if (!transcript.trim()) return;
    setIsRefining(true);
    setRefineError(null);
    try {
      const response = await fetch("/api/refine-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript })
      });
      if (!response.ok) {
        throw new Error("Không thể kết nối đến máy chủ hiệu đính.");
      }
      const data = await response.json();
      if (data.refined) {
        setTranscript(data.refined);
      }
    } catch (err: any) {
      setRefineError(err.message || "Gặp lỗi khi hiệu đính văn bản.");
    } finally {
      setIsRefining(false);
    }
  };

  const getLocalTemporalFallback = (rawText: string) => {
    const addDays = (dateStr: string, days: number) => {
      const date = new Date(`${dateStr}T12:00:00`);
      date.setDate(date.getDate() + days);
      return date.toISOString().slice(0, 10);
    };
    const getWeekEnd = (weekOffset: number) => {
      const date = new Date(`${todayStr}T12:00:00`);
      const weekday = date.getDay() || 7;
      return addDays(todayStr, (7 - weekday) + weekOffset * 7);
    };
    const sentences = rawText.split(/[.!?\n]+/).map(item => item.trim()).filter(Boolean);
    const taskSuggestions: Array<any> = [];
    const scheduleSuggestions: Array<any> = [];
    const activities: Array<any> = [];

    sentences.forEach(sentence => {
      const normalized = sentence.toLowerCase();
      const pointTime = normalized.match(/(?:lúc|vào)\s*(\d{1,2})(?:\s*(?:h|giờ|:)(\d{1,2})?)?/i);
      const recurringDaily = /mỗi ngày|hàng ngày|7\s*ngày\s*(?:mỗi|một)\s*tuần|bảy ngày một tuần/i.test(normalized);
      const intervalMatch = normalized.match(/(?:mỗi|cách nhau)\s*(\d+)\s*ngày|(?:7|bảy)\s*ngày\s*(?:một|1)\s*lần/i);
      const weekdayMap: Array<[RegExp, number]> = [[/chủ nhật/i, 0], [/thứ hai|thứ 2/i, 1], [/thứ ba|thứ 3/i, 2], [/thứ tư|thứ 4/i, 3], [/thứ năm|thứ 5/i, 4], [/thứ sáu|thứ 6/i, 5], [/thứ bảy|thứ 7/i, 6]];
      const selectedDays = weekdayMap.filter(([pattern]) => pattern.test(normalized)).map(([, day]) => day);
      if (pointTime && (recurringDaily || intervalMatch || selectedDays.length > 0)) {
        const startHour = String(Number(pointTime[1])).padStart(2, '0');
        const startMinute = String(Number(pointTime[2] || 0)).padStart(2, '0');
        const startTotal = Number(startHour) * 60 + Number(startMinute);
        const endTotal = Math.min(startTotal + 30, 23 * 60 + 59);
        const title = sentence.replace(/\b(tôi|mình)\s+(muốn|sẽ|cần|định)\s*/gi, '').trim();
        const journeyId = /backtest|fund|trading|setup/i.test(sentence) ? 'G1' : /b2b|marketing|sales/i.test(sentence) ? 'G2' : /yoga|sức khỏe|health|đi bộ/i.test(sentence) ? 'G3' : null;
        scheduleSuggestions.push({
          title, date: todayStr, startTime: `${startHour}:${startMinute}`,
          endTime: `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`,
          journeyId,
          recurrence: recurringDaily ? 'daily' : intervalMatch ? 'interval' : 'weekly_days',
          intervalDays: intervalMatch ? Number(intervalMatch[1] || 7) : undefined,
          scheduleDays: selectedDays.length ? selectedDays : undefined,
          recurrenceEndDate: state.endDate
        });
        return;
      }
      let timeframe: 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'specific_date' | 'no_date' = 'no_date';
      let dueDate: string | null = null;
      if (/\b(ngày mai|mai)\b/.test(normalized)) {
        timeframe = 'tomorrow';
        dueDate = addDays(todayStr, 1);
      } else if (normalized.includes('tuần sau')) {
        timeframe = 'next_week';
        dueDate = getWeekEnd(1);
      } else if (normalized.includes('tuần này')) {
        timeframe = 'this_week';
        dueDate = getWeekEnd(0);
      } else if (/\b(hôm nay|bữa nay)\b/.test(normalized)) {
        timeframe = 'today';
        dueDate = todayStr;
      }

      const isFuturePlan = timeframe !== 'no_date' && /\b(muốn|sẽ|cần|định|làm|hoàn thành|xếp lịch|lên lịch)\b/.test(normalized);
      if (isFuturePlan && dueDate) {
        const title = sentence
          .replace(/\b(hôm nay|bữa nay|ngày mai|mai|tuần này|tuần sau)\b/gi, '')
          .replace(/\b(tôi|mình)\s+(muốn|sẽ|cần|định)\s*/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        const journeyId = /backtest|fund|trading|setup/i.test(sentence)
          ? 'G1'
          : /b2b|website|portfolio|email|marketing|sales/i.test(sentence)
            ? 'G2'
            : /sức khỏe|health|đi bộ|cân|skincare/i.test(sentence)
              ? 'G3'
              : null;
        const timeRange = normalized.match(/(?:từ\s*)?(\d{1,2})(?:\s*(?:h|giờ|:)(\d{1,2})?)?\s*(?:đến|-)\s*(\d{1,2})(?:\s*(?:h|giờ|:)(\d{1,2})?)?/i);
        taskSuggestions.push({ title, journeyId, priority: 'important', estimatedMinutes: timeRange ? 60 : 30, dueDate, timeframe });
        if (timeRange && (timeframe === 'today' || timeframe === 'tomorrow')) {
          const startHour = String(Number(timeRange[1])).padStart(2, '0');
          const startMinute = String(Number(timeRange[2] || 0)).padStart(2, '0');
          const endHour = String(Number(timeRange[3])).padStart(2, '0');
          const endMinute = String(Number(timeRange[4] || 0)).padStart(2, '0');
          scheduleSuggestions.push({ title, date: dueDate, startTime: `${startHour}:${startMinute}`, endTime: `${endHour}:${endMinute}`, journeyId });
        }
      } else {
        activities.push({ activity: sentence, journeyId: null, milestoneId: null, confidence: 0.5, evidence: 'Dữ liệu được giữ lại khi AI tạm hết hạn mức.' });
      }
    });

    return { activities, taskSuggestions, scheduleSuggestions };
  };

  // Classify transcript via server API
  const handleAnalyzeTranscript = async (textToAnalyze: string) => {
    if (!textToAnalyze.trim()) return;
    
    setIsClassifying(true);
    setClassificationError(null);
    setShowConfirmModal(true);

    const activeGoals = (state.goals || [])
      .filter(g => g.status === "active");

    const activeRoutines = (state.routines || []);

    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: textToAnalyze,
          currentDate: todayStr,
          currentCycle: { startDate: state.startDate, endDate: state.endDate },
          goals: activeGoals,
          routines: activeRoutines,
          chores: state.chores || []
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Không thể kết nối với dịch vụ AI.");
      }

      const data = await response.json();
      setEditableCheckIn({
        summary: data.summary || "Tóm tắt check-in",
        activities: (data.activities || []).map((a: any) => ({
          activity: a.activity,
          journeyId: a.journeyId && a.journeyId !== "null" ? a.journeyId : null,
          milestoneId: a.milestoneId && a.milestoneId !== "null" ? a.milestoneId : null,
          confidence: a.confidence || 0.9,
          evidence: a.evidence || ""
        })),
        milestoneUpdates: (data.milestoneUpdates || []).map((m: any) => ({
          journeyId: m.journeyId,
          milestoneId: m.milestoneId,
          suggestedStatus: m.suggestedStatus || "completed",
          confidence: m.confidence || 0.9,
          evidence: m.evidence || ""
        })),
        taskSuggestions: (data.taskSuggestions || []).map((t: any) => ({
          title: t.title,
          journeyId: t.journeyId && t.journeyId !== "null" ? t.journeyId : null,
          priority: t.priority || 'important_urgent',
          estimatedMinutes: t.estimatedMinutes || 30,
          dueDate: t.dueDate || null,
          timeframe: t.timeframe || "no_date"
        })),
        scheduleSuggestions: (data.scheduleSuggestions || []).map((s: any) => ({
          title: s.title,
          date: s.date || todayStr,
          startTime: s.startTime || "09:00",
          endTime: s.endTime || "10:00",
          journeyId: s.journeyId && s.journeyId !== "null" ? s.journeyId : null,
          recurrence: s.recurrence || 'once',
          intervalDays: s.intervalDays || undefined,
          scheduleDays: Array.isArray(s.scheduleDays) ? s.scheduleDays : undefined,
          recurrenceEndDate: s.recurrenceEndDate || null
        })),
        routineUpdates: (data.routineUpdates || []).map((r: any) => ({
          routineId: r.routineId,
          suggestedStatus: r.suggestedStatus || "completed",
          confidence: r.confidence || 0.9,
          evidence: r.evidence || ""
        })),
        choreUpdates: (data.choreUpdates || []).map((chore: any) => ({
          choreId: chore.choreId && chore.choreId !== "null" ? chore.choreId : null,
          title: chore.title || "Chore chưa đặt tên",
          category: chore.category || "home",
          frequency: chore.frequency || "one_time",
          dueDate: chore.dueDate || todayStr,
          suggestedStatus: chore.suggestedStatus || "completed",
          confidence: chore.confidence || 0.9,
          evidence: chore.evidence || ""
        })),
        cycleUpdate: data.cycleUpdate?.startDate ? {
          startDate: data.cycleUpdate.startDate,
          shiftPlan: data.cycleUpdate.shiftPlan !== false,
          reason: data.cycleUpdate.reason || "Người dùng muốn đổi ngày bắt đầu chu kỳ."
        } : null,
        unclassifiedItems: data.unclassifiedItems || []
      });

    } catch (err: any) {
      console.error(err);
      const localFallback = getLocalTemporalFallback(textToAnalyze);
      const quotaLimited = String(err.message || '').includes('429') || String(err.message || '').toLowerCase().includes('quota');
      setClassificationError(quotaLimited
        ? "Gemini đã hết lượt miễn phí tạm thời. App vẫn phân loại ngày và giờ bằng chế độ dự phòng cục bộ."
        : (err.message || "Gặp lỗi khi xử lý phân loại bằng AI."));
      
      // Fallback state
      setEditableCheckIn({
        summary: quotaLimited ? "Đã phân loại thời gian cục bộ vì Gemini tạm hết lượt" : "Cập nhật thủ công (Phân tích AI bị gián đoạn)",
        activities: localFallback.activities,
        milestoneUpdates: [],
        taskSuggestions: localFallback.taskSuggestions,
        scheduleSuggestions: localFallback.scheduleSuggestions,
        routineUpdates: [],
        choreUpdates: [],
        cycleUpdate: null,
        unclassifiedItems: []
      });
    } finally {
      setIsClassifying(false);
    }
  };

  const handleAskCoach = async () => {
    if (!transcript.trim()) return;
    setIsCoaching(true);
    setCoachError(null);
    setCoachAdvice(null);
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: transcript, state, preferredLens: coachLens })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Không thể kết nối Life OS Coach.");
      setCoachAdvice(data);
    } catch (err: any) {
      setCoachError(err.message || "Life OS Coach gặp sự cố.");
    } finally {
      setIsCoaching(false);
    }
  };

  // Confirm and apply the parsed elements to state
  const handleConfirmAndSave = () => {
    if (!editableCheckIn) return;

    let updatedState = { ...state };
    let createdTasks: PriorityTask[] = [];
    const { aiChangeHistory: _history, ...stateBeforeAIChange } = state;

    // 0. Apply a confirmed 90-day cycle command and preserve the plan's relative timing.
    if (editableCheckIn.cycleUpdate) {
      const nextStartDate = editableCheckIn.cycleUpdate.startDate;
      const oldStart = new Date(`${state.startDate}T12:00:00`);
      const nextStart = new Date(`${nextStartDate}T12:00:00`);
      const deltaDays = Math.round((nextStart.getTime() - oldStart.getTime()) / (24 * 60 * 60 * 1000));
      const shiftDate = (value?: string | null) => {
        if (!value || !editableCheckIn.cycleUpdate?.shiftPlan) return value;
        const date = new Date(`${value}T12:00:00`);
        if (Number.isNaN(date.getTime())) return value;
        date.setDate(date.getDate() + deltaDays);
        return date.toISOString().slice(0, 10);
      };

      updatedState.startDate = nextStartDate;
      updatedState.endDate = calculateEndDate(nextStartDate);
      updatedState.dailyFocusDate = null;
      updatedState.goals = updatedState.goals.map(goal => ({
        ...goal,
        startDate: nextStartDate,
        deadline: shiftDate(goal.deadline) || goal.deadline,
        milestones: (goal.milestones || []).map(milestone => ({
          ...milestone,
          dueDate: shiftDate(milestone.dueDate) || milestone.dueDate
        }))
      }));
      updatedState.priorityTasks = (updatedState.priorityTasks || []).map(task => ({
        ...task,
        dueDate: shiftDate(task.dueDate)
      }));
      updatedState.scheduleItems = (updatedState.scheduleItems || []).map(item => ({
        ...item,
        date: shiftDate(item.date) || item.date
      }));
      updatedState.chores = (updatedState.chores || []).map(chore => ({
        ...chore,
        dueDate: shiftDate(chore.dueDate)
      }));
    }

    // 1. Add activities
    const newActivities = editableCheckIn.activities.map(act => ({
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      goalId: act.journeyId || null,
      date: todayStr,
      activity: act.activity,
      category: act.journeyId ? (state.goals.find(g => g.id === act.journeyId)?.name || "Chung") : "Chung",
      output: {},
      outcome: {},
      insight: "",
      nextAction: "",
      confidence: act.confidence,
      classificationReason: act.evidence
    }));
    updatedState.activities = [...newActivities, ...updatedState.activities];

    // 2. Apply routine completion updates
    editableCheckIn.routineUpdates.forEach(ru => {
      updatedState.routines = updatedState.routines.map(r => {
        if (r.id === ru.routineId) {
          return { ...r, status: "completed" as const };
        }
        return r;
      });

      const routine = updatedState.routines.find(r => r.id === ru.routineId);
      if (routine && ru.suggestedStatus === "completed") {
        const existingLog = (updatedState.routineLogs || []).find(log =>
          log.routineId === ru.routineId && log.date === todayStr
        );
        const linkedActivity = newActivities.find(activity => activity.goalId === routine.goalId);
        const now = Date.now();
        const nextLog = {
          id: existingLog?.id || `routine_log_${ru.routineId}_${todayStr}`,
          routineId: ru.routineId,
          goalId: routine.goalId,
          date: todayStr,
          status: "completed" as const,
          source: "ai" as const,
          evidence: ru.evidence || linkedActivity?.activity || routine.target,
          activityId: linkedActivity?.id || existingLog?.activityId || null,
          createdTimestamp: existingLog?.createdTimestamp || now,
          updatedTimestamp: now
        };
        updatedState.routineLogs = [
          nextLog,
          ...(updatedState.routineLogs || []).filter(log => !(log.routineId === ru.routineId && log.date === todayStr))
        ];
      }
    });

    const completedYoga = editableCheckIn.routineUpdates.some(update => {
      const routine = updatedState.routines.find(item => item.id === update.routineId);
      return update.suggestedStatus === 'completed' && routine?.substitutionGroup === 'movement' && routine.name.toLowerCase().includes('yoga');
    });
    if (completedYoga) {
      const walkingRoutine = updatedState.routines.find(routine => routine.substitutionGroup === 'movement' && routine.name.toLowerCase().includes('đi bộ'));
      if (walkingRoutine) {
        const existingWalkingLog = (updatedState.routineLogs || []).find(log => log.routineId === walkingRoutine.id && log.date === todayStr);
        const now = Date.now();
        const skippedWalking = {
          id: existingWalkingLog?.id || `routine_log_${walkingRoutine.id}_${todayStr}`,
          routineId: walkingRoutine.id,
          goalId: walkingRoutine.goalId,
          date: todayStr,
          status: 'skipped' as const,
          source: 'ai' as const,
          evidence: 'Được thay bằng Yoga — không tính là bỏ thói quen.',
          activityId: existingWalkingLog?.activityId || null,
          createdTimestamp: existingWalkingLog?.createdTimestamp || now,
          updatedTimestamp: now
        };
        updatedState.routineLogs = [skippedWalking, ...(updatedState.routineLogs || []).filter(log => !(log.routineId === walkingRoutine.id && log.date === todayStr))];
      }
    }

    // 2b. Complete an existing chore or create a newly recognized life-maintenance item.
    editableCheckIn.choreUpdates.forEach((update, index) => {
      const existing = (updatedState.chores || []).find(chore =>
        chore.id === update.choreId || chore.title.trim().toLowerCase() === update.title.trim().toLowerCase()
      );
      if (existing && update.suggestedStatus === "completed") {
        updatedState.chores = (updatedState.chores || []).map(chore => {
          if (chore.id !== existing.id) return chore;
          return chore.frequency === "one_time"
            ? { ...chore, completed: true, lastCompletedDate: todayStr }
            : { ...chore, lastCompletedDate: todayStr };
        });
      } else if (!existing) {
        const nextChore: Chore = {
          id: `chore_ai_${Date.now()}_${index}`,
          title: update.title,
          category: update.category,
          frequency: update.frequency,
          dueDate: update.dueDate || todayStr,
          completed: update.suggestedStatus === "completed",
          lastCompletedDate: update.suggestedStatus === "completed" ? todayStr : null,
          notes: update.evidence,
          createdAt: new Date().toISOString()
        };
        updatedState.chores = [...(updatedState.chores || []), nextChore];
      }
    });

    // 3. Apply milestone updates
    editableCheckIn.milestoneUpdates.forEach(mu => {
      updatedState.goals = updatedState.goals.map(g => {
        if (g.id === mu.journeyId) {
          const updatedMilestones = (g.milestones || []).map(m => {
            if (m.id === mu.milestoneId) {
              return {
                ...m,
                achieved: mu.suggestedStatus === "completed" ? true : m.achieved
              };
            }
            return m;
          });
          return { ...g, milestones: updatedMilestones };
        }
        return g;
      });
    });

    // Recalculate journey progress immediately after confirmed milestone updates.
    // This keeps every activity check-in, milestone and dashboard percentage in sync.
    updatedState.goals = updatedState.goals.map(goal => {
      const milestones = goal.milestones || [];
      if (milestones.length === 0) return goal;
      const completedCount = milestones.filter(m => m.achieved).length;
      const nextMilestone = milestones.find(m => !m.achieved) || null;
      const progress = Math.round((completedCount / milestones.length) * 100);
      return {
        ...goal,
        currentProgress: progress,
        currentMilestone: nextMilestone?.title || "Đã hoàn thành",
        currentMilestoneId: nextMilestone?.id || null,
        status: progress === 100 ? "completed" as const : goal.status
      };
    });

    // 4. Add task suggestions as real priority tasks
    if (editableCheckIn.taskSuggestions.length > 0) {
      const newTasks: PriorityTask[] = editableCheckIn.taskSuggestions.map((t, idx) => ({
        id: `task_${Date.now()}_${idx}`,
        title: t.title,
        priority: t.priority,
        completed: false,
        journeyId: t.journeyId,
        dueDate: t.dueDate,
        estimatedMinutes: t.estimatedMinutes,
        createdAt: new Date().toISOString()
      }));
      createdTasks = newTasks;
      updatedState.priorityTasks = [...(updatedState.priorityTasks || []), ...newTasks];
    }

    // 5. Add schedule suggestions as real schedule items
    if (editableCheckIn.scheduleSuggestions.length > 0) {
      const recurringRoutines: Routine[] = editableCheckIn.scheduleSuggestions
        .filter(s => s.recurrence && s.recurrence !== 'once' && s.journeyId)
        .map((s, idx) => ({
          id: `routine_ai_${Date.now()}_${idx}`,
          goalId: s.journeyId as string,
          name: s.title,
          frequency: s.recurrence === 'daily' ? 'Mỗi ngày' : s.recurrence === 'interval' ? `Mỗi ${s.intervalDays || 7} ngày` : 'Các thứ cố định',
          minimumDay: `Thực hiện từ ${s.startTime} đến ${s.endTime}`,
          target: `Hoàn thành lúc ${s.endTime}`,
          evidence: 'Đánh dấu hoàn thành trong lịch hoặc routine.',
          status: 'pending', active: true, calendarEnabled: true,
          recurrence: s.recurrence as Exclude<ScheduleRecurrence, 'once'>,
          intervalDays: s.intervalDays,
          scheduleDays: s.scheduleDays,
          recurrenceStartDate: s.date,
          startTime: s.startTime,
          endTime: s.endTime
        }));
      const newScheds: ScheduleItem[] = editableCheckIn.scheduleSuggestions.flatMap((s, idx) => {
        const routine = s.recurrence !== 'once' ? recurringRoutines.find(item => item.name === s.title && item.startTime === s.startTime) : undefined;
        return expandRecurringSchedule({ ...s, routineId: routine?.id || null }, state.startDate, state.endDate).map(item => ({
          ...item,
          taskId: createdTasks.find(task => task.title.trim().toLowerCase() === s.title.trim().toLowerCase() || (task.journeyId === s.journeyId && task.dueDate === s.date))?.id || null
        }));
      });
      updatedState.routines = [...updatedState.routines, ...recurringRoutines];
      updatedState.scheduleItems = mergeScheduleItems(updatedState.scheduleItems || [], newScheds);
    }

    const changeRecord = {
      id: `ai_change_${Date.now()}`,
      createdAt: new Date().toISOString(),
      summary: editableCheckIn.summary || "Cập nhật từ check-in AI",
      source: (isRecording ? "voice" : "text") as 'voice' | 'text',
      status: "applied" as const,
      beforeState: JSON.stringify(stateBeforeAIChange),
      counts: {
        activities: editableCheckIn.activities.length,
        tasks: editableCheckIn.taskSuggestions.length,
        schedules: editableCheckIn.scheduleSuggestions.length
      }
    };
    updatedState.aiChangeHistory = [changeRecord, ...(state.aiChangeHistory || [])].slice(0, 5);
    setSaveNotice(`Đã lưu ${editableCheckIn.activities.length} hoạt động, ${editableCheckIn.taskSuggestions.length} việc và ${editableCheckIn.scheduleSuggestions.length} quy tắc lịch.`);
    onChangeState(updatedState);
    setShowConfirmModal(false);
    setTranscript("");
    setEditableCheckIn(null);
  };

  const handleUndoLastSave = () => {
    const latestApplied = (state.aiChangeHistory || []).find(change => change.status === 'applied');
    if (!latestApplied) return;
    try {
      const restored = JSON.parse(latestApplied.beforeState) as AppState;
      const nextHistory = (state.aiChangeHistory || []).map(change => change.id === latestApplied.id ? { ...change, status: 'undone' as const } : change);
      onChangeState({ ...restored, aiChangeHistory: nextHistory, coachHistory: state.coachHistory || restored.coachHistory || [] });
    } catch {
      setSaveNotice("Không thể hoàn tác bản ghi này. Dữ liệu hiện tại vẫn được giữ nguyên.");
      return;
    }
    setSaveNotice("Đã hoàn tác lần lưu gần nhất.");
  };

  const saveCoachAdvice = (status: CoachHistoryEntry['status']) => {
    if (!coachAdvice) return;
    const entry: CoachHistoryEntry = {
      id: `coach_${Date.now()}`,
      createdAt: new Date().toISOString(),
      expertLens: coachAdvice.expertLens || coachLens,
      question: transcript,
      diagnosis: coachAdvice.diagnosis || "",
      nextAction: coachAdvice.nextAction || "",
      successMetric: coachAdvice.successMetric || "",
      reasoning: coachAdvice.reasoning,
      status
    };
    const nextState: AppState = { ...state, coachHistory: [entry, ...(state.coachHistory || [])].slice(0, 20) };
    if (status === 'applied' && entry.nextAction) {
      const lensCategory = coachLens === 'fund_backtest' ? 'fund_backtest' : coachLens === 'career' ? 'career' : coachLens === 'health_beauty' ? 'health' : 'business';
      const linkedGoal = state.goals.find(goal => goal.category === lensCategory) || state.goals.find(goal => goal.id === state.weeklyFocusGoalId);
      nextState.priorityTasks = [{
        id: `coach_task_${Date.now()}`,
        title: entry.nextAction,
        priority: 'important',
        completed: false,
        journeyId: linkedGoal?.id || null,
        dueDate: todayStr,
        createdAt: new Date().toISOString()
      }, ...(state.priorityTasks || [])];
    }
    onChangeState(nextState);
    setSaveNotice(status === 'applied' ? "Đã đưa việc coach đề xuất vào ưu tiên hôm nay." : "Đã lưu đề xuất vào Lịch sử AI.");
    setCoachAdvice(null);
  };

  // Section 1 Helpers: Priority Board
  const getTasksByPriority = (p: 'important_urgent' | 'important' | 'urgent' | 'later') => {
    return (state.priorityTasks || []).filter(t => t.priority === p);
  };

  const handleToggleTask = (taskId: string) => {
    onChangeState({
      ...state,
      priorityTasks: (state.priorityTasks || []).map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
    });
  };

  const handleDeleteTask = (taskId: string) => {
    onChangeState({
      ...state,
      priorityTasks: (state.priorityTasks || []).filter(t => t.id !== taskId)
    });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: PriorityTask = {
      id: `task_${Date.now()}`,
      title: newTaskTitle,
      priority: newTaskPriority,
      completed: false,
      journeyId: newTaskJourneyId || null
    };

    onChangeState({
      ...state,
      priorityTasks: [...(state.priorityTasks || []), newTask]
    });

    setNewTaskTitle("");
  };

  const saveDailyJournal = (event: React.FormEvent) => {
    event.preventDefault();
    if (!journalDraft.work.trim()) return;
    const timestamp = Date.now();
    const entry: ActivityEntry = {
      id: `journal_${timestamp}`, date: todayStr, goalId: journalDraft.goalId || null, source: 'manual',
      activity: journalDraft.work.trim(), output: {},
      outcome: journalDraft.result.trim() ? { result: journalDraft.result.trim() } : {},
      outcomeStatus: journalDraft.result.trim() ? 'measured' : 'not_applicable', outcomeReviewDate: null,
      insight: journalDraft.lesson.trim() || null, nextAction: null, confidence: 1,
      createdTimestamp: timestamp, updatedTimestamp: timestamp
    };
    onChangeState({ ...state, activities: [entry, ...state.activities] });
    setJournalDraft(value => ({ ...value, work: '', result: '', lesson: '' }));
    setSaveNotice('Đã lưu nhật ký hôm nay vào Kết quả.');
  };

  const saveUnexpectedTask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!unexpectedDraft.title.trim()) return;
    const timestamp = Date.now();
    const task: PriorityTask = {
      id: `unexpected_${timestamp}`, title: unexpectedDraft.title.trim(), priority: unexpectedDraft.priority,
      completed: false, journeyId: unexpectedDraft.goalId || null, goalId: unexpectedDraft.goalId || null,
      dueDate: todayStr, createdAt: new Date().toISOString(), activityType: 'execution'
    };
    const schedule = unexpectedDraft.startTime && unexpectedDraft.endTime > unexpectedDraft.startTime ? [{
      id: `unexpected_schedule_${timestamp}`, title: task.title, date: todayStr,
      startTime: unexpectedDraft.startTime, endTime: unexpectedDraft.endTime,
      goalId: unexpectedDraft.goalId || null, journeyId: unexpectedDraft.goalId || null,
      taskId: task.id, type: 'task' as const, completed: false
    }] : [];
    onChangeState({ ...state, priorityTasks: [task, ...(state.priorityTasks || [])], scheduleItems: [...(state.scheduleItems || []), ...schedule] });
    setUnexpectedDraft(value => ({ ...value, title: '', startTime: '', endTime: '' }));
    setSaveNotice(schedule.length ? 'Đã thêm việc phát sinh vào ưu tiên và lịch hôm nay.' : 'Đã thêm việc phát sinh vào ưu tiên hôm nay.');
  };

  const moveTaskPriority = (taskId: string, targetPriority: 'important_urgent' | 'important' | 'urgent' | 'later') => {
    onChangeState({
      ...state,
      priorityTasks: (state.priorityTasks || []).map(t => t.id === taskId ? { ...t, priority: targetPriority } : t)
    });
  };

  // Section 2: Today's Schedule and Overlaps
  const todaySchedule = (state.scheduleItems || []).filter(item => item.date === todayStr && isScheduleValidForDate(item))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const currentTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());

  const overdueTasks = (state.priorityTasks || []).filter(task =>
    !task.completed && !!task.dueDate && task.dueDate < todayStr
  );
  const unfinishedPastSchedule = todaySchedule.filter(item =>
    !item.completed && item.endTime < currentTime
  );
  const overdueMilestones = (state.goals || []).flatMap(goal =>
    (goal.milestones || [])
      .filter(milestone => !milestone.achieved && !!milestone.dueDate && milestone.dueDate < todayStr)
      .map(milestone => ({ ...milestone, journeyName: goal.name }))
  );
  const overdueChores = (state.chores || []).filter(chore =>
    !chore.completed && chore.lastCompletedDate !== todayStr && !!chore.dueDate && chore.dueDate < todayStr
  );
  const blockedTasks = (state.priorityTasks || []).filter(task => task.status === 'blocked');
  const attentionCount = blockedTasks.length + overdueTasks.length + unfinishedPastSchedule.length + overdueMilestones.length + overdueChores.length;

  const handleToggleScheduleItem = (itemId: string) => {
    const target = (state.scheduleItems || []).find(item => item.id === itemId);
    if (!target) return;
    const completed = !target.completed;
    const activityId = `schedule_activity_${target.id}`;
    const scheduleGoalId = target.goalId || target.journeyId || null;
    const linkedActivity: ActivityEntry = {
      id: activityId,
      date: target.date,
      goalId: scheduleGoalId,
      source: 'manual',
      originalTranscript: `Hoàn thành lịch: ${target.title}`,
      activity: target.title,
      output: { scheduleCompleted: true, minutes: target.estimatedMinutes || null },
      outcome: {},
      insight: null,
      nextAction: null,
      confidence: 1,
      createdTimestamp: Date.now(),
      updatedTimestamp: Date.now()
    };
    onChangeState({
      ...state,
      scheduleItems: (state.scheduleItems || []).map(item =>
        item.id === itemId ? { ...item, completed } : item
      ),
      priorityTasks: (state.priorityTasks || []).map(task =>
        target.taskId && task.id === target.taskId ? { ...task, completed, completedAt: completed ? new Date().toISOString() : null } : task
      ),
      activities: completed
        ? [linkedActivity, ...state.activities.filter(activity => activity.id !== activityId)]
        : state.activities.filter(activity => activity.id !== activityId)
    });
  };

  // Overlap checker for today
  const getOverlappingToday = () => {
    const overlaps = new Set<string>();
    for (let i = 0; i < todaySchedule.length; i++) {
      for (let j = i + 1; j < todaySchedule.length; j++) {
        const itemA = todaySchedule[i];
        const itemB = todaySchedule[j];
        const startA = parseInt(itemA.startTime.replace(":", ""));
        const endA = parseInt(itemA.endTime.replace(":", ""));
        const startB = parseInt(itemB.startTime.replace(":", ""));
        const endB = parseInt(itemB.endTime.replace(":", ""));

        if (startA < endB && startB < endA) {
          overlaps.add(itemA.id);
          overlaps.add(itemB.id);
        }
      }
    }
    return overlaps;
  };

  const todayOverlaps = getOverlappingToday();

  // Highlight next free slot
  const getNextFreeSlot = () => {
    if (todaySchedule.length === 0) {
      return "Cả ngày hôm nay chưa có lịch, thoải mái sắp xếp!";
    }
    const currentHour = new Date().getHours();
    const busyHours = new Set<number>();

    todaySchedule.forEach(item => {
      const start = parseInt(item.startTime.split(':')[0]);
      const end = Math.ceil(parseInt(item.endTime.split(':')[0]) + parseInt(item.endTime.split(':')[1]) / 60);
      for (let h = start; h < end; h++) {
        busyHours.add(h);
      }
    });

    // Check hours from current hour to 22:00
    const startHour = Math.max(8, currentHour);
    for (let h = startHour; h < 22; h++) {
      if (!busyHours.has(h) && !busyHours.has(h + 1)) {
        return `Khung trống kế tiếp: ${h.toString().padStart(2, '0')}:00 - ${(h + 2).toString().padStart(2, '0')}:00`;
      }
    }

    return "Lịch biểu hôm nay đã kín khung giờ Deep Work chính.";
  };

  // Section 3: Journeys list
  const activeJourneys = (state.goals || []).filter(g => g.status === 'active');

  const getJourneyProgress = (journey: Goal) => {
    const ms = journey.milestones || [];
    if (ms.length === 0) return 0;
    const completed = ms.filter(m => m.achieved).length;
    return Math.round((completed / ms.length) * 100);
  };

  const getActiveMilestone = (journey: Goal) => {
    const ms = journey.milestones || [];
    return ms.find(m => !m.achieved) || ms[ms.length - 1];
  };

  // Section 4: Habits should maintain
  const handleToggleHabit = (id: string) => {
    onChangeState({
      ...state,
      routines: state.routines.map(r => r.id === id ? {
        ...r,
        status: r.status === 'completed' ? 'pending' : 'completed'
      } : r)
    });
  };

  // Theme support
  const getJourneyName = (journeyId: string | null) => {
    if (!journeyId) return "Chung";
    const j = state.goals.find(g => g.id === journeyId);
    return j ? j.name : "Hành trình";
  };

  const dueOutcomes = state.activities.filter(activity => activity.outcomeStatus === 'pending' && activity.outcomeReviewDate && activity.outcomeReviewDate <= todayStr);
  const todayAvailability = (state.weeklyAvailability || []).find(day => day.dayOfWeek === new Date(`${todayStr}T12:00:00`).getDay());
  const suggestedMode = todayAvailability?.mode === 'office' ? 'busy' : todayAvailability?.mode === 'rest' ? 'recovery' : 'normal';
  const dailyMode = state.dailyModeDate === todayStr ? state.dailyMode || suggestedMode : suggestedMode;

  return (
    <div id="today-dashboard-view" className="space-y-8">

      {beforeCycle && (
        <section className="overflow-hidden rounded-[24px] border border-indigo-200 bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-800 p-5 text-white shadow-xl shadow-indigo-100 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">Ngày chuẩn bị · chưa tính tiến độ</p>
            <h2 className="mt-2 font-display text-xl font-black">Chu kỳ bắt đầu ngày {formatDisplayDate(state.startDate)}</h2>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-indigo-100">Hôm nay app không giao routine, không tính thiếu việc và không làm giảm consistency. Day 1 sẽ tự mở đúng ngày bắt đầu.</p>
          </div>
          <span className="mt-4 flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-xs font-black text-white sm:mt-0 sm:w-auto"><Calendar className="h-4 w-4" /> Tự động bắt đầu 19/07</span>
        </section>
      )}

      <div className="flex justify-end"><details className="relative"><summary className="cursor-pointer list-none rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm">Hôm nay: {dailyMode === 'busy' ? 'Bận' : dailyMode === 'recovery' ? 'Phục hồi' : 'Bình thường'} ▾</summary><div className="absolute right-0 z-30 mt-2 flex rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{([['normal','Bình thường'],['busy','Bận'],['recovery','Phục hồi']] as const).map(([mode,label]) => <button key={mode} onClick={() => onChangeState({ ...state, dailyMode: mode, dailyModeDate: todayStr })} className={`rounded-lg px-3 py-2 text-xs font-black transition ${dailyMode === mode ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}>{label}</button>)}</div></details></div>

      {!beforeCycle && <FocusOverview
        state={state}
        today={todayStr}
        currentDay={currentDay}
        onChangeState={onChangeState}
      />}

      {dueOutcomes.length > 0 && <section className="flex flex-col gap-3 rounded-[22px] border border-violet-200 bg-violet-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white"><CalendarClock className="h-4 w-4" /></span><div><p className="text-xs font-black text-violet-950">{dueOutcomes.length} kết quả cần kiểm tra hôm nay</p><p className="mt-1 text-xs text-violet-700">{dueOutcomes.slice(0, 2).map(item => item.activity).join(' · ')}{dueOutcomes.length > 2 ? ` · +${dueOutcomes.length - 2} việc` : ''}</p></div></div><button onClick={onOpenProgress} className="shrink-0 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white">Cập nhật kết quả</button></section>}

      {blockedTasks.length > 0 && <section className="rounded-[22px] border border-rose-200 bg-rose-50 p-4"><div className="flex items-start gap-3"><Siren className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" /><div className="min-w-0"><p className="text-sm font-black text-rose-950">Đang chờ & bị chặn · {blockedTasks.length} việc</p><p className="mt-1 text-sm text-rose-700">{blockedTasks[0].title}: {blockedTasks[0].blockedReason || 'chưa ghi lý do'}{blockedTasks[0].waitingUntil ? ` · kiểm tra ${formatDisplayDate(blockedTasks[0].waitingUntil)}` : ''}</p><p className="mt-2 text-xs font-bold text-rose-600">App đã chuyển sang việc khả dụng khác; task này vẫn được theo dõi riêng.</p></div></div></section>}
      
      {/* 2. VOICE / TEXT CHECK-IN — CAPTURE AFTER THE USER KNOWS WHAT TO DO */}
      <section id="section-quick-input" className={`relative overflow-hidden rounded-[24px] border shadow-sm ${captureExpanded ? "space-y-5 border-slate-800 bg-slate-950 p-5 md:p-7" : "border-indigo-100 bg-white p-4"}`}>
        <div className="relative flex items-start justify-between gap-4">
          <div>
          <p className={`mb-2 text-xs font-black uppercase tracking-[0.16em] ${captureExpanded ? 'text-indigo-300' : 'text-indigo-600'}`}>02 · Ghi nhận hoặc điều chỉnh</p>
          <h2 className={`font-display font-extrabold tracking-tight flex items-center gap-3 ${captureExpanded ? "text-xl text-white md:text-2xl" : "text-lg text-slate-950"}`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500 text-white border border-indigo-400 shadow-lg shadow-indigo-950"><MessageSquareText className="h-5 w-5" /></span>
            Bạn đã tiến được gì hôm nay?
          </h2>
          <p className={`mt-2 max-w-2xl text-sm ${captureExpanded ? 'text-slate-300' : 'text-slate-500'}`}>{captureExpanded ? "Nói tự nhiên hoặc gõ vài dòng. AI sẽ tự nhận diện loại cập nhật." : "Một ô duy nhất cho tiến độ, lịch, việc mới hoặc câu hỏi."}</p>
          </div>
          {captureExpanded && <button onClick={() => setCaptureExpanded(false)} className="relative shrink-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-bold text-slate-300 hover:bg-slate-800">Thu gọn</button>}
        </div>

        {!captureExpanded ? (
          <button onClick={() => setCaptureExpanded(true)} className="relative mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white p-3.5 text-left shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-50">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><Mic className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1 text-xs font-semibold text-slate-500">Nói hoặc nhập cập nhật, lịch, việc cần làm…</span>
            <ArrowRight className="h-4 w-4 text-indigo-600" />
          </button>
        ) : (
        <div className="relative bg-white rounded-[22px] p-4 md:p-5 border border-slate-200 shadow-2xl space-y-4">
          <div className="flex items-center gap-2.5 text-indigo-600 text-xs font-bold bg-indigo-50 border border-indigo-100 px-4 py-2.5 rounded-xl">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Ví dụ: “Tôi đã hoàn thành 3 backtests, đi bộ 6.000 bước và muốn làm website B2B lúc 14:00 ngày mai.”</span>
          </div>

          <div className="space-y-3">
            <textarea
              id="txt-transcript-input"
              rows={3}
              placeholder="Nhập nội dung nhật ký thô tại đây hoặc nhấn nút Microphone để nói..."
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              className="w-full text-sm border border-slate-200 focus:border-indigo-400 rounded-2xl px-4 py-4 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-medium leading-relaxed resize-none"
            />

            {micError && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{micError}</span>
              </div>
            )}

            {voiceNotice && !micError && (
              <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs font-semibold text-sky-700">
                <Mic className="h-4 w-4 shrink-0" /> {voiceNotice}
              </div>
            )}

            {refineError && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{refineError}</span>
              </div>
            )}

            {/* BUTTON CONTROLS */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              
              {/* Mic buttons */}
              <div className="flex items-center gap-2">
                {speechSupported ? (
                  isRecording ? (
                    <button
                      id="btn-stop-mic"
                      onClick={stopRecording}
                      className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer animate-pulse"
                    >
                      <MicOff className="w-4 h-4" />
                      <span>Đang nghe... ({recordingSeconds}s) · Dừng & phân tích</span>
                    </button>
                  ) : (
                    <button
                      id="btn-start-mic"
                      onClick={startRecording}
                      className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold px-4 py-2.5 rounded-xl border border-indigo-150 transition-all cursor-pointer"
                    >
                      <Mic className="w-4 h-4 text-indigo-500" />
                      <span>Bắt đầu Nói</span>
                    </button>
                  )
                ) : (
                  <span className="text-[11px] text-slate-400 italic bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    Trình duyệt không hỗ trợ Mic
                  </span>
                )}

                {transcript.trim() && (
                  <button
                    id="btn-refine-spelling"
                    disabled={isRefining}
                    onClick={handleRefineTranscript}
                    className="hidden items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-250 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isRefining ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>Sửa Chính Tả AI</span>
                  </button>
                )}
              </div>

              {/* Submit / Analyze button */}
              <button
                id="btn-analyze-input"
                disabled={!transcript.trim() || isClassifying}
                onClick={() => handleAnalyzeTranscript(transcript)}
                className="flex items-center gap-2 bg-slate-950 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-lg transition-all cursor-pointer active:scale-[0.98]"
              >
                <Send className="w-4 h-4" />
                <span>Gửi phân tích AI</span>
              </button>
            </div>

            <div className="hidden flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-slate-100">
              <button
                id="btn-ask-life-os-coach"
                disabled={!transcript.trim() || isCoaching}
                onClick={handleAskCoach}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-lg shadow-indigo-100 transition-all cursor-pointer"
              >
                {isCoaching ? <Loader className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                <span>{isCoaching ? "Coach đang phân tích..." : "Hỏi Life OS Coach"}</span>
              </button>
              <p className="text-[11px] text-slate-400">Tư vấn theo đúng dữ liệu Fund, B2B hoặc Health của bạn — không tìm kiếm chung.</p>
            </div>

            <div className="hidden flex-wrap gap-2">
              {[
                ['auto', 'Tự chọn chuyên gia'],
                ['fund_backtest', 'Fund & Backtest'],
                ['b2b_marketing', 'B2B Marketing'],
                ['career', 'Career 30M+'],
                ['health_beauty', 'Health & Beauty']
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCoachLens(value as typeof coachLens)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${coachLens === value ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {coachError && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {coachError}
              </div>
            )}

            {coachAdvice && (
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <Bot className="w-5 h-5 text-indigo-600" /> Life OS Coach
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="px-2.5 py-1 rounded-full bg-white border border-indigo-100 text-indigo-700">{coachAdvice.expertLens}</span>
                    <span className="flex items-center gap-1 text-slate-500"><Gauge className="w-3.5 h-3.5" /> {Math.round((coachAdvice.confidence || 0) * 100)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chẩn đoán</p>
                  <p className="text-xs text-slate-700 mt-1">{coachAdvice.diagnosis}</p>
                </div>
                <div className="rounded-xl bg-white border border-indigo-100 p-4">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600"><Lightbulb className="w-3.5 h-3.5" /> Việc nên làm ngay</p>
                  <p className="text-sm font-bold text-slate-900 mt-1.5">{coachAdvice.nextAction}</p>
                  <p className="text-xs text-slate-500 mt-2">Đo bằng: <strong>{coachAdvice.successMetric}</strong></p>
                </div>
                {coachAdvice.plan?.length > 0 && (
                  <ol className="grid gap-2 sm:grid-cols-3">
                    {coachAdvice.plan.map((step: string, index: number) => (
                      <li key={index} className="text-xs text-slate-600 bg-white/80 border border-slate-100 rounded-xl p-3"><strong className="text-indigo-600">{index + 1}.</strong> {step}</li>
                    ))}
                  </ol>
                )}
                <p className="text-[11px] text-slate-500"><strong>Lý do:</strong> {coachAdvice.reasoning}</p>
                {coachAdvice.riskNote && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3"><strong>Lưu ý:</strong> {coachAdvice.riskNote}</p>}
                {coachAdvice.clarifyingQuestion && <p className="text-xs font-semibold text-indigo-700">Coach cần biết thêm: {coachAdvice.clarifyingQuestion}</p>}
                <div className="flex flex-wrap gap-2 border-t border-indigo-100 pt-3">
                  <button type="button" onClick={() => saveCoachAdvice('applied')} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">Áp dụng việc tiếp theo</button>
                  <button type="button" onClick={() => saveCoachAdvice('saved')} className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50">Lưu để xem sau</button>
                  <button type="button" onClick={() => setCoachAdvice(null)} className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-white">Bỏ qua</button>
                </div>
              </div>
            )}

            {saveNotice && (
              <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-900">{saveNotice}</p>
                  <p className="mt-1 text-[10px] text-emerald-700">Bạn luôn có quyền kiểm tra dữ liệu vừa lưu và hoàn tác nếu AI hiểu sai.</p>
                </div>
                {(state.aiChangeHistory || []).some(change => change.status === 'applied') && (
                  <button type="button" onClick={handleUndoLastSave} className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100">
                    <Undo2 className="h-3.5 w-3.5" /> Hoàn tác lần lưu
                  </button>
                )}
              </div>
            )}

            {state.activities.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Dữ liệu vừa ghi nhận</p>
                  <span className="text-[10px] text-slate-400">3 mục gần nhất</span>
                </div>
                <div className="space-y-2">
                  {state.activities.slice(0, 3).map(activity => {
                    const goal = state.goals.find(item => item.id === activity.goalId);
                    return (
                      <div key={activity.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                        <GoalIcon icon={goal?.icon} color={goal?.accentColor} size={14} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-bold text-slate-800">{activity.activity}</p>
                          <p className="mt-0.5 text-[9px] text-slate-400">{goal?.name || 'Chưa phân loại'} · {formatDisplayDate(activity.date)} · {activity.source || 'manual'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={saveDailyJournal} className="rounded-[24px] border border-sky-200 bg-sky-50/45 p-5 shadow-sm md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="life-kicker text-sky-700">Nhật ký công việc hằng ngày</p><h2 className="mt-2 font-display text-lg font-extrabold text-slate-950">Hôm nay bạn thực sự đã làm gì?</h2><p className="mt-1 text-xs text-slate-500">Bản ghi này đi vào Kết quả, không tự tạo thêm task.</p></div>
            <MessageSquareText className="h-5 w-5 text-sky-600" />
          </div>
          <div className="mt-4 grid gap-3">
            <select aria-label="Mục tiêu của nhật ký" value={journalDraft.goalId} onChange={event => setJournalDraft({ ...journalDraft, goalId: event.target.value })} className="rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700">{state.goals.filter(goal => goal.status === 'active').map(goal => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select>
            <textarea value={journalDraft.work} onChange={event => setJournalDraft({ ...journalDraft, work: event.target.value })} placeholder="Công việc đã thực hiện…" className="min-h-20 rounded-xl border border-sky-200 bg-white px-3 py-3 text-xs outline-none focus:border-sky-500" />
            <div className="grid gap-3 sm:grid-cols-2"><input value={journalDraft.result} onChange={event => setJournalDraft({ ...journalDraft, result: event.target.value })} placeholder="Kết quả/đầu ra" className="rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-xs outline-none" /><input value={journalDraft.lesson} onChange={event => setJournalDraft({ ...journalDraft, lesson: event.target.value })} placeholder="Vấn đề hoặc bài học" className="rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-xs outline-none" /></div>
            <button disabled={!journalDraft.work.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-xs font-black text-white disabled:opacity-40"><Save className="h-4 w-4" /> Lưu nhật ký</button>
          </div>
        </form>

        <form onSubmit={saveUnexpectedTask} className="rounded-[24px] border border-amber-200 bg-amber-50/45 p-5 shadow-sm md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="life-kicker text-amber-700">Việc phát sinh</p><h2 className="mt-2 font-display text-lg font-extrabold text-slate-950">Thêm việc ngoài kế hoạch</h2><p className="mt-1 text-xs text-slate-500">Không thay đổi routine cố định; có thể đưa vào lịch hôm nay nếu có giờ.</p></div>
            <Zap className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4 grid gap-3">
            <input value={unexpectedDraft.title} onChange={event => setUnexpectedDraft({ ...unexpectedDraft, title: event.target.value })} placeholder="Ví dụ: xử lý giấy tờ phát sinh…" className="rounded-xl border border-amber-200 bg-white px-3 py-3 text-xs outline-none focus:border-amber-500" />
            <div className="grid gap-3 sm:grid-cols-2"><select aria-label="Mức ưu tiên" value={unexpectedDraft.priority} onChange={event => setUnexpectedDraft({ ...unexpectedDraft, priority: event.target.value as PriorityTask['priority'] })} className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs font-bold"><option value="important_urgent">Quan trọng & khẩn cấp</option><option value="urgent">Khẩn cấp</option><option value="important">Quan trọng</option><option value="later">Có thể để sau</option></select><select aria-label="Mục tiêu liên quan" value={unexpectedDraft.goalId} onChange={event => setUnexpectedDraft({ ...unexpectedDraft, goalId: event.target.value })} className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs"><option value="">Không thuộc mục tiêu</option>{state.goals.filter(goal => goal.status === 'active').map(goal => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3"><label className="text-[10px] font-bold text-slate-500">Bắt đầu<input type="time" value={unexpectedDraft.startTime} onChange={event => setUnexpectedDraft({ ...unexpectedDraft, startTime: event.target.value })} className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs" /></label><label className="text-[10px] font-bold text-slate-500">Kết thúc<input type="time" value={unexpectedDraft.endTime} onChange={event => setUnexpectedDraft({ ...unexpectedDraft, endTime: event.target.value })} className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs" /></label></div>
            <button disabled={!unexpectedDraft.title.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-xs font-black text-white disabled:opacity-40"><Plus className="h-4 w-4" /> Thêm việc phát sinh</button>
          </div>
        </form>
      </section>

      {/* TODAY AT A GLANCE — schedule plus exception-based alerts */}
      <section id="section-today-command" className="grid grid-cols-1 lg:grid-cols-[1.45fr_0.75fr] gap-4">
        <div className="life-panel border-t-4 border-t-indigo-500 p-5 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="life-kicker text-indigo-600 mb-2">03 · Lịch hôm nay</p>
              <h2 className="font-display text-lg font-extrabold text-slate-950">Nhịp công việc hôm nay</h2>
              <p className="text-xs text-slate-400 mt-1">Chỉ hiển thị những block bạn cần thực hiện trong ngày.</p>
            </div>
            <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1.5 text-[10px] font-bold text-indigo-700 border border-indigo-100">
              {todaySchedule.filter(item => item.completed).length}/{todaySchedule.length} xong
            </span>
          </div>

          {todaySchedule.length > 0 ? (
            <div className="space-y-2">
              {todaySchedule.slice(0, 3).map(item => {
                const isPast = !item.completed && item.endTime < currentTime;
                const scheduleGoalId = item.journeyId || item.goalId || null;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleToggleScheduleItem(item.id)}
                    className={`grid w-full grid-cols-[74px_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition-all ${
                      item.completed ? "border-emerald-200 bg-emerald-50/60" : isPast ? "border-rose-200 bg-rose-50/60" : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/20"
                    }`}
                  >
                    <span className={`flex flex-col border-r pr-3 font-mono ${item.completed ? "border-emerald-200 text-emerald-700" : isPast ? "border-rose-200 text-rose-700" : "border-indigo-100 text-indigo-700"}`}>
                      <span className="mb-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.14em]"><CalendarClock className="h-2.5 w-2.5" /> Lịch</span>
                      <span className="text-xs font-black">{item.startTime}</span>
                      <span className="text-[9px] text-slate-400">đến {item.endTime}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-xs font-bold ${item.completed ? "text-emerald-800 line-through" : "text-slate-800"}`}>{item.title}</span>
                      <span className="mt-1 block truncate text-[10px] font-semibold text-slate-400">{getJourneyName(scheduleGoalId)}</span>
                    </span>
                    {item.completed ? <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-4 w-4" /></span> : isPast ? <span className="rounded-full bg-rose-600 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white">Quá giờ</span> : <span className="h-2 w-2 rounded-full bg-indigo-500" />}
                  </button>
                );
              })}
              {todaySchedule.length > 3 && <p className="pt-2 text-center text-xs font-bold text-indigo-600">+{todaySchedule.length - 3} block khác · xem toàn bộ trong Lịch biểu</p>}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
              <Calendar className="mx-auto h-5 w-5 text-slate-300" />
              <p className="mt-2 text-xs font-semibold text-slate-500">Hôm nay chưa có lịch công việc.</p>
              <p className="mt-1 text-[10px] text-slate-400">Bạn có thể nói: “Xếp lịch làm portfolio lúc 14:00”.</p>
            </div>
          )}
        </div>

        <div className={`life-panel border-t-4 p-5 md:p-6 space-y-4 ${attentionCount > 0 ? "border-amber-200 border-t-amber-400 bg-amber-50/25 ring-1 ring-inset ring-amber-100" : "border-emerald-100 border-t-emerald-500 bg-white"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`life-kicker mb-2 flex items-center gap-1.5 ${attentionCount > 0 ? "text-amber-700" : "text-emerald-600"}`}>{attentionCount > 0 ? <Siren className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />} Cảnh báo ngoại lệ</p>
              <h2 className="font-display text-lg font-extrabold text-slate-950">{attentionCount > 0 ? `${attentionCount} việc cần xem lại` : "Mọi thứ đang ổn"}</h2>
            </div>
            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${attentionCount > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
              {attentionCount > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
            </span>
          </div>

          {attentionCount > 0 && (
            <div className="flex flex-wrap gap-1.5 text-[9px] font-black">
              {unfinishedPastSchedule.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">{unfinishedPastSchedule.length} lịch</span>}
              {overdueTasks.length > 0 && <span className="rounded-full bg-rose-600 px-2 py-1 text-white">{overdueTasks.length} task</span>}
              {overdueMilestones.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">{overdueMilestones.length} cột mốc</span>}
              {overdueChores.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">{overdueChores.length} chore</span>}
            </div>
          )}

          {attentionCount > 0 ? (
            <div className="space-y-2">
              {overdueTasks.slice(0, 1).map(task => <p key={task.id} className="flex items-start gap-2 rounded-xl border border-rose-200 bg-white px-3 py-3 text-sm font-semibold text-rose-900"><Siren className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /><span><strong className="block text-xs uppercase tracking-wider text-rose-600">Cần xử lý ngay · Việc quá hạn</strong>{task.title}</span></p>)}
              {overdueMilestones.slice(0, 1).map(milestone => <p key={milestone.id} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-white px-3 py-3 text-sm font-semibold text-amber-950"><Target className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span><strong className="block text-xs uppercase tracking-wider text-amber-600">Cần quyết định · Cột mốc trễ</strong>{milestone.title} · {milestone.journeyName}</span></p>)}
              {unfinishedPastSchedule.slice(0, 1).map(item => <p key={item.id} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-white px-3 py-3 text-sm font-semibold text-amber-950"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span><strong className="block text-xs uppercase tracking-wider text-amber-600">Cần quyết định · Lịch bỏ lỡ</strong>{item.title}</span></p>)}
              {overdueChores.slice(0, 1).map(chore => <p key={chore.id} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700"><ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /><span><strong className="block text-xs uppercase tracking-wider text-slate-500">Nhắc nhẹ · Việc nhà</strong>{chore.title}</span></p>)}
            </div>
          ) : (
            <p className="rounded-2xl bg-emerald-50 p-4 text-xs leading-relaxed text-emerald-800">Không có lịch bỏ sót, task quá hạn hoặc milestone trễ. Bạn chỉ cần tập trung vào việc đang làm.</p>
          )}
          <p className="text-[10px] leading-relaxed text-slate-400">App chỉ đưa những phần lệch khỏi kế hoạch lên đây, nên các mục tiêu khác vẫn được giám sát mà không làm dashboard bị ngợp.</p>
        </div>
      </section>

      {!beforeCycle && <LifeOperations
        state={state}
        today={todayStr}
        onChangeState={onChangeState}
      />}


      {/* 2. VIỆC ƯU TIÊN HÔM NAY (PRIORITY BOARD 2X2) */}
      <section id="section-priority-board" className="hidden space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100"><ListTodo className="h-4 w-4" /></span>
              Ưu tiên hôm nay
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Chỉ giữ những việc thật sự cần sự chú ý của bạn.</p>
          </div>

          {/* Quick-add Task Form */}
          <form onSubmit={handleAddTask} className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              required
              placeholder="Thêm việc mới..."
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-indigo-500 bg-white shadow-3xs flex-1 sm:w-48"
            />
            <select
              value={newTaskPriority}
              onChange={e => setNewTaskPriority(e.target.value as any)}
              className="text-xs border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:border-indigo-500 bg-white"
            >
              <option value="important_urgent">Gấp & Quan trọng</option>
              <option value="important">Quan trọng (Deep Work)</option>
              <option value="urgent">Gấp (Làm nhanh)</option>
              <option value="later">Làm sau</option>
            </select>
            <select
              value={newTaskJourneyId}
              onChange={e => setNewTaskJourneyId(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:border-indigo-500 bg-white"
            >
              <option value="">-- Việc chung --</option>
              {activeJourneys.map(j => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl shadow-xs cursor-pointer transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* 2X2 GRID (Desktop) / Summary Cards (Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Quadrant 1: Gấp & Quan trọng */}
          <div className="bg-gradient-to-br from-white to-rose-50/60 rounded-3xl p-5 border border-rose-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                <Siren className="h-4 w-4 text-rose-500" />
                Gấp & Quan trọng
              </span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                {getTasksByPriority('important_urgent').length} việc
              </span>
            </div>

            <div className="space-y-2 min-h-[100px]">
              {getTasksByPriority('important_urgent').map(task => (
                <div key={task.id} className="flex items-center justify-between gap-3 p-2 hover:bg-slate-50 rounded-xl transition-all border border-slate-50">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.id)}
                      className="rounded text-rose-500 focus:ring-rose-500 cursor-pointer"
                    />
                    <div>
                      <p className={`text-xs font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
                      {task.journeyId && (
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold mt-1 inline-block">
                          {getJourneyName(task.journeyId)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={task.priority}
                      onChange={e => moveTaskPriority(task.id, e.target.value as any)}
                      className="text-[9px] border-none bg-slate-100 text-slate-500 rounded p-1"
                    >
                      <option value="important_urgent">Gấp & Q.Trọng</option>
                      <option value="important">Quan trọng</option>
                      <option value="urgent">Gấp</option>
                      <option value="later">Làm sau</option>
                    </select>
                    <button onClick={() => handleDeleteTask(task.id)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {getTasksByPriority('important_urgent').length === 0 && (
                <p className="text-[11px] text-slate-400 italic text-center py-6">Chưa có đầu việc gấp & quan trọng hôm nay.</p>
              )}
            </div>
          </div>

          {/* Quadrant 2: Quan trọng nhưng không gấp (Deep Work) */}
          <div className="bg-gradient-to-br from-white to-indigo-50/60 rounded-3xl p-5 border border-indigo-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                <Brain className="h-4 w-4 text-indigo-500" />
                Quan trọng (Deep Work)
              </span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                {getTasksByPriority('important').length} việc
              </span>
            </div>

            <div className="space-y-2 min-h-[100px]">
              {getTasksByPriority('important').map(task => (
                <div key={task.id} className="flex items-center justify-between gap-3 p-2 hover:bg-slate-50 rounded-xl transition-all border border-slate-50">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.id)}
                      className="rounded text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <p className={`text-xs font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
                      {task.journeyId && (
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold mt-1 inline-block">
                          {getJourneyName(task.journeyId)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={task.priority}
                      onChange={e => moveTaskPriority(task.id, e.target.value as any)}
                      className="text-[9px] border-none bg-slate-100 text-slate-500 rounded p-1"
                    >
                      <option value="important_urgent">Gấp & Q.Trọng</option>
                      <option value="important">Quan trọng</option>
                      <option value="urgent">Gấp</option>
                      <option value="later">Làm sau</option>
                    </select>
                    <button onClick={() => handleDeleteTask(task.id)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {getTasksByPriority('important').length === 0 && (
                <p className="text-[11px] text-slate-400 italic text-center py-6">Nhóm Deep Work giúp bạn xây dựng nền móng dài hạn.</p>
              )}
            </div>
          </div>

          {/* Quadrant 3: Gấp nhưng không quan trọng */}
          <div className="bg-gradient-to-br from-white to-amber-50/60 rounded-3xl p-5 border border-amber-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-500" />
                Gấp (Làm nhanh / Ủy quyền)
              </span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                {getTasksByPriority('urgent').length} việc
              </span>
            </div>

            <div className="space-y-2 min-h-[100px]">
              {getTasksByPriority('urgent').map(task => (
                <div key={task.id} className="flex items-center justify-between gap-3 p-2 hover:bg-slate-50 rounded-xl transition-all border border-slate-50">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.id)}
                      className="rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                    <div>
                      <p className={`text-xs font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
                      {task.journeyId && (
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold mt-1 inline-block">
                          {getJourneyName(task.journeyId)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={task.priority}
                      onChange={e => moveTaskPriority(task.id, e.target.value as any)}
                      className="text-[9px] border-none bg-slate-100 text-slate-500 rounded p-1"
                    >
                      <option value="important_urgent">Gấp & Q.Trọng</option>
                      <option value="important">Quan trọng</option>
                      <option value="urgent">Gấp</option>
                      <option value="later">Làm sau</option>
                    </select>
                    <button onClick={() => handleDeleteTask(task.id)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {getTasksByPriority('urgent').length === 0 && (
                <p className="text-[11px] text-slate-400 italic text-center py-6">Giải quyết nhanh các công việc lặt vặt tại đây.</p>
              )}
            </div>
          </div>

          {/* Quadrant 4: Ít quan trọng & Chưa gấp */}
          <div className="bg-gradient-to-br from-white to-slate-100/60 rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Archive className="h-4 w-4 text-slate-400" />
                Làm sau (Giải trí / Tích lũy)
              </span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                {getTasksByPriority('later').length} việc
              </span>
            </div>

            <div className="space-y-2 min-h-[100px]">
              {getTasksByPriority('later').map(task => (
                <div key={task.id} className="flex items-center justify-between gap-3 p-2 hover:bg-slate-50 rounded-xl transition-all border border-slate-50">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.id)}
                      className="rounded text-slate-500 focus:ring-slate-500 cursor-pointer"
                    />
                    <div>
                      <p className={`text-xs font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
                      {task.journeyId && (
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold mt-1 inline-block">
                          {getJourneyName(task.journeyId)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={task.priority}
                      onChange={e => moveTaskPriority(task.id, e.target.value as any)}
                      className="text-[9px] border-none bg-slate-100 text-slate-500 rounded p-1"
                    >
                      <option value="important_urgent">Gấp & Q.Trọng</option>
                      <option value="important">Quan trọng</option>
                      <option value="urgent">Gấp</option>
                      <option value="later">Làm sau</option>
                    </select>
                    <button onClick={() => handleDeleteTask(task.id)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {getTasksByPriority('later').length === 0 && (
                <p className="text-[11px] text-slate-400 italic text-center py-6">Thêm các việc giải trí hoặc hoạt động tích lũy khi có thời gian rảnh.</p>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* 3. LỊCH HÔM NAY */}
      <section id="section-today-schedule" className="hidden space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100"><Calendar className="h-4 w-4" /></span>
              Nhịp ngày hôm nay
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Quản lý block thời gian Deep Work và phát hiện trùng lặp.</p>
          </div>
          
          <div className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl">
            {getNextFreeSlot()}
          </div>
        </div>

        <div className="bg-white/90 rounded-3xl p-5 border border-white shadow-sm">
          {todaySchedule.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {todaySchedule.map(item => {
                const isOverlap = todayOverlaps.has(item.id);
                return (
                  <div 
                    key={item.id} 
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 shadow-2xs relative ${
                      isOverlap 
                        ? 'border-rose-200 bg-rose-50/50' 
                        : 'border-slate-100 bg-slate-50/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">{item.title}</span>
                        {isOverlap && (
                          <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-extrabold uppercase animate-pulse">
                            Trùng lịch
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{item.startTime} - {item.endTime}</span>
                        <span className="mx-1">•</span>
                        <span className="font-sans font-bold text-slate-600">{getJourneyName(item.journeyId)}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-6">Lịch biểu hôm nay trống. Hãy chuyển sang Tab Lịch biểu hoặc tạo nhanh qua giọng nói!</p>
          )}
        </div>
      </section>

      {/* 4. CÁC HÀNH TRÌNH MỤC TIÊU */}
      <section id="section-goal-journeys" className="hidden space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600 border border-teal-100"><Target className="h-4 w-4" /></span>
            Ba hành trình đang tiến tới
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Tiến trình đạt các cột mốc trong chu kỳ hiện tại của bạn.</p>
        </div>

        {activeJourneys.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeJourneys.map(journey => {
              const progress = getJourneyProgress(journey);
              const activeMilestone = getActiveMilestone(journey);

              return (
                <div key={journey.id} className="group bg-white/95 rounded-3xl p-5 border border-white shadow-sm space-y-4 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-100/70 transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <GoalIcon icon={journey.icon} color={journey.accentColor} size={18} className="p-2 rounded-xl border shrink-0" />
                      <div>
                      <h3 className="text-xs font-black text-slate-900">{journey.name}</h3>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{journey.desiredOutcome}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {progress}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {/* Visual milestone path */}
                  <div className="space-y-2 pt-1 border-t border-slate-50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cột mốc hiện tại:</p>
                    {activeMilestone ? (
                      <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800">{activeMilestone.title}</p>
                          <p className="text-[9px] text-slate-400 font-mono">
                            Mục tiêu: {activeMilestone.targetValue} • Đạt được: {activeMilestone.currentValue}
                          </p>
                        </div>
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 font-bold shrink-0">
                          Đang làm
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-600 bg-emerald-50 p-2.5 rounded-xl text-center font-bold">
                        Chúc mừng! Bạn đã hoàn thành toàn bộ cột mốc hành trình!
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-3 shadow-3xs">
            <p className="text-xs text-slate-500 italic">Bạn chưa kích hoạt hành trình mục tiêu nào trong chu kỳ này.</p>
            <p className="text-[11px] text-slate-400">Hãy tạo ngay hành trình mới bằng nút ở góc trên bên phải để bắt đầu hành trình bứt phá!</p>
          </div>
        )}
      </section>

      {/* 5. THÓI QUEN NÊN DUY TRÌ */}
      <section id="section-routines" className="hidden space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100"><Repeat2 className="h-4 w-4" /></span>
            Những nhịp nhỏ nên giữ
          </h2>
          <p className="text-xs text-slate-400 mt-1">Không cần hoàn hảo — chỉ cần giữ nhịp đủ lâu để tạo đà.</p>
        </div>

        <div className="bg-white/90 rounded-3xl p-5 border border-white shadow-sm">
          {state.routines.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {state.routines.map(routine => {
                const isCompleted = routine.status === 'completed';
                return (
                  <button
                    key={routine.id}
                    onClick={() => handleToggleHabit(routine.id)}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer w-full ${
                      isCompleted 
                        ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/50' 
                        : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1">
                      <p className={`text-xs font-black ${isCompleted ? 'text-emerald-950 line-through' : 'text-slate-800'}`}>
                        {routine.name}
                      </p>
                      <p className="text-[9px] text-slate-400">
                        Liên kết: <strong className="text-slate-500">{getJourneyName(routine.goalId)}</strong>
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300 hover:border-indigo-500 transition-colors shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-6">Chưa có thói quen nào được cấu hình.</p>
          )}
        </div>
      </section>

      {/* AI INTERACTIVE CONFIRMATION MODAL */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  <span>Xác nhận thông tin AI trích xuất</span>
                </h3>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold hover:bg-slate-100 p-1.5 rounded-lg cursor-pointer"
                >
                  Hủy bỏ
                </button>
              </div>

              {isClassifying ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3.5">
                  <div className="relative">
                    <Loader className="w-10 h-10 text-indigo-600 animate-spin" />
                    <Sparkles className="w-4 h-4 text-rose-400 absolute top-0 right-0 animate-bounce" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-slate-800">Đang phân tích nhật ký thô của bạn...</p>
                    <p className="text-xs text-slate-400 font-medium animate-pulse">Gemini đang chia nhỏ hoạt động & đề xuất lịch trình tối ưu</p>
                  </div>
                </div>
              ) : (
                editableCheckIn && (
                  <div className="space-y-6 text-left">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                          <p className="text-sm font-black text-amber-950">Kiểm tra tác động trước khi lưu</p>
                          <p className="mt-1 text-xs leading-relaxed text-amber-800">Chưa có dữ liệu nào được thay đổi. Bạn có thể sửa hoặc bỏ từng đề xuất bên dưới.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-xl bg-white p-3"><span className="block text-lg font-black text-slate-900">{editableCheckIn.activities.length}</span><span className="text-[10px] font-bold text-slate-500">Hoạt động</span></div>
                        <div className="rounded-xl bg-white p-3"><span className="block text-lg font-black text-slate-900">{editableCheckIn.taskSuggestions.length}</span><span className="text-[10px] font-bold text-slate-500">Việc mới</span></div>
                        <div className="rounded-xl bg-white p-3"><span className="block text-lg font-black text-slate-900">{editableCheckIn.scheduleSuggestions.length}</span><span className="text-[10px] font-bold text-slate-500">Lịch mới</span></div>
                        <div className="rounded-xl bg-white p-3"><span className="block text-lg font-black text-slate-900">{editableCheckIn.milestoneUpdates.length}</span><span className="text-[10px] font-bold text-slate-500">Cột mốc</span></div>
                      </div>
                    </div>
                    
                    {/* Tóm tắt */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Tóm tắt ngắn ngày hôm nay</label>
                      <input
                        type="text"
                        value={editableCheckIn.summary}
                        onChange={e => setEditableCheckIn({ ...editableCheckIn, summary: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>

                    {/* Hoạt động được trích xuất */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        Các hoạt động & Gán Hành Trình
                      </h4>

                      <div className="space-y-3.5">
                        {editableCheckIn.activities.map((act, index) => (
                          <div key={index} className="p-4 bg-slate-50/50 border border-slate-150 rounded-xl space-y-3">
                            <input
                              type="text"
                              value={act.activity}
                              onChange={e => {
                                const acts = [...editableCheckIn.activities];
                                acts[index].activity = e.target.value;
                                setEditableCheckIn({ ...editableCheckIn, activities: acts });
                              }}
                              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-indigo-500"
                            />

                            <div className="grid grid-cols-2 gap-3">
                              {/* Journey Selector */}
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400">Chọn Hành Trình</span>
                                <select
                                  value={act.journeyId || ""}
                                  onChange={e => {
                                    const acts = [...editableCheckIn.activities];
                                    acts[index].journeyId = e.target.value || null;
                                    setEditableCheckIn({ ...editableCheckIn, activities: acts });
                                  }}
                                  className="w-full text-xs border border-slate-200 rounded-lg p-1.5 bg-white focus:outline-none"
                                >
                                  <option value="">Chưa phân loại.</option>
                                  {activeJourneys.map(j => (
                                    <option key={j.id} value={j.id}>{j.name}</option>
                                  ))}
                                </select>
                                {!act.journeyId && (
                                  <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-bold mt-1 inline-block">
                                    Chưa phân loại. Vui lòng chọn bằng tay.
                                  </span>
                                )}
                              </div>

                              {/* Milestone Selector */}
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400">Chọn Cột Mốc cập nhật</span>
                                <select
                                  value={act.milestoneId || ""}
                                  onChange={e => {
                                    const acts = [...editableCheckIn.activities];
                                    acts[index].milestoneId = e.target.value || null;
                                    setEditableCheckIn({ ...editableCheckIn, activities: acts });
                                  }}
                                  className="w-full text-xs border border-slate-200 rounded-lg p-1.5 bg-white focus:outline-none"
                                  disabled={!act.journeyId}
                                >
                                  <option value="">-- Không cập nhật cột mốc --</option>
                                  {act.journeyId && (state.goals.find(g => g.id === act.journeyId)?.milestones || []).map(m => (
                                    <option key={m.id} value={m.id}>{m.title}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Warning low confidence */}
                            {act.confidence < 0.6 && (
                              <div className="text-[10px] text-amber-700 bg-amber-50 p-2 rounded-lg flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>AI phân loại không chắc chắn ({Math.round(act.confidence * 100)}%). Vui lòng gán lại bằng tay nếu chưa khớp.</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cột mốc hoàn thành được đề xuất */}
                    {editableCheckIn.milestoneUpdates.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                          Đề xuất hoàn thành cột mốc ({editableCheckIn.milestoneUpdates.length})
                        </h4>
                        <div className="space-y-2">
                          {editableCheckIn.milestoneUpdates.map((mu, idx) => (
                            <div key={idx} className="p-3 bg-teal-50/50 border border-teal-100 rounded-xl flex items-center justify-between gap-3 text-xs text-slate-700 font-medium">
                              <div>
                                <span>Hoàn thành mốc <strong>{state.goals.find(g => g.id === mu.journeyId)?.milestones?.find(m => m.id === mu.milestoneId)?.title || "Cột mốc"}</strong></span>
                                <p className="text-[10px] text-slate-400 mt-0.5 italic">{mu.evidence}</p>
                              </div>
                              <button
                                onClick={() => {
                                  const updates = editableCheckIn.milestoneUpdates.filter((_, i) => i !== idx);
                                  setEditableCheckIn({ ...editableCheckIn, milestoneUpdates: updates });
                                }}
                                className="text-slate-400 hover:text-rose-600 font-bold p-1 hover:bg-white rounded cursor-pointer"
                              >
                                Bỏ đề xuất
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Thói quen được đánh dấu hoàn thành */}
                    {editableCheckIn.routineUpdates.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Thói quen ghi nhận hoàn thành ({editableCheckIn.routineUpdates.length})
                        </h4>
                        <div className="space-y-2">
                          {editableCheckIn.routineUpdates.map((ru, idx) => (
                            <div key={idx} className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center justify-between gap-3 text-xs text-slate-700 font-medium">
                              <div>
                                <span>Thói quen <strong>{state.routines.find(r => r.id === ru.routineId)?.name || "Thói quen"}</strong></span>
                                <p className="text-[10px] text-slate-400 mt-0.5 italic">{ru.evidence}</p>
                              </div>
                              <button
                                onClick={() => {
                                  const updates = editableCheckIn.routineUpdates.filter((_, i) => i !== idx);
                                  setEditableCheckIn({ ...editableCheckIn, routineUpdates: updates });
                                }}
                                className="text-slate-400 hover:text-rose-600 font-bold p-1 hover:bg-white rounded cursor-pointer"
                              >
                                Bỏ đề xuất
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chores được AI nhận diện */}
                    {editableCheckIn.choreUpdates.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                          Việc duy trì cuộc sống ({editableCheckIn.choreUpdates.length})
                        </h4>
                        <div className="space-y-2">
                          {editableCheckIn.choreUpdates.map((chore, idx) => (
                            <div key={`${chore.choreId || chore.title}_${idx}`} className="flex items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-xs font-medium text-slate-700">
                              <div>
                                <span><strong>{chore.title}</strong> · {chore.suggestedStatus === "create" ? "Tạo chore mới" : "Đánh dấu hoàn thành"}</span>
                                <p className="mt-0.5 text-[10px] italic text-slate-400">{chore.evidence}</p>
                              </div>
                              <button
                                onClick={() => setEditableCheckIn({ ...editableCheckIn, choreUpdates: editableCheckIn.choreUpdates.filter((_, i) => i !== idx) })}
                                className="cursor-pointer rounded p-1 font-bold text-slate-400 hover:bg-white hover:text-rose-600"
                              >
                                Bỏ đề xuất
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {editableCheckIn.cycleUpdate && (
                      <div className="space-y-2">
                        <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                          Điều chỉnh chu kỳ 90 ngày
                        </h4>
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-slate-700">
                          <div>
                            <p>Bắt đầu mới từ <strong>{formatDisplayDate(editableCheckIn.cycleUpdate.startDate)}</strong></p>
                            <p className="mt-1 text-[10px] text-slate-500">Kết thúc: {formatDisplayDate(calculateEndDate(editableCheckIn.cycleUpdate.startDate))} · {editableCheckIn.cycleUpdate.shiftPlan ? "Dời toàn bộ deadline và lịch theo cùng số ngày" : "Giữ nguyên lịch hiện tại"}</p>
                            <p className="mt-1 text-[10px] italic text-slate-400">{editableCheckIn.cycleUpdate.reason}</p>
                          </div>
                          <button onClick={() => setEditableCheckIn({ ...editableCheckIn, cycleUpdate: null })} className="cursor-pointer rounded p-1 font-bold text-slate-400 hover:bg-white hover:text-rose-600">Bỏ đề xuất</button>
                        </div>
                      </div>
                    )}

                    {/* Đề xuất công việc kế tiếp (taskSuggestions) */}
                    {editableCheckIn.taskSuggestions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                          Đề xuất công việc tiếp theo ({editableCheckIn.taskSuggestions.length})
                        </h4>
                        <div className="space-y-2">
                          {editableCheckIn.taskSuggestions.map((t, idx) => (
                            <div key={idx} className="p-3 bg-indigo-50/30 border border-indigo-100/50 rounded-xl flex items-center justify-between gap-3 text-xs text-slate-700 font-medium">
                              <div>
                                <span>Lên danh sách việc: <strong>{t.title}</strong></span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">{t.dueDate ? `Hạn: ${formatDisplayDate(t.dueDate)} • ` : ""}Thời gian dự kiến: {t.estimatedMinutes} phút • Độ ưu tiên: {t.priority}</span>
                              </div>
                              <button
                                onClick={() => {
                                  const tasks = editableCheckIn.taskSuggestions.filter((_, i) => i !== idx);
                                  setEditableCheckIn({ ...editableCheckIn, taskSuggestions: tasks });
                                }}
                                className="text-slate-400 hover:text-rose-600 font-bold p-1 hover:bg-white rounded cursor-pointer"
                              >
                                Bỏ đề xuất
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Đề xuất lịch làm việc (scheduleSuggestions) */}
                    {editableCheckIn.scheduleSuggestions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                          Đề xuất khung giờ làm việc ({editableCheckIn.scheduleSuggestions.length})
                        </h4>
                        <div className="space-y-2">
                          {editableCheckIn.scheduleSuggestions.map((s, idx) => (
                            <div key={idx} className="p-3 bg-violet-50/30 border border-violet-100/50 rounded-xl flex items-center justify-between gap-3 text-xs text-slate-700 font-medium">
                              <div>
                                <span>Xếp lịch: <strong>{s.title}</strong></span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">Khung giờ: {s.startTime} - {s.endTime} từ {s.date}{s.recurrence === 'daily' ? ' · mỗi ngày đến hết chu kỳ' : s.recurrence === 'interval' ? ` · lặp mỗi ${s.intervalDays || 7} ngày` : s.recurrence === 'weekly_days' ? ' · theo các thứ đã chọn' : ''}</span>
                              </div>
                              <button
                                onClick={() => {
                                  const scheds = editableCheckIn.scheduleSuggestions.filter((_, i) => i !== idx);
                                  setEditableCheckIn({ ...editableCheckIn, scheduleSuggestions: scheds });
                                }}
                                className="text-slate-400 hover:text-rose-600 font-bold p-1 hover:bg-white rounded cursor-pointer"
                              >
                                Bỏ đề xuất
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lưu / Hủy */}
                    <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end">
                      <button
                        onClick={() => setShowConfirmModal(false)}
                        className="text-xs font-bold text-slate-500 hover:bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 cursor-pointer"
                      >
                        Hủy bỏ
                      </button>
                      <button
                        onClick={handleConfirmAndSave}
                        className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Xác nhận & Lưu nhật ký</span>
                      </button>
                    </div>
                  </div>
                )
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
