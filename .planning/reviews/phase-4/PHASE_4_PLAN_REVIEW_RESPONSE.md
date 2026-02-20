# Phase 4 Plan Review Response

**Date:** 2026-02-20
**Responding to:** PHASE_4_PLAN_REVIEW.md (Synthesis) + 5 per-plan reviews

## Response to S0 Findings

### 1. Preconditions not enforced; downstream plans assume missing upstream artifacts

**Agree in principle, disagree on severity.** The plans execute sequentially via `/gsd:execute-phase` — each plan's `depends_on` field is enforced by the executor before starting the next plan. 04-01 creates the Babylon adapter package and extracts shared types; 04-02 only starts after 04-01 completes successfully (typecheck + tests pass). This is the standard GSD execution model, not a plan defect.

**Action:** No plan change needed. The executor's verify step after each plan serves as the artifact existence check.

### 2. EngineAdapter uses HTMLCanvasElement, conflicting with canonical-ir non-DOM target

**Agree — valid concern.** canonical-ir's tsconfig targets Node-compatible compilation (no DOM lib). Placing `HTMLCanvasElement` in canonical-ir would require adding `"dom"` to its lib array, which pollutes the package.

**Action:** During 04-01 execution, the EngineAdapter interface will use a generic parameter or accept `unknown` for the canvas type, with each adapter casting to `HTMLCanvasElement` internally:
```typescript
interface EngineAdapter {
  initialize(canvas: unknown): Promise<void>;  // adapters cast to HTMLCanvasElement
  // ...
}
```
This keeps canonical-ir DOM-free while providing the shared contract. Plans will be adjusted at execution time — this is a signature detail, not a structural change.

### 3. Shared adapter contract location inconsistent

**Agree on the observation, already resolved by plan intent.** 04-01 Task 1 explicitly migrates EngineAdapter from adapter-playcanvas to canonical-ir and updates all imports. After 04-01 executes, the contract lives in one place. The "inconsistency" is the current state (pre-execution) vs. the planned state (post-execution) — expected.

### 4. Adapter contract handoff undefined at implementation boundaries

**Disagree on severity.** The handoff IS defined: 04-01 creates the shared types, 04-02 adds delta to both adapters, 04-03 wires into the editor. Each plan's `depends_on` + verify step ensures the prior deliverables exist and typecheck. The executor doesn't start 04-02 until 04-01's `pnpm turbo run typecheck test` passes.

## Response to S1 Findings

### 5. PatchOps payload assumptions diverge (componentIndex vs componentType/propertyPath)

**Agree — executor must use actual payload shapes.** The plan's `computeDelta` mapping is directional (shows the intent). During execution, the implementer will read the actual `SetComponentProperty` payload from `packages/patchops/src/ops/set-component-property.ts` and map accordingly. The plan notes to accept a simplified shape `{ type: string; payload: unknown }` precisely to avoid hard-coupling to PatchOps types.

**Action:** No plan change. Executor will verify against actual PatchOps contract during 04-02 implementation.

### 6. Metadata persistence path inconsistent (__document__ vs __environment__)

**Agree this needs resolution.** The plan discusses multiple approaches and recommends direct mutation matching the system-level exception pattern (loadProject, playtest stop). Engine preference is a system-level setting, not a user edit — it shouldn't produce undo-able PatchOps.

**Action:** During 04-03 execution, engine preference will be stored in ECSON metadata via direct mutation (same pattern as loadProject). The auto-save system persists the change. This aligns with the approved architectural exception for system-level state replacement.

### 7. Tuning contract inconsistent (entity vs scene-level)

**Partially agree.** Entity-level tuning already exists in ECSON schema (`entity.tuning`). Scene-level tuning is a new concern — the plan correctly identifies this as Claude's discretion. During execution, scene-level tuning will use the document's metadata or a dedicated tuning field on the environment, depending on what the ECSON schema supports.

**Action:** Executor will check ECSON schema during 04-03 and implement scene-level tuning in the most natural location. If the schema needs extension, it will be done via proper schema migration.

### 8. Phase scope is large

**Agree it's large, disagree it's too large.** This phase proves a fundamental architectural claim (engine-agnosticism). The deliverables are inherently coupled — you can't validate conformance without both adapters and engine switching. The 5-wave sequential structure decomposes it appropriately. Prior phases had similar scope (Phase 2: 8 plans, Phase 3: 7 plans).

### 9. E2E harness relies on globals not implemented

**Agree — these need to be wired.** The `window.__editorStore` exposure and `__sceneReady` signaling are implementation details that 04-04 must set up. The plan's action section describes this. The executor will implement the wiring as part of E2E test setup.

**Action:** No plan change. The 04-04 action already describes exposing the store for E2E access.

### 10. 04-05 gate outcome model

**Agree.** The review plan should explicitly include `FAIL` as a possible outcome alongside `PASS` and `PASS_WITH_CONDITIONS`.

**Action:** Noted for 04-05 execution — all three protocol-valid outcomes will be used.

## Summary of Actions

| Concern | Action | When |
|---------|--------|------|
| HTMLCanvasElement in canonical-ir | Use `unknown` parameter in EngineAdapter | 04-01 execution |
| PatchOps payload mapping | Verify against actual contract | 04-02 execution |
| Engine preference persistence | Direct mutation (system-level exception) | 04-03 execution |
| Scene-level tuning schema | Check ECSON schema, extend if needed | 04-03 execution |
| E2E store exposure | Wire window.__editorStore | 04-04 execution |
| Gate outcomes | Include PASS/PASS_WITH_CONDITIONS/FAIL | 04-05 execution |

No structural plan changes required. All concerns are addressable during execution without altering the wave structure, dependency chain, or requirement coverage.

---
*Response by: Claude (Driver)*
*Date: 2026-02-20*
