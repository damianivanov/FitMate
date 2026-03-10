import { UserRole, type User } from "@/types";

type UserModel = User | null | undefined;

export function hasRole(user: UserModel, role: UserRole): boolean {
  return user?.roles.includes(role) ?? false;
}

export function hasAnyRole(user: UserModel, roles: readonly UserRole[]): boolean {
  return roles.some((role) => hasRole(user, role));
}

export function isAdmin(user: UserModel): boolean {
  return hasRole(user, UserRole.Admin);
}
