import { useMemo } from "react";
import { isAdmin as hasAdminRole } from "@/lib/access";
import { buildDisplayName, buildInitials, getAvatarColorClassName } from "@/lib/helpers";
import { useUserStore } from "@/stores/userStore";

export function useProfilePage() {
  const { user } = useUserStore();

  const state = useMemo(() => {
    const isAdminUser = hasAdminRole(user);

    return {
      user,
      displayName: buildDisplayName(user.firstName, user.lastName) || "FitMate User",
      initials: buildInitials(user.firstName, user.lastName, user.email),
      avatarColorClassName: getAvatarColorClassName(user.id),
      isAdminUser,
      roleLabel: isAdminUser ? "Admin" : "Member",
    };
  }, [user]);

  const actions = useMemo(() => ({}), []);

  return { state, actions };
}
