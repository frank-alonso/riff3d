# Phase 3 Plan Review — 03-03
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)  
Plan: 03-03-PLAN.md

## Codebase Verification
Checked these sources directly:

- Plan file exists: `.planning/phases/03-review-gate-foundation/03-03-PLAN.md`.
- Adapter currently exports both core and editor tooling from one entrypoint: `packages/adapter-playcanvas/src/index.ts:1`, `packages/adapter-playcanvas/src/index.ts:5`, `packages/adapter-playcanvas/src/index.ts:13`.
- `./editor-tools` subpath export does not exist yet: `packages/adapter-playcanvas/package.json:6`.
- `src/editor-tools/` directory does not exist; editor-tools files are still in `src/` root (`camera-controller.ts`, `gizmo-manager.ts`, etc.).
- Editor viewport currently imports tools from root package, not subpath: `apps/editor/src/components/editor/viewport/viewport-canvas.tsx:4`.
- GLB type import still from root package: `apps/editor/src/lib/glb-to-ecson.ts:2`.
- Additional callsite not listed in plan also imports GLB loader from root package: `apps/editor/src/components/editor/assets/glb-import.tsx:50`.
- Adapter core currently depends on camera controller directly: `packages/adapter-playcanvas/src/adapter.ts:6`.
- `check-loc` is not configured in Turbo: `turbo.json:3`.
- No adapter tests found under `packages/adapter-playcanvas/__tests__` (directory absent).
- Context reference in plan is stale/missing: `.planning/phases/03-review-gate-foundation/03-01-SUMMARY.md` does not exist.

## Feasibility
- **S0 (blocker):** Plan moves `camera-controller.ts` to editor-tools but does not include `packages/adapter-playcanvas/src/adapter.ts` edits. Current adapter imports it directly (`packages/adapter-playcanvas/src/adapter.ts:6`), so Task 1 as written will break build/typecheck.
- **S1 (high):** Plan’s split is feasible only if camera control ownership is clarified: either keep camera controller in core, or refactor adapter to stop depending on it.

## Completeness
- **S1 (high):** Import migration is incomplete. `apps/editor/src/components/editor/assets/glb-import.tsx:50` is not in `files_modified` but must change if `importGlb` moves to `@riff3d/adapter-playcanvas/editor-tools`.
- **S2 (medium):** “Update test file imports from 03-01” appears stale; there are no adapter test files currently.
- **S2 (medium):** Plan omits any contract/ADR update for boundary definition (core vs editor-tools), which is important given architecture emphasis.

## Architecture Alignment
- **S1 (high):** Proposed LoC boundary can be bypassed if core code imports editor-tools transitively (currently true for camera controller dependency). That weakens the intended architectural separation.
- **S2 (medium):** Subpath split aligns with dependency-boundary intent, but only if dependency direction is enforced (core must not consume editor-tools).

## Risk Assessment
- **S1 (high):** False confidence risk in LoC enforcement: script counts fixed file list, not dependency closure. Core could stay under budget numerically while importing large editor-tools modules.
- **S2 (medium):** Plan assumes repo verification commands can run cleanly; in this environment, Turbo commands failed due log write permissions, so CI assumptions should be validated in writable CI context.
- **S3 (low):** Stated expected LoC “~818 core / ~1625 editor-tools” is outdated vs current snapshot (~893 core by listed files; ~1550 editor-tools without index).

## Correctness
- **S0 (blocker):** Missing required `adapter.ts` update for camera-controller move (`packages/adapter-playcanvas/src/adapter.ts:6`).
- **S1 (high):** Missing import update for GLB dynamic import callsite (`apps/editor/src/components/editor/assets/glb-import.tsx:50`).
- **S2 (medium):** Plan references nonexistent `.planning/phases/03-review-gate-foundation/03-01-SUMMARY.md`.
- **S3 (low):** “Likely only uses PlayCanvasAdapter” for viewport-provider is correct (`apps/editor/src/components/editor/viewport/viewport-provider.tsx:4`), but phrasing is speculative rather than verified.

## Test Strategy
- Current strategy (`pnpm turbo typecheck`, `test`, `lint`) is broadly appropriate.
- **Gap:** No explicit check that root export no longer exposes editor-tools API (needs a focused import smoke test).
- **Gap:** No test/assertion that core does not import editor-tools (needs static boundary check, e.g. dep-cruiser/ESLint rule).
- **Gap:** No adapter package tests exist to validate subpath export behavior directly.

## Summary
- Key concerns:
- S0: Camera-controller relocation is inconsistent with current adapter dependency and will fail unless `adapter.ts` is refactored or scope is changed.
- S1: Plan misses `glb-import.tsx` import migration.
- S1: LoC budget script alone does not enforce true architectural separation.
- S2: Stale references (missing `03-01-SUMMARY.md`, nonexistent adapter tests assumption).

- Recommended adjustments:
- Add `packages/adapter-playcanvas/src/adapter.ts` to `files_modified` and explicitly decide camera-controller ownership.
- Add `apps/editor/src/components/editor/assets/glb-import.tsx` to import migration scope.
- Add a boundary guard: fail CI if core files import from `src/editor-tools/**`.
- Add a small export-surface test (root vs `./editor-tools`) to prevent regressions.
- Update plan context references and remove stale assumptions about existing adapter tests.