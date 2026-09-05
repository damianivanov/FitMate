# AI coach regression tests

These tests cover double sends, retry identity after losing the acceptance response,
conversation switching, action submission, draft preservation, silent SSE connections,
late snapshots, polling overlap and repeated terminal events.

From `client/`:

```sh
npm ci
npm install --no-save --package-lock=false vitest@5.0.0 @testing-library/react jsdom
npx vitest run
npm run lint
npm run build
```

The 10 tests passed in the original workspace with Vitest 5.0.0. The workspace
disconnected before its generated dependency lockfile could be preserved.
The test sources and configuration were recovered from the recorded edits;
test-only dependencies are therefore installed temporarily with the command above.
Commit a reproducible test dependency lockfile when the development environment
is restored. Application dependencies and their existing lockfile are unchanged.
