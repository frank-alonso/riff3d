# Collaboration Presence Bug Fix Prompt

Fix collaboration presence bugs in the Riff3D editor. The collab server is running on `ws://localhost:1234` and editor on `http://localhost:3000`. Testing is done with the same Supabase account across multiple browser tabs.

## Current Symptoms

1. **Only 1 collaborator icon in the top bar** despite 3 tabs open. Should show 2 (one per remote tab).
2. **3D indicators (frustum cones, capsule avatars, name labels) only show for the most recently joined tab**. Tabs that joined earlier are invisible to everyone.
3. **Scene hierarchy presence indicators (colored left borders, presence chips) don't appear** when a remote tab selects an entity.
4. **Inspector remote-change flash is invisible** when a remote tab modifies a property.
5. **Locks work correctly** — all tabs can see locks from all other tabs. This is an important clue.

## Root Cause Analysis

### Why locks work but presence doesn't

Locks read directly from `awareness.getStates()` per `clientID` (see `lock-manager.ts:getLockedEntities`). They do NOT go through the `collaborators` array or `collaboratorPresence` Map in the store.

All other presence features (collaborator bar, hierarchy borders, 3D renderers) read from the `collaborators` array and `collaboratorPresence` Map — which are broken.

### The core bug: wrong dedup key in `use-awareness.ts`

In `apps/editor/src/collaboration/hooks/use-awareness.ts`, `handleAwarenessChange()` (lines 86-104) deduplicates collaborators by `user.id` (Supabase auth ID):

```typescript
const seenUsers = new Map<string, { id: string; name: string; color: string }>();
const presenceMap = new Map<string, CollaboratorPresence>();

for (const [, presence] of currentRemotes) {
  if (presence.user) {
    seenUsers.set(presence.user.id, { ... });     // keyed by user.id
    presenceMap.set(presence.user.id, { ... });    // keyed by user.id
  }
}
```

When the same Supabase user opens 3 tabs, all tabs have the same `user.id`. The `seenUsers` Map keeps only ONE entry → `collaborators` has 1 item → collaborator bar shows 1 icon.

The `presenceMap` also has only 1 entry for that user.id. Whichever tab was iterated last overwrites earlier tabs' selection/camera data. Result: only the last-processed tab's camera shows 3D indicators, and only its selection shows hierarchy borders.

**This dedup was added to fix React Strict Mode ghost collaborators (dev mode double-mount). It must be removed and the ghosts fixed properly at the source.**

### The ghost fix: clear awareness on cleanup

The React Strict Mode ghost was caused by the provider effect running twice in dev, creating a stale awareness entry that persists ~30s on the server. The correct fix is to explicitly clear the local awareness state in the provider's cleanup function BEFORE destroying the provider:

```typescript
providerRef.current?.awareness?.setLocalState(null);
providerRef.current?.destroy();
```

This immediately removes the awareness entry instead of relying on the server's awareness timeout.

### Inspector flash invisible

In `apps/editor/src/components/editor/inspector/inspector-panel.tsx`, `RemoteChangeIndicator` (line 147) was recently changed from a semi-transparent full-area overlay to a thin left border (`w-0.5`). The CSS animation `remoteFlash` fades from `opacity: 0.15` to `opacity: 0`. But 15% opacity on a 2px-wide element is invisible. The animation was designed for full-area overlays.

## Files to Modify

### 1. `apps/editor/src/collaboration/hooks/use-awareness.ts`

**Change**: Replace `user.id` keying with `clientID` keying.

Each tab has a unique Yjs awareness `clientID` (different from Supabase user ID). Use stringified clientID as the key for both `collaborators` and `presenceMap`. This allows multiple tabs of the same user to appear as separate collaborators.

In `handleAwarenessChange()`, change the loop from:
```typescript
for (const [, presence] of currentRemotes) {
  if (presence.user) {
    seenUsers.set(presence.user.id, { ... });
    presenceMap.set(presence.user.id, { ... });
  }
}
```

To iterate with the clientID key:
```typescript
for (const [clientId, presence] of currentRemotes) {
  if (presence.user) {
    const tabKey = String(clientId);
    // Use tabKey as identity so each tab is a separate collaborator
    seenUsers.set(tabKey, {
      id: tabKey,
      name: presence.user.name,
      color: presence.user.color,
    });
    presenceMap.set(tabKey, {
      selection: presence.selection ?? [],
      camera: presence.camera,
      mode: presence.mode,
    });
  }
}
editorStore.getState().setCollaborators([...seenUsers.values()]);
editorStore.getState().setCollaboratorPresence(presenceMap);
```

