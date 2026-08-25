import axios from "axios";

type ApiErrorPayload = {
  error?: unknown;
};

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const apiMessage = error.response?.data?.error;
    if (typeof apiMessage === "string" && apiMessage.trim()) {
      return apiMessage;
    }
  }

  return error instanceof Error ? error.message : fallback;
}
