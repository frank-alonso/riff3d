---
phase: 05-collaboration
plan: 04
subsystem: collaboration, locking, editor-ui
tags: [yjs, awareness, entity-locking, hierarchy, inspector, viewport, wireframe, playcanvas]

# Dependency graph
requires:
  - phase: 05-collaboration
    provides: Yjs CRDT document binding with Awareness state types and CollaborationProvider (05-02)
  - phase: 05-collaboration
    provides: Presence UI hooks and collaborator bar (05-03)
provides:
  - Entity lock manager with hierarchical propagation via Awareness state
  - Lock guard on dispatchOp preventing edits to entities locked by other users
  - Auto-release locks on deselect via setSelection integration
  - useEntityLocks React hook for lock state queries and lock/unlock actions
  - Lock icons in hierarchy tree (lock/unlock/hover-to-lock)
  - Read-only inspector banner with disabled inputs for locked entities
  - LockRenderer for colored wireframe bounding boxes in 3D viewport
affects: [05-05-avatars, 05-06-review-gate]

# Tech tracking
tech-stack:
  added: []
  patterns: [Awareness-based ephemeral locks (auto-clear on disconnect), hierarchical lock propagation via BFS tree walk, cross-slice lock access via _lockAwareness field, immediate-mode AABB wireframe drawing for lock visualization]

key-files:
  created:
    - apps/editor/src/collaboration/lock-manager.ts
    - apps/editor/src/collaboration/hooks/use-entity-locks.ts
    - packages/adapter-playcanvas/src/editor-tools/lock-renderer.ts
  modified:
    - apps/editor/src/stores/slices/scene-slice.ts
    - apps/editor/src/stores/slices/collab-slice.ts
    - apps/editor/src/collaboration/provider.tsx
    - apps/editor/src/components/editor/hierarchy/tree-node.tsx
    - apps/editor/src/components/editor/inspector/inspector-panel.tsx
    - apps/editor/src/components/editor/viewport/viewport-canvas.tsx
    - packages/adapter-playcanvas/src/editor-tools/index.ts

key-decisions:
  - "Locks stored in Yjs Awareness state (ephemeral), not Y.Doc -- auto-clears on disconnect without explicit cleanup"
  - "Cross-slice lock access via _lockAwareness field on collab-slice, avoiding direct yjs import in scene-slice"
  - "BFS descendant walk for hierarchical lock propagation (locks parent + all children)"
  - "AABB wireframe approach for viewport lock tint (avoids modifying entity materials, non-destructive)"
  - "getOpTargetEntityId helper extracts entity ID from PatchOp for lock guard without importing PatchOp types"

patterns-established:
  - "Lock guard pattern: dispatchOp checks _lockAwareness for entity lock before applying op"
  - "Auto-release pattern: setSelection compares previous vs new selection, releases locks on deselected entities"
  - "LockRenderer immediate-mode pattern: draws wireframe AABB each frame via app.drawLines(), same pattern as Grid"

requirements-completed: ["COLLAB-03"]

# Metrics
duration: 11min
completed: 2026-02-20
---

# Phase 5 Plan 4: Entity Locking Summary

**Awareness-based entity locking with hierarchical propagation, dispatchOp lock guard, auto-release on deselect/disconnect, lock UI in hierarchy/inspector/viewport**

## Performance

- **Duration:** 11 min
- **Started:** 2026-02-21T01:15:30Z
- **Completed:** 2026-02-21T01:26:34Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Built entity lock manager using Yjs Awareness state with hierarchical propagation (locking a parent locks all descendants via BFS tree walk)
- Added dispatchOp lock guard that rejects PatchOps targeting entities locked by other users, and auto-release on deselect in setSelection
- Created LockRenderer for colored wireframe AABB bounding boxes in the 3D viewport for locked entities
- Integrated lock state throughout the editor: hierarchy lock icons, read-only inspector banner, viewport wireframes

## Task Commits

Each task was committed atomically:

1. **Task 1: Lock manager with hierarchical propagation and Awareness-based registry** - `6cd502d` (feat)
2. **Task 2: Lock UI in hierarchy, read-only inspector, and viewport lock tint** - `2778ba9` (feat)

