# Phase 2 Evidence
Date: 2026-02-20
Owner: Claude (Driver)
Phase: 02 -- Closed-Loop Editor

## Scope

### Planned Goals
A user can open the editor, see a 3D scene rendered by PlayCanvas, make edits via gizmos and panels, undo/redo changes, and play-test the scene -- the entire pipeline works end-to-end (PatchOps -> ECSON -> Canonical IR -> PlayCanvas adapter).

### Completed Goals
All planned goals delivered across 7 execution plans (02-01 through 02-07). The complete closed-loop editor pipeline is operational: auth -> dashboard -> create project -> open editor -> render 3D viewport -> select entities -> transform with gizmos -> edit in inspector -> reparent in hierarchy -> undo/redo -> copy/paste -> save/auto-save -> import GLB -> configure environment -> play-test -> stop -> restore.

### Requirement IDs
All 19 Phase 2 requirements implemented:
EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08, EDIT-09, EDIT-10, RNDR-01, RNDR-02, RNDR-03, RNDR-04, RNDR-05, ADPT-01, PROJ-01, PROJ-02, PROJ-03

## Success Criteria Evidence

### SC-1: "A user can log in, create a new project, and see it in their project dashboard with a thumbnail"

**Status: Implemented**

- **Auth flow:** Supabase SSR auth with email magic link (primary) and social OAuth (Google/Discord/GitHub). Cookie-based sessions using `getUser()` (never `getSession()` per Supabase best practices). Auth callback route exchanges code for session.
- **Dashboard:** Responsive project card grid at root `/` route. Each card shows project name, thumbnail, and last-modified date. Empty state CTA when no projects exist.
- **New project creation:** Modal creates project with default ECSON scene (ground plane, directional light, cube, sphere). Stored in Supabase Postgres with JSONB column. RLS policies enforce owner-only write access.
- **Thumbnails:** Captured on save via PlayCanvas canvas `toDataURL()` and stored in Supabase Storage. Displayed on dashboard project cards.
- **PROJ-03 shareable links:** Public toggle on project cards, copy-to-clipboard URL, read-only mode for non-owners with middleware exception for `/editor/*` routes.

**Reference:** 02-01-SUMMARY (auth + dashboard), 02-05-SUMMARY (thumbnail capture on save)

**Key files:**
- `apps/editor/src/app/(auth)/login/page.tsx`
- `apps/editor/src/app/(auth)/auth/callback/route.ts`
- `apps/editor/src/app/(dashboard)/page.tsx`
- `apps/editor/src/components/dashboard/project-card.tsx`
- `apps/editor/src/components/dashboard/new-project-modal.tsx`
- `apps/editor/supabase/migration-001-projects.sql`

### SC-2: "The 3D viewport renders a scene with PBR materials, lighting, and camera controls -- all powered by the PlayCanvas adapter reading Canonical IR"

**Status: Implemented**

