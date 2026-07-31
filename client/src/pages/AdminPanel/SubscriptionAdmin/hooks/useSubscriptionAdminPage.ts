import { useCallback, useEffect, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type {
  AssignPlanOverrideRequest,
  PagedResponse,
  SubscriptionPlanAdminModel,
  UserSubscriptionAdminModel,
  UserUsageAdminModel,
} from "@/types";

export type SubscriptionAdminTab = "plans" | "users" | "usage";

export function useSubscriptionAdminPage() {
  const [tab, setTab] = useState<SubscriptionAdminTab>("plans");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [reloadIndex, setReloadIndex] = useState(0);

  const [plans, setPlans] = useState<SubscriptionPlanAdminModel[]>([]);
  const [users, setUsers] = useState<PagedResponse<UserSubscriptionAdminModel> | null>(null);
  const [usage, setUsage] = useState<PagedResponse<UserUsageAdminModel> | null>(null);

  const [userSearch, setUserSearch] = useState("");
  const [overrideTarget, setOverrideTarget] = useState<UserSubscriptionAdminModel | null>(null);

  // Plans load regardless of the open tab: the override dialog needs them to offer choices.
  useEffect(() => {
    async function loadPlans() {
      try {
        const response = await adminService.subscriptionPlans.list();
        setPlans(unwrap(response.data, "Unable to load plans."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load plans.");
      }
    }

    void loadPlans();
  }, [reloadIndex]);

  useEffect(() => {
    async function load() {
      setError(null);

      try {
        if (tab === "plans") {
          return;
        }

        if (tab === "users") {
          const response = await adminService.subscriptions.list({
            page: 1,
            pageSize: 50,
            search: userSearch.trim() || undefined,
            overriddenOnly: false,
          });
          setUsers(unwrap(response.data, "Unable to load subscriptions."));
          return;
        }

        const response = await adminService.usage.list({
          page: 1,
          pageSize: 50,
          atLimitOnly: false,
        });
        setUsage(unwrap(response.data, "Unable to load usage."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load data.");
      }
    }

    void load();
  }, [reloadIndex, tab, userSearch]);

  const reload = useCallback(() => {
    setReloadIndex((current) => current + 1);
  }, []);

  const togglePlanActive = useCallback(
    async (plan: SubscriptionPlanAdminModel) => {
      setIsBusy(true);
      setError(null);

      try {
        await adminService.subscriptionPlans.setActive(plan.id, !plan.isActive);
        reload();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Unable to update the plan.");
      } finally {
        setIsBusy(false);
      }
    },
    [reload],
  );

  const assignOverride = useCallback(
    async (payload: AssignPlanOverrideRequest) => {
      if (!overrideTarget) {
        return;
      }

      setIsBusy(true);
      setError(null);

      try {
        await adminService.subscriptions.assignOverride(overrideTarget.userId, payload);
        setOverrideTarget(null);
        reload();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Unable to assign the plan.");
      } finally {
        setIsBusy(false);
      }
    },
    [overrideTarget, reload],
  );

  const removeOverride = useCallback(
    async (user: UserSubscriptionAdminModel) => {
      setIsBusy(true);
      setError(null);

      try {
        await adminService.subscriptions.removeOverride(user.userId);
        reload();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Unable to remove the override.");
      } finally {
        setIsBusy(false);
      }
    },
    [reload],
  );

  const resetUsage = useCallback(
    async (bucket: UserUsageAdminModel) => {
      setIsBusy(true);
      setError(null);

      try {
        await adminService.usage.reset(bucket.id);
        reload();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Unable to reset the usage.");
      } finally {
        setIsBusy(false);
      }
    },
    [reload],
  );

  return {
    state: {
      tab,
      error,
      isBusy,
      plans,
      users: users?.items ?? [],
      usage: usage?.items ?? [],
      userSearch,
      overrideTarget,
    },
    actions: {
      changeTab: setTab,
      changeUserSearch: setUserSearch,
      togglePlanActive,
      openOverride: setOverrideTarget,
      closeOverride: () => setOverrideTarget(null),
      assignOverride,
      removeOverride,
      resetUsage,
    },
  };
}
