import { create } from "zustand";
import type { User } from "@/types";
import { authService } from "@/services/authService";
import { isAdmin as hasAdminRole } from "@/lib/access";

function createEmptyUser(): User {
  return {
    id: 0,
    email: "",
    roles: [],
  };
}

export interface UserState {
  user: User;
  userLoaded: boolean;
  isAuthenticated: boolean;
  initUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>()((set) => ({
  user: createEmptyUser(),
  userLoaded: false,
  isAuthenticated: false,

  initUser: async () => {
    let currentUser: User | null = null;

    const tryGetCurrentUser = async (): Promise<User | null> => {
      const response = await authService.getCurrentUser();
      const result = response.data;
      const user = result.data;

      if (!result.success || !user || user.id <= 0) {
        return null;
      }

      return user;
    };

    try {
      currentUser = await tryGetCurrentUser();
    } catch {
    }

    if (!currentUser) {
      try {
        const refreshResponse = await authService.refresh();
        if (refreshResponse.data.success) {
          currentUser = await tryGetCurrentUser();
        }
      } catch {
      }
    }

    if (currentUser) {
      set({
        user: currentUser,
        userLoaded: true,
        isAuthenticated: true,
      });
      return;
    }

    set({
      user: createEmptyUser(),
      userLoaded: true,
      isAuthenticated: false,
    });
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch {
    }

    set({
      user: createEmptyUser(),
      isAuthenticated: false,
      userLoaded: true,
    });
  },
}));

export const userRoles = (state: UserState) => state.user.roles;
export const isAdmin = (state: UserState) => hasAdminRole(state.user);
