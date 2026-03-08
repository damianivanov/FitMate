import { create } from "zustand";
import axios from "axios";
import type { JsonModels } from "@/types/backend";
import { authService } from "@/services/authService";

const SESSION_FLAG_KEY = "fitmate_has_session";

type UserModel = JsonModels.Auth.UserModel;
type LoginRequest = JsonModels.Auth.LoginRequest;
type RegisterRequest = JsonModels.Auth.RegisterRequest;
type UpdateProfileRequest = JsonModels.Auth.UpdateProfileRequest;

type UserStoreState = {
  user: UserModel | null;
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

function hasSessionFlag(): boolean {
  return localStorage.getItem(SESSION_FLAG_KEY) === "1";
}

function markSessionPresent(): void {
  localStorage.setItem(SESSION_FLAG_KEY, "1");
}

function clearSessionFlag(): void {
  localStorage.removeItem(SESSION_FLAG_KEY);
}

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

    if (!hasSessionFlag()) {
      set({
        user: null,
        isAuthenticated: false,
        isInitialized: true,
      });
      return;
    }

    set({ isLoading: true, error: null });

    const isFetched = await get().fetchCurrentUser();

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

      markSessionPresent();

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

      clearSessionFlag();
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
    // Skip current-user call when there is no active session marker.
    if (!hasSessionFlag()) {
      return false;
    }

    try {
      const response = await authService.getCurrentUser();
      const result = response.data;
      const user = result.data;

      if (!result.success || !user) {
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
        clearSessionFlag();
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
    if (hasSessionFlag()) {
      try {
        await authService.logout();
      } catch {
        // Client state should still be cleared even if server logout fails.
      }
    }

    clearSessionFlag();
    set({
      user: null,
      isAuthenticated: false,
      error: null,
    });
  },
}));
