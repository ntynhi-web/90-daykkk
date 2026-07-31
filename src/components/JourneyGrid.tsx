import React from "react";
import { motion } from "motion/react";
import { Goal } from "../types";
import JourneyCard from "./JourneyCard";

interface JourneyGridProps {
  goals: Goal[];
  onViewDetails: (goalId: string) => void;
  onEdit: (e: React.MouseEvent, goal: Goal) => void;
  onArchive: (goalId: string) => void;
}

export default function JourneyGrid({ goals, onViewDetails, onEdit, onArchive }: JourneyGridProps) {
  const layoutClass = goals.length === 1
    ? "grid-cols-1"
    : goals.length === 2
      ? "grid-cols-1 md:grid-cols-2"
      : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";

  return (
    <div id="journey-grid" className={`grid ${layoutClass} gap-4 pt-2`}>
      {goals.map((goal, idx) => (
        <motion.div
          key={goal.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: idx * 0.05 }}
        >
          <JourneyCard 
            goal={goal}
            onViewDetails={onViewDetails}
            onEdit={onEdit}
            onArchive={onArchive}
          />
        </motion.div>
      ))}
    </div>
  );
}
