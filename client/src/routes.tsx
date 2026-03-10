import { createBrowserRouter } from "react-router-dom";
import Layout from "@/components/Layout";
import AccessGate from "@/components/guards/AccessGate";
import { UserRole } from "@/types";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import ExerciseGrid from "./pages/ExerciseGrid";

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
        element: <Login />,
      },
      {
        path: "register",
        element: <Register />,
      },
      {
        path: "profile",
        element: (
          <AccessGate requireAuthenticated>
            <Profile />
          </AccessGate>
        ),
      },
      {
        path: "management",
        element: (
          <AccessGate requireAuthenticated allowRoles={[UserRole.Admin]}>
            <AdminDashboard />
          </AccessGate>
        ),
      },
      {
        path: "management/exercises",
        element: (
          <AccessGate requireAuthenticated allowRoles={[UserRole.Admin]}>
            <ExerciseGrid />
          </AccessGate>
        ),
      },
    ],
  },
]);
