# Phase 5: Collaboration - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Real-time co-editing of 3D scenes. Two or more users can edit the same project simultaneously with presence awareness, entity locking, conflict resolution, embodied avatars, and independent undo stacks. Collaboration backend selection (Hocuspocus v3 leading candidate) is decided during planning/research. Game features, templates, and AI authoring are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Presence in 3D viewport
- Collaborators shown as a floating name label + camera frustum cone (colored wireframe showing where they're looking)
- Colors auto-assigned from a preset palette (system-assigned, guaranteed contrast between users)
- Presence indicators always visible (no toggle to hide)
- When in avatar mode: capsule avatar replaces the frustum cone
- When not in avatar mode: frustum cone + name label always visible to others

### Presence in 2D panels
- Colored border on entity rows in hierarchy panel showing other users' selections
- Small colored avatar chip (initial/icon) next to the selected item showing who
- Both border + chip displayed together

### Locking behavior
- Manual lock only — user clicks an explicit lock icon/button on an entity
- No auto-lock on selection or edit
- Locking an entity locks it and its descendants (per success criteria)
- Lock auto-releases when user deselects the entity
- Lock auto-releases on disconnect (prevents stale locks from disconnected users)
- When someone tries to edit a locked entity: inspector opens in read-only mode, values visible but not editable, lock holder name displayed

### Locking visuals
- Lock icon shown on entity row in hierarchy panel
- Subtle color tint/outline in 3D viewport matching the lock holder's user color
- Both hierarchy icon + viewport tint displayed together

### Avatar embodiment
- Simple colored capsule with floating name label above
- WASD walk mode for movement (FPS-style, ground-plane based)
- Explicit toolbar toggle to switch between normal editor camera and embodied avatar mode
- Not always embodied — avatar mode is opt-in per user
- When not in avatar mode, others still see camera frustum cone (presence never hidden)

### Sync & conflict feedback
- Silent sync by default — remote changes just appear in the scene seamlessly
- When viewing an entity in the inspector and another user changes one of its properties: brief color flash/highlight on the changed property in the other user's color
- Collaborative activity feed is a natural extension of the existing PatchOps log viewer carry-forward (Phase 4 pending todo), but not a hard requirement for this phase
- Join/leave: both toast notification ("Alice joined"/"Alice left") AND persistent collaborator bar in toolbar showing active users
- Concurrent edits on different properties of same entity: both preserved (Yjs CRDT merge), with brief color highlight on the changed property in inspector

### Offline behavior
- Banner displayed when connection lost: "Offline — changes will sync when reconnected"
- Editor goes read-only while offline (prevents divergence)
- Reconnection re-syncs and restores editing capability

### Claude's Discretion
- Collaboration backend selection (Hocuspocus v3 vs alternatives — researcher will evaluate)
- Exact palette colors and contrast algorithm for auto-assignment
- Frustum cone geometry (size, opacity, field of view representation)
- Capsule avatar dimensions and label positioning
- Toast notification duration and styling
- Lock icon design and placement
- Property highlight animation timing and easing
- Collaborator bar layout and overflow behavior
- Reconnection strategy and retry logic

</decisions>

<specifics>
## Specific Ideas

- "It would be great if you can toggle a feed panel to see all edits (all PatchOps and who did them)" — this builds on the Phase 4 carry-forward for PatchOps operation log viewer UI. Not a hard Phase 5 requirement, but if the log viewer gets built, extending it with user attribution is natural.
- Two presence modes: frustum cone (default editor camera) vs capsule avatar (explicit walk mode) — same user, different visual depending on mode
- Read-only inspector for locked entities rather than blocking edits entirely — informative, not frustrating

</specifics>

<deferred>
## Deferred Ideas

- PatchOps operation log viewer UI with collaborative attribution — extends Phase 4 carry-forward, could land in Phase 5 if time permits but not a hard requirement
- Voice/text chat during collaboration — Phase v2.0 (COMM-01, COMM-02, COMM-03)
- Spectator mode — Phase v2.0 (COMP-02)

</deferred>

---

*Phase: 05-collaboration*
*Context gathered: 2026-02-20*
