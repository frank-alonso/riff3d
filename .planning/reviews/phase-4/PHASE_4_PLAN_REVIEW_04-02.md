# Phase 4 Plan Review — 04-02
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)  
Plan: 04-02-PLAN.md

## Codebase Verification
Checked the referenced implementation surfaces in the repo:

- `apps/editor/src/stores/slices/scene-slice.ts` exists and currently does `applyOp -> compile -> set(canonicalScene)` with no delta state (`lastDelta` absent). See `apps/editor/src/stores/slices/scene-slice.ts:109`, `apps/editor/src/stores/slices/scene-slice.ts:130`, `apps/editor/src/stores/slices/scene-slice.ts:137`.
- Viewport currently always rebuilds on `canonicalScene` changes; no delta routing yet. See `apps/editor/src/components/editor/viewport/viewport-canvas.tsx:252`, `apps/editor/src/components/editor/viewport/viewport-canvas.tsx:256`.
- PlayCanvas adapter has `loadScene`/`rebuildScene` only; no `applyDelta`. See `packages/adapter-playcanvas/src/adapter.ts:96`, `packages/adapter-playcanvas/src/adapter.ts:132`.
- Canonical IR exports do not include delta types/functions. See `packages/canonical-ir/src/index.ts:1`, `packages/canonical-ir/src/types/index.ts:1`.
- PatchOps shape for component edits is `componentType` + `propertyPath`, not `componentIndex` + `property`. See `packages/patchops/src/ops/set-component-property.ts:7`; UI emits that shape in `apps/editor/src/components/editor/inspector/component-inspector.tsx:107`.
- Environment edits are emitted as `SetProperty` with `entityId: "__environment__"` + `path: "environment.*"`. See `apps/editor/src/components/editor/inspector/widgets/environment-panel.tsx:34`.
- `packages/adapter-babylon` does not exist in this workspace (all referenced Babylon files missing), and `.planning/phases/04-dual-adapter-validation/04-01-SUMMARY.md` is also missing.

## Feasibility
- **S0 (blocker):** Plan 04-02 depends on 04-01 artifacts that are not present (`adapter-babylon`, `IRDelta` types, shared adapter interfaces). As written, 04-02 cannot execute successfully in this codebase state.

## Completeness
- **S1:** The plan claims 04-02 delivers O(1) delta edit behavior, but defers viewport delta routing to 04-03. Current viewport path still forces full rebuild on every scene update (`viewport-canvas.tsx:256`), so the must-have truth is not achievable within this plan boundary.
- **S2:** Structural fallback list is incomplete (PatchOps includes `AddChild`/`RemoveChild` too), so full-rebuild classification coverage is not complete.

## Architecture Alignment
- **S1:** Proposed scene-slice invariant tests “in adapter-playcanvas or shared test file” risks boundary violation; adapter package should not depend on editor store internals (would break `... -> adapters -> editor` dependency direction).
- **S2:** `computeDelta` API is inconsistent in the plan text (`PatchOp` import vs ad-hoc `{type,payload}` shape). This weakens contract-first typing and may drift from PatchOps schema.

## Risk Assessment
Missed/underestimated risks:
- **S1:** Patch shape mismatch for `SetComponentProperty` (`componentIndex/property` in plan vs `componentType/propertyPath` in code) will produce wrong deltas.
- **S2:** Environment delta mapping must account for `entityId: "__environment__"` convention; path-only logic is fragile.
- **S2:** Treating all `BatchOp` as structural is safe but may degrade expected incremental performance for batched property edits.

## Correctness
- **S0:** Referenced files/interfaces from 04-01 do not exist (Babylon package, `ir-delta.ts`, `engine-adapter.ts`, `canonical-ir/src/delta.ts`).
- **S1:** `SetComponentProperty` mapping in the plan is incorrect against actual PatchOps schema and editor emission path.
- **S1:** “Both adapters handle delta identically” is currently unverifiable because second adapter package is absent.

## Test Strategy
- **S1:** Test plan is insufficiently executable in current state due to missing `@riff3d/adapter-babylon`.
- **S2:** Scene-slice `lastDelta` invariants should live in `apps/editor` tests, not adapter package tests.
- **S2:** No explicit test for structural ops `AddChild`/`RemoveChild` triggering full rebuild.
- **S2:** No test explicitly validating `__environment__` delta handling path semantics.

## Summary
- Key concerns:
  - S0 prerequisite failure: 04-01 artifacts are missing, so 04-02 cannot run as planned.
  - S1 model mismatch: plan assumes wrong `SetComponentProperty` payload shape.
  - S1 outcome mismatch: plan defers viewport delta routing yet claims delta-path performance wins now.
  - S1/S2 architecture and test-location issues around scene-slice testing in adapter scope.
- Recommended adjustments:
  1. Rebaseline 04-02 on actual repo state: either complete 04-01 first or fold missing 04-01 artifacts into 04-02.
  2. Update `computeDelta` mapping to real PatchOps payloads (`componentType`, `propertyPath`, `entityId === "__environment__"`).
  3. Include `AddChild`/`RemoveChild` in full-rebuild classification tests.
  4. Move scene-slice invariant tests to `apps/editor/__tests__`.
  5. If 04-02 must claim O(1) property edits, include viewport delta routing in 04-02 scope (or relax success criteria until 04-03).