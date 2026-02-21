# Phase 5: Collaboration - Research

**Researched:** 2026-02-20
**Domain:** Real-time collaboration (Yjs CRDTs + Hocuspocus WebSocket backend + presence awareness + 3D avatar embodiment)
**Confidence:** HIGH (core stack verified via Context7 + npm; architecture patterns from official docs)

## Summary

Phase 5 introduces real-time collaborative editing: two or more users edit the same 3D scene simultaneously with presence awareness, entity locking, conflict resolution via CRDTs, embodied avatars, and independent undo stacks. The collaboration stack centers on **Yjs** (CRDT framework, already in the project spec) synced through **Hocuspocus v3** (MIT-licensed WebSocket backend, v3.4.4 current). The ECSON document is mapped to a Yjs Y.Doc using nested Y.Map/Y.Array structures, enabling granular per-property conflict resolution. Presence (cursors, camera positions, selections, locks) flows through the Yjs Awareness protocol as ephemeral state. Each user maintains an independent undo stack via Y.UndoManager with `trackedOrigins` and `captureTimeout: 0`.

The most architecturally significant challenge is bridging Yjs shared types with the existing PatchOps pipeline. The recommended pattern: PatchOps remain the local mutation interface (preserving the "all mutations flow through PatchOps" architecture rule), but Yjs becomes the sync layer. Local PatchOps apply to the ECSON document *and* propagate changes to the Yjs Y.Doc; remote Yjs changes are observed and applied back to the local ECSON document, triggering IR recompilation. This two-way sync (ECSON <-> Y.Doc) is the critical integration seam.

**Primary recommendation:** Use Hocuspocus v3 as the collaboration backend, deployed as a standalone Node.js server (separate from Vercel/Next.js). Map ECSON's flat entity record to `Y.Map<string, Y.Map>` for entity-level granular sync. Use Yjs Awareness for all ephemeral state (presence, selections, locks, camera positions). Bridge PatchOps to Y.Doc mutations with a sync layer that prevents infinite feedback loops via transaction origin tagging.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Collaborators shown as a floating name label + camera frustum cone (colored wireframe showing where they're looking)
- Colors auto-assigned from a preset palette (system-assigned, guaranteed contrast between users)
- Presence indicators always visible (no toggle to hide)
- When in avatar mode: capsule avatar replaces the frustum cone
- When not in avatar mode: frustum cone + name label always visible to others
- Colored border on entity rows in hierarchy panel showing other users' selections
- Small colored avatar chip (initial/icon) next to the selected item showing who
- Both border + chip displayed together
- Manual lock only -- user clicks an explicit lock icon/button on an entity
- No auto-lock on selection or edit
- Locking an entity locks it and its descendants (per success criteria)
- Lock auto-releases when user deselects the entity
- Lock auto-releases on disconnect (prevents stale locks from disconnected users)
- When someone tries to edit a locked entity: inspector opens in read-only mode, values visible but not editable, lock holder name displayed
- Lock icon shown on entity row in hierarchy panel
- Subtle color tint/outline in 3D viewport matching the lock holder's user color
- Both hierarchy icon + viewport tint displayed together
- Simple colored capsule with floating name label above
- WASD walk mode for movement (FPS-style, ground-plane based)
- Explicit toolbar toggle to switch between normal editor camera and embodied avatar mode
- Not always embodied -- avatar mode is opt-in per user
- When not in avatar mode, others still see camera frustum cone (presence never hidden)
- Silent sync by default -- remote changes just appear in the scene seamlessly
- When viewing an entity in the inspector and another user changes one of its properties: brief color flash/highlight on the changed property in the other user's color
- Join/leave: both toast notification ("Alice joined"/"Alice left") AND persistent collaborator bar in toolbar showing active users
- Concurrent edits on different properties of same entity: both preserved (Yjs CRDT merge), with brief color highlight on the changed property in inspector
- Banner displayed when connection lost: "Offline -- changes will sync when reconnected"
- Editor goes read-only while offline (prevents divergence)
- Reconnection re-syncs and restores editing capability

### Claude's Discretion
- Collaboration backend selection (Hocuspocus v3 vs alternatives -- researcher will evaluate)
- Exact palette colors and contrast algorithm for auto-assignment
- Frustum cone geometry (size, opacity, field of view representation)
- Capsule avatar dimensions and label positioning
- Toast notification duration and styling
- Lock icon design and placement
- Property highlight animation timing and easing
- Collaborator bar layout and overflow behavior
- Reconnection strategy and retry logic

