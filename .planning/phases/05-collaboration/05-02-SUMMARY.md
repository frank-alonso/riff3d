---
phase: 05-collaboration
plan: 02
subsystem: collaboration, state-management, websocket
tags: [yjs, hocuspocus, crdt, y-doc, y-undomanager, websocket, supabase, presence, zustand]

# Dependency graph
requires:
  - phase: 05-collaboration
    provides: Stable viewport with carry-forward fixes (05-01)
  - phase: 02-editor-shell
    provides: Zustand store with scene-slice, save-slice, auto-save hook, editor shell
provides:
  - Hocuspocus WebSocket server with Supabase JWT auth and Y.Doc persistence
  - ECSON<->Y.Doc bidirectional sync bridge with origin tagging (no feedback loops)
  - Per-user undo via Y.UndoManager with captureTimeout:0 and trackedOrigins
  - Collaborative save strategy (Hocuspocus server persistence vs client auto-save)
  - CollaborationProvider React context for HocuspocusProvider lifecycle
  - CollabSlice in Zustand store for collaboration state management
  - Offline state detection and read-only mode on disconnect
  - 12-color presence palette and awareness state types
affects: [05-03-presence-ui, 05-04-locking, 05-05-avatars, 05-06-review-gate]

# Tech tracking
tech-stack:
  added: ["@hocuspocus/server@^3.4.4", "@hocuspocus/extension-database@^3.4.4", "@hocuspocus/provider@^3.4.4", "yjs@^13.6", "y-protocols@^1.0", "tsx@^4.19"]
  patterns: [origin-tagged Y.Doc transactions for feedback loop prevention, nested Y.Maps for per-property CRDT merge, Y.UndoManager with trackedOrigins for per-user undo, Hocuspocus Database extension for dual persistence]

key-files:
  created:
    - servers/collab/src/server.ts
    - servers/collab/src/auth.ts
    - servers/collab/src/persistence.ts
    - servers/collab/src/index.ts
    - servers/collab/package.json
    - servers/collab/tsconfig.json
    - servers/collab/migrations/001_collab_documents.sql
    - apps/editor/src/collaboration/sync-bridge.ts
    - apps/editor/src/collaboration/provider.tsx
    - apps/editor/src/collaboration/awareness-state.ts
    - apps/editor/src/collaboration/presence-colors.ts
    - apps/editor/src/stores/slices/collab-slice.ts
  modified:
    - apps/editor/src/stores/editor-store.ts
    - apps/editor/src/stores/slices/scene-slice.ts
    - apps/editor/src/hooks/use-auto-save.ts
    - apps/editor/src/components/editor/shell/editor-shell.tsx
    - apps/editor/package.json
    - pnpm-workspace.yaml

key-decisions:
  - "Nested Y.Maps per entity for per-property CRDT merge (COLLAB-05 success criterion #2)"
  - "Origin tagging (ORIGIN_LOCAL/ORIGIN_INIT) prevents infinite ECSON<->Y.Doc sync loops"
  - "Y.UndoManager with captureTimeout:0 and trackedOrigins for independent per-user undo"
  - "Hocuspocus server persistence dual-writes: Y.Doc binary to collab_documents + decoded ECSON to projects table"
  - "Auto-save skipped in collaborative mode; Hocuspocus handles persistence server-side"
  - "Editor goes read-only on disconnect; re-enables on reconnect (per locked decision)"
  - "CollaborationProvider conditionally wraps editor when NEXT_PUBLIC_COLLAB_URL is set"

patterns-established:
  - "Sync bridge pattern: local PatchOps -> syncToYDoc(ORIGIN_LOCAL) -> Y.Doc -> peers; remote Y.Doc observe -> skip ORIGIN_LOCAL -> yDocToEcson -> loadProject"
  - "onAfterDispatch callback: collaboration provider registers callback on collab slice; scene-slice calls it after every dispatchOp"
  - "Collaborative undo delegation: scene-slice undo/redo checks collabUndoManager first; falls back to PatchOps stack if null"
  - "Debounced remote rebuild: observeRemoteChanges batches rapid Y.Doc events with 50ms debounce before ECSON reconstruction"

requirements-completed: ["COLLAB-01", "COLLAB-05"]

# Metrics
duration: 7min
completed: 2026-02-20
---

# Phase 5 Plan 2: Yjs CRDT Document Binding Summary

**Hocuspocus collab server with Supabase JWT auth, bidirectional ECSON<->Y.Doc sync bridge with origin-tagged feedback loop prevention, per-user Y.UndoManager undo, and dual-path save strategy (Hocuspocus server-side vs client auto-save)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-21T00:54:40Z
- **Completed:** 2026-02-21T01:01:40Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Built the Hocuspocus WebSocket server package (servers/collab) with Supabase JWT authentication, project access control, and Y.Doc persistence to Postgres via the Database extension
- Created the ECSON<->Y.Doc bidirectional sync bridge using origin-tagged transactions to prevent infinite feedback loops, with nested Y.Maps per entity enabling per-property CRDT merge
- Implemented per-user Y.UndoManager with captureTimeout:0 and trackedOrigins to ensure undo only reverts the current user's changes (not other collaborators')
- Integrated collaboration into the Zustand store (CollabSlice) with onAfterDispatch callback and collabUndoManager delegation, plus auto-save bypass during collaboration

## Task Commits

Each task was committed atomically:

