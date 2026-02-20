# Phase 4 Plan Summary

**Phase:** 4 — Dual Adapter Validation
**Date:** 2026-02-20
**Plans:** 5 (04-01 through 04-05) in 5 waves

## 1. Phase Goal

The Babylon.js adapter proves the Canonical IR is truly engine-agnostic — all golden fixtures render and behave within tolerance on both PlayCanvas and Babylon.js.

**Requirement IDs:** ADPT-02, ADPT-03, ADPT-04, TEST-04, PORT-03

**Success Criteria (from roadmap):**
1. All golden fixtures render on both PlayCanvas and Babylon.js with visual output within defined tolerance bands
2. A user can switch between PlayCanvas and Babylon.js rendering in the editor and see consistent scene representation
3. Editing a property in the editor updates the active adapter incrementally (property-level delta) without rebuilding the entire scene
4. Engine tuning sections in ECSON are respected by the target adapter and gracefully ignored by the other

## 2. Plan Files

| Plan | Path | Wave | Description |
|------|------|------|-------------|
| 04-01 | `.planning/phases/04-dual-adapter-validation/04-01-PLAN.md` | 1 | Babylon.js adapter core + extract EngineAdapter/IRDelta to canonical-ir |
| 04-02 | `.planning/phases/04-dual-adapter-validation/04-02-PLAN.md` | 2 | Incremental delta update system (computeDelta, applyDelta on both adapters, scene-slice integration) |
| 04-03 | `.planning/phases/04-dual-adapter-validation/04-03-PLAN.md` | 3 | Engine switching UI, tuning inspector, project-level engine persistence |
| 04-04 | `.planning/phases/04-dual-adapter-validation/04-04-PLAN.md` | 4 | Conformance test suite, visual regression with tolerance bands, property tests |
| 04-05 | `.planning/phases/04-dual-adapter-validation/04-05-PLAN.md` | 5 | Phase 4 Review (Codex audit + human verification) |

**Dependency chain:** 04-01 → 04-02 → 04-03 → 04-04 → 04-05 (fully sequential after revision)

## 3. Key Source Files for Auditor

### Existing adapter (template for Babylon)
- `packages/adapter-playcanvas/src/adapter.ts` — PlayCanvasAdapter class (818 LoC core)
- `packages/adapter-playcanvas/src/scene-builder.ts` — IR-to-PlayCanvas scene construction
- `packages/adapter-playcanvas/src/component-mappers/` — per-component-type mappers
- `packages/adapter-playcanvas/src/environment.ts` — environment settings application

### IR types (shared contract)
- `packages/canonical-ir/src/types/canonical-scene.ts` — CanonicalScene type
- `packages/canonical-ir/src/types/canonical-node.ts` — CanonicalNode type
- `packages/canonical-ir/src/types/canonical-component.ts` — CanonicalComponent type
- `packages/canonical-ir/src/types/canonical-environment.ts` — CanonicalEnvironment type

### Editor integration points
- `apps/editor/src/stores/slices/scene-slice.ts` — dispatchOp flow (delta integration target)
- `apps/editor/src/components/editor/viewport/viewport-canvas.tsx` — adapter lifecycle + scene subscription
- `apps/editor/src/components/editor/viewport/viewport-provider.tsx` — adapter ref context
- `apps/editor/src/components/editor/inspector/inspector-panel.tsx` — inspector layout (tuning section target)
- `apps/editor/src/components/editor/shell/top-bar.tsx` — top bar layout (engine switcher target)

### Existing conformance + test infrastructure
- `packages/conformance/src/` — round-trip, benchmarks, budgets
- `packages/fixtures/src/index.ts` — golden fixture exports
- `apps/editor/e2e/` — E2E test infrastructure

### Research references
- `.planning/phases/04-dual-adapter-validation/04-RESEARCH.md` — Babylon.js mapping research
- `.planning/research/BABYLON_ADVANCE_RESEARCH.md` — cross-engine mapping details
- `.planning/research/FUTURE_ENGINE_CONSIDERATIONS.md` — portability constraints

## 4. Key Constraints and Decisions

### Locked Decisions (from CONTEXT.md — plans must honor exactly)
1. Engine switcher in main editor toolbar (top bar), not viewport header
2. Loading overlay on viewport during engine switch
3. Camera position carries over on switch; selection resets
4. Subtle engine icon indicator (not text label)
5. Confirmation dialog before switching engines
6. Switcher disabled during play-test mode
7. Architecture must support future hot-swap during play (not implemented now)
8. Visual target: same scene, correct materials — acceptable differences in shadows/AA/AO
9. Dev-only comparison tool for conformance validation
10. Tooltip on switcher about rendering variation
11. Collapsible "Engine Tuning" section in inspector
12. Only active engine tuning visible; peek toggle for other engine (dimmed/read-only)
13. Subtle badge on switcher for custom tuning
14. Both scene-level and per-entity tuning
15. Project-level engine setting in ECSON metadata (not per-user)
16. PlayCanvas default for new projects
17. Engine choice persists with project

### Architecture Rules
- Adapter LoC budget: 1500 LoC core (adapter.ts + scene-builder.ts + environment.ts + component-mappers)
- Adapters read Canonical IR only — never touch ECSON or PatchOps directly
- Package dependency: canonical-ir → adapters (EngineAdapter interface lives in canonical-ir)
- System-level state operations (engine switch) may bypass PatchOps per approved exception pattern

### Deferred (NOT in plans)
- Beginner/advanced editor mode toggle
- Play-mode engine hot-swap

## 5. Questions for Auditor

1. **EngineAdapter extraction to canonical-ir:** Plan 04-01 moves the EngineAdapter interface from adapter-playcanvas to canonical-ir. Is this the right location, or should there be a separate @riff3d/adapter-types package to avoid canonical-ir growing beyond its original scope?

2. **Delta granularity vs correctness:** Plan 04-02 computes deltas from PatchOps and applies them without recompilation for property changes. The full IR is still recompiled (compile(ecsonDoc)) to keep canonicalScene in sync. Is there a risk of the adapter's live scene drifting from the compiled canonicalScene over many sequential deltas?

3. **Canvas element replacement:** Plan 04-03 uses canvas element replacement during engine switching (fresh canvas per engine). The research identified this as safest for WebGL context lifecycle. Any concerns about this approach vs. disposing and reusing the same canvas?

4. **Tolerance band calibration:** Plan 04-04 defines per-fixture tolerance bands. The spot light inner cone angle approximation (Babylon uses exponent vs PlayCanvas innerConeAngle) is explicitly documented as an acceptable difference. Are the proposed thresholds (2-8% pixel diff, 0.05-0.15 color delta) reasonable for cross-engine visual conformance?

5. **Carry-forward CF-P3-04 (mutation-boundary enforcement):** This is deferred for assessment in 04-05 review. Should it be addressed mechanically in Phase 4 or is deferral to Phase 5 acceptable?
