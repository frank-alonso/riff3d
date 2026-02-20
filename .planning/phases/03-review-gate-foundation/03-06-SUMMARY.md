---
phase: 03-review-gate-foundation
plan: 06
subsystem: testing
tags: [playwright, e2e, visual-regression, screenshots, playcanvas]

# Dependency graph
requires:
  - phase: 03-03
    provides: "Adapter subpath exports and core/editor-tools split"
  - phase: 02-02
    provides: "PlayCanvas adapter with loadScene and rebuildScene"
provides:
  - "Playwright E2E infrastructure with golden-path smoke test"
  - "Visual baseline beta test suite for fixture rendering"
  - "__sceneReady CustomEvent signal for deterministic screenshot timing"
  - "Shared auth helper for E2E test login"
affects: [phase-04-dual-adapter, visual-regression, e2e-testing]

# Tech tracking
tech-stack:
  added: ["@playwright/test ^1.58"]
  patterns: ["__sceneReady signal for screenshot timing", "test.skip for missing credentials"]

key-files:
  created:
    - apps/editor/playwright.config.ts
    - apps/editor/e2e/golden-path.e2e.ts
    - apps/editor/e2e/visual/fixture-render.visual.ts
    - apps/editor/e2e/helpers/auth.ts
  modified:
    - packages/adapter-playcanvas/src/adapter.ts
    - packages/adapter-playcanvas/__tests__/helpers/pc-mocks.ts
    - packages/adapter-playcanvas/__tests__/adapter.test.ts
    - apps/editor/package.json
    - .gitignore

key-decisions:
  - "__sceneReady signal in loadScene only (not rebuildScene) since rebuildScene delegates to loadScene -- avoids double-fire"
  - "Generous visual thresholds (2% pixel ratio, 0.3 color) for WebGL rendering variance across GPU/driver combinations"
  - "Visual tests are non-blocking beta -- do not gate Phase 3 pass/fail"
  - "test.skip pattern when E2E credentials absent -- no test failures in CI without Supabase"

patterns-established:
  - "waitForSceneReady helper: page.evaluate listening for __sceneReady CustomEvent"
  - "hasTestCredentials guard: check env vars, skip test when absent"
  - "Playwright dual projects: e2e (functional) and visual (screenshot baseline)"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 3 Plan 06: E2E and Visual Regression Testing Summary

**Playwright E2E infrastructure with golden-path lifecycle smoke test, visual baseline screenshot capture, and __sceneReady adapter signal for deterministic timing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T16:19:00Z
- **Completed:** 2026-02-20T16:23:26Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Added `__sceneReady` CustomEvent to PlayCanvas adapter, fired after first frameend post-loadScene
- Created full Playwright configuration with separate e2e and visual test projects
- Golden-path E2E smoke test covers complete editor lifecycle: create, edit, save, reload, verify
- Visual baseline tests capture screenshots for 3 golden fixtures (transforms-parenting, materials-lights, animation)
- All tests skip gracefully when credentials absent -- no CI failures without Supabase

## Task Commits

Each task was committed atomically:

1. **Task 1: Add __sceneReady signal to adapter and set up Playwright configuration** - `032e242` (feat)
2. **Task 2: Create golden-path E2E smoke test and visual baseline beta tests** - `0fa8265` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `apps/editor/playwright.config.ts` - Playwright config with e2e and visual projects, webServer for dev
- `apps/editor/e2e/golden-path.e2e.ts` - Full lifecycle E2E smoke test (create -> edit -> save -> reload -> verify)
- `apps/editor/e2e/visual/fixture-render.visual.ts` - Visual baseline screenshots for 3 golden fixtures
- `apps/editor/e2e/helpers/auth.ts` - Shared login helper with env var credentials
- `packages/adapter-playcanvas/src/adapter.ts` - Added __sceneReady CustomEvent dispatch in loadScene
- `packages/adapter-playcanvas/__tests__/helpers/pc-mocks.ts` - Added MockApplication.once method
- `packages/adapter-playcanvas/__tests__/adapter.test.ts` - Added window.dispatchEvent to globalThis mock
- `apps/editor/package.json` - Added @playwright/test, test:e2e, test:visual scripts
- `.gitignore` - Added test-results/ and playwright-report/ entries

## Decisions Made
- **__sceneReady in loadScene only:** Since `rebuildScene` delegates to `loadScene`, adding the signal in both would cause double-fire. Signal fires once per scene load.
- **Generous visual thresholds:** 2% max pixel diff ratio and 0.3 color threshold accommodate WebGL rendering variance across different GPUs and drivers.
- **Visual tests non-blocking:** These are beta baselines for Phase 4 dual-adapter comparison. They do not gate Phase 3.
- **test.skip for missing credentials:** E2E tests require Supabase + test user. Without env vars, tests skip rather than fail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MockApplication missing `once` method**
- **Found during:** Task 1 (adapter __sceneReady signal)
- **Issue:** PlayCanvas adapter's `loadScene` calls `this.app.once("frameend", ...)` but the test mock `MockApplication` did not implement `once`, causing 3 test failures
- **Fix:** Added `once` method to `MockApplication` that immediately invokes the callback (simulates frameend in tests)
- **Files modified:** `packages/adapter-playcanvas/__tests__/helpers/pc-mocks.ts`
- **Verification:** All 119 adapter tests pass
- **Committed in:** `032e242` (Task 1 commit)

**2. [Rule 1 - Bug] window mock missing `dispatchEvent`**
- **Found during:** Task 1 (adapter __sceneReady signal)
- **Issue:** The globalThis.window mock in adapter tests did not include `dispatchEvent`, causing TypeError when the __sceneReady signal fires in tests
- **Fix:** Added `dispatchEvent: vi.fn()` to the globalThis.window mock
- **Files modified:** `packages/adapter-playcanvas/__tests__/adapter.test.ts`
- **Verification:** All 119 adapter tests pass
- **Committed in:** `032e242` (Task 1 commit)

**3. [Rule 1 - Bug] TypeScript strict mode window cast error**
- **Found during:** Task 2 (E2E and visual test files)
- **Issue:** `(window as Record<string, unknown>)` fails TypeScript strict mode -- `Window & typeof globalThis` cannot directly convert to `Record<string, unknown>`
- **Fix:** Changed to `(window as unknown as Record<string, unknown>)` double cast
- **Files modified:** `apps/editor/e2e/golden-path.e2e.ts`, `apps/editor/e2e/visual/fixture-render.visual.ts`
- **Verification:** `pnpm turbo typecheck` passes across full monorepo
- **Committed in:** `0fa8265` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- E2E infrastructure ready for Phase 4 dual-adapter visual comparison
- Visual baselines will be generated on first run with real editor + Supabase
- To run E2E tests: set `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` env vars, then `pnpm test:e2e`
- To generate visual baselines: `pnpm test:visual:update`

## Self-Check: PASSED

- All 5 created files verified on disk
- Both task commits (032e242, 0fa8265) verified in git log
- `pnpm turbo typecheck` passes (11/11 tasks)
- `pnpm turbo test` passes (11/11 tasks, 119 adapter tests)

---
*Phase: 03-review-gate-foundation*
*Completed: 2026-02-20*