- **PlayCanvas adapter:** `@riff3d/adapter-playcanvas` package implementing `EngineAdapter` interface. Depends only on `@riff3d/canonical-ir` (never ECSON or PatchOps, per architecture rule #3).
- **Scene builder:** Translates Canonical IR nodes (BFS-sorted) into PlayCanvas entity hierarchy. Component mappers for 4 core types: MeshRenderer (7 primitive shapes), Light (directional/point/spot), Camera (perspective/orthographic), Material (PBR with metalness workflow, roughness->gloss inversion).
- **PBR materials:** StandardMaterial with diffuse, metalness, roughness (inverted to gloss), emissive, opacity. Color conversion from RGB 0-1 to PlayCanvas Color objects.
- **Camera controls:** DOM-based camera controller with fly mode (right-click+WASD) and orbit mode (Alt+click orbit, scroll zoom). Implemented directly rather than through PlayCanvas extras (which require complex InputFrame translation layer).
- **Pipeline verified end-to-end:** ECSON -> Canonical IR compiler -> PlayCanvas adapter -> WebGL viewport. Scene rebuilds on every ECSON change via store subscription.
- **IR conventions documented:** JSDoc in adapter source code covers coordinate system, physics units, roughness, quaternion rotation, 1:N entity-to-node mapping (CF-06 resolved).

**Reference:** 02-02-SUMMARY (adapter + viewport)

**Key files:**
- `packages/adapter-playcanvas/src/adapter.ts`
- `packages/adapter-playcanvas/src/scene-builder.ts`
- `packages/adapter-playcanvas/src/component-mappers/*.ts`
- `packages/adapter-playcanvas/src/camera-controller.ts`
- `apps/editor/src/components/editor/viewport/viewport-canvas.tsx`

### SC-3: "A user can add entities, move/rotate/scale them with gizmos, edit properties in the inspector, reparent in the hierarchy tree, and every edit flows through PatchOps"

**Status: Implemented**

- **Add entities:** Context menu in hierarchy tree offers 8 presets (Empty, Cube, Sphere, Plane, Cylinder, Point Light, Spot Light, Camera). Asset browser provides 12 starter assets with click-to-spawn and drag-to-spawn. All entity creation dispatches CreateEntity + AddComponent PatchOps.
- **Transform gizmos:** GizmoManager wraps PlayCanvas TranslateGizmo/RotateGizmo/ScaleGizmo. Captures transform on drag start, creates SetProperty PatchOp only on drag end (one op per gesture, not per frame). W/E/R keyboard shortcuts for gizmo mode switching.
- **Snap-to-grid:** Configurable grid size and rotation snap. Grid rendered via immediate-mode drawLine API (not mesh entity, avoids selection picking).
- **Inspector panel:** Auto-generates property widgets from component registry editorHints. 7 widget types: SliderField, ColorPicker, Vec3Input, CheckboxField, DropdownField, NumberField, TextboxField. All property edits dispatch SetComponentProperty PatchOps with debounced dispatch for keyboard input.
- **Hierarchy tree:** react-arborist tree with drag-to-reparent dispatching Reparent PatchOp. Multi-select via Ctrl/Cmd-click and Shift-click. Search/filter by entity name.
- **Selection:** Click selection (closest entity via screen-space projection), shift-click multi-select toggle, box/marquee selection with CSS overlay. Bidirectional sync between hierarchy tree and viewport.
- **PatchOps verification:** All mutations flow through PatchOps. Undo stack records every operation. The SetProperty, SetComponentProperty, CreateEntity, DeleteEntity, AddComponent, RemoveComponent, Reparent, and BatchOp types are all exercised.

**Reference:** 02-03-SUMMARY (gizmos), 02-04-SUMMARY (hierarchy + inspector), 02-06-SUMMARY (asset browser)

**Key files:**
- `packages/adapter-playcanvas/src/gizmo-manager.ts`
- `packages/adapter-playcanvas/src/selection-manager.ts`
- `apps/editor/src/components/editor/hierarchy/scene-tree.tsx`
- `apps/editor/src/components/editor/inspector/inspector-panel.tsx`
- `apps/editor/src/components/editor/inspector/component-inspector.tsx`
- `apps/editor/src/hooks/use-keyboard-shortcuts.ts`

### SC-4: "Undo/redo works across all edit types, and auto-save persists the ECSON document"

**Status: Implemented**

- **Undo/redo stacks:** Invertible PatchOp stacks with MAX_UNDO_DEPTH=200. Every dispatchOp pushes inverse to undoStack and clears redoStack. Undo pops from undoStack, applies inverse, pushes original to redoStack. All edit types supported: transform, property, reparent, create/delete, component add/remove.
- **BatchOp atomic undo:** Paste and duplicate operations wrap multiple ops in BatchOp. Single undo reverts entire operation atomically.
- **Keyboard shortcuts:** Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo.
- **Auto-save:** 5-second debounce with immediate save on structural changes (CreateEntity, DeleteEntity, Reparent). Saves to Supabase Postgres (ECSON as JSONB). Also triggers on browser visibility change (tab blur/close).
- **Manual save:** Ctrl+S triggers immediate save via custom DOM event (`riff3d:manual-save`).
- **Save status indicator:** TopBar shows dynamic status: Saved (green checkmark), Saving... (spinner), Unsaved (yellow dot), Error (red exclamation).
- **Browser restore:** Closing and reopening browser restores exact scene state from Supabase. ECSON is loaded server-side and transferred to client via script tag.

**Reference:** 02-05-SUMMARY (undo/redo + save)

**Key files:**
- `apps/editor/src/stores/slices/scene-slice.ts` (undo/redo stacks, dispatchOp)
- `apps/editor/src/lib/clipboard.ts` (copy/paste/duplicate)
- `apps/editor/src/hooks/use-auto-save.ts` (auto-save + manual save)
- `apps/editor/src/stores/slices/save-slice.ts` (save status)
- `apps/editor/src/components/editor/shell/top-bar.tsx` (save indicator)

### SC-5: "Pressing Play transitions to runtime mode without page reload, and Stop returns to editor with edits preserved"

**Status: Implemented**

- **State machine:** play/pause/resume/stop transitions with ECSON snapshot management. Play deep-clones ECSON document. Stop restores from snapshot and triggers scene rebuild.
- **Play controls:** Centered button group in top bar with Play/Pause/Stop buttons. State-dependent rendering (Play button shows when stopped, Pause/Stop show when playing).
- **Visual indicators:** Colored border overlay around viewport (cyan for playing, amber for paused, with glow animation). Top bar background tint changes to indicate play state.
- **Panel collapse:** Left and right panels collapse during play mode. Peekable behavior: hover/click to temporarily reveal, auto-collapse on mouse leave.
- **Keyboard shortcuts:** Ctrl+P / F5 toggle play/stop. Space toggles pause/resume during play mode.
- **Adapter integration:** `setPlayMode(true)` sets timeScale to 1 (runtime). `setPlayMode(false)` sets timeScale to 0 (editor). Grid, gizmo, and selection toggling handled at viewport component level.
- **No page reload:** Transition is entirely in-memory. ECSON snapshot/restore + adapter scene rebuild.
- **Edit preservation:** Stop restores pre-play ECSON snapshot exactly. All edits made before play are preserved. Runtime changes are discarded (discard-all on Stop).

**Reference:** 02-07-SUMMARY (play-test mode)

**Key files:**
- `apps/editor/src/stores/slices/playtest-slice.ts`
- `apps/editor/src/components/editor/playtest/play-controls.tsx`
- `apps/editor/src/components/editor/playtest/play-mode-border.tsx`
- `packages/adapter-playcanvas/src/adapter.ts` (setPlayMode, setTimeScale)

## Carry-Forward Resolution

All Phase 1 carry-forward items have been resolved (except CF-04, which is deferred to Phase 4/7 as planned):

| CF | Description | Resolution | Plan | Evidence |
|----|-------------|------------|------|----------|
| CF-01 | Nightly property tests | Added 4 rotating-seed property tests with 1000 iterations and seed logging for failure reproduction | 02-05 | `packages/patchops/__tests__/nightly-property.test.ts` (guarded by NIGHTLY env var) |
| CF-02 | Lossiness contract tests | Added 29 tests enumerating stripped fields (tags, locked) and asserting all other fields preserved through ECSON->IR->ECSON round-trip | 02-05 | `packages/conformance/__tests__/lossiness-contract.test.ts` |
| CF-03 | Mutation bypass enforcement | Added 7 deep-freeze tests validating direct mutation throws TypeError while PatchOps remain the sanctioned mutation path | 02-05 | `packages/patchops/__tests__/mutation-bypass.test.ts` |
| CF-04 | Non-portable glTF extension fixture coverage | **Deferred to Phase 4/7** (as planned -- requires fixtures for extensions that haven't been promoted to portable status yet) | N/A | N/A |
| CF-05 | Unused eslint-disable directive | Removed from `packages/patchops/src/engine.ts` | 02-01 | Commit 439037e |
| CF-06 | IR convention docs | Added JSDoc documentation in `scene-builder.ts` and `adapter.ts` covering coordinate system, normal maps, physics units, roughness, 1:N entity-to-node mapping | 02-02 | `packages/adapter-playcanvas/src/scene-builder.ts`, `packages/adapter-playcanvas/src/adapter.ts` |

## Requirement Coverage Matrix

All 19 Phase 2 requirements mapped to implementing plans with verification status:

| Requirement | Description | Plan | Status | Verification |
|-------------|-------------|------|--------|--------------|
| EDIT-01 | 3D viewport with orbit/pan/zoom and fly camera | 02-02 | Complete | Fly mode (right-click+WASD), orbit mode (Alt+click), scroll zoom |
| EDIT-02 | Transform gizmos with snap-to-grid | 02-03 | Complete | Translate/Rotate/Scale gizmos, configurable grid snap |
| EDIT-03 | Scene hierarchy tree | 02-04 | Complete | react-arborist tree, drag-to-reparent, multi-select, search |
| EDIT-04 | Inspector panel from component schemas | 02-04 | Complete | Auto-generated from editorHints, 7 widget types |
| EDIT-05 | Undo/redo via invertible PatchOps | 02-05 | Complete | Invertible stacks, MAX_DEPTH=200, all edit types |
| EDIT-06 | Copy/paste/duplicate | 02-05 | Complete | Clipboard with new IDs, BatchOp, internal buffer fallback |
| EDIT-07 | Grid/snap system | 02-03 | Complete | Configurable grid size, rotation snap, immediate-mode rendering |
| EDIT-08 | Save and auto-save | 02-05 | Complete | 5s debounce, structural immediate, Ctrl+S, Supabase persistence |
| EDIT-09 | Asset library with starter assets | 02-06 | Complete | 12 assets in 4 categories, drag-to-spawn, search |
| EDIT-10 | Play-test from editor | 02-07 | Complete | State machine, snapshot/restore, visual indicators, keyboard shortcuts |
| RNDR-01 | PBR materials | 02-02 | Complete | Diffuse, metalness, roughness, emissive, opacity |
| RNDR-02 | Lighting | 02-02 | Complete | Directional, point, spot + ambient, with shadows |
| RNDR-03 | Camera entities | 02-02 | Complete | Perspective and orthographic projections |
| RNDR-04 | GLB/glTF import | 02-06 | Complete | Load, hierarchy walk, material extraction, PatchOp conversion |
| RNDR-05 | Environment settings | 02-06 | Complete | Ambient light, fog, sky color via __environment__ PatchOps |
| ADPT-01 | PlayCanvas adapter | 02-02 | Complete | Full EngineAdapter implementation, IR-only dependency |
| PROJ-01 | User accounts and auth | 02-01 | Complete | Email magic link + social OAuth, Supabase SSR |
| PROJ-02 | Project dashboard | 02-01 | Complete | Card grid, thumbnails, last-modified, empty state |
| PROJ-03 | Shareable project links | 02-01 | Complete | Public toggle, copy link, read-only mode, RLS enforcement |

## Contract Diffs

### PatchOps
- **Added:** `__environment__` virtual entity handling in `applySetProperty` and `validateOp` (routes to `doc` root instead of `doc.entities[id]`). This enables document-level property editing (ambient light, fog, sky) via standard SetProperty PatchOps with full undo/redo support.
- **Breaking:** No. Pure addition. Existing PatchOp behavior unchanged for normal entity IDs.
- **Tests:** All 76 PatchOps tests pass. All 64 conformance tests pass.

### ECSON
- **No schema changes.** Project metadata stored at app/DB layer as `ProjectRecord`, not inside ECSON. `SceneDocument` remains the pure root document consumed by compiler and PatchOps engine. (Per Codex S1 finding and plan review response.)

### Canonical IR
- **No schema changes.** Phase 1 IR already covered scene hierarchy, transforms, mesh-renderer, light, camera, material components.

### Component Registry
- **No changes.** Phase 1 editorHints already existed on all component registrations. Inspector auto-generates widgets from existing editorHints. (Per Codex S3 finding.)

### New Packages
- `packages/adapter-playcanvas` -- implements EngineAdapter interface. Depends only on `@riff3d/canonical-ir` and `playcanvas ~2.16.0`. Architecture boundary enforced (never imports ecson or patchops).

## Tests

### Unit/Integration Tests
- **PatchOps:** 76 tests pass (5 test files, 1 skipped file for nightly)
  - Engine tests: apply, validate, error handling for all 15 op types + BatchOp
  - Inverse tests: apply-inverse identity for all op types
  - Mutation bypass: 7 deep-freeze enforcement tests (CF-03)
- **Conformance:** 64 tests pass (5 test files)
  - Round-trip: 10 tests across all fixtures (ECSON -> IR -> ECSON)
  - Lossiness contract: 29 tests enumerating stripped vs preserved fields (CF-02)
  - Replay determinism: 3 tests (same ops -> same output)
  - Benchmarks: 18 performance budget tests
  - Property-based: 4 fast-check property tests (fixed seed for CI)

### Property-Based Tests
- **Nightly suite:** 4 property tests with 1000 iterations each, rotating seed, NIGHTLY env var guard (CF-01)
- **CI suite:** 4 property tests with 100 iterations, fixed seed=42

### Golden Fixture Updates
- No fixture changes in Phase 2. All 7 golden fixtures (6 clean + 1 adversarial) unchanged and passing.

### Typecheck
- All 11 packages typecheck clean: `pnpm typecheck` passes across ecson, patchops, canonical-ir, conformance, fixtures, adapter-playcanvas, and editor.

### Lint
- All 7 lint-enabled packages pass: `pnpm lint` clean. No warnings or errors.

## Performance

### Test Execution
| Suite | Files | Tests | Duration |
|-------|-------|-------|----------|
| PatchOps | 5 (1 skipped) | 76 (4 skipped) | 512ms |
| Conformance | 5 | 64 | 740ms |

### Compilation Performance
- IR compilation for all fixtures completes within performance budgets (18 benchmark tests pass)
- Full scene rebuild on every ECSON change is acceptable for Phase 2 scene sizes (<100 entities)
- Incremental delta format deferred to Phase 4 (ADPT-03)

### Build Performance
- Turborepo cache hits for all tasks when code unchanged
- `pnpm typecheck`: 46ms (full turbo cache)
- `pnpm test`: 37ms (full turbo cache)

### Regressions
- None identified. All Phase 1 performance budgets maintained.

## Risks and Deferrals

### Known Limitations
1. **Full scene rebuild on every edit** -- Not incremental deltas. Acceptable for Phase 2 scene sizes but will need optimization in Phase 4 (ADPT-03).
2. **GLB import uses local object URLs** -- Supabase Storage upload deferred to collaboration phase. Local files only in Phase 2.
3. **Play mode discards runtime changes** -- "Keep runtime changes" UX deferred to future enhancement. Stop always restores pre-play snapshot.
4. **WebGL2 only** -- WebGPU evaluation deferred to Phase 4+.

### Deferred Items
- CF-04 (non-portable glTF extension fixture coverage) -- deferred to Phase 4/7 as planned
- Supabase Storage for GLB assets -- deferred to Phase 5 (collaboration)
- Incremental adapter updates (property-level deltas) -- Phase 4 (ADPT-03)
- Adapter dependency lint rule -- acknowledged in plan review response but not yet automated (manual enforcement via code review)

### Pre-Execution Review Responses
All S1 findings from Codex plan review were addressed:
1. **PatchOps already exist** -- No redefinition. Used existing ops directly.
2. **ECSON projects wrapper** -- Kept project metadata at app/DB layer. SceneDocument unchanged.
3. **Adapter boundary** -- Enforced manually. No ecson/patchops imports in adapter package.
4. **Zod version skew** -- Stayed on Zod 3.25.x for stability. Docs updated.

## Decisions Requested

None. All Phase 2 architectural decisions were made and documented in STATE.md during execution.

## Phase 2 Execution Metrics

| Plan | Duration | Tasks | Commits | Key Deliverable |
|------|----------|-------|---------|-----------------|
| 02-01 | 29 min | 3 | 3 | Auth, dashboard, editor shell |
| 02-02 | 12 min | 2 | 2 | PlayCanvas adapter, viewport |
| 02-03 | 7 min | 2 | 2 | Gizmos, selection, grid |
| 02-04 | 7 min | 2 | 2 | Hierarchy, inspector |
| 02-05 | 7 min | 2 | 2 | Undo/redo, save, CF tests |
| 02-06 | 10 min | 2 | 2 | Assets, GLB import, environment |
| 02-07 | 5 min | 2 | 2 | Play-test mode |
| **Total** | **77 min** | **15** | **15** | |

Average plan duration: 11.0 min. Total commits: 15 task commits + 7 metadata commits = 22 commits.

## Deviation Summary

Total auto-fixed issues across all plans: 17
- Rule 1 (Bug): 7 fixes
- Rule 2 (Missing Critical): 2 fixes
- Rule 3 (Blocking): 8 fixes
- Rule 4 (Architectural): 0 (none required)

All deviations were necessary for correct operation. No scope creep. Details documented in each plan's SUMMARY.md.
