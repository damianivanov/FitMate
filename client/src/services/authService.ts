import type {
  AuthResponse,
  ChangePasswordRequest,
  ConfirmImageUploadRequest,
  CookieConsentRequest,
  ForgotPasswordRequest,
  GoogleLoginRequest,
  ImageUploadTicket,
  ImageUploadTicketRequest,
  JsonData,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  User,
} from "@/types";
import api from "@/lib/api";
import { putToBlobStorage } from "@/lib/blobUpload";
import { compressImageForUpload } from "@/lib/imageCompression";
import { unwrap } from "@/lib/unwrap";

export const authService = {
  async login(payload: LoginRequest) {
    return api.post<JsonData<AuthResponse>>("auth/login", payload);
  },

  async register(payload: RegisterRequest) {
    return api.post<JsonData<AuthResponse>>("auth/register", payload);
  },

  async googleLogin(payload: GoogleLoginRequest) {
    return api.post<JsonData<AuthResponse>>("auth/google", payload);
  },

  async changePassword(payload: ChangePasswordRequest) {
    return api.post<JsonData<string>>("auth/change-password", payload);
  },

  async forgotPassword(payload: ForgotPasswordRequest) {
    return api.post<JsonData<string>>("auth/forgot-password", payload);
  },

  async resetPassword(payload: ResetPasswordRequest) {
    return api.post<JsonData<string>>("auth/reset-password", payload);
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

  // Three steps, same as an exercise image: ask for a write URL, PUT the bytes straight to storage,
  // then confirm so the server squares and stores what actually arrived.
  async uploadAvatar(file: File) {
    const prepared = await compressImageForUpload(file);

    const ticketResponse = await api.post<JsonData<ImageUploadTicket>>(
      "auth/avatar/upload-url",
      { fileName: prepared.name, contentType: prepared.type } satisfies ImageUploadTicketRequest,
    );
    const ticket = unwrap(ticketResponse.data, "Could not start the upload.");

    await putToBlobStorage(ticket.uploadUrl, prepared);

    return api.post<JsonData<User>>(
      "auth/avatar/confirm",
      { blobName: ticket.blobName } satisfies ConfirmImageUploadRequest,
    );
  },

  async removeAvatar() {
    return api.delete<JsonData<User>>("auth/avatar");
  },

  async saveCookieConsent(payload: CookieConsentRequest) {
    return api.post<JsonData<User>>("auth/cookie-consent", payload);
  },

  async logout() {
    return api.post<JsonData<string>>("auth/logout", {});
  },
};
