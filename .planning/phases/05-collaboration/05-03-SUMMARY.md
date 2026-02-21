---
phase: 05-collaboration
plan: 03
subsystem: collaboration, presence, ui
tags: [yjs, awareness, presence, frustum-cone, collaborator-bar, offline-banner, toast, playcanvas, zustand]

# Dependency graph
requires:
  - phase: 05-collaboration
    provides: Yjs CRDT document binding, CollabSlice, awareness-state types (05-02)
  - phase: 02-editor-shell
    provides: TopBar, EditorShell, InspectorPanel, TreeNode components
  - phase: 02-editor-shell
    provides: PlayCanvas adapter with immediate-mode drawing (Grid pattern)
provides:
  - useAwareness hook with join/leave detection and toast notifications
  - useRemoteChanges hook for tracking remote property modifications
  - CollaboratorBar component showing active users with colored initials
  - OfflineBanner component with amber warning when connection lost
  - Hierarchy presence indicators (2px colored border + avatar chips on entity rows)
  - Inspector remote change flash highlights (CSS transition animation)
  - PresenceRenderer class for 3D frustum cone + floating name label rendering
  - collaboratorPresence field in collab-slice for per-user selection/camera state
affects: [05-04-locking, 05-05-avatars, 05-06-review-gate]

# Tech tracking
tech-stack:
  added: []
  patterns: [immediate-mode frustum cone drawing via PlayCanvas drawLine, DOM overlay for 3D-to-2D screen-projected name labels, Zustand subscription for feeding 3D renderer with awareness data, CSS keyframe animation for remote change flash]

key-files:
  created:
    - apps/editor/src/collaboration/hooks/use-awareness.ts
    - apps/editor/src/collaboration/hooks/use-remote-changes.ts
    - apps/editor/src/components/editor/collaboration/collaborator-bar.tsx
    - apps/editor/src/components/editor/collaboration/offline-banner.tsx
    - packages/adapter-playcanvas/src/editor-tools/presence-renderer.ts
  modified:
    - apps/editor/src/components/editor/hierarchy/tree-node.tsx
    - apps/editor/src/components/editor/inspector/inspector-panel.tsx
    - apps/editor/src/components/editor/shell/top-bar.tsx
    - apps/editor/src/components/editor/shell/editor-shell.tsx
    - apps/editor/src/stores/slices/collab-slice.ts
    - apps/editor/src/app/globals.css
    - apps/editor/src/components/editor/viewport/viewport-canvas.tsx
    - packages/adapter-playcanvas/src/editor-tools/index.ts

key-decisions:
  - "DOM overlay approach for name labels (not 3D text) -- simpler, crisp at any zoom, positioned via camera.worldToScreen each frame"
  - "collaboratorPresence Map in collab-slice stores per-user selection/camera/mode from Awareness for hierarchy presence and frustum rendering"
  - "Camera updates throttled to 100ms in useAwareness to avoid flooding Awareness protocol"
  - "Remote change entries auto-clear after 2 seconds for transient flash effect"
  - "PresenceRenderer takes camera entity as constructor param (same pattern as GizmoManager/SelectionManager)"

patterns-established:
  - "Presence data flow: Awareness change -> useAwareness hook -> collab-slice collaboratorPresence -> Zustand subscription -> PresenceRenderer.update()"
  - "Remote change flash: Y.Doc observeDeep -> cross-reference transaction origin with Awareness -> addChange to Map -> CSS animation -> auto-clear timer"
  - "Hierarchy presence: useEntityPresence reads collaboratorPresence Map, filters by selection array, returns matching collaborators for border/chip rendering"

requirements-completed: ["COLLAB-02"]

# Metrics
duration: 9min
completed: 2026-02-20
---

# Phase 5 Plan 3: Presence and Awareness UI Summary

**Collaborator bar, 2D hierarchy presence borders/chips, 3D viewport frustum cones with floating name labels, join/leave toasts, offline banner, and inspector remote change flash highlights**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-21T01:15:25Z
- **Completed:** 2026-02-21T01:24:46Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Built the full 2D presence UI layer: awareness hooks with join/leave toast notifications, collaborator bar showing colored initials in toolbar, offline banner with read-only mode, hierarchy presence indicators (colored borders + avatar chips), and inspector remote change flash highlights
- Created the 3D presence visualization: PresenceRenderer class that draws camera frustum cones using PlayCanvas immediate-mode line API, with DOM-overlay floating name labels positioned via 3D-to-2D screen projection
- Added collaboratorPresence field to collab-slice for per-user selection/camera state, enabling the hierarchy to show which users have each entity selected and the viewport to render remote camera positions

