---
phase: 02-closed-loop-editor
plan: 06
subsystem: editor, 3d-engine, assets
tags: [asset-browser, glb-import, environment, patchops, drag-drop, playcanvas, pbr]

# Dependency graph
requires:
  - phase: 02-02
    provides: "PlayCanvas adapter, ECSON compile pipeline, dispatchOp, environment.ts"
  - phase: 02-04
    provides: "Inspector panel, component inspector widgets (color picker, slider, dropdown, checkbox)"
  - phase: 02-05
    provides: "Undo/redo stacks, clipboard, BatchOp dispatch, auto-save"
provides:
  - "Asset browser panel with 12 starter assets organized by category"
  - "Asset drag-and-drop from browser/strip to viewport via HTML5 DnD"
  - "Compact asset strip below viewport for quick access"
  - "GLB/glTF import pipeline: load, extract hierarchy/materials, convert to PatchOps"
  - "Environment settings panel: ambient light, fog, sky color"
  - "PatchOps __environment__ entity for document-level SetProperty ops"
  - "Viewport request-app event bridge for cross-component PlayCanvas access"
affects: [02-07, 02-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "StarterAsset catalog pattern: typed asset definitions with createOps() factory"
    - "ASSET_DRAG_MIME custom type for drag-and-drop identification"
    - "Custom DOM event bridge (riff3d:request-app / riff3d:provide-app) for cross-component adapter access"
    - "__environment__ virtual entity ID for document-level SetProperty PatchOps"
    - "Parameters<typeof fn>[0] type extraction for cross-package type boundaries"

key-files:
  created:
    - "apps/editor/src/lib/asset-manager.ts"
    - "apps/editor/src/components/editor/assets/asset-browser.tsx"
    - "apps/editor/src/components/editor/assets/asset-card.tsx"
    - "apps/editor/src/components/editor/assets/asset-strip.tsx"
    - "apps/editor/src/components/editor/assets/glb-import.tsx"
    - "apps/editor/src/lib/glb-to-ecson.ts"
    - "packages/adapter-playcanvas/src/glb-loader.ts"
    - "apps/editor/src/components/editor/inspector/widgets/environment-panel.tsx"
  modified:
    - "apps/editor/src/components/editor/shell/editor-shell.tsx"
    - "apps/editor/src/components/editor/inspector/inspector-panel.tsx"
    - "apps/editor/src/components/editor/viewport/viewport-canvas.tsx"
    - "packages/adapter-playcanvas/src/index.ts"
    - "packages/adapter-playcanvas/src/environment.ts"
    - "packages/patchops/src/engine.ts"
    - "packages/patchops/src/validation.ts"

key-decisions:
  - "Custom DOM event bridge for GLB import to access PlayCanvas app (avoids tight coupling to viewport context)"
  - "__environment__ virtual entity ID enables environment edits via standard SetProperty PatchOps with full undo/redo"
  - "Local object URL for GLB loading in Phase 2 (Supabase Storage upload deferred to collaboration phase)"
  - "Environment panel shown in inspector when no entity selected (common editor UX pattern)"

patterns-established:
  - "StarterAsset.createOps(parentId) returns BatchOp-ready PatchOp array for any asset type"
  - "ASSET_DRAG_MIME data transfer type distinguishes asset drops from other drag events"
  - "Environment edits use __environment__ entityId + environment.* path for document-level properties"
  - "Viewport riff3d:request-app / riff3d:provide-app event handshake for PlayCanvas app access"

requirements-completed: [EDIT-09, RNDR-04, RNDR-05]

# Metrics
duration: 10min
completed: 2026-02-19
---

# Phase 2 Plan 6: Asset Browser, GLB Import, Environment Settings Summary

**Asset browser with 12 starter assets and drag-to-spawn, GLB import pipeline with material extraction, and environment settings panel with ambient/fog/sky controls via PatchOps**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-20T04:31:52Z
- **Completed:** 2026-02-20T04:41:29Z
- **Tasks:** 2
- **Files modified:** 15 (8 created + 7 modified)

## Accomplishments

- Complete asset browser panel with 12 starter assets in 4 categories (primitives, lights, cameras, other), search filter, and click-to-spawn via BatchOp
- Compact asset strip below viewport for quick drag-and-drop access to most-used assets
- HTML5 drag-and-drop from browser/strip to viewport spawns entities via PatchOps
- GLB/glTF import pipeline: PlayCanvas loads and instantiates GLB, walker extracts hierarchy/transforms/materials, converter maps to CreateEntity + AddComponent PatchOps
- Environment settings panel in inspector (shown when nothing selected): ambient light color/intensity, fog toggle/type/color/density, sky color
- PatchOps engine extended with `__environment__` virtual entity for document-level SetProperty ops with full undo/redo support
- All existing tests pass (76 patchops + 64 conformance)

## Task Commits

Each task was committed atomically:

1. **Task 1: Asset browser, starter assets, and asset strip** - `04842a9` (feat)
2. **Task 2: GLB import and environment settings** - `b5a2a98` (feat)

## Files Created/Modified

### Asset System (apps/editor)
- `src/lib/asset-manager.ts` - StarterAsset type, 12-asset catalog, category grouping, strip asset IDs
- `src/components/editor/assets/asset-browser.tsx` - Full asset browser panel with categories, search, GLB import button
- `src/components/editor/assets/asset-card.tsx` - Draggable asset card with Lucide icons, click and drag-to-spawn
- `src/components/editor/assets/asset-strip.tsx` - Compact horizontal strip below viewport for quick access
- `src/components/editor/assets/glb-import.tsx` - GLB file picker, PlayCanvas loading, PatchOp conversion, toast notifications

### GLB Import Pipeline
- `packages/adapter-playcanvas/src/glb-loader.ts` - PlayCanvas GLB loading, hierarchy walking, material extraction
- `apps/editor/src/lib/glb-to-ecson.ts` - GLB hierarchy to CreateEntity + AddComponent PatchOp conversion
- `packages/adapter-playcanvas/src/index.ts` - Added GLB loader exports

### Environment Settings
- `apps/editor/src/components/editor/inspector/widgets/environment-panel.tsx` - Ambient light, fog, sky color editors
- `apps/editor/src/components/editor/inspector/inspector-panel.tsx` - Shows environment panel when no entity selected

### Infrastructure
- `apps/editor/src/components/editor/shell/editor-shell.tsx` - Mounted AssetBrowser, AssetStrip, viewport drop handler
- `apps/editor/src/components/editor/viewport/viewport-canvas.tsx` - Request-app event bridge for GLB import
- `packages/patchops/src/engine.ts` - __environment__ entity handling in applySetProperty
- `packages/patchops/src/validation.ts` - __environment__ bypass in SetProperty validation
- `packages/adapter-playcanvas/src/environment.ts` - Minor documentation update

## Decisions Made

1. **Custom DOM event bridge for GLB import** - The GLB import button needs the PlayCanvas Application instance to load .glb files, but it lives outside the ViewportProvider context. Instead of prop drilling or global state, used `riff3d:request-app` / `riff3d:provide-app` custom DOM events for a clean decoupled handshake.

2. **__environment__ virtual entity ID** - Environment settings like ambient light and fog need to be edited via SetProperty PatchOps for undo/redo support, but they're on the document root, not on entities. Introduced a `__environment__` virtual entity ID that the PatchOps engine routes to `doc` instead of `doc.entities[id]`. This reuses the existing SetProperty infrastructure without a new op type.

3. **Local object URL for GLB in Phase 2** - The plan specified Supabase Storage upload, but collaboration isn't active yet. Deferred remote upload to the collaboration phase; Phase 2 loads GLB files via `URL.createObjectURL()` locally.

4. **Environment panel in inspector** - Following the common editor pattern (Unity, Blender), environment settings are shown in the inspector when no entity is selected, rather than as a separate activity bar tab. This avoids adding another panel and uses existing UI real estate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] PatchOps engine __environment__ entity handling**
- **Found during:** Task 2 (Environment panel)
- **Issue:** The PatchOps engine's SetProperty handler always looks up `doc.entities[entityId]`, which fails for document-level environment properties. No mechanism existed to edit `doc.environment.*` via PatchOps.
- **Fix:** Added `__environment__` virtual entity handling to both `validateOp` (bypass entity existence check) and `applySetProperty` (route to `doc` instead of `doc.entities[id]`).
- **Files modified:** `packages/patchops/src/engine.ts`, `packages/patchops/src/validation.ts`
- **Verification:** `pnpm test --filter @riff3d/patchops` -- all 76 tests pass. `pnpm test --filter @riff3d/conformance` -- all 64 tests pass.
- **Committed in:** b5a2a98

