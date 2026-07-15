import React from "react";
import { 
  Briefcase,
  Megaphone,
  LineChart,
  Heart,
  User,
  GraduationCap,
  Wallet,
  Home,
  Repeat,
  FolderKanban,
  Target,
  Rocket,
  Dumbbell,
  Globe,
  Laptop,
  BookOpen,
  Sparkles,
  HelpCircle
} from "lucide-react";
import { GoalIconName } from "../types";

export const GOAL_ICON_MAP: Record<string, React.ComponentType<any>> = {
  briefcase: Briefcase,
  megaphone: Megaphone,
  chart: LineChart,
  heart: Heart,
  career: User,
  learning: GraduationCap,
  finance: Wallet,
  home: Home,
  habit: Repeat,
  project: FolderKanban,
  target: Target,
  rocket: Rocket,
  dumbbell: Dumbbell,
  globe: Globe,
  laptop: Laptop,
  book: BookOpen,
  sparkles: Sparkles
};

export const COLOR_MAP: Record<string, { bg: string; text: string; border: string; rawHex: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100", rawHex: "#3B82F6" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", rawHex: "#10B981" },
  rose: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100", rawHex: "#F43F5E" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100", rawHex: "#F59E0B" },
  purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100", rawHex: "#8B5CF6" },
  cyan: { bg: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-100", rawHex: "#06B6D4" },
  pink: { bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-100", rawHex: "#EC4899" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100", rawHex: "#6366F1" },
};

interface GoalIconProps {
  icon?: GoalIconName | string;
  color?: string;
  className?: string;
  size?: number;
}

export default function GoalIcon({ icon, color = "indigo", className = "", size = 16 }: GoalIconProps) {
  const IconComponent = (icon && GOAL_ICON_MAP[icon]) || GOAL_ICON_MAP["target"] || HelpCircle;
  const colors = COLOR_MAP[color] || COLOR_MAP["indigo"];

  return (
    <div className={`p-2 rounded-xl flex items-center justify-center border shrink-0 ${colors.bg} ${colors.text} ${colors.border} ${className}`}>
      <IconComponent style={{ width: size, height: size }} />
    </div>
  );
}
