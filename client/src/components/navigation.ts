import type { IconType } from "react-icons";
import {
  LuBookCopy,
  LuCircleUserRound,
  LuClock3,
  LuDumbbell,
  LuHistory,
  LuLayoutDashboard,
  LuLayoutTemplate,
  LuPlus,
} from "react-icons/lu";

export type NavItem = {
  label: string;
  to: string;
  icon: IconType;
  end?: boolean;
  requiresAdmin?: boolean;
};

export type NavSection = {
  section: string;
  items: NavItem[];
};

export type MobileNavItem = Pick<NavItem, "label" | "to" | "icon" | "end"> & {
  isPrimaryAction?: boolean;
};

export const trainingNavItems: NavItem[] = [
  { label: "Dashboard", to: "/workouts", icon: LuDumbbell, end: true },
  { label: "New workout", to: "/workouts/new", icon: LuDumbbell, end: false },
  { label: "Templates", to: "/templates", icon: LuLayoutTemplate, end: false },
  { label: "History", to: "/workouts/history", icon: LuClock3, end: false },
];

export const insightNavItems: NavItem[] = [
  { label: "Analytics", to: "/analytics", icon: LuLayoutDashboard, end: false },
  { label: "Records", to: "/records", icon: LuLayoutDashboard, end: false },
];

const managementNavItems: NavItem[] = [
  { label: "Admin Dashboard", to: "/management", icon: LuLayoutDashboard, end: true, requiresAdmin: true },
  { label: "Exercise Grid", to: "/management/exercises", icon: LuDumbbell, end: false, requiresAdmin: true },
  { label: "Muscle Group Grid", to: "/management/muscle-groups", icon: LuBookCopy, end: false, requiresAdmin: true },
];

export const navSections: NavSection[] = [
  {
    section: "Training",
    items: trainingNavItems,
  },
  {
    section: "Insights",
    items: insightNavItems,
  },
  {
    section: "Management",
    items: managementNavItems,
  },
];

export const mobileBottomNavItems: MobileNavItem[] = [
  { label: "All Workouts", to: "/workouts", icon: LuDumbbell, end: true },
  { label: "All Workout Templates", to: "/templates", icon: LuLayoutTemplate, end: true },
  { label: "New workout", to: "/workouts/new", icon: LuPlus, end: true, isPrimaryAction: true },
  { label: "Workout History", to: "/workouts/history", icon: LuHistory, end: true },
  { label: "Profile", to: "/profile", icon: LuCircleUserRound, end: true },
];
