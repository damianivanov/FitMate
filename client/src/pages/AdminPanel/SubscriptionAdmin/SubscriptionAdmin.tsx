import { PageBody, PageHeader } from "@/shared/components";
import { EntitlementSource, SubscriptionFeature } from "@/types";
import { AssignPlanModal } from "../components/AssignPlanModal";
import { useSubscriptionAdminPage, type SubscriptionAdminTab } from "./hooks/useSubscriptionAdminPage";

const TABS: { id: SubscriptionAdminTab; label: string }[] = [
  { id: "plans", label: "Plans" },
  { id: "users", label: "Users" },
  { id: "usage", label: "Usage" },
];

const SOURCE_LABELS: Record<number, string> = {
  [EntitlementSource.FreePlan]: "Free plan",
  [EntitlementSource.Subscription]: "Subscription",
  [EntitlementSource.AdminOverride]: "Admin override",
};

const FEATURE_LABELS = new Map<number, string>(
  Object.entries(SubscriptionFeature)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .map(([name, value]) => [value, name.replace(/([a-z])([A-Z])/g, "$1 $2")]),
);

export default function SubscriptionAdmin() {
  const { state, actions } = useSubscriptionAdminPage();

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle="Plans, what each user is entitled to, and how much of it they have used."
        actions={
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => actions.changeTab(tab.id)}
                className={`liquid-pill rounded-full px-3 py-2 text-sm font-semibold ${
                  state.tab === tab.id ? "text-foreground" : "text-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      <PageBody>
        {state.error ? <p className="mb-4 text-sm text-danger">{state.error}</p> : null}

        {state.tab === "plans" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {state.plans.map((plan) => (
              <section key={plan.id} className="liquid-surface rounded-3xl p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold text-foreground">{plan.name}</h2>
                  <span className="text-sm text-muted">{plan.subscriberCount} subscribers</span>
                </div>

                <p className="mt-1 text-sm text-muted">
                  {plan.prices.length === 0
                    ? "No price configured"
                    : plan.prices
                        .map((price) => `${price.amount} ${price.currency}`)
                        .join(" · ")}
                </p>

                <ul className="mt-3 flex flex-col gap-1">
                  {plan.entitlements.map((entitlement) => (
                    <li
                      key={entitlement.id}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-secondary">
                        {FEATURE_LABELS.get(entitlement.feature) ?? entitlement.feature}
                      </span>
                      <span className="shrink-0 text-muted">
                        {!entitlement.isEnabled
                          ? "off"
                          : (entitlement.monthlyLimit ?? entitlement.hardLimit ?? "unlimited")}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={state.isBusy}
                  onClick={() => void actions.togglePlanActive(plan)}
                  className="liquid-pill mt-4 w-full rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                >
                  {plan.isActive ? "Deactivate" : "Activate"}
                </button>
              </section>
            ))}
          </div>
        ) : null}

        {state.tab === "users" ? (
          <section className="liquid-surface rounded-3xl p-5 md:p-6">
            <input
              value={state.userSearch}
              onChange={(event) => actions.changeUserSearch(event.target.value)}
              placeholder="Search by email or name"
              className="liquid-input mb-4 w-full max-w-md rounded-full px-3 py-2.5"
            />

            <ul className="flex flex-col gap-2">
              {state.users.map((user) => (
                <li
                  key={user.userId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {user.email ?? `User ${user.userId}`}
                    </p>
                    <p className="text-xs text-muted">
                      {user.effectivePlanName} · {SOURCE_LABELS[user.source] ?? "—"}
                      {user.activeOverride ? ` · ${user.activeOverride.reason}` : ""}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={state.isBusy}
                      onClick={() => actions.openOverride(user)}
                      className="liquid-pill rounded-full px-3 py-2 text-sm font-semibold disabled:opacity-40"
                    >
                      Assign plan
                    </button>

                    {user.activeOverride ? (
                      <button
                        type="button"
                        disabled={state.isBusy}
                        onClick={() => void actions.removeOverride(user)}
                        className="liquid-pill liquid-pill-danger rounded-full px-3 py-2 text-sm font-semibold disabled:opacity-40"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {state.tab === "usage" ? (
          <section className="liquid-surface rounded-3xl p-5 md:p-6">
            {state.usage.length === 0 ? (
              <p className="text-sm text-muted">No usage recorded this period.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {state.usage.map((bucket) => (
                  <li
                    key={bucket.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {bucket.email ?? `User ${bucket.userId}`}
                      </p>
                      <p className="text-xs text-muted">
                        {FEATURE_LABELS.get(bucket.feature) ?? bucket.feature} ·{" "}
                        {`${bucket.used}${bucket.effectiveLimit != null ? ` / ${bucket.effectiveLimit}` : ""}`}
                        {bucket.reserved > 0 ? ` · ${bucket.reserved} reserved` : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={state.isBusy}
                      onClick={() => void actions.resetUsage(bucket)}
                      className="liquid-pill rounded-full px-3 py-2 text-sm font-semibold disabled:opacity-40"
                    >
                      Reset
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </PageBody>

      <AssignPlanModal
        target={
          state.overrideTarget
            ? {
                userId: state.overrideTarget.userId,
                email: state.overrideTarget.email ?? null,
                currentPlanName: state.overrideTarget.effectivePlanName,
              }
            : null
        }
        plans={state.plans}
        isSaving={state.isBusy}
        onSave={actions.assignOverride}
        onClose={actions.closeOverride}
      />
    </>
  );
}
