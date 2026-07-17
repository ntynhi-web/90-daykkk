import React, { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { AppState, Goal } from "../types";
import JourneyHeader from "./JourneyHeader";
import JourneyGrid from "./JourneyGrid";
import JourneyEmptyState, { JourneyPreset } from "./JourneyEmptyState";
import JourneySetupWizard from "./JourneySetupWizard";
import JourneyDetail from "./JourneyDetail";

interface GoalsViewProps {
  state: AppState;
  onChangeState: (newState: AppState) => void;
  autoOpenCreateModal?: boolean;
  onCloseCreateModal?: () => void;
}

export default function GoalsView({ state, onChangeState, autoOpenCreateModal, onCloseCreateModal }: GoalsViewProps) {
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [isEditingGoalId, setIsEditingGoalId] = useState<string | null>(null);
  const [presetForWizard, setPresetForWizard] = useState<JourneyPreset | null>(null);

  useEffect(() => {
    if (autoOpenCreateModal) {
      setPresetForWizard(null);
      setIsAddingGoal(true);
      onCloseCreateModal?.();
    }
  }, [autoOpenCreateModal, onCloseCreateModal]);

  const activeGoal = state.goals.find(g => g.id === selectedGoalId);
  const editingGoal = state.goals.find(g => g.id === isEditingGoalId);

  // Archive a goal
  const handleArchiveGoal = (goalId: string) => {
    const nextGoals = state.goals.map(g => {
      if (g.id === goalId) {
        return { ...g, status: "archived" as const };
      }
      return g;
    });
    onChangeState({ ...state, goals: nextGoals });
  };

  // Open Edit Goal Form
  const handleOpenEditGoal = (e: React.MouseEvent, goal: Goal) => {
    e.stopPropagation();
    setIsEditingGoalId(goal.id);
  };

  // Save Goal from Setup Wizard (create or update)
  const handleSaveGoal = (newGoal: Goal, initialPlan?: {
    firstTask?: string;
    habit?: string;
    scheduleTime?: string;
    duration?: number;
    notes?: string;
  }) => {
    let nextGoals = [...state.goals];
    
    if (isEditingGoalId) {
      nextGoals = nextGoals.map(g => g.id === isEditingGoalId ? { ...g, ...newGoal, id: g.id } : g);
      setIsEditingGoalId(null);
    } else {
      nextGoals.push(newGoal);
      setIsAddingGoal(false);
    }

    let nextTasks = [...(state.priorityTasks || [])];
    let nextRoutines = [...(state.routines || [])];
    
    if (initialPlan) {
      const todayStr = new Date().toISOString().split("T")[0];
      if (initialPlan.firstTask) {
        nextTasks.push({
          id: `task_init_${Date.now()}`,
          title: initialPlan.firstTask,
          completed: false,
          priority: "important_urgent",
          goalId: newGoal.id,
          journeyId: newGoal.id,
          dueDate: todayStr
        });
      }
      if (initialPlan.habit) {
        nextRoutines.push({
          id: `routine_init_${Date.now()}`,
          name: initialPlan.habit,
          status: "pending",
          minimumDay: "Làm mỗi ngày",
          target: "Duy trì",
          frequency: "daily",
          evidence: "Ghi chép",
          goalId: newGoal.id
        });
      }
    }

    onChangeState({
      ...state,
      goals: nextGoals,
      priorityTasks: nextTasks,
      routines: nextRoutines
    });
    
    setPresetForWizard(null);
  };

  // Preset Selection (prefill template)
  const handleSelectPreset = (preset: JourneyPreset) => {
    setPresetForWizard(preset);
    setIsAddingGoal(true);
  };

  const visibleGoals = state.goals.filter(g => g.status !== "archived");
  const activeGoals = visibleGoals.filter(g => g.status === "active");
  const focusGoal = activeGoals.find(g => g.id === state.dailyFocusGoalId) || activeGoals[0];
  const supportGoals = activeGoals.filter(g => g.id !== focusGoal?.id).slice(0, 2);
  const laterGoals = visibleGoals.filter(g => g.id !== focusGoal?.id && !supportGoals.some(item => item.id === g.id));

  return (
    <div id="goals-view-root" className="space-y-6 max-w-7xl mx-auto px-4 md:px-6">
      
      {/* Journey Page Header */}
      <JourneyHeader 
        state={state}
        onCreateClick={() => {
          setPresetForWizard(null);
          setIsAddingGoal(true);
        }}
      />

      {/* Main Grid or Empty State */}
      {visibleGoals.length === 0 ? (
        <JourneyEmptyState 
          onCreateClick={() => {
            setPresetForWizard(null);
            setIsAddingGoal(true);
          }}
          onSelectExample={handleSelectPreset}
        />
      ) : (
        <div className="space-y-8">
          {focusGoal && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="life-kicker text-indigo-600">Ưu tiên hiện tại</p>
                  <h2 className="mt-1 font-display text-xl font-extrabold text-slate-950">Một hành trình chính</h2>
                  <p className="mt-1 text-xs text-slate-500">Đây là mục tiêu nhận phần lớn thời gian và năng lượng. Bạn vẫn nhìn thấy các mục tiêu khác mà không phải xử lý tất cả cùng lúc.</p>
                </div>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-bold text-indigo-700">60–70% nỗ lực</span>
              </div>
              <JourneyGrid goals={[focusGoal]} onViewDetails={setSelectedGoalId} onEdit={handleOpenEditGoal} onArchive={handleArchiveGoal} />
            </section>
          )}

          {supportGoals.length > 0 && (
            <section className="space-y-3">
              <div>
                <p className="life-kicker text-emerald-600">Giữ nhịp</p>
                <h2 className="mt-1 font-display text-lg font-extrabold text-slate-950">Tối đa hai hành trình hỗ trợ</h2>
                <p className="mt-1 text-xs text-slate-500">Chỉ cần một block nhỏ hoặc routine tối thiểu để các mục tiêu này không bị lãng quên.</p>
              </div>
              <JourneyGrid goals={supportGoals} onViewDetails={setSelectedGoalId} onEdit={handleOpenEditGoal} onArchive={handleArchiveGoal} />
            </section>
          )}

          {laterGoals.length > 0 && (
            <details className="group rounded-3xl border border-slate-200 bg-white p-5">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="life-kicker text-slate-400">Sau này</p>
                    <h2 className="mt-1 font-display text-lg font-extrabold text-slate-900">{laterGoals.length} hành trình đang chờ</h2>
                    <p className="mt-1 text-xs text-slate-500">Được lưu an toàn nhưng không chiếm sự chú ý trên dashboard.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600 group-open:bg-indigo-50 group-open:text-indigo-700">Mở danh sách</span>
                </div>
              </summary>
              <div className="mt-5 border-t border-slate-100 pt-5">
                <JourneyGrid goals={laterGoals} onViewDetails={setSelectedGoalId} onEdit={handleOpenEditGoal} onArchive={handleArchiveGoal} />
              </div>
            </details>
          )}
        </div>
      )}

      {/* SETUP WIZARD FOR ADDING A GOAL */}
      <AnimatePresence>
        {isAddingGoal && (
          <JourneySetupWizard 
            state={state}
            onClose={() => {
              setIsAddingGoal(false);
              setPresetForWizard(null);
            }}
            onSave={handleSaveGoal}
            initialPreset={presetForWizard}
          />
        )}
      </AnimatePresence>

      {/* SETUP WIZARD FOR EDITING A GOAL */}
      <AnimatePresence>
        {isEditingGoalId && editingGoal && (
          <JourneySetupWizard 
            state={state}
            onClose={() => setIsEditingGoalId(null)}
            onSave={handleSaveGoal}
            initialPreset={{
              name: editingGoal.name,
              desiredOutcome: editingGoal.desiredOutcome,
              category: editingGoal.category || "custom",
              icon: editingGoal.icon || "target",
              accentColor: editingGoal.accentColor || "indigo",
              mainMetric: editingGoal.mainMetric || "",
              notes: editingGoal.notes || "",
              milestones: editingGoal.milestones.map(m => ({
                title: m.title,
                targetValue: m.targetValue,
                dueDate: m.dueDate
              }))
            }}
          />
        )}
      </AnimatePresence>

      {/* JOURNEY DETAILED VIEW DRAWER */}
      <AnimatePresence>
        {selectedGoalId && activeGoal && (
          <JourneyDetail 
            goal={activeGoal}
            state={state}
            onClose={() => setSelectedGoalId(null)}
            onEdit={(g) => {
              setSelectedGoalId(null);
              setIsEditingGoalId(g.id);
            }}
            onChangeState={onChangeState}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