1. **Task 1: Hocuspocus server with Supabase auth and persistence** - `47c123d` (feat)
2. **Task 2: ECSON<->Y.Doc sync bridge, collaboration provider, per-user undo, and save transition** - `25ee10c` (feat)

## Files Created/Modified
- `servers/collab/src/server.ts` - Hocuspocus Server with configurable port, onAuthenticate, onDisconnect hooks
- `servers/collab/src/auth.ts` - Supabase JWT verification, project access check, user color assignment from palette
- `servers/collab/src/persistence.ts` - Database extension: Y.Doc binary to collab_documents, decoded ECSON to projects table
- `servers/collab/src/index.ts` - Server entry point
- `servers/collab/migrations/001_collab_documents.sql` - SQL migration for collab_documents table with RLS
- `apps/editor/src/collaboration/sync-bridge.ts` - initializeYDoc, syncToYDoc, yDocToEcson, observeRemoteChanges with origin tagging
- `apps/editor/src/collaboration/provider.tsx` - CollaborationProvider React context with HocuspocusProvider lifecycle
- `apps/editor/src/collaboration/awareness-state.ts` - PresenceState interface, updatePresence, getRemotePresences
- `apps/editor/src/collaboration/presence-colors.ts` - 12-color PRESENCE_PALETTE and assignUserColor
- `apps/editor/src/stores/slices/collab-slice.ts` - CollabSlice with isCollaborating, isOffline, collabUndoManager, onAfterDispatch
- `apps/editor/src/stores/editor-store.ts` - Added CollabSlice to EditorState type union
- `apps/editor/src/stores/slices/scene-slice.ts` - dispatchOp calls onAfterDispatch; undo/redo delegates to Y.UndoManager when collab active
- `apps/editor/src/hooks/use-auto-save.ts` - Skips auto-save when isCollaborating (Hocuspocus handles persistence)
- `apps/editor/src/components/editor/shell/editor-shell.tsx` - Conditionally wraps with CollaborationProvider when NEXT_PUBLIC_COLLAB_URL set

## Decisions Made
- Used nested Y.Maps per entity (not flat JSON values) to enable per-property CRDT merge. This is required by success criterion #2: concurrent edits on different properties of the same entity must both be preserved.
- Origin tagging with string constants (ORIGIN_LOCAL, ORIGIN_INIT) rather than using Y.Doc.clientID directly. String constants are more readable and can be shared between sync bridge and provider without coupling to a specific client instance.
- Hocuspocus server dual-writes on store: both the Y.Doc binary state to collab_documents and the decoded ECSON JSON to the projects table. This ensures non-collaborative project loads (e.g., dashboard project list, solo editing) still have current data.
- CollaborationProvider uses a callback pattern (onAfterDispatch on collab slice) rather than direct Y.Doc import in scene-slice. This preserves the dependency boundary: scene-slice never imports yjs directly.
- Y.UndoManager tracks ORIGIN_LOCAL (not clientID) because all local sync bridge transactions use ORIGIN_LOCAL as origin. This correctly scopes undo to only the local user's changes.
- Debounced remote change observer (50ms) to batch rapid Y.Doc events into a single ECSON rebuild, avoiding excessive recompilation during BatchOp propagation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added yjs as direct dependency for collab server**
- **Found during:** Task 1 (typecheck)
- **Issue:** persistence.ts uses dynamic import of yjs for Y.Doc decoding, but yjs was not in package.json dependencies
- **Fix:** Added yjs@^13.6 to servers/collab/package.json dependencies and changed to static import
- **Files modified:** servers/collab/package.json, servers/collab/src/persistence.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** 47c123d (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Hocuspocus API type mismatches**
- **Found during:** Task 1 (typecheck)
- **Issue:** Plan referenced `data.connection.readOnly` which doesn't exist on onAuthenticatePayload. Correct property is `data.connectionConfig.readOnly`. Also onDisconnect must return Promise.
- **Fix:** Used `data.connectionConfig.readOnly` and made onDisconnect async
- **Files modified:** servers/collab/src/server.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** 47c123d (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correct typing. No scope creep.

## Issues Encountered
None -- all planned work executed cleanly after the auto-fix deviations.

## User Setup Required

To enable collaboration, the following environment variables must be configured:

**Server (servers/collab):**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `COLLAB_PORT` - WebSocket server port (default: 1234)
- `EDITOR_ORIGIN` - Allowed CORS origin (default: http://localhost:3000)

**Client (apps/editor):**
- `NEXT_PUBLIC_COLLAB_URL` - Hocuspocus server WebSocket URL (e.g., ws://localhost:1234). If not set, collaboration is disabled and solo editing mode is preserved.

**Database migration:**
- Run `servers/collab/migrations/001_collab_documents.sql` against the Supabase database to create the collab_documents table.

## Next Phase Readiness
- Collaboration infrastructure complete: Hocuspocus server, sync bridge, per-user undo, save strategy
- Ready for 05-03 (presence UI): CollabSlice provides isConnected, isOffline, collaborators; awareness-state.ts provides PresenceState interface
- Ready for 05-04 (entity locking): awareness-state.ts has locks field; lock state will flow through Yjs Awareness
- Offline state detection ready for offline banner UI in 05-03

## Self-Check: PASSED

All 13 key files verified present. Both task commits (47c123d, 25ee10c) verified in git log.

---
*Phase: 05-collaboration*
*Completed: 2026-02-20*