### Deferred Ideas (OUT OF SCOPE)
- PatchOps operation log viewer UI with collaborative attribution -- extends Phase 4 carry-forward, could land in Phase 5 if time permits but not a hard requirement
- Voice/text chat during collaboration -- Phase v2.0 (COMM-01, COMM-02, COMM-03)
- Spectator mode -- Phase v2.0 (COMP-02)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COLLAB-01 | Shared operation log backed by Yjs CRDTs for real-time co-editing | Yjs Y.Doc with nested Y.Map for entities; Hocuspocus WebSocket sync; PatchOps-to-Y.Doc bridge pattern |
| COLLAB-02 | Multiplayer cursors and presence (colored cursors with user names, both 2D overlay and 3D viewport) | Yjs Awareness protocol for ephemeral state; PlayCanvas frustum wireframe rendering; React presence components |
| COLLAB-03 | Object-level locking with hierarchical lock propagation (locking parent locks descendants) | Y.Map-based lock registry in Awareness state; descendant traversal on ECSON entity tree; read-only inspector gate |
| COLLAB-04 | Embodied avatar editing (walk around 3D scene as avatar while editing) | PlayCanvas capsule mesh entity; ground-plane movement via adapted camera controller WASD; avatar state broadcast via Awareness |
| COLLAB-05 | Conflict resolution strategy (LWW per property initially, upgradeable to OT) | Yjs CRDT provides automatic LWW merge for Y.Map properties; no OT needed (CRDTs are strictly superior for this use case) |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yjs | ^13.6.29 | CRDT shared data types (Y.Doc, Y.Map, Y.Array, Awareness) | De-facto standard for collaborative editing; already in project spec; highest-performance CRDT implementation |
| @hocuspocus/server | ^3.4.4 | WebSocket backend for Yjs document sync | MIT license, self-hosted, multiplexing support, built-in auth/persistence hooks, active maintenance |
| @hocuspocus/provider | ^3.4.4 | Client-side WebSocket provider for Yjs | Pairs with Hocuspocus server; handles reconnection, auth token, awareness relay |
| @hocuspocus/extension-database | ^3.4.4 | Custom database persistence for Hocuspocus | Enables Supabase Postgres persistence via custom fetch/store hooks |
| y-protocols | ^1.0.7 | Awareness protocol + sync utilities | Standard companion to Yjs; provides Awareness CRDT for presence |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| y-indexeddb | ^9.0.12 | Local persistence for offline tolerance | Cache Y.Doc locally so reconnection is fast; optional if offline is read-only |
| lib0 | ^0.2.87 | Binary encoding/decoding utilities | Already a Hocuspocus dependency; useful for custom awareness encoding if needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hocuspocus | y-websocket (bare) | Simpler but no auth hooks, no persistence, no multiplexing, hard to scale |
| Hocuspocus | Y-Sweet (Rust) | Better raw performance but requires binary server distribution, less customizable auth/persistence hooks, fewer extension points |
| Hocuspocus | y-redis | More scalable (Redis pub/sub) but heavier infra, overkill for initial collaboration |
| Hocuspocus | Liveblocks | Managed SaaS with good DX but vendor lock-in, recurring costs, less control over persistence |
| y-pojo/SyncedStore | Manual Y.Doc mapping | Simpler API but too abstracted -- we need fine-grained control over Y.Doc structure for entity-level sync |

**Recommendation: Hocuspocus v3.** MIT license, self-hosted, hooks for Supabase auth verification, custom persistence to Supabase Postgres, multiplexing for future multi-document support. The ecosystem maturity (59 code snippets in Context7, 3.4.4 stable) and active maintenance make it the clear choice.

**Installation:**
```bash
# Server (new package: servers/collab)
pnpm add @hocuspocus/server @hocuspocus/extension-database @supabase/supabase-js

# Client (apps/editor)
pnpm add @hocuspocus/provider yjs y-protocols
```

## Architecture Patterns

### Recommended Project Structure

```
servers/collab/                    # Hocuspocus WebSocket server
├── src/
│   ├── server.ts                  # Hocuspocus server setup
│   ├── auth.ts                    # Supabase JWT verification hook
│   ├── persistence.ts             # Supabase Postgres persistence (Y.Doc <-> JSONB)
│   └── index.ts                   # Entry point
├── package.json
└── tsconfig.json

apps/editor/src/
├── collaboration/                 # Collaboration integration layer
│   ├── provider.tsx               # React context for HocuspocusProvider + Y.Doc
│   ├── sync-bridge.ts             # ECSON <-> Y.Doc bidirectional sync
│   ├── awareness-state.ts         # Awareness state types and helpers
│   ├── presence-colors.ts         # User color palette and assignment
│   ├── lock-manager.ts            # Entity locking via Awareness Y.Map
│   └── hooks/
│       ├── use-collaboration.ts   # Main collaboration hook
│       ├── use-awareness.ts       # Presence/awareness state hook
│       ├── use-entity-locks.ts    # Lock state hook
│       └── use-remote-changes.ts  # Remote change highlight tracking
├── stores/slices/
│   └── collab-slice.ts            # Zustand slice for collaboration state
└── components/editor/
    ├── collaboration/
    │   ├── collaborator-bar.tsx    # Top bar showing active users
    │   ├── presence-cursor.tsx     # 2D cursor overlay (optional)
    │   └── offline-banner.tsx      # Offline status banner
    ├── hierarchy/
    │   └── tree-node.tsx           # Extended with presence border + lock icon
    └── viewport/
        └── presence-renderer.ts   # 3D frustum cones + avatars (adapter-level)
```