## Task Commits

Each task was committed atomically:

1. **Task 1: Awareness hooks, collaborator bar, join/leave toasts, offline banner, remote change highlights** - `fa5f1d2` (feat)
2. **Task 2: 3D viewport frustum cone presence rendering** - `6963246` (feat)

## Files Created/Modified
- `apps/editor/src/collaboration/hooks/use-awareness.ts` - Hook subscribing to Yjs Awareness changes with join/leave detection and collab-slice sync
- `apps/editor/src/collaboration/hooks/use-remote-changes.ts` - Hook tracking remote Y.Doc property changes with 2s auto-clear
- `apps/editor/src/components/editor/collaboration/collaborator-bar.tsx` - Toolbar component showing active collaborators (max 5, overflow badge)
- `apps/editor/src/components/editor/collaboration/offline-banner.tsx` - Amber warning banner shown when collab connection lost
- `packages/adapter-playcanvas/src/editor-tools/presence-renderer.ts` - 3D frustum cone + name label rendering for remote users
- `apps/editor/src/components/editor/hierarchy/tree-node.tsx` - Added presence indicators (2px colored border, avatar chips)
- `apps/editor/src/components/editor/inspector/inspector-panel.tsx` - Added remote change flash overlay with CSS animation
- `apps/editor/src/components/editor/shell/top-bar.tsx` - Integrated CollaboratorBar in right section
- `apps/editor/src/components/editor/shell/editor-shell.tsx` - Integrated OfflineBanner above viewport
- `apps/editor/src/stores/slices/collab-slice.ts` - Added collaboratorPresence Map and setCollaboratorPresence action
- `apps/editor/src/app/globals.css` - Added remoteFlash CSS keyframe animation
- `apps/editor/src/components/editor/viewport/viewport-canvas.tsx` - Integrated PresenceRenderer with Zustand subscription
- `packages/adapter-playcanvas/src/editor-tools/index.ts` - Exported PresenceRenderer and RemoteUserPresence

## Decisions Made
- Used DOM overlay approach for name labels (not 3D text or pc.Element) -- renders crisp text at any zoom level, positioned via `camera.worldToScreen()` each frame, with `pointer-events: none` container over the canvas
- Camera updates throttled to 100ms in useAwareness to avoid flooding the Awareness protocol with high-frequency position data during smooth camera movement
- PresenceRenderer takes camera entity as a constructor parameter (same pattern as GizmoManager, SelectionManager) rather than finding it by tag at runtime
- Remote change entries stored with userName and color, auto-cleared after 2 seconds via per-entry timers. The flash animation uses a CSS keyframe (`remoteFlash`) that fades from 15% opacity to 0 in 0.5s
- collaboratorPresence uses a Map<userId, {selection, camera, mode}> in the Zustand store rather than tracking raw Awareness client IDs, since the store is the source of truth for UI rendering

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed lucide-react Lock icon title prop type error**
- **Found during:** Task 2 (typecheck)
- **Issue:** TypeScript LSP auto-added lock-related code from plan 05-04 (which had already been executed in a parallel session). The Lock icon received a `title` prop which is not valid on lucide-react icons in this version.
- **Fix:** Wrapped the Lock icon in a `<span>` with the title attribute
- **Files modified:** apps/editor/src/components/editor/hierarchy/tree-node.tsx
- **Verification:** pnpm typecheck passes
- **Committed in:** 6963246 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type fix. No scope creep.

## Issues Encountered
- TypeScript LSP repeatedly auto-injected imports and code from plan 05-04 (entity locking) into tree-node.tsx and inspector-panel.tsx. This happened because 05-04 had been partially executed in a previous session, creating files like `use-entity-locks.ts` and `lock-manager.ts`. The LSP's organize-imports feature added these references on every file save. Resolved by accepting the valid imports (the referenced files exist) and fixing the one type error.

## Next Phase Readiness
- Presence UI complete: all 6 must-have truths addressed (colored cursors in hierarchy, frustum cones in viewport, collaborator bar, join/leave toasts, offline banner, remote change highlights)
- Ready for 05-04 (entity locking): lock-related infrastructure partially exists from parallel session; 05-03 presence infrastructure provides the awareness and collab-slice foundation
- Ready for 05-05 (avatars): PresenceRenderer already handles mode="editor" vs "avatar" branching (avatar mode skipped, ready for future implementation)

## Self-Check: PASSED

All 5 key created files verified present. Both task commits (fa5f1d2, 6963246) verified in git log.

---
*Phase: 05-collaboration*
*Completed: 2026-02-20*
