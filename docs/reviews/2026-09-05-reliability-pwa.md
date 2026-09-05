# FitMate reliability and PWA review — 5 September 2026

Reviewed baseline: `15b74bd7b35c1990b91fe2a9824c3aabfeea4dab`.

## Changes in this draft

| Finding | Change |
| --- | --- |
| Multiple sends could start before the first acceptance response | A synchronous submission guard covers conversation creation and message acceptance. The UI now reports sending during that entire interval. |
| Retrying a lost 202 generated a different request ID | The same conversation and request ID are retained for a retry of the same content while the page remains mounted. |
| Failed sends erased the user's text | The composer clears the submitted text only after acceptance, preserving new typing as well. |
| Late conversation loads and send responses could replace a newer view | Responses are checked against a view version before updating the current conversation. |
| Multiple action submissions could overlap | Confirm, reject and merge share a synchronous in-flight guard. |
| An open but silent SSE connection never triggered polling | A ten-second idle watchdog activates bounded, non-overlapping snapshot reads. Old-run responses and repeated terminal events are ignored. |
| Queued authentication retries did not receive the refresh limit | Queued requests are marked as retried before they wait for refresh. |
| Stale recovery updated candidate IDs without rechecking live state | Recovery rechecks status, lease expiry, side effects and attempt limits at each conditional update. |
| Recovery left failed-run quota reserved | Failure, quota release, conversation unlock and terminal progress commit in one transaction. |
| A provider could return after another worker took the lease | The worker checks ownership again before handling a provider result; a late provider failure is ignored if ownership was transferred. |
| Safe-area coverage was disabled while extra bottom padding was hard-coded | Enable viewport-fit=cover, use one bottom inset calculation, and derive the nav lens and content clearance from the nav's geometry. |

No provider/model migration or new database schema is included. The feature work in
this pass is the complete message-submission/recovery flow using the existing
clientRequestId API contract.

## Verification and limits

Before the environment disconnected:
- Frontend production build passed (TypeScript and Vite).
- Frontend lint passed.
- All 10 new Vitest regression tests passed.

The files were subsequently reconstructed from recorded edits and the pinned GitHub
baseline to preserve the work. The final remote commit has not been rerun.
One backend refinement during recovery scopes the late-failure ownership guard
to the provider call, so errors in a worker's own terminal finalization still use
the existing error handling.

Backend tests were added for a provider returning/failing after ownership changes
and for interrupted-run quota release occurring once. They have not run: no .NET SDK
was installed, and the SDK installer download was blocked.

The browser check was interrupted by the environment disconnect. Safe-area layout
is not visually verified. Check an actual installed iPhone PWA, including the
keyboard, bottom tabs, last content row, and light/dark themes before merging.
See `client/tests/README.md` for the temporary frontend test dependency setup.

## Remaining findings from the cross-layer review

### High: proposal merge is not durable until the workout draft saves

`AIActionService.MergeIntoWorkoutAsync` marks the proposal executed and returns
exercises; it deliberately does not append them to the workout. The client queues
them in an in-memory store and the builder subsequently saves its complete draft.
Closing the page or losing the response in that interval can leave an executed
proposal whose exercises never reached the workout. A server-only append would be
overwritten by the next full-draft autosave.

Next implementation: design an acknowledged, idempotent merge keyed by action and
target workout, coordinated with draft versioning. Test response loss, refresh,
duplicate delivery, and a concurrently edited draft together. This is not fixed
by the in-flight button guard in this draft.

### High: normal run finalization still has a crash window

The ordinary success path persists the assistant message, marks the run completed,
commits usage, clears ActiveRunId and publishes progress through separate writes.
A process exit between those writes can leave a terminal run holding the conversation
lock. Stale recovery selects Running rows, so it does not repair that terminal row.

Next implementation: make ordinary terminal finalization atomic and/or reconcile
terminal runs against conversation locks and quota. Verify with failure injection
between each write on PostgreSQL. This draft makes stale recovery atomic only.

### Validation still needed: simultaneous server requests with the same key

The starter checks for an existing clientRequestId before its transaction. That
covers a later retry, but simultaneous requests can both miss the lookup and race
at insertion. The database uniqueness constraint prevents duplicate runs, but the
losing request's response should be tested and normalized to the winning run.
The client guard reduces this race within one mounted page; it does not replace
server idempotency across tabs or devices.
