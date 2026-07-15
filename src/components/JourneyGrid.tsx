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
  return (
    <div id="journey-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
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
