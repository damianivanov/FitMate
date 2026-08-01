import { LuChevronDown, LuChevronRight } from "react-icons/lu";
import { PageBody, PageHeader } from "@/shared/components";
import { useAIUserCostsPage } from "./hooks/useAIUserCostsPage";

const DAY_OPTIONS = [7, 30, 90, 365];

const numberFormatter = new Intl.NumberFormat();

function formatMoney(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatTokens(value: number): string {
  return numberFormatter.format(value);
}

export default function AIUserCosts() {
  const { state, actions } = useAIUserCostsPage();

  return (
    <>
      <PageHeader
        title="AI Cost per User"
        subtitle="Token spend and money per user, broken down by model. Costs are the ones priced when each run happened."
      />

      <PageBody>
        <section className="liquid-surface w-full rounded-3xl p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={state.searchInput}
              onChange={actions.onSearchInputChange}
              placeholder="Search by email"
              className="liquid-input w-full max-w-xs rounded-full px-3 py-2.5"
            />
            <div className="flex gap-1">
              {DAY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => actions.changeDays(option)}
                  className={`liquid-pill rounded-full px-3 py-2 text-xs font-semibold ${
                    state.days === option ? "text-primary" : "text-secondary"
                  }`}
                >
                  {option}d
                </button>
              ))}
            </div>
            <span className="ml-auto text-sm text-secondary">
              {state.totalCount} users · page total {formatMoney(state.grandTotalCost)}
            </span>
          </div>

          {state.error ? <p className="mb-4 text-sm text-danger">{state.error}</p> : null}

          {state.isLoading ? (
            <p className="text-sm text-secondary">Loading…</p>
          ) : state.rows.length === 0 ? (
            <p className="text-sm text-secondary">No AI usage in this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-tertiary">
                    <th className="w-8 py-2" />
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3 text-right">Runs</th>
                    <th className="py-2 pr-3 text-right">Input</th>
                    <th className="py-2 pr-3 text-right">Output</th>
                    <th className="py-2 pr-3 text-right">Total tokens</th>
                    <th className="py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((row) => {
                    const isExpanded = state.expandedUserId === row.userId;

                    return [
                      <tr key={row.userId} className="border-t border-white/8">
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => actions.toggleExpanded(row.userId)}
                            aria-label={isExpanded ? "Hide models" : "Show models"}
                            className="liquid-pill rounded-full p-1.5"
                          >
                            {isExpanded ? (
                              <LuChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <LuChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="py-2 pr-3 text-foreground">{row.email ?? `User ${row.userId}`}</td>
                        <td className="py-2 pr-3 text-secondary">{row.planName}</td>
                        <td className="py-2 pr-3 text-right text-secondary">{row.runCount}</td>
                        <td className="py-2 pr-3 text-right text-secondary">
                          {formatTokens(row.inputTokens)}
                        </td>
                        <td className="py-2 pr-3 text-right text-secondary">
                          {formatTokens(row.outputTokens)}
                        </td>
                        <td className="py-2 pr-3 text-right text-secondary">
                          {formatTokens(row.totalTokens)}
                        </td>
                        <td className="py-2 text-right font-semibold text-foreground">
                          {formatMoney(row.estimatedCost)}
                        </td>
                      </tr>,
                      isExpanded ? (
                        <tr key={`${row.userId}-models`} className="bg-white/3">
                          <td />
                          <td colSpan={7} className="py-2 pr-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left uppercase tracking-wide text-tertiary">
                                  <th className="py-1 pr-3">Model</th>
                                  <th className="py-1 pr-3 text-right">Runs</th>
                                  <th className="py-1 pr-3 text-right">Input</th>
                                  <th className="py-1 pr-3 text-right">Cached</th>
                                  <th className="py-1 pr-3 text-right">Output</th>
                                  <th className="py-1 text-right">Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.byModel.map((model) => (
                                  <tr key={model.model}>
                                    <td className="py-1 pr-3 font-mono text-foreground">{model.model}</td>
                                    <td className="py-1 pr-3 text-right text-secondary">
                                      {model.runCount}
                                    </td>
                                    <td className="py-1 pr-3 text-right text-secondary">
                                      {formatTokens(model.inputTokens)}
                                    </td>
                                    <td className="py-1 pr-3 text-right text-secondary">
                                      {formatTokens(model.cachedInputTokens)}
                                    </td>
                                    <td className="py-1 pr-3 text-right text-secondary">
                                      {formatTokens(model.outputTokens)}
                                    </td>
                                    <td className="py-1 text-right text-foreground">
                                      {formatMoney(model.estimatedCost)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}

          {state.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <button
                type="button"
                disabled={state.page <= 1}
                onClick={() => actions.changePage(state.page - 1)}
                className="liquid-pill rounded-full px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-secondary">
                {state.page} / {state.totalPages}
              </span>
              <button
                type="button"
                disabled={state.page >= state.totalPages}
                onClick={() => actions.changePage(state.page + 1)}
                className="liquid-pill rounded-full px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      </PageBody>
    </>
  );
}