### Pattern 1: ECSON <-> Y.Doc Bidirectional Sync Bridge

**What:** The critical integration seam between the existing PatchOps-driven architecture and Yjs CRDTs. ECSON remains the local source of truth; Y.Doc is the sync transport.

**When to use:** Every PatchOp dispatch and every remote Y.Doc change.

**Design:**
```
Local edit flow:
  User action -> dispatchOp(op) -> applyOp(ecsonDoc, op) -> syncToYDoc(ecsonDoc, yDoc, 'local')
                                                          -> compile(ecsonDoc) -> adapter

Remote sync flow:
  Y.Doc observe -> yDocToEcson(yDoc) -> loadProject(newEcsonDoc) -> compile() -> adapter
```

**Example:**
```typescript
// Source: Yjs official docs + Hocuspocus patterns
import * as Y from 'yjs';
import type { SceneDocument } from '@riff3d/ecson';

const ORIGIN_LOCAL = 'local-edit';
const ORIGIN_REMOTE = 'remote-sync';

/**
 * Sync ECSON entity changes to Y.Doc.
 * Called after every local PatchOp application.
 * Uses transaction origin tagging to prevent feedback loops.
 */
function syncEntityToYDoc(
  yEntities: Y.Map<Y.Map<unknown>>,
  entityId: string,
  entity: Record<string, unknown>,
): void {
  yEntities.doc!.transact(() => {
    let yEntity = yEntities.get(entityId);
    if (!yEntity) {
      yEntity = new Y.Map();
      yEntities.set(entityId, yEntity);
    }
    // Sync each top-level property
    for (const [key, value] of Object.entries(entity)) {
      const existing = yEntity.get(key);
      if (JSON.stringify(existing) !== JSON.stringify(value)) {
        yEntity.set(key, value);
      }
    }
  }, ORIGIN_LOCAL);
}

/**
 * Observe Y.Doc changes from remote users.
 * Rebuilds ECSON from Y.Doc and triggers recompilation.
 * Ignores changes with local origin to prevent feedback loops.
 */
function observeRemoteChanges(
  yEntities: Y.Map<Y.Map<unknown>>,
  onRemoteChange: (newEntities: Record<string, unknown>) => void,
): void {
  yEntities.observeDeep((events, transaction) => {
    if (transaction.origin === ORIGIN_LOCAL) return; // Skip own changes
    const entities = yEntities.toJSON();
    onRemoteChange(entities);
  });
}
```

### Pattern 2: Yjs Awareness for Ephemeral Presence State

**What:** User presence (selection, camera position, locks, avatar state) flows through Yjs Awareness, not the persistent Y.Doc.

**When to use:** All non-persistent per-user state.

**Example:**
```typescript
// Source: Yjs Awareness docs (https://docs.yjs.dev)
import type { Awareness } from 'y-protocols/awareness';

interface PresenceState {
  user: {
    id: string;
    name: string;
    color: string;
  };
  selection: string[];           // Selected entity IDs
  camera: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    fov: number;
  };
  mode: 'editor' | 'avatar';    // Editor camera vs embodied avatar
  locks: string[];               // Entity IDs this user has locked
}

function updatePresence(awareness: Awareness, partial: Partial<PresenceState>): void {
  for (const [key, value] of Object.entries(partial)) {
    awareness.setLocalStateField(key, value);
  }
}

function observePresence(
  awareness: Awareness,
  onUpdate: (states: Map<number, PresenceState>) => void,
): () => void {
  const handler = () => {
    onUpdate(awareness.getStates() as Map<number, PresenceState>);
  };
  awareness.on('change', handler);
  return () => awareness.off('change', handler);
}
```

### Pattern 3: Independent Per-User Undo with Y.UndoManager

**What:** Each user maintains their own undo stack. Undoing on one client does NOT undo another user's operations.

**Critical finding:** Y.UndoManager has a known issue in multi-user scenarios where operation merging (`captureTimeout > 0`) can cause one user's undo to revert another user's changes. The fix is `captureTimeout: 0` combined with `trackedOrigins`.

