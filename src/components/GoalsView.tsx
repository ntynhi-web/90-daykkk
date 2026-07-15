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

  // Filter out archived goals to show in the primary grid
  const activeAndPausedGoals = state.goals.filter(g => g.status !== "archived");

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
      {activeAndPausedGoals.length === 0 ? (
        <JourneyEmptyState 
          onCreateClick={() => {
            setPresetForWizard(null);
            setIsAddingGoal(true);
          }}
          onSelectExample={handleSelectPreset}
        />
      ) : (
        <JourneyGrid 
          goals={activeAndPausedGoals}
          onViewDetails={setSelectedGoalId}
          onEdit={handleOpenEditGoal}
          onArchive={handleArchiveGoal}
        />
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
