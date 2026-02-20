# Phase 3 Plan Review — 03-05
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)  
Plan: 03-05-PLAN.md

## Codebase Verification
Checked the plan assumptions against these files:

- `apps/editor/src/components/editor/viewport/viewport-canvas.tsx:41`  
  - Exists; initializes adapter/tools.  
  - No drag event wiring (`dragenter/dragover/dragleave/drop`) currently.
- `apps/editor/src/components/editor/shell/editor-shell.tsx:139`  
  - Current asset drop handling lives here (container-level), not in viewport canvas.
- `apps/editor/src/components/editor/assets/asset-browser.tsx:32`  
  - Exists, but at `assets/asset-browser.tsx` (not `panels/asset-browser.tsx`).
- `apps/editor/src/lib/asset-manager.ts:264` and `apps/editor/src/components/editor/assets/asset-card.tsx:58`  
  - `ASSET_DRAG_MIME` exists; drag payload is `asset.id` (not `assetType`).
- `packages/adapter-playcanvas/src/index.ts:1` and `packages/adapter-playcanvas/package.json`  
  - No `editor-tools` directory/subpath exports today.
- `packages/conformance/src/benchmarks.ts:17` and `packages/conformance/__tests__/benchmarks.test.ts:17`  
  - Uses existing `PERFORMANCE_BUDGETS`; no `budgets.ts`, no tiered budgets.
- `packages/conformance/src/index.ts:27`  
  - Exports `PERFORMANCE_BUDGETS` from `benchmarks.ts`, not tiered budget APIs.
- `scripts/`  
  - `scripts/check-adapter-loc.sh` does not exist (only `scripts/codex-review.sh`).
- Command validity check  
  - `pnpm vitest run --filter ...` fails: unknown option `--filter` in this setup.

## Feasibility
- **S1** Plan is partially feasible technically, but not executable as written due stale paths and invalid verification commands.
- **S1** `DragPreviewManager` can be implemented (adapter already exposes `getApp()`/`getCameraEntity()`), but current drop flow is in `editor-shell`; moving logic needs explicit migration steps.

## Completeness
- **S2** Missing migration detail for existing drop pipeline in `editor-shell` (`apps/editor/src/components/editor/shell/editor-shell.tsx:139` onward).
- **S2** Plan does not update starter asset contract to support spawn position; `createOps(parentId)` currently has no position parameter (`apps/editor/src/lib/asset-manager.ts:30`).
- **S2** Existing benchmark suite includes decompilation budgets (`packages/conformance/__tests__/benchmarks.test.ts:64`), but proposed tier table omits decompilation criteria.

## Architecture Alignment
- **S1** Potential dependency-boundary risk: if adapter `drag-preview.ts` imports app-level `ASSET_DRAG_MIME`, that would invert package boundaries (`editor` should depend on adapter, not vice versa).
- **S2** Mutation path remains aligned if drop callback dispatches PatchOps (current pattern already does this via `BatchOp` in `editor-shell.tsx:172`).
- **S2** Plan should preserve current asset catalog abstraction instead of introducing duplicated “asset type → ops” mapping in viewport code.

## Risk Assessment
- **S2** Drag listeners on canvas only may miss drops over overlays (toolbar/container). Current implementation uses container-level handlers (`editor-shell.tsx:263`).
- **S3** Fallback placement (“5 units along ray”) can create unpredictable spawn UX; no acceptance criteria for this behavior.
- **S2** No plan for read-only mode interaction during drag-drop (editor has ownership/read-only state in shell initialization).

## Correctness
- **S0** Success criterion requires export from `@riff3d/adapter-playcanvas/editor-tools`, but package exports only `"."` today (`packages/adapter-playcanvas/package.json`). Plan file list does not include package export changes.
- **S1** Referenced paths are incorrect/nonexistent in current repo:
  - `packages/adapter-playcanvas/src/editor-tools/*`
  - `apps/editor/src/components/editor/panels/asset-browser.tsx`
  - `packages/adapter-playcanvas/__tests__/drag-preview.test.ts` (directory absent)
- **S1** Verification command is incorrect for Vitest here: `--filter` is unsupported.
- **S1** Verification references missing script: `scripts/check-adapter-loc.sh`.

## Test Strategy
- **S1** Test commands in plan are not runnable as written (`vitest --filter`).
- **S2** “Shared PlayCanvas mock factory” is not present in repository; test infra needs to be defined first.
- **S2** Good intent on lifecycle/raycast tests, but missing integration coverage for handoff from drag preview drop → PatchOp dispatch path.

## Summary
- Key concerns:
- **S0** Export-path blocker: `@riff3d/adapter-playcanvas/editor-tools` not currently possible without `package.json` export changes.
- **S1** Multiple stale/incorrect file paths and invalid verification commands.
- **S1** Dependency-boundary risk around `ASSET_DRAG_MIME` usage from adapter layer.
- **S2** Incomplete migration from current `editor-shell` drop handling and missing spawn-position contract update.
- Recommended adjustments:
- Add `packages/adapter-playcanvas/package.json` to `files_modified` and define explicit subpath export (or drop subpath requirement).
- Correct file targets to current structure (`assets/asset-browser.tsx`, etc.).
- Replace verify commands with workspace-correct invocations (e.g., `pnpm --filter @riff3d/adapter-playcanvas vitest run ...`).
- Define where drag data parsing lives to preserve dependency direction (prefer editor passes parsed asset id/type into adapter manager).
- Extend starter asset contract for positioned spawn (or add a PatchOp to set transform after create).
- Include decompilation budget migration so existing conformance coverage is not regressed.