**Example:**
```typescript
// Source: Yjs UndoManager docs (https://docs.yjs.dev/api/undo-manager)
import * as Y from 'yjs';

const yDoc = new Y.Doc();
const yEntities = yDoc.getMap('entities');

// Create per-user undo manager
// CRITICAL: captureTimeout must be 0 to prevent cross-user operation merging
const clientId = yDoc.clientID; // Unique per client

const undoManager = new Y.UndoManager(yEntities, {
  trackedOrigins: new Set([clientId]),
  captureTimeout: 0,
});

// When applying local changes, use clientId as transaction origin
yDoc.transact(() => {
  // ... apply changes
}, clientId);

// Undo only reverts changes from this client
undoManager.undo();

// Listen for undo/redo events to update UI
undoManager.on('stack-item-added', (event) => {
  // Update canUndo/canRedo in Zustand store
});
```

**Integration with existing undo:** The existing `undoStack`/`redoStack` in `scene-slice.ts` will be replaced by Y.UndoManager for collaborative sessions. For solo editing (no collaboration), the existing PatchOps-based undo can remain as fallback.

### Pattern 4: Hocuspocus Server with Supabase Auth + Persistence

**What:** The collaboration server verifies Supabase JWT tokens and persists Y.Doc state to Supabase Postgres.

**Example:**
```typescript
// Source: Hocuspocus docs + Emergence Engineering Supabase integration
import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-side only
);

const server = new Server({
  port: 1234,

  async onAuthenticate({ token, documentName }) {
    // Verify Supabase JWT
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid token');

    // Check project access
    const { data: project } = await supabase
      .from('projects')
      .select('id, owner_id, is_public')
      .eq('id', documentName)
      .single();

    if (!project) throw new Error('Project not found');

    const isOwner = user.id === project.owner_id;
    const hasAccess = isOwner || project.is_public;
    if (!hasAccess) throw new Error('Access denied');

    return {
      user: { id: user.id, name: user.user_metadata?.name || 'Anonymous' },
      isOwner,
    };
  },

  extensions: [
    new Database({
      async fetch({ documentName }) {
        const { data } = await supabase
          .from('collab_documents')
          .select('ydoc_state')
          .eq('project_id', documentName)
          .single();
        return data?.ydoc_state ? Buffer.from(data.ydoc_state, 'base64') : null;
      },
      async store({ documentName, state }) {
        await supabase
          .from('collab_documents')
          .upsert({
            project_id: documentName,
            ydoc_state: Buffer.from(state).toString('base64'),
            updated_at: new Date().toISOString(),
          });
      },
    }),
  ],
});
```

### Pattern 5: Multiplexed WebSocket Connection

**What:** Hocuspocus v3 supports multiplexing multiple documents over one WebSocket connection. This is important because the client may need to sync both the ECSON document and a separate presence/lock document.

**Example:**
```typescript
// Source: Hocuspocus docs (Context7)
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';

const socket = new HocuspocusProviderWebsocket({
  url: 'ws://localhost:1234',
});

const provider = new HocuspocusProvider({
  websocketProvider: socket,
  name: `project-${projectId}`,
  document: yDoc,
  token: supabaseAccessToken,
  onSynced: () => { /* Document synced, enable editing */ },
  onStatus: ({ status }) => { /* 'connected' | 'disconnected' */ },
  onAuthenticationFailed: ({ reason }) => { /* Handle auth failure */ },
});
```

### Anti-Patterns to Avoid

- **Storing entire ECSON as a single Y.Map value:** This would send the entire document on every change (~777 bytes vs ~27 bytes per property). Use nested Y.Map/Y.Array for granular sync.
- **Syncing undo stacks via Yjs:** Undo stacks are per-user and local. Never put undo/redo state in Y.Doc.
- **Using Y.Text for entity names:** Entity names are short strings replaced atomically, not collaboratively edited character-by-character. Use plain string values in Y.Map.
- **Putting lock state in Y.Doc:** Locks are ephemeral -- they auto-release on disconnect. Use Awareness, not persistent Y.Doc state.
- **Direct ECSON mutation from Y.Doc observer:** Always go through the existing PatchOps-equivalent application path to maintain IR recompilation invariant.
- **Attempting offline editing with Yjs sync:** Per user decision, offline mode is read-only. Do NOT attempt offline CRDTs-will-merge-later pattern -- it adds enormous complexity for minimal benefit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CRDT conflict resolution | Custom OT/CRDT engine | Yjs Y.Map/Y.Array | Yjs is battle-tested with years of edge case fixes; hand-rolling CRDTs is a PhD-level challenge |
| WebSocket reconnection | Custom retry logic | HocuspocusProvider built-in | Provider handles exponential backoff, authentication re-negotiation, state resync |
| Awareness/presence protocol | Custom presence server | y-protocols/awareness | Handles timeout-based garbage collection of stale clients, efficient binary encoding |
| Per-user undo in collaboration | Custom undo stack manager | Y.UndoManager with trackedOrigins | Correctly handles CRDT undo semantics including tombstone restoration |
| Binary document encoding | Custom serialization | Yjs built-in encoding (Y.encodeStateAsUpdate) | Optimized binary format with deduplication and truncation of removed content |
| JWT verification | Custom JWT parsing | Supabase client library (getUser) | Handles key rotation, token refresh, session management |

