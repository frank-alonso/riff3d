# Phase 3 Plan Review — 03-06
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)  
Plan: 03-06-PLAN.md

## Codebase Verification
Checked plan assumptions against current repo state:

- `apps/editor/playwright.config.ts` is missing.
- `apps/editor/e2e/golden-path.e2e.ts` is missing.
- `apps/editor/e2e/visual/fixture-render.visual.ts` is missing.
- `apps/editor/e2e/helpers/auth.ts` is missing.
- `packages/adapter-playcanvas/src/adapter.ts` exists and has `loadScene`/`rebuildScene` (`packages/adapter-playcanvas/src/adapter.ts:96`, `packages/adapter-playcanvas/src/adapter.ts:122`) but no `__sceneReady`.
- `apps/editor/package.json` has no Playwright deps/scripts (`apps/editor/package.json:6`, `apps/editor/package.json:30`).
- `packages/fixtures/src/index.ts` exists, but fixture naming in plan does not match actual fixture set.
- `03-03-SUMMARY` referenced by plan is missing (`.planning/phases/03-review-gate-foundation/03-06-PLAN.md:66`).

Key mismatches found:

- `S1` Auth flow mismatch: plan assumes email+password env login (`.planning/phases/03-review-gate-foundation/03-06-PLAN.md:160`, `.planning/phases/03-review-gate-foundation/03-06-PLAN.md:166`), but app uses OAuth + magic-link OTP only (`apps/editor/src/app/(auth)/login/page.tsx:30`, `apps/editor/src/app/(auth)/login/page.tsx:49`).
- `S1` Fixture mismatch: plan fixture names `simple-scene/all-components/deep-hierarchy` (`.planning/phases/03-review-gate-foundation/03-06-PLAN.md:242`) do not exist; actual fixtures are `transforms-parenting/materials-lights/animation/events-triggers/character-stub/timeline-stub/adversarial` (`packages/fixtures/src/builders/index.ts:5`).
- `S1` Fixture loading path is unspecified/incomplete: no `/editor/fixture/[fixtureName]` route exists, and editor package does not depend on `@riff3d/fixtures` (`apps/editor/package.json:13`).
- `S2` Visual wait strategy race: plan references `window.__sceneAlreadyReady` (`.planning/phases/03-review-gate-foundation/03-06-PLAN.md:252`) but no such flag exists in codebase.
- `S2` Context link drift: `03-03-SUMMARY` is referenced but absent, reducing traceability of dependency assumptions.

## Feasibility
Partially feasible, but not feasible as written due to `S1` auth and fixture-loading gaps.  
`__sceneReady` addition is straightforward and feasible in adapter.

## Completeness
Incomplete for implementation detail in two critical areas:

- How Playwright authenticates in a non-password app.
- How visual tests deterministically load known fixtures in editor runtime.

Also missing explicit browser install step (`playwright install chromium`).

## Architecture Alignment
Mostly aligned with architecture rules:

- No direct ECSON mutation implied.
- Adapter change stays adapter-local and still reads Canonical IR (`packages/adapter-playcanvas/src/adapter.ts:2`).
- Non-blocking visual beta aligns with Phase 3 non-gating intent.

## Risk Assessment
- `S1` High risk of non-runnable E2E due auth assumption mismatch.
- `S1` High risk of non-runnable visual tests due missing fixture-loading mechanism.
- `S2` Flakiness risk from scene-ready race (`__sceneReady` event may fire before listener).
- `S2` Cleanup fragility: delete-project UI path exists but has hover/menu interactions that can be brittle in E2E (`apps/editor/src/components/dashboard/project-card.tsx:166`).

## Correctness
Not fully correct against current codebase:

- Plan references nonexistent fixture names.
- Plan references password auth path that app does not implement.
- Plan references missing context summary file.

Correct assumptions:

- Dashboard/editor lifecycle exists.
- Auto-save/manual save hook exists (`apps/editor/src/hooks/use-auto-save.ts:135`).
- Adapter has lifecycle hooks where `__sceneReady` can be inserted.

## Test Strategy
Good intent (single golden-path + non-blocking visual), but currently insufficiently specified for deterministic execution.  
Needs explicit auth strategy and explicit fixture ingestion strategy before execution.

## Summary
- Key concerns:
  - `S1` Password-based auth assumptions conflict with actual magic-link/OAuth login.
  - `S1` Visual fixture names/loading plan does not match available fixtures/runtime paths.
  - `S2` `__sceneAlreadyReady` wait logic is referenced without implementation.
- Recommended adjustments:
  - Replace password login with one of: pre-baked Playwright `storageState`, test-only auth bypass, or Supabase test-session bootstrap.
  - Use real fixture names from `packages/fixtures`.
  - Add deterministic fixture load path (test route or API seed path) and declare required files/deps.
  - Define scene-ready synchronization contract fully (`__sceneReady` + optional sticky ready flag).
  - Fix context link to existing dependency artifacts.

I could not execute `pnpm turbo typecheck` in this environment because sandbox is read-only and Turbo failed writing logs.