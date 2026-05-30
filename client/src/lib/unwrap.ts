import type { JsonData } from "@/types";

export function unwrap<T>(result: JsonData<T>, fallbackMessage: string): T {
  if (!result.success || result.data == null) {
    throw new Error(result.error ?? fallbackMessage);
  }

  return result.data;
}
