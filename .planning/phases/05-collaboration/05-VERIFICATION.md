---
phase: 05-collaboration
verified: 2026-02-21T02:15:00Z
status: gaps_found
score: 4/5 success criteria verified
gaps:
  - truth: "Two users editing the same scene see each other's changes appear within 2 seconds, with colored cursors and name labels visible in both the 2D panels and 3D viewport"
    status: partial
    reason: "All infrastructure is implemented and wired correctly. Cannot verify the 2-second latency bound or visual fidelity programmatically -- requires two live browser sessions connected to a running Hocuspocus server."
    artifacts: []
    missing:
      - "Human verification: open two browser sessions against running collab server, edit in one, observe 2s bound in the other"
  - truth: "Phase 5 review gate (05-06) has not been executed"
    status: failed
    reason: "05-06-SUMMARY.md does not exist. The post-execution review plan (05-06) was never run. No PHASE_5_EVIDENCE.md exists in .planning/reviews/phase-5/. The phase cannot be formally closed without this gate."
    artifacts:
      - path: ".planning/reviews/phase-5/PHASE_5_EVIDENCE.md"
        issue: "File does not exist -- evidence packet not compiled"
      - path: ".planning/phases/05-collaboration/05-06-SUMMARY.md"
        issue: "File does not exist -- plan 05-06 never executed"
    missing:
      - "Execute plan 05-06: compile evidence packet, run Codex post-execution review, obtain gate decision"
human_verification:
  - test: "Real-time sync latency (COLLAB-01 success criterion 1)"
    expected: "Edit in tab A, change appears in tab B within 2 seconds"
    why_human: "Requires live Hocuspocus server, two authenticated browser sessions, and wall-clock timing measurement"
  - test: "Concurrent property merge (COLLAB-05 success criterion 2)"
    expected: "User A edits transform, User B edits material simultaneously on same entity -- both edits preserved"
    why_human: "Requires two simultaneous browser sessions and CRDT merge inspection"
  - test: "Colored cursors and name labels in 2D hierarchy and 3D viewport (COLLAB-02)"
    expected: "User A's selection shows colored border and avatar chip in User B's hierarchy; frustum cone with name label visible in User B's viewport"
    why_human: "Visual behavior requiring two live sessions"
  - test: "Entity locking UI end-to-end (COLLAB-03)"
    expected: "User A locks entity, User B sees lock icon, User B's inspector is read-only, colored wireframe appears in viewport"
    why_human: "Multi-user visual interaction requiring live sessions"
  - test: "Avatar mode (COLLAB-04)"
    expected: "User A toggles avatar mode, User B sees colored capsule with name label moving via WASD"
    why_human: "3D rendering and movement requiring live sessions"
  - test: "Independent undo stacks (COLLAB-01/05)"
    expected: "User A undoes only User A's change, User B's edit unaffected"
    why_human: "Requires two sessions with interleaved edits and undo operations"
---

# Phase 5: Collaboration Verification Report

**Phase Goal:** Two or more users can edit the same project simultaneously with real-time presence, conflict resolution, and independent undo stacks
**Verified:** 2026-02-21T02:15:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Two users editing the same scene see each other's changes within 2 seconds, colored cursors and name labels in 2D panels and 3D viewport | ? UNCERTAIN | Infrastructure fully wired (sync-bridge.ts, provider.tsx, presence-renderer.ts, collaborator-bar.tsx). Cannot verify latency or visual appearance programmatically. |
| 2 | When two users edit different properties of the same entity simultaneously, both edits are preserved | ? UNCERTAIN | Nested Y.Map architecture verified in sync-bridge.ts (per-property CRDT keys). Merge correctness requires live two-session test. |
| 3 | A user can lock an entity and descendants for exclusive editing; others see visual lock indicator and cannot modify locked objects | ✓ VERIFIED | lock-manager.ts (acquireLock with BFS descendant walk, awareness storage), use-entity-locks.ts, tree-node.tsx (lock icons), inspector-panel.tsx (isLockedByOther read-only gate), lock-renderer.ts (AABB wireframe), dispatchOp lock guard in scene-slice.ts (line 160). |
| 4 | A user can walk around the 3D scene as an embodied avatar; other users see avatar moving in real-time | ✓ VERIFIED | avatar-controller.ts (WASD, pointer lock, 5 m/s, ground plane Y=0), avatar-renderer.ts (CapsuleGeometry 0.3m radius 1.8m height), viewport-canvas.tsx (AvatarRenderer wired), top-bar.tsx (toggleAvatarMode button), awareness setLocalStateField mode='avatar' at viewport-canvas.tsx line 471. |
| 5 | Each user has an independent undo stack -- undoing on one client does not undo another user's operations | ✓ VERIFIED | Y.UndoManager created with captureTimeout:0 and trackedOrigins: new Set([ORIGIN_LOCAL]) in provider.tsx lines 126-132. scene-slice.ts delegates to collabUndoManager when collab active (lines 228-230). |

