import React, { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { AppState, Goal } from "../types";
import GoalRoadmapBlock from "./GoalRoadmapBlock";
import JourneyEmptyState, { JourneyPreset } from "./JourneyEmptyState";
import JourneyHeader from "./JourneyHeader";
import JourneySetupWizard from "./JourneySetupWizard";

interface GoalsViewProps {
  state: AppState;
  onChangeState: (newState: AppState) => void;
  autoOpenCreateModal?: boolean;
  onCloseCreateModal?: () => void;
}

const getToday = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

export default function GoalsView({ state, onChangeState, autoOpenCreateModal, onCloseCreateModal }: GoalsViewProps) {
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [presetForWizard, setPresetForWizard] = useState<JourneyPreset | null>(null);

  useEffect(() => {
    if (!autoOpenCreateModal) return;
    setPresetForWizard(null);
    setIsAddingGoal(true);
    onCloseCreateModal?.();
  }, [autoOpenCreateModal, onCloseCreateModal]);

  const openCreate = (preset: JourneyPreset | null = null) => {
    setPresetForWizard(preset);
    setIsAddingGoal(true);
  };

  const handleSaveGoal = (newGoal: Goal, initialPlan?: {
    firstTask?: string;
    habit?: string;
    scheduleTime?: string;
    duration?: number;
    notes?: string;
  }) => {
    const now = Date.now();
    const today = getToday();
    const nextTasks = [...(state.priorityTasks || [])];
    const nextRoutines = [...(state.routines || [])];

    if (initialPlan?.firstTask?.trim()) {
      nextTasks.push({
        id: `task_init_${now}`,
        title: initialPlan.firstTask.trim(),
        completed: false,
        priority: "important_urgent",
        goalId: newGoal.id,
        journeyId: newGoal.id,
        dueDate: today
      });
    }

    if (initialPlan?.habit?.trim()) {
      nextRoutines.push({
        id: `routine_init_${now}`,
        name: initialPlan.habit.trim(),
        status: "pending",
        minimumDay: "Làm mỗi ngày",
        target: "Duy trì",
        frequency: "daily",
        evidence: "Ghi nhận thủ công",
        goalId: newGoal.id
      });
    }

    onChangeState({
      ...state,
      goals: [...state.goals, newGoal],
      priorityTasks: nextTasks,
      routines: nextRoutines
    });
    setIsAddingGoal(false);
    setPresetForWizard(null);
  };

  const visibleGoals = state.goals.filter(goal => goal.status !== "archived");

  return (
    <div id="goals-view-root" className="mx-auto max-w-7xl space-y-6 px-4 md:px-6">
      <JourneyHeader state={state} onCreateClick={() => openCreate()} />

      {visibleGoals.length === 0 ? (
        <JourneyEmptyState onCreateClick={() => openCreate()} onSelectExample={openCreate} />
      ) : (
        <GoalRoadmapBlock state={state} today={getToday()} onChangeState={onChangeState} />
      )}

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
    </div>
  );
}
