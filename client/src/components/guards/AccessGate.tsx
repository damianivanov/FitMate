import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";
import { hasAnyRole } from "@/lib/access";
import type { UserRole } from "@/types";

type AccessGateProps = {
  children: ReactNode;
  requireAuthenticated?: boolean;
  allowRoles?: readonly UserRole[];
  unauthenticatedRedirectTo?: string;
  unauthorizedRedirectTo?: string;
};

export default function AccessGate({
  children,
  requireAuthenticated = false,
  allowRoles,
  unauthenticatedRedirectTo = "/login",
  unauthorizedRedirectTo = "/",
}: AccessGateProps) {
  const { user, isAuthenticated, isInitialized } = useUserStore();
  const location = useLocation();

  if (!isInitialized) {
    return (
      <div className="w-full flex-1 flex items-center justify-center px-5 py-8 text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  if (requireAuthenticated && !isAuthenticated) {
    return <Navigate to={unauthenticatedRedirectTo} replace state={{ from: location }} />;
  }

  if (allowRoles && allowRoles.length > 0 && !hasAnyRole(user, allowRoles)) {
    return <Navigate to={unauthorizedRedirectTo} replace />;
  }

  return <>{children}</>;
}