**Score:** 3/5 truths fully verified, 2/5 require human testing (all automated infrastructure verified, behavior not testable programmatically)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `servers/collab/src/server.ts` | Hocuspocus server with auth and persistence hooks | ✓ VERIFIED | 60 LoC. createCollabServer() with onAuthenticate (JWT verify, project access check), onDisconnect, Database extension. Substantive. |
| `servers/collab/src/auth.ts` | Supabase JWT verification, color assignment | ✓ VERIFIED | 95 LoC. createAuthHandler() calls supabase.auth.getUser(), project access check, 12-color PRESENCE_PALETTE. Substantive. |
| `servers/collab/src/persistence.ts` | Y.Doc binary -> collab_documents, decoded ECSON -> projects | ✓ VERIFIED | 136 LoC. fetch() loads from collab_documents, store() upserts and syncs ECSON back to projects table. Substantive. |
| `apps/editor/src/collaboration/sync-bridge.ts` | Bidirectional ECSON <-> Y.Doc sync with origin tagging | ✓ VERIFIED | 276 LoC. initializeYDoc, syncToYDoc (nested Y.Maps), yDocToEcson, observeRemoteChanges with ORIGIN_LOCAL skip logic. Substantive. |
| `apps/editor/src/collaboration/provider.tsx` | React context with HocuspocusProvider, Y.Doc, Awareness | ✓ VERIFIED | 265 LoC. CollaborationProvider with full lifecycle: Supabase session token, HocuspocusProvider, onSynced (Y.Doc init vs load), onStatus (offline/reconnect), Y.UndoManager creation, onAfterDispatch registration. Substantive. |
| `apps/editor/src/stores/slices/collab-slice.ts` | Collab state: connected, synced, userColor, collaborators, undoManager | ✓ VERIFIED | 119 LoC. Full slice with isCollaborating, isConnected, isSynced, isOffline, collabUndoManager, onAfterDispatch, _lockAwareness, collaboratorPresence. Substantive. |
| `apps/editor/src/collaboration/hooks/use-awareness.ts` | Hook for subscribing to Yjs Awareness state changes | ✓ VERIFIED | 131 LoC. awareness.on('change') subscription, join/leave detection with toast, collab-slice sync. Exports useAwareness. |
| `apps/editor/src/components/editor/collaboration/collaborator-bar.tsx` | Toolbar component showing active collaborators | ✓ VERIFIED | Renders colored initials, max 5 + overflow badge, uses useEditorStore for collaborators. |
| `apps/editor/src/components/editor/collaboration/offline-banner.tsx` | Offline status banner component | ✓ VERIFIED | Amber banner, isOffline + isCollaborating gate, exports OfflineBanner. |
| `packages/adapter-playcanvas/src/editor-tools/presence-renderer.ts` | 3D frustum cone + name label rendering | ✓ VERIFIED | 260 LoC. Draws 8 lines per frustum cone (4 to corners + 4 connecting). DOM overlay name labels via worldToScreen. Skips mode='avatar' users. |
| `apps/editor/src/collaboration/lock-manager.ts` | Lock acquisition, release, hierarchical propagation, Awareness registry | ✓ VERIFIED | 342 LoC. acquireLock (BFS descendants, ancestor checks), releaseLock, isEntityLocked (direct + inherited), getLockedEntities, getOpTargetEntityId. |
| `apps/editor/src/collaboration/hooks/use-entity-locks.ts` | Hook for lock state queries and lock/unlock actions | ✓ VERIFIED | Exists. |
| `packages/adapter-playcanvas/src/editor-tools/lock-renderer.ts` | Colored wireframe AABB on locked entities | ✓ VERIFIED | 185 LoC. app.drawLines() for 12 edges of BoundingBox. Immediate-mode pattern. |
| `apps/editor/src/collaboration/avatar-controller.ts` | WASD ground-plane movement controller | ✓ VERIFIED | 329 LoC. WALK_SPEED=5, HEAD_HEIGHT=1.7, GROUND_Y=0, pointer lock, per-frame WASD with yaw rotation, throttled Awareness broadcast at 100ms. |
| `packages/adapter-playcanvas/src/editor-tools/avatar-renderer.ts` | Capsule mesh + name label for remote avatars | ✓ VERIFIED | 308 LoC. CapsuleGeometry (0.3m radius, 1.8m height), semi-transparent alpha 0.7, floating name labels, mode='avatar' filter. |
| `.planning/reviews/phase-5/PHASE_5_EVIDENCE.md` | Evidence packet for Codex post-execution review | ✗ MISSING | File does not exist. Plan 05-06 has not been executed. |
| `.planning/phases/05-collaboration/05-06-SUMMARY.md` | Plan 05-06 completion record | ✗ MISSING | File does not exist. Plan 05-06 has not been executed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| scene-slice.ts dispatchOp | sync-bridge.ts syncToYDoc | onAfterDispatch callback (ORIGIN_LOCAL) | ✓ WIRED | scene-slice.ts lines 209-217: reads onAfterDispatch from store, calls with entityId after PatchOp. provider.tsx sets this callback. |
| sync-bridge.ts observeRemoteChanges | scene-slice.ts loadProject | Y.Doc observer -> yDocToEcson -> loadProject (ORIGIN_REMOTE skip) | ✓ WIRED | provider.tsx lines 112-116: observeRemoteChanges callback calls editorStore.getState().loadProject(ecson). Skip logic via ORIGIN_LOCAL/ORIGIN_INIT in handleEvent. |
| provider.tsx | servers/collab/src/server.ts | HocuspocusProvider WebSocket with Supabase JWT | ✓ WIRED | provider.tsx line 90: token: session.access_token. Server onAuthenticate calls createAuthHandler with the token. |
| use-awareness.ts | y-protocols/awareness | awareness.on('change') | ✓ WIRED | use-awareness.ts line 92: awareness.on("change", handleAwarenessChange). |
| presence-renderer.ts | PlayCanvas app.drawLine | Immediate-mode frustum cone (same pattern as grid.ts) | ✓ WIRED | presence-renderer.ts lines 161, 167: app.drawLine(position, corner, color, false, this.layer). |
| collaborator-bar.tsx | collab-slice collaborators | Zustand selector | ✓ WIRED | collaborator-bar.tsx line 18: useEditorStore((s) => s.collaborators). |
| lock-manager.ts | y-protocols/awareness | awareness.setLocalStateField('locks', ...) | ✓ WIRED | lock-manager.ts lines 194, 220, 227: awareness.setLocalStateField("locks", ...). |
| inspector-panel.tsx | use-entity-locks.ts | isLockedByOther read-only gate | ✓ WIRED | inspector-panel.tsx line 68: isLockedByOther = lockInfo.locked && !lockInfo.lockedByMe. Line 106: pointer-events-none on isLockedByOther. |
| tree-node.tsx | use-entity-locks.ts | lockInfo.holderName lock icon display | ✓ WIRED | tree-node.tsx lines 6, 93-94, 158-186: uses useEntityLocks(), getLockInfo(), renders Lock/Unlock icons with holder name. |
| avatar-controller.ts | awareness-state.ts | Avatar position broadcast via Awareness | ✓ WIRED | avatar-controller.ts lines 300-313: broadcastCallback called at 100ms interval with position/rotation/fov. viewport-canvas.tsx line 451-454 sets the broadcastCallback using _lockAwareness.setLocalStateField('camera'). |
| avatar-renderer.ts | presence-renderer.ts | Replaces frustum cone when mode='avatar' | ✓ WIRED | presence-renderer.ts line 103: if (user.mode === 'avatar') continue. avatar-renderer.ts line 108: if (user.mode !== 'avatar') continue. Both receive same remote user list. |
| top-bar.tsx | awareness-state.ts | Avatar mode toggle sets mode in Awareness | ✓ WIRED | viewport-canvas.tsx lines 466-484: on isAvatarMode toggle, calls setLocalStateField with {mode: 'avatar'} or {mode: 'editor'}. top-bar.tsx lines 69-70: reads isAvatarMode/toggleAvatarMode from store. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| COLLAB-01 | 05-02 | Shared operation log backed by Yjs CRDTs for real-time co-editing | ✓ SATISFIED | Hocuspocus server + sync-bridge.ts + Y.Doc persistence. scene-slice dispatchOp -> onAfterDispatch -> syncToYDoc -> peers. REQUIREMENTS.md marks [x]. |
| COLLAB-02 | 05-03 | Multiplayer cursors and presence (colored cursors with user names, both 2D overlay and 3D viewport) | ? NEEDS HUMAN | All infrastructure verified (collaborator-bar, tree-node borders, presence-renderer frustum cones). Visual behavior requires live multi-session test. REQUIREMENTS.md marks [x]. |
| COLLAB-03 | 05-04 | Object-level locking with hierarchical lock propagation | ✓ SATISFIED | lock-manager.ts BFS hierarchy propagation, Awareness storage, dispatchOp lock guard, inspector read-only, LockRenderer wireframe. REQUIREMENTS.md marks [x]. |
| COLLAB-04 | 05-05 | Embodied avatar editing (walk around 3D scene as avatar while editing) | ✓ SATISFIED | avatar-controller.ts WASD ground-plane, avatar-renderer.ts capsule, top-bar toggle, presence mode switching. REQUIREMENTS.md marks [x]. |
| COLLAB-05 | 05-02 | Conflict resolution strategy (LWW per property initially) | ✓ SATISFIED | Nested Y.Map per entity in sync-bridge.ts initializeYDoc (per-property Y.Map entries enable property-level LWW merge). REQUIREMENTS.md marks [x]. |