**Key insight:** Collaborative editing has an extremely high density of subtle edge cases (split-brain recovery, concurrent deletes, undo-after-remote-edit, clock skew, partial updates during reconnection). Every hand-rolled component is a landmine. Use the battle-tested stack end-to-end.

## Common Pitfalls

### Pitfall 1: Infinite Sync Loop (ECSON -> Y.Doc -> ECSON -> Y.Doc -> ...)
**What goes wrong:** Local PatchOp updates ECSON, which syncs to Y.Doc, which triggers an observer that updates ECSON again, creating an infinite loop.
**Why it happens:** No origin tagging on transactions; the observer cannot distinguish local from remote changes.
**How to avoid:** Use Yjs transaction origins. Tag local changes with `ORIGIN_LOCAL`; in the Y.Doc observer, skip events where `transaction.origin === ORIGIN_LOCAL`.
**Warning signs:** Browser tab freezes or extreme CPU usage when making any edit in collaborative mode.

### Pitfall 2: Y.UndoManager Cross-User Undo
**What goes wrong:** User A makes an edit, User B makes an edit, User A presses undo -- User B's edit is undone instead of User A's.
**Why it happens:** Y.UndoManager's `captureTimeout` merges nearby operations into a single undo item. If operations from different users occur within the timeout window, they get merged.
**How to avoid:** Set `captureTimeout: 0` and use `trackedOrigins: new Set([clientId])` so each UndoManager only tracks its own changes.
**Warning signs:** Undo produces unexpected results; undo seems to affect other users' edits.

### Pitfall 3: Y.Doc Size Growth
**What goes wrong:** Y.Doc grows indefinitely because Yjs retains tombstones (deleted items) for conflict resolution.
**Why it happens:** CRDT garbage collection is conservative -- items are only GC'd when all clients have seen the deletion.
**How to avoid:** Use Hocuspocus server-side document compaction (built-in when persistence is configured). The server periodically creates fresh snapshots. For very large scenes, consider entity-level document sharding (one Y.Doc per entity group).
**Warning signs:** Initial sync time grows over months of editing; memory usage increases without scene complexity increase.

### Pitfall 4: Stale Locks After Disconnect
**What goes wrong:** A user disconnects unexpectedly (browser crash, network failure) while holding entity locks. Other users cannot edit those entities.
**Why it happens:** Lock state persisted in Y.Doc survives disconnection.
**How to avoid:** Store locks in Awareness state (not Y.Doc). Awareness automatically removes state for disconnected clients (default 30-second timeout). The Hocuspocus `onDisconnect` hook can also explicitly clean up.
**Warning signs:** Locked entities remain locked after a user disappears; no way to force-unlock.

### Pitfall 5: Vercel WebSocket Limitation
**What goes wrong:** Deploying the Hocuspocus server as a Next.js API route on Vercel fails because Vercel does not support persistent WebSocket connections.
**Why it happens:** Vercel's serverless architecture terminates connections after the response is sent.
**How to avoid:** Deploy Hocuspocus as a **standalone Node.js server** on a platform that supports persistent WebSockets (Railway, Fly.io, Render, AWS ECS, self-hosted VPS). The Next.js editor connects to it via the `HocuspocusProvider`.
**Warning signs:** WebSocket connections immediately close; provider shows "disconnected" status constantly.

### Pitfall 6: Race Condition Between Project Load and Y.Doc Sync
**What goes wrong:** The editor loads the ECSON document from Supabase (via server component), but the Y.Doc hasn't synced yet. User starts editing based on stale data.
**Why it happens:** Two sources of truth: Supabase ECSON (loaded on page load) and Y.Doc (synced over WebSocket asynchronously).
**How to avoid:** Wait for Y.Doc `onSynced` before enabling editing. On first sync, if the Y.Doc is empty (new collaboration session), initialize it from the Supabase ECSON. If Y.Doc has content, use it as the authoritative source (it may have more recent changes from other users).
**Warning signs:** Edits disappear after a few seconds; scene "jumps" to a different state shortly after load.

