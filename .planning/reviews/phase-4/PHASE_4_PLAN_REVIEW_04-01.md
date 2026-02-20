# Phase 4 Plan Review — 04-01
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)  
Plan: 04-01-PLAN.md

## Codebase Verification
No skill file was used; none matched this audit task.

Checked and confirmed current state:
- `EngineAdapter` is currently defined only in PlayCanvas adapter: `packages/adapter-playcanvas/src/types.ts:9`.
- PlayCanvas adapter currently implements only the old interface surface (no `applyDelta`, `serializeCameraState`, `restoreCameraState`): `packages/adapter-playcanvas/src/adapter.ts:33`.
- Canonical IR currently has no `engine-adapter.ts` or `ir-delta.ts`; type barrel only exports canonical scene/node/component/env/etc.: `packages/canonical-ir/src/types/index.ts:3`.
- `@riff3d/canonical-ir` package currently compiles with non-DOM lib only (`ES2022`): `packages/canonical-ir/tsconfig.json:5`.
- `@riff3d/adapter-playcanvas` already depends on canonical-ir: `packages/adapter-playcanvas/package.json:24`.
- `packages/adapter-babylon` does not exist yet.
- Workspace already includes `packages/*`: `pnpm-workspace.yaml:3`.
- Catalog does not define `vitest` or `typescript`: `pnpm-workspace.yaml:5`.
- Existing adapter LoC budget script is PlayCanvas-specific only: `scripts/check-adapter-loc.sh:5`.

## Feasibility
Feasible with moderate risk, but not feasible **as written** without corrections below (interface breakage, DOM typing issue, Babylon node typing mismatch, catalog misuse).

## Completeness
Gaps:
- **S0** Plan expands `EngineAdapter` but Task 1 does not include updating `packages/adapter-playcanvas/src/adapter.ts`; typecheck will fail once interface is moved/expanded.
- **S1** No explicit task to add/adjust tests for newly required shared adapter methods (`applyDelta`, camera state serialize/restore).
- **S2** LoC budget target for Babylon is stated, but no enforcement path exists (current script only checks PlayCanvas).

## Architecture Alignment
- Positive: moving shared adapter contract to canonical-ir aligns with dependency direction (`ecson -> ... -> canonical-ir -> adapters`).
- **S0** Putting `HTMLCanvasElement` in canonical-ir `EngineAdapter` conflicts with current non-DOM canonical-ir config and with “no web-only assumptions” intent (`packages/canonical-ir/tsconfig.json:5`).
- **S2** Plan says IRDelta should be TS-only; project convention says Zod contracts are source of truth. This is a process mismatch that should be resolved explicitly.

## Risk Assessment
Missed or underestimated risks:
- **S0** Babylon class hierarchy mismatch: plan types entity map as `Map<string, TransformNode>` while lights/cameras are `Node` (not `TransformNode`), so this type/model cannot represent all IR node kinds.
- **S1** `applyDelta` stub fallback behavior is underspecified for `currentScene === null`.
- **S1** Orthographic camera mapping only sets top/bottom; left/right handling is needed for aspect-correct output.
- **S1** Package scaffold uses `catalog:` for `vitest`/`typescript`, but those entries are absent in workspace catalog (`pnpm-workspace.yaml:5`), so install will break.

## Correctness
Specific mismatches between plan assumptions and repo reality:
- **S0** Plan assumes shared adapter types can be moved without touching adapter implementation, but `PlayCanvasAdapter implements EngineAdapter` today and will break if new methods are required (`packages/adapter-playcanvas/src/adapter.ts:33`).
- **S0** Plan assumes canonical-ir can host web-facing adapter interface unchanged; current canonical-ir compiler lib excludes DOM (`packages/canonical-ir/tsconfig.json:5`).
- **S1** Plan asks to update `packages/adapter-playcanvas/src/index.ts` export line, but it already matches (`packages/adapter-playcanvas/src/index.ts:2`).
- **S1** Plan’s dependency instructions for Babylon package (`vitest: catalog:`, `typescript: catalog:`) do not match workspace catalog contents (`pnpm-workspace.yaml:5`).
- **S3** Plan lists `pnpm-workspace.yaml` modification, but `packages/*` already includes future `packages/adapter-babylon` (`pnpm-workspace.yaml:3`).

## Test Strategy
Current proposed tests are good for mappers/environment, but insufficient overall:
- Missing adapter contract tests for `BabylonAdapter` lifecycle and interface conformance.
- Missing tests for camera state serialize/restore contract (shared interface).
- Missing tests for left/right-handed direction handling for camera/light quaternion-derived vectors.
- Missing regression test ensuring PlayCanvas remains compatible after interface extraction.

## Summary
- Key concerns:
  - **S0** Interface expansion will break PlayCanvas unless `adapter.ts` is updated in same plan.
  - **S0** Canonical-ir DOM typing conflict for `HTMLCanvasElement`.
  - **S0** Babylon node typing/model inconsistency (`TransformNode` vs `Node` for lights/cameras).
  - **S1** Invalid `catalog:` dependency assumptions for Babylon scaffold.
- Recommended adjustments:
  1. Add `packages/adapter-playcanvas/src/adapter.ts` to Task 1 and implement new required methods/stubs.
  2. Make `EngineAdapter` canvas type platform-neutral (or move web canvas specifics out of canonical-ir).
  3. Change Babylon entity map/base node typing to `Node` (or explicit union) and adjust scene-builder contract accordingly.
  4. Replace `catalog:` for `vitest`/`typescript` with valid versions or add catalog entries first.
  5. Expand tests to include adapter-level lifecycle + new shared contract behavior, not only mapper/environment tests.