All 5 COLLAB requirement IDs from the ROADMAP are claimed by plans and accounted for. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `servers/collab/src/persistence.ts` | 27 | `return null` | ℹ Info | Intentional: null signals "no persisted state" to Hocuspocus, which is the correct behavior for first collaborative session. Not a stub. |
| `apps/editor/src/components/editor/viewport/viewport-canvas.tsx` | 109 | Avatar controller initializes yaw to 0 instead of reading current camera yaw | ⚠ Warning | On avatar mode entry, the user's current camera orientation is not preserved (yaw resets to 0). Minor UX issue, does not break the feature. |
| `apps/editor/src/collaboration/avatar-controller.ts` | 136-139 | Comment notes yaw initialization is simplified ("keep yaw at 0 initially -- the user can mouse-look") | ⚠ Warning | Acknowledged in code. Camera continuity on avatar mode entry is degraded. Not a blocker. |

No blockers found. No TODO/FIXME/PLACEHOLDER patterns in collaboration files.

### Missing Gate Artifacts

Plan 05-06 was never executed. This is the most significant gap:

- `.planning/reviews/phase-5/PHASE_5_EVIDENCE.md` -- does not exist
- `.planning/phases/05-collaboration/05-06-SUMMARY.md` -- does not exist
- No Codex post-execution review has been run for Phase 5
- No gate decision (PASS/PASS_WITH_CONDITIONS/FAIL) has been recorded

