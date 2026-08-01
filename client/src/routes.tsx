import { Outlet, createBrowserRouter } from "react-router";
import Layout from "@/components/Layout";
import AccessGate from "@/components/guards/AccessGate";
import { UserRole } from "@/types";
import { Login, Register, ForgotPassword, ResetPassword } from "./pages/Auth";
import Home from "./pages/Home";
import Profile, { ProfileAccount, MyExercises, TrainingProfile } from "./pages/Profile";
import AdminPanel, {
  AIConversationGrid,
  AIOverview,
  AISettings,
  AIUserCosts,
  ErrorGrid,
  ExerciseGrid,
  MuscleGroupGrid,
  SubscriptionAdmin,
  UnsupportedRequestGrid,
  UserGrid,
} from "./pages/AdminPanel";
import WorkoutBuilderRoute from "./pages/WorkoutBuilder/WorkoutBuilderRoute";
import WorkoutSummary from "./pages/WorkoutSummary";
import Workouts from "./pages/Workouts";
import AICoach from "./pages/AICoach";
import Program, { ProgramDetail } from "./pages/Program";
import ProgramBuilder from "./pages/ProgramBuilder";
import ProgramCalendar from "./pages/ProgramCalendar";
import Subscription from "./pages/Subscription";
import Templates from "./pages/Templates";
import TemplateBuilder from "./pages/TemplateBuilder";
import TemplatePreview from "./pages/TemplatePreview";
import Analytics from "./pages/Analytics";
import Calendar from "./pages/Calendar";
import Legal from "./pages/Legal";
import WeightLog from "./pages/WeightLog";
import ComponentTest from "./pages/ComponentTest";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <AccessGate requireUnauthenticated authenticatedRedirectTo="/workouts">
            <Home />
          </AccessGate>
        ),
      },
      {
        path: "login",
        element: (
          <AccessGate requireUnauthenticated>
            <Login />
          </AccessGate>
        ),
      },
      {
        path: "register",
        element: (
          <AccessGate requireUnauthenticated>
            <Register />
          </AccessGate>
        ),
      },
      {
        path: "forgot-password",
        element: (
          <AccessGate requireUnauthenticated>
            <ForgotPassword />
          </AccessGate>
        ),
      },
      {
        path: "reset-password",
        element: (
          <AccessGate requireUnauthenticated>
            <ResetPassword />
          </AccessGate>
        ),
      },
      {
        path: "component-test",
        element: <ComponentTest />,
      },
      {
        path: "legal",
        element: <Legal />,
      },
      {
        path: "profile",
        element: (
          <AccessGate requireAuthenticated>
            <Profile />
          </AccessGate>
        ),
        children: [
          {
            index: true,
            element: <ProfileAccount />,
          },
          {
            path: "training",
            element: <TrainingProfile />,
          },
          {
            path: "exercises",
            element: <MyExercises />,
          },
        ],
      },

      {
        path: "workouts",
        element: (
          <AccessGate requireAuthenticated>
            <Outlet />
          </AccessGate>
        ),
        children: [
          {
            index: true,
            element: <Workouts />,
          },
          {
            path: "new",
            element: <WorkoutBuilderRoute />,
          },
          {
            path: ":workoutId/summary",
            element: <WorkoutSummary />,
          },
          {
            path: ":workoutId",
            element: <WorkoutBuilderRoute />,
          },
        ],
      },

      {
        path: "templates",
        element: (
          <AccessGate requireAuthenticated>
            <Outlet />
          </AccessGate>
        ),
        children: [
          {
            index: true,
            element: <Templates />,
          },
          {
            path: "new",
            element: <TemplateBuilder />,
          },
          {
            path: "view/:templateId",
            element: <TemplatePreview />,
          },
          {
            path: ":templateId",
            element: <TemplateBuilder />,
          },
        ],
      },

      {
        path: "ai-coach",
        element: (
          <AccessGate requireAuthenticated>
            <AICoach />
          </AccessGate>
        ),
      },

      {
        path: "subscription",
        element: (
          <AccessGate requireAuthenticated>
            <Outlet />
          </AccessGate>
        ),
        children: [
          {
            index: true,
            element: <Subscription />,
          },
          {
            path: "usage",
            element: <Subscription />,
          },
        ],
      },

      {
        path: "program",
        element: (
          <AccessGate requireAuthenticated>
            <Outlet />
          </AccessGate>
        ),
        children: [
          {
            index: true,
            element: <Program />,
          },
          {
            path: "new",
            element: <ProgramBuilder />,
          },
          {
            path: ":planId",
            element: <ProgramDetail />,
          },
          {
            path: ":planId/edit",
            element: <ProgramBuilder />,
          },
          {
            path: ":planId/calendar",
            element: <ProgramCalendar />,
          },
        ],
      },

      {
        path: "calendar",
        element: (
          <AccessGate requireAuthenticated>
            <Calendar />
          </AccessGate>
        ),
      },

      {
        path: "analytics",
        element: (
          <AccessGate requireAuthenticated>
            <Analytics />
          </AccessGate>
        ),
      },

      {
        path: "weight-log",
        element: (
          <AccessGate requireAuthenticated>
            <WeightLog />
          </AccessGate>
        ),
      },

      {
        path: "management",
        element: (
          <AccessGate requireAuthenticated allowRoles={[UserRole.Admin]}>
            <Outlet />
          </AccessGate>
        ),
        children: [
          {
            index: true,
            element: <AdminPanel />,
          },
          {
            path: "exercises",
            element: <ExerciseGrid />,
          },
          {
            path: "muscle-groups",
            element: <MuscleGroupGrid />,
          },
          {
            path: "users",
            element: <UserGrid />,
          },
          {
            path: "errors",
            element: <ErrorGrid />,
          },
          {
            path: "ai",
            element: <AIOverview />,
          },
          {
            path: "ai/conversations",
            element: <AIConversationGrid />,
          },
          {
            path: "ai/unsupported-requests",
            element: <UnsupportedRequestGrid />,
          },
          {
            path: "ai/costs",
            element: <AIUserCosts />,
          },
          {
            path: "ai/settings",
            element: <AISettings />,
          },
          {
            path: "subscriptions",
            element: <SubscriptionAdmin />,
          },
        ],
      },
    ],
  },
]);
