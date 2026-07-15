import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  X, Edit2, Play, Pause, Archive, CheckCircle, Clock, Trash2, Milestone as MilestoneIcon,
  BookOpen, Plus, ArrowUp, ArrowDown, ClipboardList, Calendar, Sparkles, ChevronRight, Check
} from "lucide-react";
import { AppState, Goal, Milestone, PriorityTask, ScheduleItem, Routine } from "../types";
import GoalIcon, { COLOR_MAP } from "./GoalIcon";
import { formatDisplayDate } from "../utils";

interface JourneyDetailProps {
  goal: Goal;
  state: AppState;
  onClose: () => void;
  onEdit: (goal: Goal) => void;
  onChangeState: (newState: AppState) => void;
}

export default function JourneyDetail({ goal, state, onClose, onEdit, onChangeState }: JourneyDetailProps) {
  const colors = COLOR_MAP[goal.accentColor || "indigo"] || COLOR_MAP["indigo"];

  // Inline forms state
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneTarget, setNewMilestoneTarget] = useState("");
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState("");

  const [notes, setNotes] = useState(goal.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Filter tasks, habits, schedules, and activities for this specific goal
  const goalTasks = state.priorityTasks.filter(t => t.goalId === goal.id || t.journeyId === goal.id);
  const goalSchedules = state.scheduleItems.filter(s => s.goalId === goal.id || s.journeyId === goal.id);
  const goalRoutines = state.routines.filter(r => r.goalId === goal.id);
  const goalActivities = state.activities.filter(a => a.goalId === goal.id);

  // Status handlers
  const handleUpdateStatus = (status: 'active' | 'paused' | 'completed' | 'archived') => {
    const nextGoals = state.goals.map(g => {
      if (g.id === goal.id) {
        return { ...g, status };
      }
      return g;
    });
    onChangeState({ ...state, goals: nextGoals });
  };

  // Milestone actions
  const handleToggleMilestone = (milestoneId: string) => {
    const nextGoals = state.goals.map(g => {
      if (g.id === goal.id) {
        const nextMilestones = g.milestones.map(m => {
          if (m.id === milestoneId) {
            const nextAchieved = !m.achieved;
            return { 
              ...m, 
              achieved: nextAchieved,
              currentValue: nextAchieved ? m.targetValue : "Chưa đạt",
              status: nextAchieved ? ("completed" as const) : ("active" as const),
              completedAt: nextAchieved ? new Date().toISOString() : null
            };
          }
          return m;
        });

        // Auto trigger next active milestone
        const completedIndex = nextMilestones.findIndex(m => m.id === milestoneId);
        if (completedIndex !== -1) {
          const nextIncomplete = nextMilestones.find((m, i) => i > completedIndex && !m.achieved);
          if (nextIncomplete) {
            nextIncomplete.status = "active";
          }
        }

        // Recalculate progress
        const achievedCount = nextMilestones.filter(m => m.achieved).length;
        const total = nextMilestones.length;
        const progressBonus = total > 0 ? Math.round((achievedCount / total) * 100) : g.currentProgress;

        return { 
          ...g, 
          milestones: nextMilestones,
          currentProgress: progressBonus,
          currentMilestone: nextMilestones.find(m => !m.achieved)?.title || g.currentMilestone,
          currentMilestoneId: nextMilestones.find(m => !m.achieved)?.id || null
        };
      }
      return g;
    });
    onChangeState({ ...state, goals: nextGoals });
  };

  const handleSkipMilestone = (milestoneId: string) => {
    const nextGoals = state.goals.map(g => {
      if (g.id === goal.id) {
        const nextMilestones = g.milestones.map(m => {
          if (m.id === milestoneId) {
            return { 
              ...m, 
              status: "skipped" as const,
              currentValue: "Đã bỏ qua"
            };
          }
          return m;
        });

        // Set next active
        const skipIndex = nextMilestones.findIndex(m => m.id === milestoneId);
        const nextIncomplete = nextMilestones.find((m, i) => i > skipIndex && !m.achieved && m.status !== "skipped");
        if (nextIncomplete) {
          nextIncomplete.status = "active";
        }

        return { 
          ...g, 
          milestones: nextMilestones,
          currentMilestone: nextMilestones.find(m => !m.achieved && m.status !== "skipped")?.title || g.currentMilestone,
          currentMilestoneId: nextMilestones.find(m => !m.achieved && m.status !== "skipped")?.id || null
        };
      }
      return g;
    });
    onChangeState({ ...state, goals: nextGoals });
  };

  const handleAddMilestone = () => {
    if (!newMilestoneTitle.trim() || !newMilestoneTarget.trim()) {
      return;
    }

    const nextGoals = state.goals.map(g => {
      if (g.id === goal.id) {
        const newMile: Milestone = {
          id: `mile_detail_${Date.now()}`,
          title: newMilestoneTitle,
          targetValue: newMilestoneTarget,
          currentValue: "Chưa đạt",
          achieved: false,
          dueDate: newMilestoneDueDate || goal.deadline,
          status: g.milestones.length === 0 ? "active" : "locked",
          order: g.milestones.length
        };
        const updatedMilestones = [...g.milestones, newMile];
        return {
          ...g,
          milestones: updatedMilestones
        };
      }
      return g;
    });

    onChangeState({ ...state, goals: nextGoals });
    setNewMilestoneTitle("");
    setNewMilestoneTarget("");
    setNewMilestoneDueDate("");
  };

  const handleDeleteMilestone = (milestoneId: string) => {
    const nextGoals = state.goals.map(g => {
      if (g.id === goal.id) {
        const filtered = g.milestones.filter(m => m.id !== milestoneId);
        const updated = filtered.map((m, idx) => ({
          ...m,
          order: idx,
          status: idx === 0 ? ("active" as const) : m.status
        }));
        return {
          ...g,
          milestones: updated
        };
      }
      return g;
    });
    onChangeState({ ...state, goals: nextGoals });
  };

  const handleMoveMilestone = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === goal.milestones.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...goal.milestones];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    const final = updated.map((m, i) => ({
      ...m,
      order: i
    }));

    const nextGoals = state.goals.map(g => {
      if (g.id === goal.id) {
        return { ...g, milestones: final };
      }
      return g;
    });
    onChangeState({ ...state, goals: nextGoals });
  };

  const handleSaveNotes = () => {
    const nextGoals = state.goals.map(g => {
      if (g.id === goal.id) {
        return { ...g, notes };
      }
      return g;
    });
    onChangeState({ ...state, goals: nextGoals });
    setIsEditingNotes(false);
  };

  return (
    <div id="journey-detail-drawer" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex md:justify-end justify-center p-0 md:p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        className="bg-white w-full md:max-w-3xl min-h-screen md:min-h-0 flex flex-col shadow-2xl relative border-l border-slate-100"
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <GoalIcon icon={goal.icon} color={goal.accentColor} size={20} className="p-2 bg-white" />
            <div>
              <h3 className="font-display font-extrabold text-slate-900 text-lg leading-tight">{goal.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Thời hạn: {formatDisplayDate(goal.deadline)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(goal)}
              className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Sửa hành trình"
            >
              <Edit2 className="w-4.5 h-4.5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Summary Outcomes */}
          <div className="bg-[#f8fafc] rounded-2xl p-5 border border-slate-200/60 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Kết quả mong muốn 90 ngày</span>
            <p className="text-sm text-slate-800 font-semibold leading-relaxed">
              &ldquo;{goal.desiredOutcome}&rdquo;
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 block uppercase">TIẾN ĐỘ HÀNH TRÌNH</span>
                <span className="text-2xl font-black text-slate-900 font-mono block">{goal.currentProgress}%</span>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${goal.currentProgress}%`, backgroundColor: colors.rawHex }} />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 block uppercase">TRẠNG THÁI</span>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    goal.status === "active" ? "bg-emerald-50 text-emerald-700" :
                    goal.status === "paused" ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-700"
                  }`}>
                    {goal.status === "active" ? "Đang chạy" : goal.status === "paused" ? "Tạm dừng" : "Lưu trữ"}
                  </span>
                  {goal.status === "active" ? (
                    <button onClick={() => handleUpdateStatus("paused")} className="p-1 border border-slate-200 rounded hover:bg-slate-50" title="Tạm dừng"><Pause className="w-3.5 h-3.5" /></button>
                  ) : (
                    <button onClick={() => handleUpdateStatus("active")} className="p-1 border border-slate-200 rounded hover:bg-slate-50" title="Kích hoạt"><Play className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: CỘT MỐC TIẾN TRÌNH */}
          <div className="space-y-4 border border-slate-150 rounded-[20px] p-5 bg-white">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <MilestoneIcon className="w-4 h-4 text-indigo-500" /> 1. Hành trình cột mốc ({goal.milestones.filter(m => m.achieved).length}/{goal.milestones.length})
            </h4>

            {/* Path View */}
            {goal.milestones.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-50 p-3 rounded-xl border border-slate-200/50 overflow-x-auto">
                {goal.milestones.map((m, i) => (
                  <React.Fragment key={m.id}>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                        m.achieved ? "bg-emerald-500 border-emerald-500 text-white" :
                        m.status === "active" ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-300 text-slate-500"
                      }`}>
                        {m.achieved ? "✓" : i + 1}
                      </span>
                      <span className={`text-[11px] font-bold ${m.achieved ? "text-slate-400 line-through" : m.status === "active" ? "text-indigo-600" : "text-slate-600"}`}>{m.title}</span>
                    </div>
                    {i < goal.milestones.length - 1 && <span className="text-slate-300 text-xs shrink-0 mx-1">&rarr;</span>}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Quick add milestone form */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-700 block">Thêm cột mốc mới vào hành trình</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Tiêu đề: ví dụ Đạt 50 email outreach"
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Chỉ tiêu: ví dụ 50"
                  value={newMilestoneTarget}
                  onChange={(e) => setNewMilestoneTarget(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div className="flex justify-between items-center pt-1">
                <input
                  type="date"
                  value={newMilestoneDueDate}
                  onChange={(e) => setNewMilestoneDueDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddMilestone}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  Thêm chặng
                </button>
              </div>
            </div>

            {/* Milestones list with actions */}
            <div className="space-y-2">
              {goal.milestones.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Chưa có cột mốc.</p>
              ) : (
                goal.milestones.map((m, idx) => (
                  <div 
                    key={m.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                      m.achieved ? "bg-emerald-50/40 border-emerald-100 text-emerald-800" : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleToggleMilestone(m.id)}
                        className="cursor-pointer"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          m.achieved ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"
                        }`}>
                          {m.achieved && <Check className="w-3 h-3 stroke-[3px]" />}
                        </div>
                      </button>
                      <div>
                        <span className={`text-xs font-bold block ${m.achieved ? "line-through text-slate-400" : "text-slate-800"}`}>
                          {m.title}
                        </span>
                        <span className="text-[10px] text-slate-500 block">Chỉ tiêu: {m.targetValue}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-400">Hạn: {formatDisplayDate(m.dueDate)}</span>
                      {!m.achieved && m.status !== "skipped" && (
                        <button 
                          onClick={() => handleSkipMilestone(m.id)}
                          className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded cursor-pointer"
                        >
                          Bỏ qua
                        </button>
                      )}
                      <button
                        onClick={() => handleMoveMilestone(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveMilestone(idx, 'down')}
                        disabled={idx === goal.milestones.length - 1}
                        className="p-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => handleDeleteMilestone(m.id)}
                        className="p-1 text-slate-300 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 2: VIỆC ƯU TIÊN */}
          <div className="space-y-3 border border-slate-150 rounded-[20px] p-5 bg-white">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-indigo-500" /> 2. Việc ưu tiên ({goalTasks.filter(t => t.completed).length}/{goalTasks.length})
            </h4>
            {goalTasks.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">Chưa có nhiệm vụ ưu tiên được gắn với hành trình này.</p>
            ) : (
              <div className="space-y-2">
                {goalTasks.map(task => (
                  <div key={task.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                    <div>
                      <span className={`font-bold block ${task.completed ? "line-through text-slate-400" : "text-slate-800"}`}>{task.title}</span>
                      {task.scheduledStart && <span className="text-[10px] text-slate-500">{task.scheduledStart} - {task.scheduledEnd} ({task.estimatedMinutes} phút)</span>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      task.completed ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"
                    }`}>
                      {task.completed ? "Hoàn thành" : "Đang chờ"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: LỊCH SẮP TỚI */}
          <div className="space-y-3 border border-slate-150 rounded-[20px] p-5 bg-white">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" /> 3. Lịch sắp tới
            </h4>
            {goalSchedules.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">Chưa có lịch hẹn nào của hành trình này.</p>
            ) : (
              <div className="space-y-2">
                {goalSchedules.map(sched => (
                  <div key={sched.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold block text-slate-800">{sched.title}</span>
                      <span className="text-[10px] text-slate-500">Ngày: {formatDisplayDate(sched.date)} | Giờ: {sched.startTime} - {sched.endTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 4: THÓI QUEN LIÊN QUAN */}
          <div className="space-y-3 border border-slate-150 rounded-[20px] p-5 bg-white">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" /> 4. Thói quen liên quan
            </h4>
            {goalRoutines.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">Chưa có thói quen hàng ngày nào gắn với hành trình này.</p>
            ) : (
              <div className="space-y-2">
                {goalRoutines.map(rot => (
                  <div key={rot.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold block text-slate-800">{rot.name} ({rot.frequency})</span>
                      <span className="text-[10px] text-slate-500">Tối thiểu: {rot.minimumDay} | Đích: {rot.target}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      rot.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {rot.status === "completed" ? "Đã làm" : "Chờ"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 5: HOẠT ĐỘNG GẦN ĐÂY */}
          <div className="space-y-3 border border-slate-150 rounded-[20px] p-5 bg-white">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" /> 5. Hoạt động gần đây ({goalActivities.length})
            </h4>
            {goalActivities.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Chưa ghi nhận hoạt động nào.</p>
            ) : (
              <div className="space-y-2.5 max-h-[250px] overflow-y-auto">
                {goalActivities.map(act => (
                  <div key={act.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-xs space-y-1">
                    <span className="text-[10px] text-slate-400 block font-mono">{formatDisplayDate(act.date)} ({act.source})</span>
                    <p className="font-semibold text-slate-800 leading-relaxed">{act.activity}</p>
                    {act.insight && <p className="text-[10px] text-indigo-600 bg-indigo-50 p-1.5 rounded mt-1">Lưu ý: {act.insight}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 6: GHI CHÚ */}
          <div className="space-y-3 border border-slate-150 rounded-[20px] p-5 bg-white">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">
                6. Ghi chú
              </h4>
              {!isEditingNotes ? (
                <button 
                  onClick={() => setIsEditingNotes(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-bold"
                >
                  Sửa ghi chú
                </button>
              ) : (
                <button 
                  onClick={handleSaveNotes}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold"
                >
                  Lưu
                </button>
              )}
            </div>
            
            {!isEditingNotes ? (
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3.5 rounded-xl border border-slate-100 italic">
                {goal.notes || "Chưa có ghi chú nào. Hãy thêm ghi chú để định hướng lộ trình."}
              </p>
            ) : (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500/25"
                placeholder="Nhập ghi chú quan trọng hoặc định hướng chặng hành trình tại đây..."
              />
            )}
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold shadow-sm cursor-pointer"
          >
            Đóng hành trình
          </button>
        </div>
      </motion.div>
    </div>
  );
}
