import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "/api";
axios.defaults.baseURL = apiBaseUrl;
axios.defaults.timeout = 0;

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

let isRefreshing = false;
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Response Interceptor: Handle 401 and refresh token automatically.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 responses.
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Skip refresh for auth endpoints to prevent infinite loops.
      const url = (originalRequest.url || "").toLowerCase();
      const isAuthEndpoint =
        url.includes("login") || url.includes("register") || url.includes("refresh");

      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      // If already refreshing, queue this request.
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      // Check if we've exceeded max refresh attempts.
      if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
        refreshAttempts = 0;
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;
      refreshAttempts++;

      try {
        // Refresh using HttpOnly cookie (server reads refresh token from cookie).
        const response = await api.post("auth/refresh");

        if (response.status === 200 && response.data?.success) {
          isRefreshing = false;
          refreshAttempts = 0;
          processQueue();

          return api(originalRequest);
        }

        throw new Error("Refresh failed");
      } catch (refreshError) {
        isRefreshing = false;
        refreshAttempts = 0;
        processQueue(refreshError as Error);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