### Pitfall 7: Property-Level Sync Granularity vs Performance
**What goes wrong:** Syncing every individual property as a separate Y.Map entry creates too many Yjs items, increasing memory and sync overhead.
**Why it happens:** Over-granular Y.Doc structure (e.g., separate entries for position.x, position.y, position.z).
**How to avoid:** Sync at the entity top-level property level (transform, components array, name, etc.), not at individual nested fields. A transform update sends the entire transform object (~100 bytes), not three individual numbers. This matches PatchOps granularity.
**Warning signs:** High WebSocket traffic for simple operations; sync latency increases with scene complexity.

## Code Examples

### Hocuspocus Provider Setup in React

```typescript
// Source: Hocuspocus docs (Context7 /ueberdosis/hocuspocus)
"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { createClient } from '@/lib/supabase/client';

interface CollabContextValue {
  provider: HocuspocusProvider | null;
  yDoc: Y.Doc;
  awareness: ReturnType<HocuspocusProvider['awareness']> | null;
  connected: boolean;
  synced: boolean;
}

const CollabContext = createContext<CollabContextValue | null>(null);

export function CollaborationProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const yDocRef = useRef(new Y.Doc());
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function connect() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const hp = new HocuspocusProvider({
        url: process.env.NEXT_PUBLIC_COLLAB_URL!,
        name: projectId,
        document: yDocRef.current,
        token: session.access_token,
        onStatus: ({ status }) => setConnected(status === 'connected'),
        onSynced: ({ state }) => setSynced(state),
        onAuthenticationFailed: ({ reason }) => {
          console.error('Collab auth failed:', reason);
        },
      });

      setProvider(hp);
    }

    void connect();

    return () => {
      provider?.destroy();
    };
  }, [projectId]);

  return (
    <CollabContext value={{
      provider,
      yDoc: yDocRef.current,
      awareness: provider?.awareness ?? null,
      connected,
      synced,
    }}>
      {children}
    </CollabContext>
  );
}

export function useCollaboration(): CollabContextValue {
  const ctx = useContext(CollabContext);
  if (!ctx) throw new Error('useCollaboration must be used within CollaborationProvider');
  return ctx;
}
```

### Y.Doc Structure for ECSON

```typescript
// Source: Yjs docs (Context7 /yjs/yjs + /yjs/docs)

/**
 * ECSON -> Y.Doc mapping strategy.
 *
 * The Y.Doc mirrors the ECSON SceneDocument structure:
 *
 * Y.Doc root:
 *   'meta'       -> Y.Map { id, name, schemaVersion, rootEntityId }
 *   'entities'   -> Y.Map<entityId, entityJSON>   (flat entity record)
 *   'assets'     -> Y.Map<assetId, assetJSON>     (flat asset record)
 *   'wiring'     -> Y.Array<wireJSON>              (event wires)
 *   'environment' -> Y.Map { ... }                 (environment settings)
 *
 * Entities are stored as plain JSON values in the Y.Map, NOT as nested Y.Maps.
 * This is a deliberate trade-off:
 * - Pro: Simpler sync logic; matches PatchOps entity-level granularity
 * - Pro: Entity-level LWW merge (last write to any entity property wins)
 * - Con: Entire entity is sent on any property change (~200 bytes typical)
 * - Con: Cannot merge concurrent edits to different properties of same entity
 *
 * UPGRADE PATH: If property-level merge is needed (COLLAB-05), switch to
 * nested Y.Maps per entity. This is more complex but enables per-property
 * LWW. The sync bridge isolates this decision from the rest of the editor.
 *
 * ACTUALLY: Per success criteria #2, concurrent edits on different properties
 * of the same entity MUST be preserved. This requires nested Y.Maps per entity.
 */

function initializeYDoc(yDoc: Y.Doc, ecsonDoc: SceneDocument): void {
  yDoc.transact(() => {
    const yMeta = yDoc.getMap('meta');
    yMeta.set('id', ecsonDoc.id);
    yMeta.set('name', ecsonDoc.name);
    yMeta.set('schemaVersion', ecsonDoc.schemaVersion);
    yMeta.set('rootEntityId', ecsonDoc.rootEntityId);

    const yEntities = yDoc.getMap('entities');
    for (const [id, entity] of Object.entries(ecsonDoc.entities)) {
      const yEntity = new Y.Map();
      for (const [key, value] of Object.entries(entity)) {
        yEntity.set(key, value); // Store transform, components, etc. as JSON values
      }
      yEntities.set(id, yEntity);
    }

    const yAssets = yDoc.getMap('assets');
    for (const [id, asset] of Object.entries(ecsonDoc.assets)) {
      yAssets.set(id, asset); // Assets are atomic (replaced whole)
    }

    const yEnvironment = yDoc.getMap('environment');
    for (const [key, value] of Object.entries(ecsonDoc.environment)) {
      yEnvironment.set(key, value);
    }
  }, 'init');
}
```