**2. [Rule 3 - Blocking] GLB import cross-package type boundary**
- **Found during:** Task 2 (GLB import component)
- **Issue:** The editor package doesn't import PlayCanvas types directly (architecture boundary). `importGlb` expects `pc.Application` but the app instance obtained via DOM event is typed as `unknown`.
- **Fix:** Used `Parameters<typeof importGlb>[0]` type extraction to safely assert the type without importing PlayCanvas.
- **Files modified:** `apps/editor/src/components/editor/assets/glb-import.tsx`
- **Verification:** `pnpm typecheck --filter @riff3d/editor` passes.
- **Committed in:** b5a2a98

**3. [Rule 3 - Blocking] Deferred Supabase Storage upload to collaboration phase**
- **Found during:** Task 2 (GLB import)
- **Issue:** Plan specified uploading to Supabase Storage then loading from URL, but collaboration isn't active and local editing doesn't need remote storage.
- **Fix:** Used `URL.createObjectURL()` for local file loading instead. Supabase upload will be added when collaboration requires remote asset sharing.
- **Files modified:** `apps/editor/src/components/editor/assets/glb-import.tsx`
- **Verification:** Import flow works with local files.
- **Committed in:** b5a2a98

---

**Total deviations:** 3 auto-fixed (1 missing critical, 2 blocking)
**Impact on plan:** All fixes necessary for correctness and type safety. The __environment__ entity is a clean architectural addition. Supabase deferral is appropriate scope management. No scope creep.

## Issues Encountered

- The adapter package only exposes a `"."` export path, not subpath exports like `./src/glb-loader`. Imports from the editor must go through the barrel `@riff3d/adapter-playcanvas`, which means all types from the GLB loader need to be re-exported from `index.ts`.
- JSX lint error for unescaped quotes in search "no results" text -- fixed with HTML entities (`&ldquo;` / `&rdquo;`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Asset browser and GLB import ready for user testing
- Environment settings editable with full undo/redo support
- All infrastructure in place for 02-07 (play-test mode) and 02-08
- Starter asset catalog extensible for future asset types (physics bodies, audio sources)
- GLB import pipeline ready for Supabase Storage integration when collaboration is added

## Self-Check: PASSED

All 8 created files verified present. Both task commits (04842a9, b5a2a98) verified in git log. All tests pass (76 patchops + 64 conformance).

---
*Phase: 02-closed-loop-editor, Plan: 06*
*Completed: 2026-02-19*
