import { useEffect, useState } from "react";

const DEFAULT_DELAY_MS = 300;

export function useDebouncedValue<T>(value: T, delayMs = DEFAULT_DELAY_MS): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs, value]);

  return debouncedValue;
}