## Files Created/Modified
- `apps/editor/src/collaboration/lock-manager.ts` - Core lock API: acquireLock, releaseLock, isEntityLocked, getLockedEntities, getOpTargetEntityId
- `apps/editor/src/collaboration/hooks/use-entity-locks.ts` - React hook for lock state with awareness change subscription
- `packages/adapter-playcanvas/src/editor-tools/lock-renderer.ts` - Wireframe AABB drawing in lock holder's color via immediate-mode drawLines
- `apps/editor/src/stores/slices/scene-slice.ts` - Lock guard in dispatchOp, auto-release in setSelection
- `apps/editor/src/stores/slices/collab-slice.ts` - _lockAwareness field and AwarenessLike type import
- `apps/editor/src/collaboration/provider.tsx` - Sets _lockAwareness on sync, clears on cleanup
- `apps/editor/src/components/editor/hierarchy/tree-node.tsx` - Lock/unlock icons, hover-to-lock button (committed in 05-03 forward pass)
- `apps/editor/src/components/editor/inspector/inspector-panel.tsx` - "Locked by [name]" banner, pointer-events-none disabled state (committed in 05-03 forward pass)
- `apps/editor/src/components/editor/viewport/viewport-canvas.tsx` - LockRenderer initialization and awareness subscription (committed in 05-03 forward pass)
- `packages/adapter-playcanvas/src/editor-tools/index.ts` - Export LockRenderer (committed in 05-03 forward pass)

## Decisions Made
- Locks use Awareness state (not Y.Doc) because they are ephemeral by nature -- the Awareness protocol automatically clears state when a user disconnects, providing free auto-release without custom cleanup logic.
- Cross-slice lock access uses `_lockAwareness` field on collab-slice rather than importing yjs directly in scene-slice. This preserves the dependency boundary where scene-slice never imports collaboration libraries directly.
- BFS tree walk for descendant collection ensures parents are always checked before children and avoids stack overflow on deep hierarchies.
- AABB wireframe approach for viewport lock tint chosen over emissive material modification because it is non-destructive (doesn't modify entity materials), simpler to implement, and follows the established immediate-mode drawing pattern from Grid.
- The `getOpTargetEntityId` helper handles the `__environment__` virtual entity by returning null (environment edits are never lockable since they are document-level, not entity-level).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added on/off methods to AwarenessLike interface**
- **Found during:** Task 1 (typecheck)
- **Issue:** The useEntityLocks hook calls `awareness.on("change", ...)` and `awareness.off(...)` but the AwarenessLike interface only had getStates/clientID/setLocalStateField/getLocalState
- **Fix:** Added `on` and `off` method signatures to AwarenessLike interface
- **Files modified:** apps/editor/src/collaboration/lock-manager.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** 6cd502d (Task 1 commit)

**2. [Rule 1 - Bug] Fixed PlayCanvas BoundingBox.getMin() API usage**
- **Found during:** Task 2 (typecheck)
- **Issue:** Used `aabb.getMin(outVec)` but PlayCanvas getMin() takes no arguments and returns a Vec3
- **Fix:** Changed to `const min = aabb.getMin()` (return value instead of out parameter)
- **Files modified:** packages/adapter-playcanvas/src/editor-tools/lock-renderer.ts
- **Verification:** pnpm typecheck passes

**3. [Rule 1 - Bug] Fixed drawLines API -- Vec3[] not number[]**
- **Found during:** Task 2 (typecheck)
- **Issue:** Used `number[]` for positions and colors, but PlayCanvas drawLines expects `Vec3[]` for positions and `Color | Color[]` for colors
- **Fix:** Changed to push Vec3 instances to positions array and pass single Color for uniform color
- **Files modified:** packages/adapter-playcanvas/src/editor-tools/lock-renderer.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** 2778ba9 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All type-level fixes for correct PlayCanvas API usage. No scope creep.

## Issues Encountered

**05-03 forward pass included 05-04 UI code:** The 05-03 plan execution had already committed lock UI code in tree-node.tsx, inspector-panel.tsx, viewport-canvas.tsx, and editor-tools/index.ts. This meant Task 2's hierarchy/inspector modifications were already in place. The lock-renderer.ts file itself was the only new Task 2 artifact, along with the viewport wiring that 05-03 had pre-referenced.

## User Setup Required
None - entity locking uses the same Hocuspocus/Yjs infrastructure from 05-02.

## Next Phase Readiness
- Entity locking complete: acquire, propagate, display, prevent edits, auto-release
- Ready for 05-05 (collaborative avatars): lock state flows through Awareness alongside presence
- Ready for 05-06 (review gate): COLLAB-03 requirement satisfied

## Self-Check: PASSED

All key files verified present. Both task commits (6cd502d, 2778ba9) verified in git log.

---
*Phase: 05-collaboration*
*Completed: 2026-02-20*