The reviews directory contains only `PHASE_5_PLAN_REVIEW_SKIPPED.md`, which confirms the pre-execution review was intentionally skipped (permitted for standard delivery phases) but explicitly notes "Post-execution review: Required before Phase 6 gate."

### Human Verification Required

#### 1. Real-time sync latency (Success Criterion 1)

**Test:** Open two browser tabs authenticated to the same project with `NEXT_PUBLIC_COLLAB_URL` set, edit an entity property in tab A (e.g., change position X), observe when the change appears in tab B's inspector.
**Expected:** Change appears in tab B within 2 seconds.
**Why human:** Requires live Hocuspocus server, two authenticated sessions, and wall-clock timing. Cannot be verified statically.

#### 2. Concurrent property merge (Success Criterion 2)

**Test:** In tab A change position X on entity "Cube", simultaneously in tab B change the material color on the same entity "Cube". Both edits committed within 500ms of each other.
**Expected:** After sync, the entity has both the new position X from tab A AND the new material color from tab B.
**Why human:** Requires two simultaneous sessions. Nested Y.Map architecture is verified but CRDT merge correctness requires live execution.

#### 3. Colored cursors in 2D hierarchy and 3D viewport (COLLAB-02)

**Test:** In tab A, select an entity. In tab B, observe the hierarchy tree.
**Expected:** The selected entity row in tab B shows a 2px colored border and small avatar chip in tab A's assigned color. Moving tab A's camera should show a colored frustum cone with name label in tab B's viewport.
**Why human:** Visual rendering requires live sessions.

