import type { IconType } from "react-icons";
import {
  LuCalendarDays,
  LuCircleUserRound,
  LuDumbbell,
  LuLayoutDashboard,
  LuLayoutTemplate,
  LuPlus,
  LuScale,
} from "react-icons/lu";

export interface NavItem {
  label: string;
  to: string;
  icon: IconType;
  end?: boolean;
}

export interface DesktopNavItem extends NavItem {
  requiresAdmin?: boolean;
}

export interface MobileNavItem extends NavItem {
  isPrimaryAction?: boolean;
}

export interface NavSection {
  section: string;
  items: DesktopNavItem[];
}

export const trainingNavItems: DesktopNavItem[] = [
  { label: "Dashboard", to: "/workouts", icon: LuDumbbell, end: true },
  { label: "New workout", to: "/workouts/new", icon: LuDumbbell, end: false },
  { label: "Templates", to: "/templates", icon: LuLayoutTemplate, end: false },
  { label: "Calendar", to: "/calendar", icon: LuCalendarDays, end: false },
];

export const insightNavItems: DesktopNavItem[] = [
  { label: "Analytics", to: "/analytics", icon: LuLayoutDashboard, end: false },
  { label: "Weight", to: "/weight-log", icon: LuScale, end: false },
];

const managementNavItems: DesktopNavItem[] = [
  { label: "Admin Dashboard", to: "/management", icon: LuLayoutDashboard, end: false, requiresAdmin: true },
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
  { label: "Calendar", to: "/calendar", icon: LuCalendarDays, end: true },
  { label: "Profile", to: "/profile", icon: LuCircleUserRound, end: false },
];
