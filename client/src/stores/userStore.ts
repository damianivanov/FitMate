import { create } from "zustand";
import axios from "axios";
import type { LoginRequest, RegisterRequest, UpdateProfileRequest, User } from "@/types";
import { authService } from "@/services/authService";
import { isAdmin as hasAdminRole } from "@/lib/access";
export type UserStoreState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (payload: LoginRequest) => Promise<boolean>;
  register: (payload: RegisterRequest) => Promise<boolean>;
  updateProfile: (payload: UpdateProfileRequest) => Promise<boolean>;
  fetchCurrentUser: () => Promise<boolean>;
  logout: () => Promise<void>;
};

export const useUserStore = create<UserStoreState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    if (get().isInitialized) {
      return;
    }

    set({ isLoading: true, error: null });

    let isFetched = await get().fetchCurrentUser();

    // current-user can return anonymous payload (id=0) instead of 401.
    // Try one silent refresh to restore access token from refresh cookie.
    if (!isFetched) {
      try {
        const refreshResponse = await authService.refresh();
        if (refreshResponse.data.success) {
          isFetched = await get().fetchCurrentUser();
        }
      } catch {
        // Not authenticated or refresh expired; remain logged out.
      }
    }

    set({
      isInitialized: true,
      isLoading: false,
      isAuthenticated: isFetched,
    });
  },

  login: async (payload: LoginRequest) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authService.login(payload);
      const result = response.data;

      if (!result.success) {
        set({
          isLoading: false,
          error: result.error ?? "Login failed.",
        });
        return false;
      }

      const isFetched = await get().fetchCurrentUser();

      set({
        isLoading: false,
        isInitialized: true,
        isAuthenticated: isFetched,
      });

      return isFetched;
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.error as string | undefined) ?? error.message
        : "Login failed.";

      set({
        isLoading: false,
        error: message,
        isAuthenticated: false,
      });

      return false;
    }
  },

  register: async (payload: RegisterRequest) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authService.register(payload);
      const result = response.data;

      if (!result.success) {
        set({
          isLoading: false,
          error: result.error ?? "Registration failed.",
        });
        return false;
      }

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      });

      return true;
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.error as string | undefined) ?? error.message
        : "Registration failed.";

      set({
        isLoading: false,
        error: message,
        isAuthenticated: false,
      });

      return false;
    }
  },

  updateProfile: async (payload: UpdateProfileRequest) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authService.updateProfile(payload);
      const result = response.data;
      const updatedUser = result.data;

      if (!result.success || !updatedUser) {
        set({
          isLoading: false,
          error: result.error ?? "Unable to update profile.",
        });
        return false;
      }

      set({
        user: updatedUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.error as string | undefined) ?? error.message
        : "Unable to update profile.";

      set({
        isLoading: false,
        error: message,
      });
      return false;
    }
  },

  fetchCurrentUser: async () => {
    try {
      const response = await authService.getCurrentUser();
      const result = response.data;
      const user = result.data;

      if (!result.success || !user || user.id <= 0) {
        set({
          user: null,
          isAuthenticated: false,
        });
        return false;
      }

      set({
        user,
        isAuthenticated: true,
        error: null,
      });

      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        set({
          user: null,
          isAuthenticated: false,
        });
        return false;
      }

      set({
        error: "Unable to load current user.",
        isAuthenticated: false,
      });
      return false;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // Client state should still be cleared even if server logout fails.
    }

    set({
      user: null,
      isAuthenticated: false,
      error: null,
    });
  },
}));

export const userRoles = (state: UserStoreState) => state.user?.roles ?? [];
export const isAdmin = (state: UserStoreState) => hasAdminRole(state.user);
