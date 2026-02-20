# Phase 2 Plan Summary
Date: 2026-02-19
Owner: Claude (Driver)
Phase: 02 — Closed-Loop Editor

## Phase Goal
- **Goal:** A user can open the editor, see a 3D scene rendered by PlayCanvas, make edits via gizmos and panels, undo/redo changes, and play-test the scene — the entire pipeline works end-to-end (PatchOps → ECSON → Canonical IR → PlayCanvas adapter).
- **Requirement IDs:** EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08, EDIT-09, EDIT-10, RNDR-01, RNDR-02, RNDR-03, RNDR-04, RNDR-05, ADPT-01, PROJ-01, PROJ-02, PROJ-03
- **Success Criteria:**
  1. User can log in, create a project, see it in dashboard with thumbnail
  2. 3D viewport renders scene with PBR materials, lighting, camera controls — all via PlayCanvas adapter reading Canonical IR
  3. User can add entities, transform with gizmos, edit in inspector, reparent in hierarchy — every edit flows through PatchOps
  4. Undo/redo works across all edit types; auto-save persists ECSON so browser refresh restores exact state
  5. Play mode runs scene without reload; Stop restores editor state with all edits preserved

## Approach

### Strategy
- **Lean on PlayCanvas extras:** Gizmos (TranslateGizmo, RotateGizmo, ScaleGizmo), camera controllers (OrbitController, FlyController), and GLB container import are all available as PlayCanvas extras — no custom reimplementation needed.
- **Supabase managed services:** Auth (Google/Discord/GitHub social login via PKCE), Postgres (ECSON as JSONB), Storage (thumbnails and GLB assets). Minimizes backend code.
- **Zustand vanilla store as the bridge:** PlayCanvas adapter subscribes to store changes outside React via `store.subscribe()`, while React panels use hooks. PatchOps remain the single source of truth for all mutations.
- **VS Code-style shell layout:** Fixed panels (activity bar, left sidebar, center viewport, right inspector) using `react-resizable-panels`. Figma-style floating toolbar in viewport for editing tools.
- **Dark theme only:** Designed with CSS custom properties for future theming but ships dark-only.
- **Full recompile over incremental deltas:** Start with full IR recompile on each PatchOp (simpler). Profile performance. If recompile stays <16ms for typical scenes, defer incremental delta format.
- **WebGL2 default:** WebGPU evaluation deferred to Phase 4+.

### Alternatives Rejected
| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| react-resizable-panels | allotment | Fewer downloads, less active maintenance |
| react-arborist | react-dnd-treeview | react-arborist has built-in virtualization for large scenes |
| Frustum box-select | PlayCanvas Picker (readPixels) | GPU stall risk; frustum projection is sufficient and stall-free |
| Keep runtime changes | Discard-all on Stop | UX complexity of "which changes to keep?" deferred |
| JSONB storage | File-based storage | Scenes are small in Phase 2; file-based fallback deferred to Phase 5 |

## Plan Overview

**8 plans across 6 waves:**

| Plan | Wave | Depends On | Description |
|------|------|------------|-------------|
| 02-01 | 1 | — | Auth (Supabase social login), project dashboard with card grid, VS Code-style editor shell with resizable panels, Zustand vanilla store, dark theme |
| 02-02 | 2 | 02-01 | PlayCanvas adapter package (`packages/adapter-playcanvas`), scene builder (IR→PC hierarchy), component mappers (mesh, light, camera, material), camera controllers, viewport canvas integration, default starter scene |
| 02-03 | 3 | 02-02 | GizmoManager (translate/rotate/scale via PC Gizmo API, PatchOp only on `transform:end`), SelectionManager (click/shift-click/box select), grid plane, Figma-style floating toolbar, keyboard shortcuts |
| 02-04 | 4 | 02-02, 02-03 | Hierarchy tree (`react-arborist`) with drag-to-reparent, multi-select, search; Inspector panel with auto-generated widgets from component registry `editorHints`; bidirectional selection sync |
| 02-05 | 4 | 02-02, 02-03 | Undo/redo stacks (invertible PatchOps), copy/paste/duplicate (new entity IDs), auto-save (5s debounce + blur + structural), manual save Ctrl+S, thumbnail capture. Also resolves carry-forwards CF-01, CF-02, CF-03 |
| 02-06 | 5 | 02-02, 02-04, 02-05 | Asset browser with 12+ starter assets, drag-to-spawn via PatchOps, compact asset strip, GLB import pipeline (upload→load→extract→`glbToEcsonOps` BatchOp), environment panel |
| 02-07 | 5 | 02-02, 02-04, 02-05 | Play-test mode state machine (play/pause/resume/stop), ECSON deep-clone snapshot, gizmo/grid hide during play, colored viewport border, panel collapse with peek, Ctrl+P/Space shortcuts |
| 02-08 | 6 | All | Phase 2 post-execution review gate — evidence packet, Codex post-review, final gate decision, golden path verification |

**Parallelization:** Waves 4 and 5 each have two parallel plans. Total sequential depth is 6 waves.

## Contract Impact

