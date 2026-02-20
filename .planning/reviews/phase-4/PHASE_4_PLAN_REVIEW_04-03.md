# Phase 4 Plan Review — 04-03
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)  
Plan: 04-03-PLAN.md

## Codebase Verification
**Checked**
- `04-03` plan content: `.planning/phases/04-dual-adapter-validation/04-03-PLAN.md:1`
- Store/slices: `apps/editor/src/stores/editor-store.ts:23`, `apps/editor/src/stores/slices/scene-slice.ts:23`
- Viewport stack: `apps/editor/src/components/editor/viewport/viewport-provider.tsx:4`, `apps/editor/src/components/editor/viewport/viewport-canvas.tsx:4`
- Shell/top bar/inspector: `apps/editor/src/components/editor/shell/editor-shell.tsx:123`, `apps/editor/src/components/editor/shell/top-bar.tsx:208`, `apps/editor/src/components/editor/inspector/inspector-panel.tsx:20`
- ECSON/PatchOps/adapter contracts: `packages/ecson/src/schemas/scene-document.ts:27`, `packages/ecson/src/schemas/entity.ts:22`, `packages/patchops/src/validation.ts:47`, `packages/adapter-playcanvas/src/types.ts:9`

**Findings (ordered by severity)**
- **S0** `@riff3d/adapter-babylon` is referenced by the plan but does not exist in workspace/deps (`04-03-PLAN.md:50`, `04-03-PLAN.md:210`; no `packages/adapter-babylon`; editor deps only include playcanvas in `apps/editor/package.json:19`).
- **S0** Plan references non-existent Canonical IR files/types: `packages/canonical-ir/src/delta.ts` (`04-03-PLAN.md:86`) and `packages/canonical-ir/src/types/engine-adapter.ts` (`04-03-PLAN.md:100`). Neither file exists.
- **S0** Plan recommends direct ECSON mutation (`04-03-PLAN.md:245`, `04-03-PLAN.md:249`), which conflicts with project rule “ALL mutations flow through PatchOps.”
- **S1** Proposed `SetProperty` for document metadata via `__document__` is unsupported. Current validation only special-cases `__environment__` and only `environment.*` paths (`packages/patchops/src/validation.ts:47`, `packages/patchops/src/validation.ts:51`).
- **S1** Plan assumes delta plumbing (`lastDelta`, `applyDelta`) exists (`04-03-PLAN.md:219`, `04-03-PLAN.md:227`, `04-03-PLAN.md:229`), but scene slice has no `lastDelta` (`apps/editor/src/stores/slices/scene-slice.ts:41`) and adapter interface has no `applyDelta` (`packages/adapter-playcanvas/src/types.ts:20`).
- **S1** Plan imports `EngineAdapter` from `@riff3d/canonical-ir` (`04-03-PLAN.md:160`), but current `EngineAdapter` type is in `@riff3d/adapter-playcanvas` (`packages/adapter-playcanvas/src/types.ts:9`).
- **S1** Plan’s scene-level tuning source is incorrect (`04-03-PLAN.md:343` says `ecsonDoc.environment`); environment schema has no tuning key (`packages/ecson/src/schemas/environment.ts:33`). Entity tuning is on `entity.tuning` (`packages/ecson/src/schemas/entity.ts:22`).
- **S2** Plan says tuning badge reads metadata (`04-03-PLAN.md:305`), but tuning data lives on entities/components, not `metadata`.
- **S2** Context references `04-01-SUMMARY.md` and `04-02-SUMMARY.md` (`04-03-PLAN.md:82`, `04-03-PLAN.md:83`) but those files are currently absent.

## Feasibility
Not feasible as written. It is blocked by missing Babylon adapter package and missing delta/adapter contract files. A reduced “UI-only switch state” is feasible, but true dual-engine switching is not.

## Completeness
Plan misses prerequisite contract work:
- Shared engine adapter contract location (currently playcanvas-local).
- Camera serialize/restore API definition.
- PatchOps contract for project metadata mutation (if needed).
- Scene-level tuning schema/path definition.

## Architecture Alignment
Partial alignment intent, but key violations:
- Direct ECSON mutation recommendation violates the non-negotiable mutation rule.
- Contract-first is not followed for new adapter/delta/camera-switch APIs.

## Risk Assessment
Real risks are understated:
- High risk of broken type graph/imports due to wrong package assumptions.
- High risk of persistence bugs from non-PatchOps mutation.
- High risk of hidden schema drift if scene-level tuning is stored ad hoc in `environment`.

## Correctness
Path/API mismatches are significant:
- Missing: `packages/canonical-ir/src/delta.ts`, `packages/canonical-ir/src/types/engine-adapter.ts`, `packages/adapter-babylon`.
- Wrong import target for `EngineAdapter`.
- Unsupported `__document__` SetProperty convention.
- Non-existent `lastDelta` and `adapter.applyDelta`.

## Test Strategy
Current verification (`typecheck` + manual checks) is insufficient.
Missing tests:
- Engine slice behavior and persistence semantics.
- Switch lifecycle (selection reset, camera transfer, play-mode disabled state).
- PatchOps-level tests if metadata/tuning mutation path is introduced.
- Determinism/replay coverage for any new mutation operation.

## Summary
- Key concerns:
  - Blocked prerequisites are missing (Babylon package and shared contracts).
  - Plan includes architecture-breaking direct mutation guidance.
  - Several file/API references do not match the current codebase.
- Recommended adjustments:
  1. Add/merge 04-01 and 04-02 deliverables first (Babylon adapter package + delta contract) or re-scope 04-03 to UI scaffolding only.
  2. Define a shared adapter contract package/module before changing viewport provider typing.
  3. Keep engine preference persistence PatchOps-compliant (extend PatchOps contract explicitly) instead of direct mutation.
  4. Define explicit schema location for scene-level tuning (or keep tuning entity-level only in Phase 4).