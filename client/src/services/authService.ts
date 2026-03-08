import type { JsonData, JsonModels } from "@/types/backend";
import api from "@/lib/api";

export const authService = {
  async login(payload: JsonModels.Auth.LoginRequest) {
    return api.post<JsonData<JsonModels.Auth.AuthResponse>>("auth/login", payload);
  },

  async register(payload: JsonModels.Auth.RegisterRequest) {
    return api.post<JsonData<JsonModels.Auth.AuthResponse>>("auth/register", payload);
  },

  async refresh(refreshToken: string) {
    return api.post<JsonData<JsonModels.Auth.AuthResponse>>("auth/refresh", { refreshToken });
  },

  async getCurrentUser() {
    return api.get<JsonData<JsonModels.Auth.UserModel>>("auth/current-user");
  },

  async updateProfile(payload: JsonModels.Auth.UpdateProfileRequest) {
    return api.put<JsonData<JsonModels.Auth.UserModel>>("auth/profile", payload);
  },

  async logout() {
    return api.post<JsonData<string>>("auth/logout", {});
  },
};