**Also update**: The `Collaborator.id` will now be a stringified clientID. All consumers of `collaborators[].id` and `presenceMap.get(id)` must use this same key. Check that `collaborator-bar.tsx`, `tree-node.tsx:useEntityPresence`, and `viewport-canvas.tsx` all cross-reference using the same key consistently.

### 2. `apps/editor/src/collaboration/provider.tsx`

**Change**: In the cleanup function (line 245), explicitly clear awareness state before destroying the provider:

```typescript
return () => {
  // ... existing setCollabState cleanup ...

  cleanupRef.current?.();
  cleanupRef.current = null;

  undoManagerRef.current?.destroy();
  undoManagerRef.current = null;

  // Clear awareness BEFORE destroying provider to immediately remove
  // this tab's presence entry. Without this, React Strict Mode
  // double-mount leaves stale awareness entries for ~30 seconds.
  providerRef.current?.awareness?.setLocalState(null);
  providerRef.current?.destroy();
  providerRef.current = null;

  // ... rest of cleanup ...
};
```

### 3. `apps/editor/src/components/editor/inspector/inspector-panel.tsx`

**Change**: Fix `RemoteChangeIndicator` to be visible. The current thin-border approach with `opacity: 0.15` is invisible.

Replace the current implementation (lines 163-172) with one that's actually visible. Options:
- Use a subtle background flash: `absolute inset-0` with the user's color at low opacity, fading out. Make sure the parent has `position: relative` (it does — the EntityHeader and each component section are wrapped in `<div className="relative">`).
- OR keep the left border approach but use full opacity: change from `animate-[remoteFlash_1s_ease-out_forwards]` to `opacity-100` with a `animate-[remoteFlash_1s_ease-out_forwards]` where the keyframes go from `opacity: 1` to `opacity: 0`.

Recommended approach: restore a scoped background flash (the containers are now properly relative-positioned):
```tsx
return (
  <div className="pointer-events-none absolute inset-0 z-10">
    <div
      className="absolute inset-y-0 left-0 w-0.5"
      style={{ backgroundColor: match.color }}
    />
    <div
      className="absolute inset-0 animate-[remoteFlash_0.5s_ease-out_forwards]"
      style={{ backgroundColor: match.color, opacity: 0.12 }}
    />
  </div>
);
```

This gives both a persistent thin left accent bar AND a brief area flash, scoped to the relative container.

### 4. `apps/editor/src/components/editor/hierarchy/tree-node.tsx`

**Verify**: `useEntityPresence` (line 57) does:
```typescript
return collaborators.filter((user) => {
  const presence = presenceStates.get(user.id);
  return presence?.selection?.includes(entityId);
});
```

After fix #1, `user.id` is the stringified clientID, and `presenceStates` is keyed by the same stringified clientID. This cross-reference should work correctly without changes. **Verify this is the case.**

### 5. `apps/editor/src/components/editor/viewport/viewport-canvas.tsx`

**Verify**: The presence subscription (line 410-440) does:
```typescript
for (const collab of collaborators) {
  const presence = presenceMap.get(collab.id);
  if (presence?.camera) { ... }
}
```

After fix #1, `collab.id` is the stringified clientID, and `presenceMap` is keyed by the same stringified clientID. This should work correctly. **Verify this is the case.**

## Verification Steps

After making changes:

1. Run `pnpm turbo typecheck test --filter @riff3d/editor` — must pass all 58 tests with no type errors.
2. Open 3 tabs to the same project (same Supabase account, `http://localhost:3000`).
3. **Collaborator bar**: Each tab should show 2 colored circles in the top bar (one for each OTHER tab).
4. **3D presence**: All tabs should show frustum cones / name labels for both other tabs (not just the latest joiner).
5. **Hierarchy presence**: Select an entity in Tab A → Tab B and Tab C should show a colored left border and presence chip on that entity in the scene hierarchy.
6. **Inspector flash**: In Tab A, select an entity and modify a property in the inspector → Tab B (if viewing the same entity) should show a brief colored flash on the changed section.
7. **Locks**: Should continue working as before — locking an entity in one tab shows the lock icon in all other tabs.

## Key Architectural Insight

The `collaborators` array and `collaboratorPresence` Map in the Zustand store are the **single source of truth** for all 2D/3D presence rendering. Everything except locks reads from them:
- `collaborator-bar.tsx` → reads `collaborators`
- `tree-node.tsx:useEntityPresence` → cross-references `collaborators` with `collaboratorPresence`
- `viewport-canvas.tsx` presence subscription → cross-references `collaborators` with `collaboratorPresence`

Locks work differently — they read directly from `awareness.getStates()` via `lock-manager.ts`, bypassing the store entirely. That's why locks work while everything else is broken.

The fix is to ensure the store data correctly represents each tab as a separate collaborator, keyed by awareness `clientID` rather than Supabase `user.id`.
