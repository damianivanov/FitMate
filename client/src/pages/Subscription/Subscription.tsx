import { AsyncSection, PageBody, PageHeader } from "@/shared/components";
import { isCustomerFacingFeature } from "./components/features";
import { UsageBar } from "./components/UsageBar";
import { useSubscriptionPage } from "./hooks/useSubscriptionPage";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function Subscription() {
  const { state, actions } = useSubscriptionPage();
  const subscription = state.subscription;

  return (
    <>
      <PageHeader title="Subscription" subtitle="Your plan and what you have used this month" />

      <PageBody>
        <AsyncSection
          isLoading={state.isLoading}
          error={state.error}
          onRetry={actions.reload}
          loadingLabel="Loading your subscription..."
        >
          {subscription ? (
            <div className="flex flex-col gap-4">
              <section className="liquid-panel rounded-2xl p-4 md:rounded-lg">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">Current plan</p>
                <p className="mt-1 text-xl font-bold text-foreground">{subscription.planName}</p>
                {subscription.currentPeriodEnd ? (
                  <p className="mt-1 text-sm text-muted">
                    {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} on{" "}
                    {DATE_FORMATTER.format(new Date(subscription.currentPeriodEnd))}
                  </p>
                ) : null}
              </section>

              <section className="liquid-panel rounded-2xl p-4 md:rounded-lg">
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  This month
                </p>
                {subscription.features
                  .filter((feature) => isCustomerFacingFeature(feature.feature))
                  .map((feature) => (
                    <UsageBar key={feature.feature} availability={feature} />
                  ))}
              </section>
            </div>
          ) : null}
        </AsyncSection>
      </PageBody>
    </>
  );
}
