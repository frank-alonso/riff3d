# Phase 4 Plan Review — 04-04
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)  
Plan: 04-04-PLAN.md

## Codebase Verification
- Checked plan file at `.planning/phases/04-dual-adapter-validation/04-04-PLAN.md`.
- Verified current conformance surface exists at `packages/conformance/src/harness.ts:32`, `packages/conformance/src/index.ts:11`, `packages/conformance/package.json:18`.
- Verified fixture exports and actual fixture names at `packages/fixtures/src/index.ts:4` and `packages/conformance/__tests__/benchmarks.test.ts:38`.
- Verified current visual test is `apps/editor/e2e/visual/fixture-render.visual.ts:1` (not `apps/editor/e2e/fixture-render.visual.ts`).
- Verified `EngineAdapter` is currently defined in `packages/adapter-playcanvas/src/types.ts:9`, and `canonical-ir` does not expose an engine adapter contract (`packages/canonical-ir/src/index.ts:4`, `packages/canonical-ir/src/types/index.ts:3`).
- Verified PlayCanvas adapter has `loadScene/rebuildScene/getEntityMap/dispose` but no `applyDelta` (`packages/adapter-playcanvas/src/adapter.ts:96`, `packages/adapter-playcanvas/src/adapter.ts:132`, `packages/adapter-playcanvas/src/adapter.ts:149`, `packages/adapter-playcanvas/src/adapter.ts:258`).
- Verified there is no `packages/adapter-babylon` package in this workspace (`packages` directory listing only includes `adapter-playcanvas`, `canonical-ir`, `conformance`, `ecson`, `fixtures`, `patchops`).
- Verified editor viewport is PlayCanvas-only (`apps/editor/src/components/editor/viewport/viewport-canvas.tsx:4`, `apps/editor/src/components/editor/viewport/viewport-canvas.tsx:62`), with no engine-switch state in viewport slice (`apps/editor/src/stores/slices/viewport-slice.ts:11`).
- Verified no `window.__editorStore` exposure and no `switchEngine` API in store (`apps/editor/src/stores/editor-store.ts:25`).
- Verified `__sceneAlreadyReady` is read by tests but never set in app code (`apps/editor/e2e/visual/fixture-render.visual.ts:27`, `apps/editor/e2e/golden-path.e2e.ts:22`, adapter dispatch only at `packages/adapter-playcanvas/src/adapter.ts:118`).
- Verified LoC script exists but only checks PlayCanvas (`scripts/check-adapter-loc.sh:5`).
- Verified CI only runs `pnpm turbo typecheck lint test` and does not run Playwright or `check-loc` (`.github/workflows/ci.yml:22`).
- Verified plan context references summary files that do not exist (`.planning/phases/04-dual-adapter-validation` contains only `*-PLAN.md`, `04-CONTEXT.md`, `04-RESEARCH.md`).

## Feasibility
- `S0` Plan is not executable as written because `@riff3d/adapter-babylon` does not exist in repo.
- `S0` Plan assumes `EngineAdapter` comes from `@riff3d/canonical-ir`; current code does not provide that contract there.
- `S1` Plan’s adapter conformance API assumes `applyDelta`; current adapter interface does not include it.
- `S1` Dual-engine visual testing is not feasible without first implementing runtime engine switching in editor/store.

## Completeness
- `S1` Missing prerequisite tasks for this codebase state:
  - Create/land Babylon adapter package.
  - Move shared adapter contract into canonical-ir (or another shared package) first.
  - Add engine selection state/actions in store and viewport wiring.
- `S2` Plan references nonexistent context docs (`04-01-SUMMARY.md`, `04-02-SUMMARY.md`, `04-03-SUMMARY.md`), reducing traceability.
- `S2` Path references in context are stale (`apps/editor/e2e/fixture-render.visual.ts` vs actual `apps/editor/e2e/visual/fixture-render.visual.ts`).

## Architecture Alignment
- `S1` Intended contract-first direction is good, but current plan skips the required contract migration step for this repo state.
- `S1` Adapter boundary rule is at risk in practice because shared adapter interface still lives inside PlayCanvas package (`packages/adapter-playcanvas/src/types.ts:9`), coupling future Babylon work to PlayCanvas internals.
- `S2` Plan generally aligns with “adapters read canonical IR only,” but must explicitly sequence dependency-boundary fixes first.

## Risk Assessment
- `S0` Major delivery risk: plan assumes prior phases landed, but repository reality is precondition-incomplete (no Babylon package, no dual-engine editor wiring).
- `S1` E2E fragility risk: plan relies on `window.__editorStore` and readiness flags that are not implemented.
- `S1` CI promotion risk: current CI has no visual test job and no LoC budget enforcement step.
- `S2` Fixture tolerance config risk: proposed fixture keys (`minimal-scene`, `pbr-materials`, `spot-lighting`) do not match actual fixtures, so tolerance lookup will silently fall back.

## Correctness
- `S0` Incorrect API reference: `@riff3d/canonical-ir` does not export `EngineAdapter` from `packages/canonical-ir/src/index.ts`.
- `S0` Incorrect repository assumption: `packages/adapter-babylon/*` paths do not exist.
- `S1` Incorrect file path in plan context: `apps/editor/e2e/fixture-render.visual.ts` is wrong; actual file is `apps/editor/e2e/visual/fixture-render.visual.ts`.
- `S1` Incorrect runtime assumptions: no `switchEngine` action, no `__editorStore` global, no route/query handling for fixture loading.
- `S2` Redundant dependency steps: `fast-check` and `@fast-check/vitest` already in catalog and conformance package (`pnpm-workspace.yaml:6`, `packages/conformance/package.json:25`).

## Test Strategy
- `S1` Coverage intent is strong (unit conformance + property + visual), but prerequisites are missing so execution commands in plan are currently invalid.
- `S1` Visual strategy needs concrete CI wiring changes (workflow updates) rather than “check if required.”
- `S2` Property test spec should define CanonicalScene arbitraries or builders explicitly; current plan leaves generator implementation underspecified.

## Summary
- Key concerns:
  - `S0` Core prerequisites are missing in codebase (no Babylon adapter package, no shared EngineAdapter contract in canonical-ir).
  - `S1` Dual-adapter E2E assumptions do not match editor/store implementation.
  - `S1` CI “required visual + LoC gating” is not wired today.
  - `S1` Several file paths and fixture-name assumptions are stale/inaccurate.
- Recommended adjustments:
  1. Re-sequence 04-04 behind a prerequisite checkpoint: confirm `packages/adapter-babylon` exists and shared adapter contract location is settled.
  2. Add explicit pre-task to implement engine switching contract/state in `editor-store` and viewport runtime wiring.
  3. Correct stale paths and fixture identifiers to current repo conventions before implementation.
  4. Make CI updates explicit in plan with exact files/steps (`.github/workflows/ci.yml`, Playwright invocation, `check-adapter-loc.sh` invocation).