# Phase 4 Plan Review (Synthesis)
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)

## Dependency Coherence
- **S0:** The declared sequence `04-01 → 04-02 → 04-03 → 04-04 → 04-05` is logically correct, but plan handoffs are not gated by artifact existence. Multiple downstream plans assume outputs that do not exist yet (`packages/adapter-babylon`, `packages/canonical-ir/src/types/engine-adapter.ts`, `packages/canonical-ir/src/delta.ts`).
- **S0:** 04-02, 04-03, and 04-04 all depend on 04-01 contract extraction and Babylon scaffolding, but those dependencies are treated as implicit rather than hard preconditions.
- **S1:** 04-04 depends on runtime engine-switch behavior from 04-03, yet 04-03 itself depends on delta/state APIs from 04-02 (`lastDelta`, `applyDelta`) that are not present in current code (`apps/editor/src/stores/slices/scene-slice.ts:41`, `packages/adapter-playcanvas/src/types.ts:20`).
- **S1:** 04-05 assumes all prior deliverables are already implemented and reviewable, but no checkpoint enforces this before audit claims (`.planning/phases/04-dual-adapter-validation/04-05-PLAN.md:109` vs missing artifacts called out in `.planning/reviews/phase-4/PHASE_4_PLAN_REVIEW_04-05.md`).

## Contract Consistency
- **S0:** Shared adapter contract location and shape are inconsistent across plans: local in PlayCanvas today (`packages/adapter-playcanvas/src/types.ts:9`), planned in canonical-ir, but imports/usages in later plans already assume migration is done.
- **S0:** Proposed `EngineAdapter` in canonical-ir uses `HTMLCanvasElement`, conflicting with canonical-ir non-DOM compiler target (`packages/canonical-ir/tsconfig.json:5`).
- **S1:** PatchOps payload assumptions diverge from actual contract: plans use `componentIndex/property`, code uses `componentType/propertyPath` (`packages/patchops/src/ops/set-component-property.ts:7`).
- **S1:** Metadata persistence path is inconsistent: 04-03 proposes `__document__` mutation, but validator only supports `__environment__` special-casing (`packages/patchops/src/validation.ts:47`).
- **S1:** Tuning contract is inconsistent across plans (`metadata`, `ecsonDoc.environment`, entity tuning), while current schema places tuning at entity level (`packages/ecson/src/schemas/entity.ts:22`), and environment schema has no tuning field (`packages/ecson/src/schemas/environment.ts:33`).
- **S2:** IRDelta contract process conflicts with architecture convention (“Zod schemas first”) when planned as TS-only.

## Scope Risk
- **S1:** Phase 4 currently bundles too many coupled deliverables: new adapter package, shared contract migration, incremental delta engine, runtime engine switching UX/state, tuning UX/persistence, conformance/property/visual infra, CI gating, and phase audit.
- **S1:** Scope creep is visible from locked UX decisions plus infra expansion (comparison tool, badges, overlay, tolerance calibration, LoC gates) without decomposition into enforceable milestones.
- **S2:** Review/documentation scope is also inflated; missing `04-0x-SUMMARY.md` artifacts create planning overhead and weaken execution traceability.

## Requirement Coverage
- **ADPT-02 (dual-engine fixture parity):** **Gap (S0)**. Not coverable until Babylon adapter exists and shared adapter contract stabilizes (`packages/adapter-babylon` missing).
- **ADPT-03 (engine switching in editor):** **Gap (S1)**. UI/state/lifecycle dependencies are split across plans without complete contract handoff (`switchEngine`, camera transfer, selection reset, play-mode disable not fully wired).
- **ADPT-04 (engine tuning respected/ignored cross-engine):** **Gap (S1)**. Scene-level tuning schema/location is unresolved; persistence/mutation path conflicts with PatchOps rules.
- **TEST-04 (conformance + tolerance):** **Gap (S1)**. Test plan exists conceptually, but paths/fixture keys are stale and CI does not enforce visual or LoC checks (`.github/workflows/ci.yml:23`, `scripts/check-adapter-loc.sh:5`).
- **PORT-03 (portability via Canonical IR contracts):** **Partial with blocker (S0)**. Extraction intent is right, but contract currently introduces platform leakage and package-boundary ambiguity.

## Integration Risk
- **S0:** Adapter contract handoff is undefined at implementation boundaries (who owns `EngineAdapter`/`IRDelta`, and how adapters/versioning are validated).
- **S1:** Delta handoff is under-specified: scene-slice computes/holds delta, viewport consumes it, adapters apply it, but fallback/rebuild semantics are inconsistent across plans.
- **S1:** Engine-switch lifecycle integration points are not end-to-end defined (store action, viewport canvas replacement, adapter dispose/init, camera state transfer, readiness signaling).
- **S1:** E2E harness integration is brittle: tests rely on globals/readiness flags that are not implemented (`window.__editorStore`, `__sceneAlreadyReady` setting).
- **S2:** Governance integration is weak: 04-05 gate outcome model diverges from protocol by excluding `FAIL` (`.planning/PHASE_REVIEW_PROTOCOL.md:182`).

## Summary
- Key cross-plan concerns:
  - **S0:** Preconditions are not enforced; downstream plans assume missing upstream artifacts.
  - **S0:** Shared contract strategy is inconsistent and currently platform-leaky.
  - **S1:** PatchOps/schema assumptions drift across plans (component payloads, metadata mutation, tuning location).
  - **S1:** Requirement-to-deliverable mapping is incomplete for ADPT-03/04 and TEST-04 due to unresolved integration and CI wiring.
- Recommended adjustments:
  1. Add hard phase gates between each wave: artifact existence + typecheck + contract tests before next wave starts.
  2. Freeze one shared adapter contract design (prefer platform-neutral core), then update all plans to that exact import path/signature.
  3. Add explicit PatchOps/schema tasks for engine persistence and scene-level tuning before UI work.
  4. Move viewport delta routing into same wave as delta computation if claiming incremental update outcomes.
  5. Rebaseline 04-04/04-05 against real file paths, fixture IDs, and CI jobs; include protocol-valid outcomes `PASS | PASS_WITH_CONDITIONS | FAIL`.