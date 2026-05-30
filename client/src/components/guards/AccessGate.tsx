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
  requireUnauthenticated?: boolean;
  authenticatedRedirectTo?: string;
};

export default function AccessGate({
  children,
  requireAuthenticated = false,
  allowRoles,
  unauthenticatedRedirectTo = "/login",
  unauthorizedRedirectTo = "/",
  requireUnauthenticated = false,
  authenticatedRedirectTo = "/",
}: AccessGateProps) {
  const { user, isAuthenticated, userLoaded } = useUserStore();
  const location = useLocation();

  if (!userLoaded) {
    return (
      <div className="w-full flex-1 flex items-center justify-center px-5 py-8 text-sm text-tertiary">
        Loading...
      </div>
    );
  }

  if (requireUnauthenticated && isAuthenticated) {
    return <Navigate to={authenticatedRedirectTo} replace />;
  }

  if (requireAuthenticated && !isAuthenticated) {
    return <Navigate to={unauthenticatedRedirectTo} replace state={{ from: location }} />;
  }

  if (allowRoles && allowRoles.length > 0 && !hasAnyRole(user, allowRoles)) {
    return <Navigate to={unauthorizedRedirectTo} replace />;
  }

  return <>{children}</>;
}

