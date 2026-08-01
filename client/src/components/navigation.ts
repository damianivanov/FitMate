import type { IconType } from "react-icons";
import {
  LuCalendarDays,
  LuChartLine,
  LuCircleUserRound,
  LuClipboardList,
  LuCreditCard,
  LuDumbbell,
  LuLayoutTemplate,
  LuScale,
  LuShield,
  LuSparkles,
} from "react-icons/lu";

export interface NavItem {
  label: string;
  to: string;
  icon: IconType;
  end?: boolean;
  requiresAdmin?: boolean;
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

export const navItems = {
  workouts: { label: "Workouts", to: "/workouts", icon: LuDumbbell, end: true },
  program: { label: "Program", to: "/program", icon: LuClipboardList },
  templates: { label: "Templates", to: "/templates", icon: LuLayoutTemplate },
  calendar: { label: "Calendar", to: "/calendar", icon: LuCalendarDays },
  analytics: { label: "Analytics", to: "/analytics", icon: LuChartLine },
  weight: { label: "Weight", to: "/weight-log", icon: LuScale },
  aiCoach: { label: "AI Coach", to: "/ai-coach", icon: LuSparkles },
  profile: { label: "Profile", to: "/profile", icon: LuCircleUserRound },
  subscription: { label: "Subscription", to: "/subscription", icon: LuCreditCard },
  admin: { label: "Admin", to: "/management", icon: LuShield, requiresAdmin: true },
} satisfies Record<string, NavItem>;

export const navSections: NavSection[] = [
  {
    section: "Train",
    items: [navItems.workouts, navItems.program, navItems.templates, navItems.calendar],
  },
  {
    section: "Progress",
    items: [navItems.analytics, navItems.weight, navItems.aiCoach],
  },
  {
    section: "Account",
    items: [navItems.profile, navItems.subscription, navItems.admin],
  },
];

export const mobileTabItems: NavItem[] = [
  navItems.workouts,
  navItems.program,
  navItems.calendar,
  navItems.analytics,
];
