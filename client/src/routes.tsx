import { Outlet, createBrowserRouter } from "react-router-dom";
import Layout from "@/components/Layout";
import AccessGate from "@/components/guards/AccessGate";
import { UserRole } from "@/types";
import { Login, Register } from "./pages/Auth";
import Home from "./pages/Home";
import Profile, { ProfileAccount } from "./pages/Profile";
import AdminPanel, { ExerciseGrid, MuscleGroupGrid, UserGrid } from "./pages/AdminPanel";
import WorkoutBuilder from "./pages/WorkoutBuilder";
import WorkoutSummary from "./pages/WorkoutSummary";
import Workouts from "./pages/Workouts";
import WorkoutHistory from "./pages/WorkoutHistory";
import Templates from "./pages/Templates";
import TemplateBuilder from "./pages/TemplateBuilder";
import TemplatePreview from "./pages/TemplatePreview";
import Analytics from "./pages/Analytics";
import PersonalRecords from "./pages/PersonalRecords";
import ComponentTest from "./pages/ComponentTest";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />,
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
        path: "component-test",
        element: <ComponentTest />,
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
            element: <WorkoutBuilder />,
          },
          {
            path: "history",
            element: <WorkoutHistory />,
          },
          {
            path: ":workoutId/summary",
            element: <WorkoutSummary />,
          },
          {
            path: ":workoutId",
            element: <WorkoutBuilder />,
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
        path: "analytics",
        element: (
          <AccessGate requireAuthenticated>
            <Analytics />
          </AccessGate>
        ),
      },

      {
        path: "records",
        element: (
          <AccessGate requireAuthenticated>
            <PersonalRecords />
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
        ],
      },
    ],
  },
]);
