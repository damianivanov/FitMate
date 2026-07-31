import { useCallback, useEffect, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { subscriptionService } from "@/services/subscriptionService";
import type { CurrentSubscriptionModel } from "@/types";

export function useSubscriptionPage() {
  const [subscription, setSubscription] = useState<CurrentSubscriptionModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await subscriptionService.getMine();
      setSubscription(unwrap(response.data, "Unable to load your subscription."));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your subscription.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    state: { subscription, isLoading, error },
    actions: { reload: load },
  };
}
