import { LineChart, PageBody, PageHeader, StatTile } from "@/shared/components";
import { useAIOverviewPage } from "./hooks/useAIOverviewPage";

const WINDOWS = [7, 30, 90] as const;

export default function AIOverview() {
  const { state, actions } = useAIOverviewPage();
  const { overview } = state;

  return (
    <>
      <PageHeader
        title="AI Overview"
        subtitle="Runs, tool calls, cost and the gaps users keep asking about."
        actions={
          <div className="flex gap-1">
            {WINDOWS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => actions.changeWindow(days)}
                className={`liquid-pill rounded-full px-3 py-2 text-sm font-semibold ${
                  state.days === days ? "text-foreground" : "text-muted"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        }
      />

      <PageBody>
        {state.error ? <p className="mb-4 text-sm text-danger">{state.error}</p> : null}

        {state.isLoading || !overview ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : (
          <div className="flex flex-col gap-4">
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Runs" value={overview.totalRuns.toLocaleString()} />
              <StatTile label="Failed runs" value={overview.failedRuns.toLocaleString()} />
              <StatTile label="Active users" value={overview.activeUsers.toLocaleString()} />
              <StatTile label="Estimated cost" value={`$${overview.estimatedCost.toFixed(2)}`} />
              <StatTile label="Conversations" value={overview.conversations.toLocaleString()} />
              <StatTile label="Tool calls" value={overview.toolCalls.toLocaleString()} />
              <StatTile
                label="Actions confirmed"
                value={`${overview.confirmedActions} / ${overview.proposedActions}`}
              />
              <StatTile label="p95 latency" value={`${(overview.p95DurationMilliseconds / 1000).toFixed(1)}s`} />
            </section>

            <section className="liquid-surface rounded-3xl p-5 md:p-6">
              <h2 className="mb-3 text-base font-bold text-foreground">Cost per day</h2>
              <LineChart points={state.costPoints} emptyText="No runs in this window." />
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="liquid-surface rounded-3xl p-5 md:p-6">
                <h2 className="mb-3 text-base font-bold text-foreground">Most used tools</h2>
                {overview.topTools.length === 0 ? (
                  <p className="text-sm text-muted">No tool calls yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {overview.topTools.map((tool) => (
                      <li key={tool.toolName} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-foreground">{tool.toolName}</span>
                        <span className="shrink-0 text-muted">
                          {tool.callCount} calls
                          {tool.failureCount > 0 ? ` · ${tool.failureCount} failed` : ""}
                          {` · ${tool.averageDurationMilliseconds}ms`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="liquid-surface rounded-3xl p-5 md:p-6">
                <h2 className="mb-3 text-base font-bold text-foreground">Most expensive users</h2>
                {overview.topUsersByCost.length === 0 ? (
                  <p className="text-sm text-muted">No runs yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {overview.topUsersByCost.map((user) => (
                      <li key={user.userId} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-foreground">
                          {user.email ?? `User ${user.userId}`}
                        </span>
                        <span className="shrink-0 text-muted">
                          {`${user.runCount} runs · $${user.estimatedCost.toFixed(2)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="liquid-surface rounded-3xl p-5 md:p-6">
              <h2 className="mb-3 text-base font-bold text-foreground">Most requested missing features</h2>
              {overview.topUnsupportedCategories.length === 0 ? (
                <p className="text-sm text-muted">Nothing reported yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {overview.topUnsupportedCategories.map((category) => (
                    <li
                      key={category.category}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="truncate font-medium text-foreground">{category.category}</span>
                      <span className="shrink-0 text-muted">
                        {`${category.occurrenceCount} requests · ${category.groupCount} topics`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </PageBody>
    </>
  );
}
