import { useNavigate } from "react-router";
import type { IconType } from "react-icons";
import {
  LuBrain,
  LuCreditCard,
  LuDumbbell,
  LuGauge,
  LuHeartPulse,
  LuMessageCircle,
  LuSettings2,
  LuSparkles,
  LuTriangleAlert,
  LuUsers,
} from "react-icons/lu";
import {
  NativeCard,
  NativeGlyph,
  NativePage,
  NativeSection,
  PageBody,
  PageIntro,
  type NativeTint,
} from "@/shared/components";
import { BuildInfoPanel } from "./components/BuildInfoPanel";
import "./admin.css";

type AdminLink = {
  to: string;
  title: string;
  description: string;
  icon: IconType;
  tint: NativeTint;
};

const CATALOGUE: AdminLink[] = [
  {
    to: "/management/exercises",
    title: "Exercises",
    description: "Global exercise catalogue",
    icon: LuDumbbell,
    tint: "orange",
  },
  {
    to: "/management/muscle-groups",
    title: "Muscle groups",
    description: "Names and images",
    icon: LuHeartPulse,
    tint: "pink",
  },
  {
    to: "/management/users",
    title: "Users",
    description: "Roles and accounts",
    icon: LuUsers,
    tint: "blue",
  },
  {
    to: "/management/errors",
    title: "Errors",
    description: "Server-side error log",
    icon: LuTriangleAlert,
    tint: "rose",
  },
  {
    to: "/management/subscriptions",
    title: "Subscriptions",
    description: "Plans and entitlements",
    icon: LuCreditCard,
    tint: "green",
  },
];

const AI_LINKS: AdminLink[] = [
  {
    to: "/management/ai",
    title: "AI overview",
    description: "Runs, latency and cost",
    icon: LuGauge,
    tint: "purple",
  },
  {
    to: "/management/ai/conversations",
    title: "Conversations",
    description: "Runs and proposed actions",
    icon: LuMessageCircle,
    tint: "cyan",
  },
  {
    to: "/management/ai/unsupported-requests",
    title: "Unsupported requests",
    description: "What users ask for that FitMate cannot do",
    icon: LuBrain,
    tint: "yellow",
  },
  {
    to: "/management/ai/costs",
    title: "Cost per user",
    description: "Token spend by model",
    icon: LuSparkles,
    tint: "orange",
  },
  {
    to: "/management/ai/settings",
    title: "AI settings",
    description: "Models, ceilings and tool limits",
    icon: LuSettings2,
    tint: "gray",
  },
];

function AdminGrid({ links }: { links: AdminLink[] }) {
  const navigate = useNavigate();

  return (
    <div className="ad-grid">
      {links.map((link) => {
        const Icon = link.icon;

        return (
          <button
            type="button"
            key={link.to}
            onClick={() => navigate(link.to)}
            className="ad-tile"
          >
            <NativeGlyph tint={link.tint}>
              <Icon className="h-5 w-5" />
            </NativeGlyph>
            <b>{link.title}</b>
            <small>{link.description}</small>
          </button>
        );
      })}
    </div>
  );
}

export default function AdminPanel() {
  return (
    <PageBody>
      <NativePage>
        <PageIntro eyebrow="Admin" />

        <NativeSection title="Management">
          <AdminGrid links={CATALOGUE} />
        </NativeSection>

        <NativeSection title="AI operations">
          <AdminGrid links={AI_LINKS} />
        </NativeSection>

        <NativeCard className="ad-build">
          <BuildInfoPanel />
        </NativeCard>
      </NativePage>
    </PageBody>
  );
}
