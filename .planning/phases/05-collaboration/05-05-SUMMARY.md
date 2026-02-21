---
phase: 05-collaboration
plan: 05
subsystem: collaboration, presence, viewport
tags: [avatar, capsule, wasd, ground-plane, playcanvas, awareness, presence-mode, pointer-lock]

# Dependency graph
requires:
  - phase: 05-collaboration
    provides: Yjs Awareness protocol, collab-slice, presence-state types, PresenceRenderer (05-02, 05-03)
  - phase: 02-editor-shell
    provides: PlayCanvas adapter with CameraController, viewport-canvas, TopBar, Zustand store
provides:
  - AvatarController class for FPS-style WASD ground-plane movement in avatar mode
  - AvatarRenderer class for colored capsule + floating name label rendering of remote avatars
  - Avatar mode toggle button in TopBar (visible when collaborating, disabled during play)
  - isAvatarMode/toggleAvatarMode/setAvatarMode in viewport-slice
  - CameraController enable/disable methods for avatar mode handoff
  - Presence mode switching between frustum cone (editor) and capsule (avatar)
affects: [05-06-review-gate]

# Tech tracking
tech-stack:
  added: []
  patterns: [pointer-lock for FPS mouse look, CameraController enable/disable for mode handoff, dual-renderer pattern (PresenceRenderer + AvatarRenderer) filtering by mode]

key-files:
  created:
    - apps/editor/src/collaboration/avatar-controller.ts
    - packages/adapter-playcanvas/src/editor-tools/avatar-renderer.ts
  modified:
    - apps/editor/src/stores/slices/viewport-slice.ts
    - apps/editor/src/components/editor/shell/top-bar.tsx
    - apps/editor/src/components/editor/viewport/viewport-canvas.tsx
    - packages/adapter-playcanvas/src/adapter.ts
    - packages/adapter-playcanvas/src/editor-tools/camera-controller.ts
    - packages/adapter-playcanvas/src/editor-tools/index.ts

key-decisions:
  - "CameraController enable/disable pattern for avatar mode handoff -- disabling input handlers and update loop rather than disposing/recreating"
  - "Pointer lock for smooth FPS mouse look in avatar mode, with ESC to exit and click to re-lock"
  - "Dual-renderer pattern: both PresenceRenderer and AvatarRenderer receive the full remote user list, each filters by mode internally"
  - "AvatarController is editor-layer code (not adapter package) using minimal interface types to avoid PlayCanvas dependency"
  - "Capsule dimensions: 0.3m radius, 1.8m height, alpha 0.7 -- human-scale semi-transparent avatar"

patterns-established:
  - "Avatar mode data flow: TopBar toggle -> viewport-slice isAvatarMode -> viewport-canvas subscription -> CameraController.disable() + AvatarController.enable() + Awareness mode update"
  - "Presence mode switching: Awareness mode field drives renderer selection. PresenceRenderer skips avatar-mode users, AvatarRenderer skips editor-mode users"

requirements-completed: ["COLLAB-04"]

# Metrics
duration: 6min
completed: 2026-02-20
---

# Phase 5 Plan 5: Collaborative Avatars Summary

**WASD ground-plane avatar controller with capsule rendering, presence mode switching between frustum cones and embodied capsules, and toolbar toggle for avatar mode**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-21T01:30:26Z
- **Completed:** 2026-02-21T01:36:45Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Built AvatarController with FPS-style WASD ground-plane movement, pointer lock mouse look, and throttled Awareness position broadcasting at 100ms intervals
- Created AvatarRenderer that draws colored semi-transparent capsules (0.3m radius, 1.8m height, 0.7 alpha) with floating name labels for remote users in avatar mode
- Added avatar mode toggle button to TopBar toolbar (visible when collaborating, disabled during play), with CameraController enable/disable handoff for seamless mode switching

## Task Commits

Each task was committed atomically:

1. **Task 1: Avatar mode toggle, WASD controller, and Awareness broadcast** - `13fd642` (feat)
2. **Task 2: Remote avatar capsule rendering and presence mode switching** - `992be54` (feat)

## Files Created/Modified
- `apps/editor/src/collaboration/avatar-controller.ts` - WASD ground-plane movement controller with pointer lock, 5 m/s walk speed, camera at head height (1.7m)
- `packages/adapter-playcanvas/src/editor-tools/avatar-renderer.ts` - Colored capsule mesh + floating name label rendering for remote avatar users
- `apps/editor/src/stores/slices/viewport-slice.ts` - Added isAvatarMode, toggleAvatarMode, setAvatarMode to viewport state
- `apps/editor/src/components/editor/shell/top-bar.tsx` - Avatar toggle button with PersonStanding/Eye icons, violet active state
- `apps/editor/src/components/editor/viewport/viewport-canvas.tsx` - Integrated AvatarRenderer + AvatarController with store subscriptions
- `packages/adapter-playcanvas/src/adapter.ts` - Added getCameraController() public method for avatar mode handoff
- `packages/adapter-playcanvas/src/editor-tools/camera-controller.ts` - Added enable/disable/isEnabled methods with input state cleanup
- `packages/adapter-playcanvas/src/editor-tools/index.ts` - Exported AvatarRenderer

## Decisions Made
- Used CameraController enable/disable pattern rather than dispose/recreate -- simpler lifecycle, preserves controller state for seamless restore when exiting avatar mode
- AvatarController uses minimal interface types (AvatarCameraHandle, AvatarAppHandle) to avoid direct PlayCanvas dependency in the editor layer, maintaining clean architectural boundaries
- Pointer lock requested on avatar mode entry for smooth FPS mouse look; ESC exits pointer lock, click re-locks
- Both renderers (presence + avatar) receive the same full remote user list each frame; each filters by mode internally. This avoids splitting the data flow and keeps the subscription logic simple
- Capsule positioned at Y = capsuleHeight/2 on the ground plane, with name label at Y = 2.1m for visibility above the capsule top

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 collaboration plans (05-01 through 05-05) executed; ready for 05-06 review gate
- Avatar mode fully integrated with existing presence system (mode switching, awareness broadcast, dual rendering)
- PresenceRenderer already handled avatar-mode filtering since 05-03 (skips avatar users); now AvatarRenderer handles them

## Self-Check: PASSED

All key files verified present:
- apps/editor/src/collaboration/avatar-controller.ts: FOUND
- packages/adapter-playcanvas/src/editor-tools/avatar-renderer.ts: FOUND

Both task commits verified in git log:
- 13fd642: FOUND
- 992be54: FOUND

---
*Phase: 05-collaboration*
*Completed: 2026-02-20*