### User Color Palette

```typescript
// Source: Research into collaborative editor conventions (Figma, Google Docs patterns)

/**
 * 12-color palette for user presence.
 * Requirements:
 * - Visually distinct from each other
 * - Readable against dark editor background (#0d0d1e)
 * - Accessible (WCAG 3:1 contrast ratio for UI components)
 * - Not conflicting with selection highlight (emissive tint) or error red
 */
const PRESENCE_PALETTE = [
  '#FF6B6B', // Coral red
  '#4ECDC4', // Teal
  '#FFE66D', // Warm yellow
  '#A78BFA', // Soft purple
  '#F97316', // Orange
  '#34D399', // Emerald green
  '#60A5FA', // Sky blue
  '#F472B6', // Pink
  '#FBBF24', // Amber
  '#818CF8', // Indigo
  '#2DD4BF', // Cyan
  '#FB923C', // Tangerine
] as const;

function assignUserColor(userIndex: number): string {
  return PRESENCE_PALETTE[userIndex % PRESENCE_PALETTE.length]!;
}
```

### Frustum Cone Rendering in PlayCanvas

```typescript
// Source: PlayCanvas API (RENDERSTYLE_WIREFRAME, drawLines)
import * as pc from 'playcanvas';

/**
 * Render a camera frustum cone for a remote user's presence.
 * Uses immediate-mode line drawing (same pattern as grid.ts).
 *
 * The frustum is a simplified cone: 4 lines from camera position
 * to the corners of the near plane, plus 4 lines connecting corners.
 */
function drawFrustumCone(
  app: pc.Application,
  position: pc.Vec3,
  rotation: pc.Quat,
  fov: number,
  color: pc.Color,
  aspect: number = 16 / 9,
  distance: number = 3, // Cone depth in meters
): void {
  const halfFovRad = (fov / 2) * (Math.PI / 180);
  const halfH = Math.tan(halfFovRad) * distance;
  const halfW = halfH * aspect;

  // Corner offsets in local space
  const corners = [
    new pc.Vec3(-halfW, halfH, -distance),
    new pc.Vec3(halfW, halfH, -distance),
    new pc.Vec3(halfW, -halfH, -distance),
    new pc.Vec3(-halfW, -halfH, -distance),
  ];

  // Transform to world space
  const worldCorners = corners.map((c) => {
    const w = new pc.Vec3();
    rotation.transformVector(c, w);
    w.add(position);
    return w;
  });

  // Draw lines from origin to corners
  const lines: pc.Vec3[] = [];
  const colors: pc.Color[] = [];
  for (const corner of worldCorners) {
    lines.push(position, corner);
    colors.push(color, color);
  }

  // Draw near plane rectangle
  for (let i = 0; i < 4; i++) {
    lines.push(worldCorners[i]!, worldCorners[(i + 1) % 4]!);
    colors.push(color, color);
  }

  app.drawLines(lines, colors);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OT (Operational Transform) | CRDTs (Yjs, Automerge) | ~2020-2022 | CRDTs don't need a central server for conflict resolution; better offline support |
| y-websocket (bare) | Hocuspocus v3 | 2023 | Auth, persistence, multiplexing, hooks -- batteries included |
| Hocuspocus v2 | Hocuspocus v3 | 2024 | Multiplexing (multiple docs over one WS), better TypeScript, more extensions |
| Full document sync | Property-level CRDT merge | Always (Yjs design) | Y.Map enables per-property LWW without custom conflict resolution |
| Custom undo in collab | Y.UndoManager + trackedOrigins | Yjs v13+ | Built-in per-user undo that correctly handles CRDT semantics |

**Deprecated/outdated:**
- `y-websocket` as a production backend: Lacks auth, persistence, scaling. Use Hocuspocus or y-redis instead.
- OT-based collaboration for new projects: CRDTs are strictly superior for distributed editing (no central sequencer needed).

## Open Questions

1. **Y.Doc Initialization Race**
   - What we know: On first load, the ECSON comes from Supabase (server component), but Y.Doc syncs asynchronously via WebSocket.
   - What's unclear: What happens if two users open a project simultaneously and both try to initialize the Y.Doc from their Supabase-loaded ECSON?
   - Recommendation: The Hocuspocus `fetch` hook loads the persisted Y.Doc state. If no Y.Doc state exists (first collaborative session), the first connected client initializes from ECSON. Use a "initialized" flag in Y.Doc metadata to prevent double-init. Subsequent clients receive the Y.Doc via WebSocket sync, ignoring their Supabase-loaded ECSON.

2. **Save Strategy Transition**
   - What we know: Currently, auto-save writes ECSON directly to Supabase `projects.ecson` via the client. With collaboration, Y.Doc is the authoritative source synced through Hocuspocus.
   - What's unclear: Should the `useAutoSave` hook be completely replaced, or should it coexist?
   - Recommendation: In collaborative mode, persistence is handled by Hocuspocus (server-side save to a `collab_documents` table). The `projects.ecson` column is updated periodically (on disconnect or at intervals) by the Hocuspocus `store` hook converting Y.Doc to ECSON. For solo editing (no active collaboration), the existing auto-save can remain as-is.

3. **Y.Doc <-> ECSON Schema Version Mismatch**
   - What we know: ECSON has schema versioning and migrations. Y.Doc state is binary-encoded.
   - What's unclear: What happens when the ECSON schema version changes (migration) while a Y.Doc is persisted?
   - Recommendation: Store the ECSON schema version in Y.Doc metadata. On load, if the version doesn't match, discard the Y.Doc state and re-initialize from the migrated ECSON. Migrations are rare and justify a full Y.Doc reset.

4. **Avatar Walk Mode Ground Plane**
   - What we know: Avatar uses WASD for ground-plane walking. The existing camera controller uses WASD for free-flight.
   - What's unclear: How to constrain avatar movement to the ground plane without a full physics system.
   - Recommendation: Raycast downward from avatar position to find ground level (scene geometry or Y=0 fallback). Keep avatar at raycast hit Y + capsule half-height. This is much simpler than full physics and sufficient for editor walk-around.

5. **Carry-Forward Viewport Bugs (CF-P4-05/06/07)**
   - What we know: Three viewport stability bugs are carried forward to Phase 5.
   - What's unclear: Whether these are best fixed before or during collaboration work.
   - Recommendation: Fix these FIRST, before adding collaboration complexity. They affect the core adapter lifecycle that collaboration will build on. A single "carry-forward cleanup" plan at the start of Phase 5.

## Sources

### Primary (HIGH confidence)
- Context7 `/ueberdosis/hocuspocus` -- Server setup, auth hooks, persistence extensions, multiplexing, connection lifecycle (59 snippets)
- Context7 `/yjs/yjs` -- Y.Doc, Y.Map, Y.Array, UndoManager, awareness, provider integration (302 snippets)
- Context7 `/yjs/docs` -- Awareness protocol, shared types, document structure patterns (343 snippets)
- Context7 `/jamsocket/y-sweet` -- Y-Sweet server comparison (41 snippets)
- npm registry: `@hocuspocus/server@3.4.4`, `@hocuspocus/provider@3.4.4`, `yjs@13.6.29`, `y-protocols@1.0.7` (verified via `npm view`)
- Hocuspocus GitHub: MIT license confirmed (https://github.com/ueberdosis/hocuspocus/blob/main/LICENSE.md)

### Secondary (MEDIUM confidence)
- Emergence Engineering blog: Hocuspocus + Supabase integration pattern (https://emergence-engineering.com/blog/hocuspocus-with-supabase) -- verified against Hocuspocus official docs
- Yjs Community Forum: Y.UndoManager multi-user issues (https://discuss.yjs.dev/t/how-is-undomanager-being-used/1851) -- confirmed via GitHub issue #273
- Yjs Community Forum: Nested JSON objects in Y.Map (https://discuss.yjs.dev/t/best-way-to-store-deep-json-objects-js-object-or-y-map/2223)
- PlayCanvas API: RENDERSTYLE_WIREFRAME, drawLines, Frustum class (https://api.playcanvas.com/)

### Tertiary (LOW confidence)
- y-pojo library (https://github.com/boourns/y-pojo) -- 22 stars, last active unknown, not recommended but informed sync bridge design
- mutative-yjs (https://github.com/mutativejs/mutative-yjs) -- alternative bidirectional sync approach, not directly applicable

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified via npm, versions confirmed, Context7 docs comprehensive
- Architecture: HIGH -- Yjs/Hocuspocus integration patterns well-documented; ECSON<->Y.Doc bridge pattern derived from official Yjs documentation and community consensus
- Pitfalls: HIGH -- Known issues (UndoManager multi-user, Vercel WebSocket) documented in official sources; feedback loop prevention is standard Yjs pattern
- 3D presence rendering: MEDIUM -- PlayCanvas line drawing API confirmed; frustum cone geometry is standard math; specific implementation needs validation during execution
- Avatar embodiment: MEDIUM -- Ground-plane constraint approach is reasonable but untested in this codebase; may need adjustments

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable domain; Hocuspocus/Yjs release cadence is monthly)