### New Packages
- `packages/adapter-playcanvas` — new package implementing `EngineAdapter` interface. Depends only on `@riff3d/canonical-ir` (never ECSON or PatchOps per architecture rule #3).

### Schema Changes
- **PatchOps:** New op types needed — `Reparent` (for hierarchy drag-drop), `BatchOp` (for GLB import producing multiple ops atomically), and likely `CreateEntity`/`RemoveEntity`/`AddComponent`/`RemoveComponent` extensions for asset spawning and copy/paste.
- **ECSON:** `EnvironmentSettings` schema extension for skybox, fog, ambient light, exposure. ECSON document gains a `projects` wrapper for Supabase storage (id, name, owner, timestamps).
- **Canonical IR:** No changes expected — Phase 1 IR already covers scene hierarchy, transform, mesh-renderer, light, camera, material components.
- **Component Registry:** `editorHints` metadata added to each component schema for inspector auto-generation (widget type, min/max, step, labels).

### Breaking Changes
- None expected. All additions are additive to Phase 1 contracts.

### Dependency Additions
- `apps/editor`: `@supabase/supabase-js`, `@supabase/ssr`, `react-resizable-panels`, `react-arborist`, `react-hotkeys-hook`, `lucide-react`, `sonner`, `zustand`
- `packages/adapter-playcanvas`: `playcanvas` (~2.16)

## Risks and Assumptions

### Risks
1. **Zustand store design complexity** — The store must bridge React and non-React (PlayCanvas) worlds cleanly. Incorrect granularity could cause performance issues (too many re-renders) or stale state.
2. **Full recompile performance** — If IR compilation exceeds 16ms for scenes with 100+ entities, the user will feel lag on every edit. Mitigation: profile early in 02-02 and add incremental path if needed.
3. **PlayCanvas extras API stability** — Gizmos and camera controllers are `extras` (not core). API could change between minor versions. Mitigation: pin exact PC version, wrap in our own interfaces.
4. **Supabase RLS policies** — Incorrect Row Level Security could either block legitimate access or leak data. Mitigation: test RLS extensively in 02-01.
5. **GLB import edge cases** — Complex GLB files (embedded animations, multiple materials, PBR extensions) may not map cleanly to ECSON. Mitigation: start with simple GLBs, document known limitations.
6. **Phase 2 scope (19 requirements in 7 delivery plans)** — Largest delivery phase in the roadmap. Risk of quality erosion toward the end. Mitigation: wave structure limits WIP, carry-forwards tracked.

### Assumptions
1. Phase 1 contracts (ECSON, PatchOps, Canonical IR, fixtures, conformance) are stable and complete. Any gaps will surface during 02-02 adapter integration.
2. PlayCanvas 2.16 extras module exports gizmos, camera controllers, and container asset loading as documented.
3. Supabase project is provisioned and accessible (auth providers configured, storage buckets created).
4. `react-arborist` supports the reparent, multi-select, and search/filter patterns needed without forking.
5. Scenes in Phase 2 are small enough (<100 entities) that full IR recompile is acceptable performance-wise.

### Open Questions from Research
1. **WebGPU vs WebGL2** — Defaulting to WebGL2. Evaluate in Phase 4+.
2. **Incremental IR deltas** — Starting with full recompile. Define delta format later if profiling shows need.
3. **ECSON storage format** — JSONB for now. File-based fallback deferred to Phase 5.
4. **Box select implementation** — Frustum-based screen-space projection (no GPU stall). Upgrade to Picker if precision insufficient.
5. **Grid rendering** — Custom mesh grid entity (simple). Infinite shader grid deferred.

## Questions for Auditor

1. **Adapter boundary enforcement:** Plan 02-02 creates `packages/adapter-playcanvas` depending only on `@riff3d/canonical-ir`. Is the proposed scene builder + component mapper pattern sufficient to maintain this boundary, or do you foresee situations where the adapter might need to reach into ECSON/PatchOps?

2. **PatchOp-only mutation path for gizmos:** Plan 02-03 fires PatchOps only on `transform:end` (not during drag). During drag, PlayCanvas entities move directly for responsiveness. Is this "optimistic local update + PatchOp commit" pattern acceptable, or does it create a window where ECSON and the viewport are inconsistent?

3. **Undo/redo stack design:** Plan 02-05 uses invertible PatchOps with separate undo/redo stacks tracked by `docVersion`. Are there edge cases with BatchOps (GLB import) or Reparent ops where the inverse operation could produce an inconsistent state?

4. **Play-test snapshot approach:** Plan 02-07 deep-clones the entire ECSON document before entering play mode. For large scenes, this could be expensive. Is a structural sharing approach (copy-on-write) worth investigating now, or is deep-clone acceptable for Phase 2 scene sizes?

5. **Phase 2 scope risk:** 19 requirements across 7 delivery plans is the largest phase. Phase 1 completed in 1.2 hours (7 plans). Phase 2 plans are significantly more complex (UI, 3D rendering, multiple integrations). Is the wave structure sufficient to manage this complexity, or should we consider splitting into sub-phases?

6. **Carry-forward resolution in Plan 02-05:** CF-01 (nightly property tests with rotating seeds), CF-02 (lossiness contract tests), and CF-03 (mutation-bypass enforcement) are resolved in Plan 02-05 alongside undo/redo and copy/paste. Is bundling carry-forward resolution with feature work a risk to either?
