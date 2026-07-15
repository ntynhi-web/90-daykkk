import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, MicOff, Send, HelpCircle, Flame, Calendar, Trash2, Plus, CheckCircle, 
  AlertTriangle, Play, Sparkles, AlertCircle, Edit, ArrowRight, Loader, Save, Check, Clock, Eye,
  ListTodo, Siren, Brain, Zap, Archive, Target, Repeat2, MessageSquareText, Bot, Gauge, Lightbulb
} from "lucide-react";
import { AppState, Goal, Routine, ActivityEntry, PriorityTask, ScheduleItem } from "../types";
import { getCycleStats, saveCheckInToState, formatDisplayDate } from "../utils";
import GoalIcon from "./GoalIcon";

interface TodayViewProps {
  state: AppState;
  onChangeState: (newState: AppState) => void;
}

export default function TodayView({ state, onChangeState }: TodayViewProps) {
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
  const { currentDay, daysRemaining } = getCycleStats(state.startDate, todayStr);

  // Core States
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [isCoaching, setIsCoaching] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachAdvice, setCoachAdvice] = useState<any | null>(null);

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
    }>;
    scheduleSuggestions: Array<{
      title: string;
      date: string;
      startTime: string;
      endTime: string;
      journeyId: string | null;
    }>;
    routineUpdates: Array<{
      routineId: string;
      suggestedStatus: string;
      confidence: number;
      evidence: string;
    }>;
    unclassifiedItems: string[];
  } | null>(null);

  // Section 1: Priority Tasks States
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<'important_urgent' | 'important' | 'urgent' | 'later'>('important_urgent');
  const [newTaskJourneyId, setNewTaskJourneyId] = useState("");

  // Speech recognition ref
  const recognitionRef = useRef<any>(null);

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
        setIsRecording(true);
        setMicError(null);
        setRecordingSeconds(0);
      };

      recognition.onresult = (event: any) => {
        const currentResult = Array.from(event.results)
          .map((res: any) => res[0].transcript)
          .join(" ");
        setTranscript(currentResult);
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
        setIsRecording(false);
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
          goals: activeGoals,
          routines: activeRoutines
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
          estimatedMinutes: t.estimatedMinutes || 30
        })),
        scheduleSuggestions: (data.scheduleSuggestions || []).map((s: any) => ({
          title: s.title,
          date: s.date || todayStr,
          startTime: s.startTime || "09:00",
          endTime: s.endTime || "10:00",
          journeyId: s.journeyId && s.journeyId !== "null" ? s.journeyId : null
        })),
        routineUpdates: (data.routineUpdates || []).map((r: any) => ({
          routineId: r.routineId,
          suggestedStatus: r.suggestedStatus || "completed",
          confidence: r.confidence || 0.9,
          evidence: r.evidence || ""
        })),
        unclassifiedItems: data.unclassifiedItems || []
      });

    } catch (err: any) {
      console.error(err);
      setClassificationError(err.message || "Gặp lỗi khi xử lý phân loại bằng AI.");
      
      // Fallback state
      setEditableCheckIn({
        summary: "Cập nhật thủ công (Phân tích AI bị gián đoạn)",
        activities: [
          {
            activity: textToAnalyze,
            journeyId: null,
            milestoneId: null,
            confidence: 0.5,
            evidence: "Người dùng nhập liệu trực tiếp."
          }
        ],
        milestoneUpdates: [],
        taskSuggestions: [],
        scheduleSuggestions: [],
        routineUpdates: [],
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
        body: JSON.stringify({ question: transcript, state })
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

    // 4. Add task suggestions as real priority tasks
    if (editableCheckIn.taskSuggestions.length > 0) {
      const newTasks: PriorityTask[] = editableCheckIn.taskSuggestions.map((t, idx) => ({
        id: `task_${Date.now()}_${idx}`,
        title: t.title,
        priority: t.priority,
        completed: false,
        journeyId: t.journeyId
      }));
      updatedState.priorityTasks = [...(updatedState.priorityTasks || []), ...newTasks];
    }

    // 5. Add schedule suggestions as real schedule items
    if (editableCheckIn.scheduleSuggestions.length > 0) {
      const newScheds: ScheduleItem[] = editableCheckIn.scheduleSuggestions.map((s, idx) => ({
        id: `sched_${Date.now()}_${idx}`,
        title: s.title,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        journeyId: s.journeyId
      }));
      updatedState.scheduleItems = [...(updatedState.scheduleItems || []), ...newScheds];
    }

    onChangeState(updatedState);
    setShowConfirmModal(false);
    setTranscript("");
    setEditableCheckIn(null);
    alert("Cập nhật thành công! Dữ liệu hành trình, thói quen và lịch trình đã được đồng bộ hoá.");
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

  const moveTaskPriority = (taskId: string, targetPriority: 'important_urgent' | 'important' | 'urgent' | 'later') => {
    onChangeState({
      ...state,
      priorityTasks: (state.priorityTasks || []).map(t => t.id === taskId ? { ...t, priority: targetPriority } : t)
    });
  };

  // Section 2: Today's Schedule and Overlaps
  const todaySchedule = (state.scheduleItems || []).filter(item => item.date === todayStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

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

  return (
    <div id="today-dashboard-view" className="space-y-8">
      
      {/* 1. VOICE / TEXT CHECK-IN — PRIMARY ACTION */}
      <section id="section-quick-input" className="relative overflow-hidden space-y-5 rounded-[28px] border border-slate-800 bg-slate-950 p-5 md:p-7 shadow-[0_28px_70px_rgba(15,23,42,0.18)] before:absolute before:-right-24 before:-top-24 before:h-64 before:w-64 before:rounded-full before:bg-indigo-500/20 before:blur-3xl">
        <div>
          <p className="life-kicker text-indigo-300 mb-3">01 · Voice & text check-in</p>
          <h2 className="font-display text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500 text-white border border-indigo-400 shadow-lg shadow-indigo-950"><MessageSquareText className="h-5 w-5" /></span>
            Bạn đã tiến được gì hôm nay?
          </h2>
          <p className="text-sm text-slate-300 mt-2 max-w-2xl">Nói tự nhiên hoặc gõ vài dòng. AI sẽ phân loại tiến độ, phát hiện thông tin còn thiếu và đề xuất bước tiếp theo.</p>
        </div>

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
                      <span>Đang nghe... ({recordingSeconds}s) - Bấm để dừng</span>
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
                    className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-250 transition-all cursor-pointer disabled:opacity-50"
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

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-slate-100">
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
              </div>
            )}
          </div>
        </div>
      </section>


      {/* 2. VIỆC ƯU TIÊN HÔM NAY (PRIORITY BOARD 2X2) */}
      <section id="section-priority-board" className="space-y-4">
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
      <section id="section-today-schedule" className="space-y-4">
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
      <section id="section-goal-journeys" className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600 border border-teal-100"><Target className="h-4 w-4" /></span>
            Ba hành trình đang tiến tới
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Tiến trình đạt các mốc cột mốc trong chu kỳ 90 ngày của bạn.</p>
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
      <section id="section-routines" className="space-y-4">
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

                    {/* Đề xuất công việc kế tiếp (taskSuggestions) */}
                    {editableCheckIn.taskSuggestions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                          Đề xuất công việc chuẩn bị cho ngày mai ({editableCheckIn.taskSuggestions.length})
                        </h4>
                        <div className="space-y-2">
                          {editableCheckIn.taskSuggestions.map((t, idx) => (
                            <div key={idx} className="p-3 bg-indigo-50/30 border border-indigo-100/50 rounded-xl flex items-center justify-between gap-3 text-xs text-slate-700 font-medium">
                              <div>
                                <span>Lên danh sách việc: <strong>{t.title}</strong></span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">Thời gian dự kiến: {t.estimatedMinutes} phút • Độ ưu tiên: {t.priority}</span>
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
                                <span className="text-[10px] text-slate-400 block mt-0.5">Khung giờ: {s.startTime} - {s.endTime} ngày {s.date}</span>
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
