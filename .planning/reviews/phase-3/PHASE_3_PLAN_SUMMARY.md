# Phase 3 Plan Summary

**Phase:** 03 — Review Gate: Foundation
**Date:** 2026-02-20
**Plans:** 7 plans in 4 waves

## 1. Phase Goal

Validate that contracts (Phase 1) and the closed-loop editor (Phase 2) are sound before building collaboration and the second adapter on top. This is an **expanded-scope review** that also:
- Resolves all 4 carry-forward items from Phase 2 (CF-P2-01 through CF-P2-04)
- Adds a drag-preview ghost feature
- Establishes tiered performance budgets (Excellent/Pass/Fail)
- Sets up E2E smoke testing and visual baseline beta
- Runs a Codex expanded-scope audit with extra scrutiny on PatchOps integrity, adapter boundary, and cumulative debt

**Requirement IDs:** None (review phase)

**Success Criteria:**
1. All golden fixtures load, edit, save, compile, and render without errors in the editor
2. PatchOps operation log accurately captures every edit made through the UI — no hidden state mutations exist
3. Round-trip tests pass at 100% for the portable subset (ECSON to Canonical IR to ECSON)
4. Performance budgets (load time, memory, FPS) are met for all golden fixture projects running in the PlayCanvas adapter
5. All carry-forward actions from Phase 1-2 reviews are resolved or explicitly re-scheduled
6. No unaddressed architecture drift from original contract definitions

## 2. Plan Files

| Plan | Path | Description |
|------|------|-------------|
| 03-01 | `.planning/phases/03-review-gate-foundation/03-01-PLAN.md` | Adapter unit tests via PlayCanvas mocking — core modules + editor-tools, remove passWithNoTests (CF-P2-01) |
| 03-02 | `.planning/phases/03-review-gate-foundation/03-02-PLAN.md` | Migrate all test document construction to SceneDocumentSchema.parse() (CF-P2-03) |
| 03-03 | `.planning/phases/03-review-gate-foundation/03-03-PLAN.md` | Split adapter into core/editor-tools subpath exports with CI LoC budget enforcement (CF-P2-04) |
| 03-04 | `.planning/phases/03-review-gate-foundation/03-04-PLAN.md` | RLS policy tests — mocked structural tests + live Supabase integration tests (CF-P2-02) |
| 03-05 | `.planning/phases/03-review-gate-foundation/03-05-PLAN.md` | Drag-preview ghost entity + tiered performance budgets (Excellent/Pass/Fail) |
| 03-06 | `.planning/phases/03-review-gate-foundation/03-06-PLAN.md` | Playwright E2E smoke test + visual baseline beta (non-blocking) |
| 03-07 | `.planning/phases/03-review-gate-foundation/03-07-PLAN.md` | Review gate: evidence packet, Codex expanded-scope audit, human walkthrough checklist |

## 3. Key Source Files for Auditor

### Adapter (core + editor-tools boundary)
- `packages/adapter-playcanvas/src/adapter.ts` — Main adapter class, loadScene/rebuildScene lifecycle
- `packages/adapter-playcanvas/src/scene-builder.ts` — IR-to-PlayCanvas entity mapping
- `packages/adapter-playcanvas/src/environment.ts` — Environment settings (skybox, fog, ambient)
- `packages/adapter-playcanvas/src/component-mappers/` — Light, camera, material, mesh-renderer mappers
- `packages/adapter-playcanvas/src/gizmo-manager.ts` — Gizmo mode switching, PatchOp dispatch
- `packages/adapter-playcanvas/src/selection-manager.ts` — Click picking, box select
- `packages/adapter-playcanvas/src/camera-controller.ts` — Fly/orbit camera modes
- `packages/adapter-playcanvas/src/grid.ts` — Grid rendering
- `packages/adapter-playcanvas/src/glb-loader.ts` — GLB import hierarchy walking

### PatchOps and ECSON
- `packages/patchops/src/engine.ts` — PatchOp application with dispatchOp
- `packages/ecson/src/schemas/` — ECSON Zod schemas (SceneDocumentSchema)
- `packages/canonical-ir/src/compiler.ts` — ECSON-to-IR compiler
- `packages/canonical-ir/src/decompiler.ts` — IR-to-ECSON decompiler

### Editor (integration points)
- `apps/editor/src/components/editor/viewport/viewport-canvas.tsx` — Viewport component wiring adapter
- `apps/editor/src/components/editor/panels/asset-browser.tsx` — Asset drag source
- `apps/editor/src/lib/glb-to-ecson.ts` — GLB import flow

### Test Infrastructure
- `packages/conformance/__tests__/` — Round-trip, replay, lossiness, benchmarks
- `packages/fixtures/src/` — Golden fixture builders

### RLS Policies
- `apps/editor/supabase/migration-001-projects.sql` — RLS policy definitions

## 4. Key Constraints and Decisions

From CONTEXT.md (locked user decisions plans must respect):
- ALL four carry-forward items resolved in Phase 3, none deferred
- Tiered thresholds with Excellent = WebXR-ready (72+ FPS)
- Both per-scene budget AND total editor footprint cap
- E2E runs locally only — no cloud CI
- Visual baseline testing is beta, non-blocking (`pnpm test:visual`)
- Implementation plans first, then review gate plan (clean separation)
- Codex review focuses on: PatchOps integrity, adapter boundary, cumulative debt
- Surface normal snapping deferred to Phase 7 (no physics engine in Phase 3) — Y=0 ground plane only

## 5. Questions for Auditor

1. **Adapter mock fidelity:** Plans mock PlayCanvas via `vi.mock`. Is the testing strategy sufficient to catch real adapter bugs, or should we also require at least one Playwright-rendered integration test per adapter module?
2. **RLS structural tests:** Mocked tests verify SQL structure via regex. Is this robust enough for policy correctness, or should we pursue pgTAP-style tests even though they require Supabase CLI locally?
3. **Performance budget numbers:** The tiered budgets (72 FPS Excellent, 45 FPS Pass, 30 FPS Fail) are based on industry baselines and the WebXR target. Are these reasonable for the current project state (Phase 3, ~20 entity scenes)?
4. **Drag-preview without physics:** Ground plane raycasting (Y=0) is the only option without Rapier. Is deferring scene geometry raycasting to Phase 7 acceptable, or should we add a basic BVH-based raycast now?
5. **Cross-phase integration:** Are there integration seams between Phase 1 contracts and Phase 2 editor that the plans don't adequately test?