#### 4. Entity locking end-to-end (COLLAB-03)

**Test:** In tab A, hover over an entity in the hierarchy, click the lock button. In tab B, select that same entity.
**Expected:** Tab B sees a lock icon on the entity row (and all children), inspector shows "Locked by [tab A user name]" banner with all inputs disabled, colored AABB wireframe visible in tab B's 3D viewport. Deselecting in tab A auto-releases the lock.
**Why human:** Multi-user visual interaction.

#### 5. Avatar mode rendering (COLLAB-04)

**Test:** In tab A, click the "Walk" toolbar button while collaborating. Tab A camera transitions to first-person at 1.7m height. Press W/A/S/D.
**Expected:** In tab B, a colored semi-transparent capsule (tab A's assigned color) appears at tab A's position and moves as tab A walks. When tab A exits avatar mode, capsule disappears and frustum cone reappears.
**Why human:** 3D rendering and real-time movement.

#### 6. Independent undo (Success Criterion 5)

**Test:** In tab A, rename entity to "Alice". In tab B, rename entity to "Bob". Then in tab A, press Ctrl+Z (undo).
**Expected:** Entity reverts to its name before "Alice" on tab A's view. Tab B's view is unchanged ("Bob" remains).
**Why human:** Requires interleaved edits across two sessions to verify undo isolation.

### Gaps Summary

Two gaps block formal phase closure:

**Gap 1 -- Plan 05-06 not executed (formal gate missing).** The phase delivery plans (05-01 through 05-05) are all complete with verified commits. However plan 05-06 (the post-execution review gate) was never executed. There is no evidence packet, no Codex review, and no gate decision on record. This is a procedural gap -- all feature code is implemented, but the phase cannot be formally closed per the project's review protocol without this step.

**Gap 2 -- Real-time behavior requires human verification.** The collaboration infrastructure is fully implemented and wired (Hocuspocus server, sync bridge, per-user undo, presence, locking, avatars). However all five success criteria from the ROADMAP involve real-time multi-user behavior that cannot be verified programmatically by reading the codebase. These must be verified by running the system with two authenticated browser sessions.

The two gaps are related: executing plan 05-06 (compile evidence packet + Codex review + gate decision) is the natural vehicle for the human verification items.

---

_Verified: 2026-02-21T02:15:00Z_
_Verifier: Claude (gsd-verifier)_
