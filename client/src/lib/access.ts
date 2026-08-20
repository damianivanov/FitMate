import { UserRole, type User } from "@/types";

type UserModel = User | null | undefined;

/**
 * The super administrator: the first account in the database. A handful of catalogue-wide
 * operations are reserved for it rather than for the Admin role at large. Mirrors
 * SystemUsers.SuperAdminId on the server, which is where the rule is actually enforced.
 */
export const SUPER_ADMIN_USER_ID = 1;

export function hasRole(user: UserModel, role: UserRole): boolean {
  return user?.roles.includes(role) ?? false;
}

export function hasAnyRole(user: UserModel, roles: readonly UserRole[]): boolean {
  return roles.some((role) => hasRole(user, role));
}

export function isAdmin(user: UserModel): boolean {
  return hasRole(user, UserRole.Admin);
}
