import type {
  AuthResponse,
  JsonData,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  User,
} from "@/types";
import api from "@/lib/api";

export const authService = {
  async login(payload: LoginRequest) {
    return api.post<JsonData<AuthResponse>>("auth/login", payload);
  },

  async register(payload: RegisterRequest) {
    return api.post<JsonData<AuthResponse>>("auth/register", payload);
  },

  async refresh() {
    return api.post<JsonData<AuthResponse>>("auth/refresh");
  },

  async getCurrentUser() {
    return api.get<JsonData<User>>("auth/current-user");
  },

  async updateProfile(payload: UpdateProfileRequest) {
    return api.put<JsonData<User>>("auth/profile", payload);
  },

  async logout() {
    return api.post<JsonData<string>>("auth/logout", {});
  },
};
