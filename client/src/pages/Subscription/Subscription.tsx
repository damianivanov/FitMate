import { LuCrown } from "react-icons/lu";
import {
  AsyncSection,
  NativeCard,
  NativeHero,
  NativePage,
  NativeSection,
  PageBody,
  PageIntro,
} from "@/shared/components";
import { isCustomerFacingFeature } from "./components/features";
import { UsageBar } from "./components/UsageBar";
import { useSubscriptionPage } from "./hooks/useSubscriptionPage";
import "./subscription.css";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function Subscription() {
  const { state, actions } = useSubscriptionPage();
  const subscription = state.subscription;

  const renewalLabel = subscription?.currentPeriodEnd
    ? `${subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} ${DATE_FORMATTER.format(new Date(subscription.currentPeriodEnd))}`
    : null;

  return (
    <PageBody>
      <NativePage>
        <PageIntro eyebrow="Your plan" title="Subscription" />

        <AsyncSection
          isLoading={state.isLoading}
          error={state.error}
          onRetry={actions.reload}
          loadingLabel="Loading your subscription..."
        >
          {subscription ? (
            <>
              <NativeHero centred>
                <span className="sub-crown" aria-hidden="true">
                  <LuCrown className="h-6 w-6" />
                </span>
                <p>Current plan</p>
                <h2>{subscription.planName}</h2>
                {renewalLabel ? <small>{renewalLabel}</small> : null}
              </NativeHero>

              <NativeSection title="This month">
                <NativeCard className="sub-usage-card">
                  {subscription.features
                    .filter((feature) => isCustomerFacingFeature(feature.feature))
                    .map((feature) => (
                      <UsageBar key={feature.feature} availability={feature} />
                    ))}
                </NativeCard>
              </NativeSection>
            </>
          ) : null}
        </AsyncSection>
      </NativePage>
    </PageBody>
  );
}
