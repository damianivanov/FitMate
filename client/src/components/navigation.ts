import type { IconType } from "react-icons";
import {
  LuCalendarDays,
  LuChartLine,
  LuClipboardList,
  LuCreditCard,
  LuDumbbell,
  LuLayoutTemplate,
  LuScale,
  LuShield,
  LuSparkles,
} from "react-icons/lu";

/** Drives the tinted glyph tile a section gets in the navigation drawer. */
export type NavTint =
  | "orange"
  | "blue"
  | "purple"
  | "pink"
  | "green"
  | "cyan"
  | "yellow"
  | "gray"
  | "rose";

export interface NavItem {
  label: string;
  to: string;
  icon: IconType;
  tint: NavTint;
  end?: boolean;
  requiresAdmin?: boolean;
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

export const navItems = {
  workouts: { label: "Workouts", to: "/workouts", icon: LuDumbbell, tint: "orange", end: true },
  program: { label: "Program", to: "/program", icon: LuClipboardList, tint: "blue" },
  templates: { label: "Templates", to: "/templates", icon: LuLayoutTemplate, tint: "purple" },
  calendar: { label: "Calendar", to: "/calendar", icon: LuCalendarDays, tint: "pink" },
  analytics: { label: "Analytics", to: "/analytics", icon: LuChartLine, tint: "green" },
  weight: { label: "Weight", to: "/weight-log", icon: LuScale, tint: "cyan" },
  aiCoach: { label: "AI Coach", to: "/ai-coach", icon: LuSparkles, tint: "yellow" },
  subscription: { label: "Subscription", to: "/subscription", icon: LuCreditCard, tint: "purple" },
  admin: { label: "Admin", to: "/management", icon: LuShield, tint: "rose", requiresAdmin: true },
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
    // Profile is deliberately absent: the drawer already opens with the user's own avatar row,
    // and a second way in would be the same destination twice on one screen.
    section: "Account",
    items: [navItems.subscription, navItems.admin],
  },
];

/** Flat reading order for the drawer's tile grid, which has no section headings. */
export const drawerNavItems: NavItem[] = navSections.flatMap((section) => section.items);

/* The app header swaps the wordmark for the current page's name once the page's own large
   title has scrolled away, so it needs a title for every route — including the ones that
   never appear in the drawer. Longest prefix wins, so the specific entries below can sit in
   any order alongside the section roots they extend. */
const routeTitles: ReadonlyArray<readonly [path: string, title: string]> = [
  ...drawerNavItems.map((item) => [item.to, item.label] as const),
  ["/profile", "Profile"],
  ["/workouts/new", "New workout"],
  ["/templates/new", "New template"],
  ["/templates/view", "Template"],
  ["/program/new", "New program"],
  ["/legal", "Legal"],
];

export function resolveRouteTitle(pathname: string): string | null {
  let match: string | null = null;
  let matchLength = 0;

  for (const [path, title] of routeTitles) {
    const isMatch = pathname === path || pathname.startsWith(`${path}/`);

    if (isMatch && path.length > matchLength) {
      match = title;
      matchLength = path.length;
    }
  }

  return match;
}

export const mobileTabItems: NavItem[] = [
  navItems.workouts,
  navItems.program,
  navItems.calendar,
  navItems.analytics,
];
