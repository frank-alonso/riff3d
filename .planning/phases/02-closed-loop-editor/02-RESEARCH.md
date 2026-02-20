# Phase 2: Closed-Loop Editor - Research

**Researched:** 2026-02-19
**Domain:** 3D editor shell, PlayCanvas adapter, auth, project management, editor UX
**Confidence:** HIGH (core stack verified via official docs and engine source)

## Summary

Phase 2 transforms the contract packages from Phase 1 into a working 3D editor. The core challenge is bridging React (editor panels) with PlayCanvas (viewport canvas) through a Zustand store, while ensuring every user action flows through PatchOps. PlayCanvas 2.16 ships with built-in gizmos (TranslateGizmo, RotateGizmo, ScaleGizmo), camera controllers (OrbitController, FlyController), and GLB import via container assets -- all available as `extras` exports from the npm package, eliminating the need for custom implementations of these complex systems.

The editor shell uses a VS Code-inspired layout with fixed panels, built with `react-resizable-panels` for resize handles. Authentication goes through Supabase with `@supabase/ssr` for cookie-based server-side auth. The Zustand vanilla store pattern is critical: the PlayCanvas adapter subscribes to store changes outside React via `store.subscribe()`, while React panels use the same store via hooks.

**Primary recommendation:** Lean heavily on PlayCanvas extras (gizmos, camera controllers, container assets) and Supabase managed services (auth, storage, Postgres) to minimize custom code. The planner's main architectural challenge is the Zustand store design -- it must bridge React and non-React worlds cleanly while keeping PatchOps as the single source of truth for all mutations.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- VS Code-style layout: activity bar on far left with icon tabs, left sidebar panel (hierarchy/assets), center viewport, right sidebar for inspector
- Fixed panel positions for Phase 2 -- no drag-and-drop docking or user-configurable layouts
- Editing tools live in a floating toolbar embedded in the viewport (Figma-style), not in the top bar
- Top bar is minimal: project name, save status, and play/pause/stop controls centered
- Asset browser has dual presence: activity bar tab for full browsing + compact bottom strip below viewport for drag-and-drop into scene
- Dark theme as the default and only theme shipped in Phase 2
- Design with theming in mind (CSS custom properties / Tailwind theme tokens) so light theme can be added later without a rewrite
- Card grid layout for project listing -- thumbnail cards showing project name, relative timestamp, entity count, and collaborator avatars
- "New Project" opens a modal with blank scene option and template slots (templates locked/placeholder until Phase 8, but the UI slot exists now)
- Project name field in the creation modal
- Empty dashboard (new user, no projects) shows a hero CTA -- welcoming illustration/graphic with a prominent "Create your first project" button
- Camera: both game-style (right-click+drag to look, WASD to fly) and orbit mode (Alt+click to orbit, Alt+middle to pan). Default is game-style. Toggle via key shortcut or UI button
- Gizmos: standard RGB axes (red=X, green=Y, blue=Z) for translate, rotate, and scale. Familiar industry-standard style
- Selection: click to select, Shift+click to add/remove, drag rectangle for box/marquee selection
- Default blank scene: starter kit -- ground plane, sky/environment, directional light, plus a couple of placeholder objects (cube, sphere) to immediately show the pipeline working
- In-place play-test transition: viewport stays in the same location, colored border/tint signals play mode (like Unity's blue tint)
- Panels collapse when entering play mode but are "peekable" -- user can hover or toggle panels back temporarily to inspect runtime values
- Play/Pause/Stop controls centered in the top bar, always visible regardless of mode
- On Stop: discard all runtime changes (scene resets to pre-play state). Aspirational: "offer to keep changes" prompt -- planner should evaluate feasibility during planning; if too many edge cases, fall back to discard-all and defer

### Claude's Discretion
- Loading skeleton design and spinner placement
- Exact spacing, typography, icon set
- Panel resize handle behavior and min/max widths
- Error state handling and toast/notification design
- Keyboard shortcut assignments (beyond camera toggle)
- Auto-save interval and debounce strategy
- Thumbnail generation approach (viewport screenshot vs. server-side render)

### Deferred Ideas (OUT OF SCOPE)
- Configurable/dockable panel layout (drag panels, save/restore layouts) -- user wants this eventually, explore open-source docking libraries during research but don't ship in Phase 2
- Light theme -- design with theming in mind but ship dark-only for now
- "Keep runtime changes" prompt on Stop -- evaluate feasibility during planning, defer if too complex
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EDIT-01 | 3D viewport with orbit/pan/zoom and WASD fly-camera | PlayCanvas `OrbitController` + `FlyController` in extras module; `KeyboardMouseSource` for input; toggle between modes via store state |
| EDIT-02 | Transform gizmos (translate/rotate/scale) with configurable snap-to-grid | PlayCanvas `TranslateGizmo`, `RotateGizmo`, `ScaleGizmo` in extras; built-in `snap` and `snapIncrement` properties |
| EDIT-03 | Scene hierarchy tree view with drag-to-reparent, multi-select, search/filter | `react-arborist` library provides virtualized tree with drag-drop, rename, search, multi-select; reparent triggers `Reparent` PatchOp |
| EDIT-04 | Properties/inspector panel auto-generated from component schemas | Component registry `editorHints` map to React widget renderers (slider, color picker, checkbox, etc.); iterate `listComponents()` |
| EDIT-05 | Undo/redo via invertible PatchOps with per-user undo stacks | PatchOps engine already returns inverse ops; maintain two stacks (undo/redo) in Zustand store; apply inverse to undo |
| EDIT-06 | Copy/paste/duplicate within same scene | Clipboard API `navigator.clipboard.writeText()` with JSON-serialized entity snapshots; paste generates new IDs via `CreateEntity` + `AddComponent` PatchOps |
| EDIT-07 | Grid/snap system with configurable grid size and rotation snap | PlayCanvas gizmo `snap`/`snapIncrement` for transform snapping; custom grid plane rendered as a mesh entity in the scene |
| EDIT-08 | Save and auto-save (ECSON to persistent storage) | Supabase Postgres (JSONB column) for ECSON documents; debounced auto-save (5s idle + on significant change); Supabase Storage for binary assets |
| EDIT-09 | Asset library/object palette with curated starter assets | Supabase Storage bucket for starter GLB/texture assets; asset browser panel reads from registry; drag-and-drop spawns `CreateEntity` + `AddComponent` PatchOps |
| EDIT-10 | Play-test from editor (editor -> runtime transition without page reload) | Snapshot ECSON doc via `deepClone()` before play; set `app.timeScale = 1`; on Stop, restore snapshot and recompile IR; colored border via CSS class toggle |
| RNDR-01 | PBR materials (color, metalness, roughness, emissive) | PlayCanvas `StandardMaterial` with `diffuse`, `metalness`, `gloss` (1-roughness), `emissive`, `emissiveIntensity` |
| RNDR-02 | Lighting (directional, point, spot + ambient/environment) | PlayCanvas `light` component with type: 'directional'/'omni'/'spot'; `scene.ambientLight` for ambient; environment atlas for IBL |
| RNDR-03 | Camera entities (perspective and orthographic) | PlayCanvas `camera` component with `projection` (PROJECTION_PERSPECTIVE / PROJECTION_ORTHOGRAPHIC); separate editor camera from scene cameras |
| RNDR-04 | GLB/glTF import with textures, materials, and embedded animations | `app.assets.loadFromUrl(url, 'container', callback)` then `asset.resource.instantiateRenderEntity()`; extracts hierarchy, materials, textures |
| RNDR-05 | Environment settings (skybox color/image, fog type/density, ambient light) | `scene.skybox`, `scene.fog` (FogParams), `scene.ambientLight`, `scene.exposure`; map from ECSON `EnvironmentSettings` |
| ADPT-01 | PlayCanvas adapter compiles Canonical IR to PlayCanvas runtime | New `packages/adapter-playcanvas` package; reads `CanonicalScene`, creates PlayCanvas entity hierarchy, maps components to PC components, handles incremental deltas |
| PROJ-01 | User accounts and authentication (Google, Discord, GitHub) | Supabase Auth with `@supabase/ssr`; `signInWithOAuth({ provider })` for social logins; PKCE flow with callback route |
| PROJ-02 | Project list/dashboard with thumbnails and last-modified dates | Supabase Postgres `projects` table; thumbnails via `canvas.toDataURL()` stored in Supabase Storage; card grid UI |
| PROJ-03 | Shareable project links (deep-link into specific project/scene) | Next.js dynamic route `/editor/[projectId]`; Supabase RLS policies for read access; share URL = `{origin}/editor/{projectId}` |
</phase_requirements>

## Standard Stack

### Core (already decided from Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PlayCanvas | ~2.16 | 3D engine, gizmos, camera controls, GLB import | Has built-in gizmos, camera controllers, and container asset system in `extras` module; the primary adapter engine |
| Next.js | 16.x | Editor app framework, routing, SSR | Already scaffolded in Phase 1; App Router for file-based routing |
| React | 19.x | Editor panel UI components | Already in stack; concurrent features for responsive UI |
| Zustand | ^5.0 | Editor-viewport state bridge | Vanilla store API for non-React (PlayCanvas) + React hooks for panels |
| Tailwind CSS | 4.x | Styling with dark theme tokens | CSS custom properties approach enables future theming |
| Supabase | latest | Auth, Postgres, Storage | Managed service for auth + data + file storage |
| Zod | ^4.3 | Schema validation (contracts) | Already the source of truth from Phase 1 |

### New Dependencies for Phase 2

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | ^2 | Supabase client | Auth, DB queries, storage uploads |
| `@supabase/ssr` | ^0.5 | Server-side auth for Next.js | Cookie-based auth, middleware, server client |
| `react-resizable-panels` | ^2.x | Resizable panel layout | VS Code-style sidebar/viewport/inspector resize |
| `react-arborist` | ^3.x | Tree view with drag-drop | Scene hierarchy panel |
| `react-hotkeys-hook` | ^4.x | Keyboard shortcut binding | Undo/redo, gizmo mode switching, camera toggle |
| `lucide-react` | ^0.4x | Icon library | Activity bar icons, toolbar icons, panel headers |
| `sonner` | ^2.x | Toast notifications | Save confirmations, error messages, warnings |
| `nanoid` | ^5.x | ID generation | Already in catalog; new entity/asset IDs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-resizable-panels | allotment | allotment has fewer downloads, less active maintenance; react-resizable-panels is battle-tested, used by shadcn |
| react-arborist | react-dnd-treeview | react-arborist has virtualization built-in, better for large scenes (1000+ entities) |
| lucide-react | @heroicons/react, react-icons | Lucide is tree-shakable, consistent style, pairs well with Tailwind and shadcn |
| sonner | react-hot-toast | Sonner is the shadcn default, supports rich toasts, tiny bundle |
| react-hotkeys-hook | tinykeys, hotkeys-js | react-hotkeys-hook integrates naturally with React component lifecycle and refs |

### Docking Libraries (Deferred -- awareness only)

| Library | Weekly Downloads | Stars | Notes |
|---------|-----------------|-------|-------|
| flexlayout-react | 47k | 1.2k | Mature, React-only, tabbed docking |
| dockview | 35k | 3k | Zero-dep, supports React/Vue/Angular, IDE-like |
| rc-dock | 10k | 800 | Lighter, React-only |

**Recommendation for future Phase:** `dockview` -- zero-dependency, framework-agnostic core, most modern API, actively maintained.

### Installation

```bash
# In apps/editor
pnpm add @supabase/supabase-js @supabase/ssr react-resizable-panels react-arborist react-hotkeys-hook lucide-react sonner zustand

# In packages/adapter-playcanvas (new package)
pnpm add playcanvas
```

## Architecture Patterns

### Recommended Project Structure

```
apps/editor/src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login page with social auth buttons
│   │   └── auth/callback/route.ts  # OAuth callback handler
│   ├── (dashboard)/
│   │   └── page.tsx                # Project list dashboard
│   ├── editor/[projectId]/
│   │   ├── page.tsx                # Editor page (loads project)
│   │   └── layout.tsx              # Editor shell layout
│   ├── layout.tsx                  # Root layout (Supabase provider)
│   └── middleware.ts               # Auth middleware
├── components/
│   ├── editor/
│   │   ├── shell/                  # EditorShell, ActivityBar, TopBar
│   │   ├── viewport/               # ViewportCanvas, FloatingToolbar, GridOverlay
│   │   ├── hierarchy/              # SceneTree, TreeNode
│   │   ├── inspector/              # InspectorPanel, PropertyWidgets
│   │   ├── assets/                 # AssetBrowser, AssetStrip, AssetCard
│   │   └── playtest/               # PlayControls, PlayModeBorder
│   ├── dashboard/
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectGrid.tsx
│   │   ├── NewProjectModal.tsx
│   │   └── EmptyState.tsx
│   └── ui/                         # Shared primitives (Button, Modal, Input, etc.)
├── stores/
│   ├── editor-store.ts             # Main Zustand store (vanilla + React)
│   ├── slices/
│   │   ├── scene-slice.ts          # ECSON doc state, selection, undo/redo stacks
│   │   ├── viewport-slice.ts       # Camera mode, gizmo mode, grid settings
│   │   ├── ui-slice.ts             # Panel visibility, active sidebar tab
│   │   └── playtest-slice.ts       # Play/pause/stop state, ECSON snapshot
│   └── hooks.ts                    # useEditorStore(), typed selectors
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   ├── server.ts               # Server Supabase client
│   │   └── middleware.ts            # Auth session refresh
│   ├── adapter/                    # Thin bridge to @riff3d/adapter-playcanvas
│   └── patchops/                   # PatchOp dispatch helpers
└── hooks/
    ├── use-keyboard-shortcuts.ts
    ├── use-auto-save.ts
    └── use-project.ts

packages/adapter-playcanvas/
├── src/
│   ├── index.ts
│   ├── adapter.ts                  # PlayCanvasAdapter implements EngineAdapter
│   ├── scene-builder.ts            # IR -> PlayCanvas entity hierarchy
│   ├── component-mappers/          # Per-component-type mapping functions
│   │   ├── mesh-renderer.ts
│   │   ├── light.ts
│   │   ├── camera.ts
│   │   ├── material.ts
│   │   └── index.ts
│   ├── environment.ts              # IR environment -> PC scene settings
│   ├── delta-applier.ts            # Incremental IR delta application
│   ├── gizmo-manager.ts            # TranslateGizmo/RotateGizmo/ScaleGizmo lifecycle
│   ├── camera-controller.ts        # OrbitController/FlyController setup
│   ├── selection-manager.ts        # Raycasting, framebuffer picking
│   └── grid.ts                     # Grid plane rendering
└── __tests__/
```

### Pattern 1: Zustand Vanilla Store Bridge

**What:** A single Zustand store created with `createStore` (vanilla, not `create`) that both React components and the PlayCanvas adapter subscribe to.

**When to use:** Always -- this is the core communication pattern between editor and viewport.

**Example:**

```typescript
// stores/editor-store.ts
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface EditorState {
  // Scene state
  ecsonDoc: SceneDocument | null;
  selectedEntityIds: string[];

  // Viewport state
  gizmoMode: 'translate' | 'rotate' | 'scale';
  cameraMode: 'fly' | 'orbit';
  snapEnabled: boolean;
  gridSize: number;

  // Undo/redo
  undoStack: PatchOp[];
  redoStack: PatchOp[];

  // Actions
  dispatchOp: (op: PatchOp) => void;
  undo: () => void;
  redo: () => void;
  setSelection: (ids: string[]) => void;
  setGizmoMode: (mode: 'translate' | 'rotate' | 'scale') => void;
}

// Vanilla store -- accessible from both React and PlayCanvas
export const editorStore = createStore<EditorState>()(
  subscribeWithSelector((set, get) => ({
    ecsonDoc: null,
    selectedEntityIds: [],
    gizmoMode: 'translate',
    cameraMode: 'fly',
    snapEnabled: false,
    gridSize: 1,
    undoStack: [],
    redoStack: [],

    dispatchOp: (op) => {
      const { ecsonDoc, undoStack } = get();
      if (!ecsonDoc) return;
      const inverse = applyOp(ecsonDoc, op);  // from @riff3d/patchops
      set({
        ecsonDoc: { ...ecsonDoc },  // trigger re-render
        undoStack: [...undoStack, inverse],
        redoStack: [],  // clear redo on new op
      });
    },

    undo: () => { /* pop undoStack, apply, push to redoStack */ },
    redo: () => { /* pop redoStack, apply, push to undoStack */ },
    setSelection: (ids) => set({ selectedEntityIds: ids }),
    setGizmoMode: (mode) => set({ gizmoMode: mode }),
  }))
);

// React hook wrapper
export function useEditorStore<T>(selector: (state: EditorState) => T): T {
  return useStore(editorStore, selector);
}
```

```typescript
// In PlayCanvas adapter (non-React):
import { editorStore } from '../stores/editor-store';

// Subscribe to selection changes
editorStore.subscribe(
  (state) => state.selectedEntityIds,
  (selectedIds) => {
    gizmo.detach();
    const nodes = selectedIds.map(id => entityMap.get(id)).filter(Boolean);
    if (nodes.length > 0) gizmo.attach(nodes);
  }
);

// Subscribe to gizmo mode changes
editorStore.subscribe(
  (state) => state.gizmoMode,
  (mode) => switchGizmo(mode)
);

// Read state imperatively
const doc = editorStore.getState().ecsonDoc;
```

### Pattern 2: PatchOps-First Mutation Flow

**What:** Every user edit (gizmo drag, inspector value change, hierarchy reparent) creates a PatchOp, dispatches it through the store, which applies it to the ECSON doc and triggers IR recompilation + adapter delta.

**When to use:** Every mutation. No exceptions.

**Flow:**
```
User Action (gizmo drag / inspector edit / hierarchy reparent)
  → Create PatchOp(s)
  → store.dispatchOp(op)
  → applyOp(ecsonDoc, op) → returns inverse
  → Push inverse to undoStack
  → Recompile Canonical IR (or apply delta)
  → Adapter updates PlayCanvas scene
  → React panels re-render via useEditorStore selectors
```

### Pattern 3: Inspector Auto-Generation from Component Registry

**What:** The inspector panel iterates over a selected entity's components, looks up each `ComponentDefinition` from the registry, and renders form widgets based on `editorHints`.

**When to use:** Inspector panel for any entity.

**Example:**

```typescript
// Inspector renders based on editorHints
function ComponentInspector({ entityId, componentType }: Props) {
  const def = getComponentDef(componentType);
  if (!def) return null;

  return (
    <div>
      <h3>{def.type}</h3>
      {Object.entries(def.editorHints).map(([propName, hint]) => (
        <PropertyWidget
          key={propName}
          hint={hint}
          value={getCurrentValue(entityId, componentType, propName)}
          onChange={(value) => {
            store.dispatchOp(createSetComponentPropertyOp(
              entityId, componentType, propName, value
            ));
          }}
        />
      ))}
    </div>
  );
}

// PropertyWidget dispatches to the right widget
function PropertyWidget({ hint, value, onChange }) {
  switch (hint.editorHint) {
    case 'slider': return <SliderField min={hint.min} max={hint.max} .../>;
    case 'color': return <ColorPicker value={value} onChange={onChange} />;
    case 'dropdown': return <Select options={...} .../>;
    case 'checkbox': return <Toggle checked={value} .../>;
    case 'vec3': return <Vec3Input value={value} .../>;
    case 'asset-ref': return <AssetRefPicker type={hint.assetType} .../>;
    // ...
  }
}
```

### Pattern 4: Play-Test Mode Transition

**What:** Snapshot the ECSON doc before play, let PlayCanvas run with full `timeScale`, on Stop restore snapshot and recompile.

**When to use:** EDIT-10 play-test requirement.

**Example:**

```typescript
// playtest-slice.ts
interface PlaytestSlice {
  isPlaying: boolean;
  isPaused: boolean;
  ecsonSnapshot: SceneDocument | null;

  play: () => void;
  pause: () => void;
  stop: () => void;
}

// On Play:
play: () => {
  const { ecsonDoc } = get();
  set({
    isPlaying: true,
    isPaused: false,
    ecsonSnapshot: deepClone(ecsonDoc),  // snapshot for restore
  });
  // PlayCanvas adapter: enable physics, set timeScale = 1
}

// On Stop:
stop: () => {
  const { ecsonSnapshot } = get();
  set({
    isPlaying: false,
    isPaused: false,
    ecsonDoc: ecsonSnapshot,  // restore pre-play state
    ecsonSnapshot: null,
    undoStack: [],  // clear -- play session ops not undoable
    redoStack: [],
  });
  // Recompile IR from restored doc, adapter rebuilds scene
}
```

### Pattern 5: Supabase Auth with Next.js App Router

**What:** Cookie-based auth using `@supabase/ssr` with middleware for session refresh.

**When to use:** All auth flows.

**Key files:**
- `lib/supabase/client.ts` -- `createBrowserClient()` for client components
- `lib/supabase/server.ts` -- `createServerClient()` with `cookies()` for Server Components / Route Handlers
- `middleware.ts` -- session refresh via `supabase.auth.getUser()`
- `app/(auth)/login/page.tsx` -- social login buttons calling `signInWithOAuth({ provider: 'github' | 'google' | 'discord' })`
- `app/(auth)/auth/callback/route.ts` -- `exchangeCodeForSession(code)` callback

**Critical:** Use `getUser()` not `getSession()` for server-side auth checks. `getUser()` validates the JWT; `getSession()` trusts the cookie without verification.

### Anti-Patterns to Avoid

- **Direct ECSON mutation from UI:** Never modify `ecsonDoc` directly. Always go through `dispatchOp()` which calls `applyOp()` and captures the inverse.
- **React components rendering 3D:** The PlayCanvas canvas must NOT be a React component. Use a `<canvas ref={...}>` and initialize PlayCanvas imperatively in a `useEffect`. React manages panels; PlayCanvas manages the canvas.
- **Full IR recompile on every edit:** For property changes, compute a delta and apply it incrementally via the adapter's `applyDelta()` method. Full recompile only on structural changes (add/remove entity, reparent).
- **Storing PlayCanvas objects in Zustand:** Never put PlayCanvas `Entity`, `Material`, or `Application` instances in the store. Store only serializable data (ECSON, selection IDs, mode enums). The adapter maintains its own internal map of PlayCanvas objects keyed by entity/asset IDs.
- **Using deprecated `@supabase/auth-helpers-nextjs`:** Use `@supabase/ssr` exclusively. The auth-helpers package is deprecated.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transform gizmos | Custom drag handles + ray intersection + axis constraints | PlayCanvas `TranslateGizmo`, `RotateGizmo`, `ScaleGizmo` | Complex math (gimbal lock, screen-space projection), already battle-tested in PC editor |
| Camera orbit/fly | Custom mouse/keyboard state machine | PlayCanvas `OrbitController`, `FlyController`, `KeyboardMouseSource` | Damping, pitch clamping, scroll zoom, multi-input already handled |
| GLB/glTF parsing | Custom loader | `app.assets.loadFromUrl(url, 'container', cb)` + `instantiateRenderEntity()` | Handles Draco, textures, materials, animations, hierarchy extraction |
| PBR material system | Custom shader pipeline | PlayCanvas `StandardMaterial` | Physically-based rendering with metalness/roughness workflow built-in |
| Resizable panels | Custom drag resize logic | `react-resizable-panels` | Keyboard accessible, persists sizes, handles edge cases |
| Tree with drag-drop | Custom tree + react-dnd | `react-arborist` | Virtualized, handles large trees, built-in drag-drop + rename + search |
| Auth session management | Custom JWT refresh logic | `@supabase/ssr` middleware | Handles cookie rotation, PKCE flow, token refresh automatically |
| Toast notifications | Custom portal + animation | `sonner` | Stacking, dismissal, promise toasts, accessible, 2-3KB |
| File storage | Custom S3 integration | Supabase Storage | CDN, RLS policies, signed URLs, public buckets, integrated with auth |

**Key insight:** PlayCanvas's `extras` module (gizmos, camera controllers, view cube) provides exactly the editor-specific functionality needed. The adapter layer should delegate to these systems rather than reimplementing them.

## Common Pitfalls

### Pitfall 1: PlayCanvas Canvas Lifecycle in React

**What goes wrong:** PlayCanvas `Application` is created in a `useEffect`, but React Strict Mode runs effects twice, creating two applications on the same canvas. Or the canvas is unmounted/remounted during navigation, leaving the app in a broken state.

**Why it happens:** React 19's strict mode double-invokes effects in development. Next.js App Router may unmount/remount during navigation.

**How to avoid:**
1. Use a cleanup function in `useEffect` that calls `app.destroy()`
2. Use a ref to track whether the app is already initialized
3. Consider creating the PlayCanvas app in a module-level singleton rather than in a component effect
4. Use `useRef` for the canvas element, not `document.getElementById`

**Warning signs:** Console errors about duplicate canvas contexts, gizmos not responding, double event handlers.

### Pitfall 2: Zustand Selector Equality and Render Storms

**What goes wrong:** React panels re-render on every PatchOp because the selector returns a new object reference each time (e.g., `state.ecsonDoc.entities[selectedId]`).

**Why it happens:** Zustand uses `Object.is` by default. Creating derived objects in selectors produces new references.

**How to avoid:**
1. Use `subscribeWithSelector` middleware (already recommended)
2. Select primitive values where possible (strings, numbers, booleans)
3. For derived data, use `useShallow` or pass a custom equality function
4. Memoize derived state outside the selector

**Warning signs:** Inspector flickering, laggy gizmo interaction, high React DevTools highlight frequency.

### Pitfall 3: PatchOp Ordering During Gizmo Drag

**What goes wrong:** Gizmo fires `transform:move` events at 60fps, generating a flood of `SetProperty` PatchOps. Each triggers IR recompile + undo stack push, causing lag and enormous undo histories.

**Why it happens:** Naive implementation dispatches an op per mouse move event.

**How to avoid:**
1. During gizmo drag (`transform:start` to `transform:end`), update the PlayCanvas entity position directly (bypass PatchOps temporarily for visual feedback)
2. On `transform:end`, create a single `SetProperty` op with the final value and the pre-drag value as `previousValue`
3. This produces one undoable op per drag gesture, not hundreds

**Warning signs:** Undo requires clicking 60+ times to reverse a single drag, memory usage climbing during drags.

### Pitfall 4: PlayCanvas Entity Map Desync

**What goes wrong:** The adapter's internal `Map<string, pc.Entity>` gets out of sync with the ECSON document when entities are created/deleted via PatchOps but the adapter isn't notified.

**Why it happens:** Not subscribing to the right store changes, or handling structural changes (create/delete) differently from property changes.

**How to avoid:**
1. Subscribe to `ecsonDoc` changes with a diff algorithm that detects added/removed entities
2. For structural changes, rebuild the affected subtree
3. For property changes, apply incremental delta to existing PlayCanvas entities
4. Use the IR `nodeIndex` for O(1) lookup

**Warning signs:** Ghost entities visible in viewport but not in hierarchy, entities missing from viewport after creation.

### Pitfall 5: Supabase RLS Policy Gaps

**What goes wrong:** Users can see/edit other users' projects, or unauthenticated users can access project data.

**Why it happens:** Missing or misconfigured Row Level Security policies on Supabase tables.

**How to avoid:**
1. Enable RLS on ALL tables by default
2. Create explicit policies: `SELECT` where `auth.uid() = owner_id`, `INSERT` where `auth.uid() = owner_id`, etc.
3. For shareable links (PROJ-03), add a `is_public` column with a separate read policy
4. Test RLS policies with the Supabase SQL editor using `set role authenticated; set request.jwt.claims = '...'`

**Warning signs:** 403 errors in production, empty project lists, data visible to wrong users.

### Pitfall 6: Canvas.toDataURL() for Thumbnails Fails with WebGL

**What goes wrong:** Calling `canvas.toDataURL()` on a WebGL canvas returns a blank or black image.

**Why it happens:** WebGL clears the drawing buffer after composition. By the time `toDataURL()` runs, the buffer is empty.

**How to avoid:**
1. Set `preserveDrawingBuffer: true` in PlayCanvas Application options (performance cost -- only enable when capturing)
2. OR call `toDataURL()` immediately after `app.render()` in the same frame, before buffer clear
3. Best approach: Use `app.renderNextFrame = true; app.autoRender = false;` temporarily, render one frame, capture, restore

**Warning signs:** Blank/black thumbnails in project dashboard.

### Pitfall 7: Next.js 16 and PlayCanvas SSR Conflict

**What goes wrong:** Next.js tries to server-render the editor page, but PlayCanvas requires `window`, `document`, and WebGL context.

**Why it happens:** Next.js App Router server-renders by default.

**How to avoid:**
1. Mark the viewport component with `'use client'` directive
2. Use dynamic import with `ssr: false` for the PlayCanvas initialization component: `const Viewport = dynamic(() => import('./Viewport'), { ssr: false })`
3. Guard any `window`/`document` access with `typeof window !== 'undefined'`

**Warning signs:** "window is not defined" errors during build, hydration mismatches.

## Code Examples

### PlayCanvas Application Setup (Standalone)

```typescript
// Source: https://developer.playcanvas.com/user-manual/engine/standalone/
import * as pc from 'playcanvas';

export function createPlayCanvasApp(canvas: HTMLCanvasElement): pc.Application {
  const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    keyboard: new pc.Keyboard(window),
  });

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  // Handle resize
  window.addEventListener('resize', () => app.resizeCanvas());

  return app;
}
```

### Gizmo Setup

```typescript
// Source: https://api.playcanvas.com/engine/classes/TransformGizmo.html
import {
  TranslateGizmo, RotateGizmo, ScaleGizmo,
  Gizmo, GIZMOSPACE_WORLD, GIZMOSPACE_LOCAL
} from 'playcanvas';

// Create gizmo layer
const gizmoLayer = Gizmo.createLayer(app);

// Create gizmos
const translateGizmo = new TranslateGizmo(camera, gizmoLayer);
const rotateGizmo = new RotateGizmo(camera, gizmoLayer);
const scaleGizmo = new ScaleGizmo(camera, gizmoLayer);

// Configure
translateGizmo.snap = true;
translateGizmo.snapIncrement = 0.5;
translateGizmo.coordSpace = GIZMOSPACE_WORLD;

// Attach to selected entities
translateGizmo.attach(selectedNodes);

// Listen for transform events
translateGizmo.on('transform:start', () => {
  capturedPosition = selectedNodes[0].getPosition().clone();
});

translateGizmo.on('transform:end', () => {
  const finalPosition = selectedNodes[0].getPosition();
  // Create single PatchOp for the entire drag gesture
  store.getState().dispatchOp(createSetPropertyOp(
    entityId, 'transform.position',
    { x: finalPosition.x, y: finalPosition.y, z: finalPosition.z },
    { x: capturedPosition.x, y: capturedPosition.y, z: capturedPosition.z }
  ));
});
```

### Camera Controller Setup

```typescript
// Source: PlayCanvas engine extras/input/controllers
import {
  OrbitController, FlyController,
  KeyboardMouseSource, Pose
} from 'playcanvas';

// Create input source
const inputSource = new KeyboardMouseSource(app.keyboard, app.mouse);

// Create controllers
const orbitController = new OrbitController();
orbitController.rotateDamping = 0.98;
orbitController.moveDamping = 0.98;
orbitController.zoomDamping = 0.98;

const flyController = new FlyController();
flyController.rotateDamping = 0.98;
flyController.moveDamping = 0.98;

// Switch between modes
function setControllerMode(mode: 'orbit' | 'fly') {
  const currentPose = activeController.detach();
  if (mode === 'orbit') {
    orbitController.attach(currentPose);
    activeController = orbitController;
  } else {
    flyController.attach(currentPose);
    activeController = flyController;
  }
}

// In update loop:
app.on('update', (dt) => {
  const frame = inputSource.getFrame(dt);
  activeController.update(frame, dt);
  camera.setPosition(activeController.pose.position);
  camera.setRotation(activeController.pose.rotation);
});
```

### GLB Import

```typescript
// Source: PlayCanvas docs + forum solutions
function importGlb(app: pc.Application, url: string): Promise<pc.Entity> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(url, 'container', (err, asset) => {
      if (err || !asset) {
        reject(err || new Error('Asset load failed'));
        return;
      }
      const entity = asset.resource.instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true,
      });
      resolve(entity);
    });
  });
}

// Convert to ECSON entities (walk the hierarchy)
function glbToEcsonOps(rootEntity: pc.Entity): PatchOp[] {
  const ops: PatchOp[] = [];
  // Walk hierarchy, create CreateEntity + AddComponent ops for each node
  // Extract materials as AssetEntry records, mesh refs, etc.
  return ops;
}
```

### PBR Material Mapping (IR to PlayCanvas)

```typescript
// Mapping ECSON Material component to PlayCanvas StandardMaterial
function mapMaterial(props: MaterialProperties): pc.StandardMaterial {
  const mat = new pc.StandardMaterial();

  // Color: ECSON stores as hex string, PC uses Color
  mat.diffuse = hexToColor(props.baseColor);
  mat.metalness = props.metallic;
  mat.gloss = 1 - props.roughness;  // PC uses glossiness (inverse of roughness)
  mat.emissive = hexToColor(props.emissive);
  mat.emissiveIntensity = props.emissiveIntensity;
  mat.opacity = props.opacity;
  mat.blendType = mapAlphaMode(props.alphaMode);
  mat.alphaCutoff = props.alphaCutoff;
  mat.twoSidedLighting = props.doubleSided;
  mat.cull = props.doubleSided ? pc.CULLFACE_NONE : pc.CULLFACE_BACK;

  mat.update();
  return mat;
}
```

### Entity Selection via Raycasting

```typescript
// Source: https://developer.playcanvas.com/tutorials/entity-picking/
function handleClick(event: MouseEvent, camera: pc.CameraComponent) {
  const from = camera.screenToWorld(event.x, event.y, camera.nearClip);
  const to = camera.screenToWorld(event.x, event.y, camera.farClip);

  // Option A: Physics-based (if collision components exist)
  const result = app.systems.rigidbody?.raycastFirst(from, to);
  if (result) {
    const entityId = result.entity.name; // or a custom lookup
    store.getState().setSelection([entityId]);
    return;
  }

  // Option B: Framebuffer picking (no physics needed)
  // Use pc.Picker for color-buffer-based selection
  const picker = new pc.Picker(app, canvas.width, canvas.height);
  picker.prepare(camera, app.scene);
  const selection = picker.getSelection(event.x, event.y);
  // Map MeshInstance back to entity ID
}
```

### Supabase Auth Setup

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs

// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Ignore in Server Components */ }
        },
      },
    }
  );
}

// Social login
async function signInWithProvider(provider: 'github' | 'google' | 'discord') {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}
```

### Undo/Redo with PatchOps

```typescript
// Undo/redo is straightforward because applyOp returns inverses
undo: () => {
  const { ecsonDoc, undoStack, redoStack } = get();
  if (!ecsonDoc || undoStack.length === 0) return;

  const inverseOp = undoStack[undoStack.length - 1]!;
  const reInverse = applyOp(ecsonDoc, inverseOp); // apply the undo

  set({
    ecsonDoc: { ...ecsonDoc },
    undoStack: undoStack.slice(0, -1),
    redoStack: [...redoStack, reInverse],
  });
},

redo: () => {
  const { ecsonDoc, undoStack, redoStack } = get();
  if (!ecsonDoc || redoStack.length === 0) return;

  const redoOp = redoStack[redoStack.length - 1]!;
  const inverse = applyOp(ecsonDoc, redoOp);

  set({
    ecsonDoc: { ...ecsonDoc },
    undoStack: [...undoStack, inverse],
    redoStack: redoStack.slice(0, -1),
  });
},
```

## Discretion Recommendations

### Icon Set: Lucide React

**Recommendation:** Use `lucide-react` for all icons. It provides 1000+ consistent SVG icons, is tree-shakable, works naturally with Tailwind's `className` prop, and is the default icon library for shadcn/ui.

**Confidence:** HIGH -- most popular choice for Tailwind/React projects in 2025-2026.

### Toast/Notification: Sonner

**Recommendation:** Use `sonner` for all toast notifications (save confirmations, errors, warnings). 2-3KB bundle, supports promise toasts (loading -> success/error), stacking, and is the shadcn default.

**Confidence:** HIGH -- 8M+ weekly npm downloads, actively maintained.

### Auto-Save Strategy

**Recommendation:** Debounced auto-save with two triggers:
1. **Idle debounce:** Save 5 seconds after the last edit (reset timer on each new op)
2. **Significant change trigger:** Save immediately after structural changes (CreateEntity, DeleteEntity, Reparent, AddComponent, RemoveComponent)
3. **Window blur:** Save when the user switches tabs/windows

Implementation: A `useAutoSave` hook that subscribes to the store's `ecsonDoc` and calls the Supabase upsert. Show "Saving..." / "Saved" / "Error" status in the top bar.

**Confidence:** HIGH -- standard pattern in web editors (Figma, Notion).

### Thumbnail Generation

**Recommendation:** Client-side canvas capture via `canvas.toDataURL('image/png')`. Capture after rendering a frame with `preserveDrawingBuffer: true` or by hooking into the render loop. Upload the PNG blob to Supabase Storage.

**Timing:** Capture on project save (not on every edit). Use the editor camera's current view as the thumbnail.

**Confidence:** MEDIUM -- `preserveDrawingBuffer` has a small performance cost; the render-then-capture-immediately approach is more efficient but timing-sensitive.

### Panel Resize Behavior

**Recommendation:**
- Left sidebar: min 200px, max 400px, default 280px
- Right sidebar (inspector): min 250px, max 450px, default 320px
- Panels collapse to 0 width when hidden (activity bar icons toggle)
- Resize handles are 4px wide, cursor changes to `col-resize`
- Panel sizes persist in `localStorage` via react-resizable-panels' built-in persistence

**Confidence:** HIGH -- react-resizable-panels handles all edge cases natively.

### Keyboard Shortcuts

**Recommendation using react-hotkeys-hook:**

| Action | Shortcut | Notes |
|--------|----------|-------|
| Undo | Ctrl+Z | |
| Redo | Ctrl+Shift+Z or Ctrl+Y | |
| Delete selected | Delete or Backspace | |
| Duplicate | Ctrl+D | |
| Copy | Ctrl+C | |
| Paste | Ctrl+V | |
| Select all | Ctrl+A | |
| Translate gizmo | W | Industry standard (Unity/Blender) |
| Rotate gizmo | E | |
| Scale gizmo | R | |
| Toggle camera mode | F5 or custom | |
| Toggle snap | Ctrl+Shift+S | Avoid conflict with Ctrl+S (save) |
| Focus selected | F | |
| Save | Ctrl+S | Manual save trigger |
| Play/Stop | Ctrl+P or F5 | |
| Deselect | Escape | |

**Confidence:** HIGH -- follows industry conventions from Unity/Blender/PlayCanvas editor.

### Loading Skeleton Design

**Recommendation:**
- Dashboard: Ghost card grid (pulsing rectangular placeholders)
- Editor: Full-height skeleton with panel outlines, pulsing viewport placeholder
- Project load: Progress bar in top bar + skeleton viewport
- Use Tailwind's `animate-pulse` on `bg-neutral-800` blocks

**Confidence:** HIGH -- standard skeleton pattern.

### Error State Handling

**Recommendation:**
- Network errors: Sonner toast with retry action
- Auth errors: Redirect to login with error message
- Save failures: Persistent toast with "Retry" button, "Unsaved changes" indicator in top bar
- PlayCanvas initialization failure: Full-viewport error boundary with "Reload" button
- Asset load failures: Toast + placeholder mesh/texture in viewport

**Confidence:** HIGH -- standard web application patterns.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PlayCanvas Model component | Render component | v1.55+ (2022) | Use `render` component for GLB hierarchy access |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | New package handles cookies correctly, supports App Router |
| Individual cookie methods (get/set/remove) | `getAll()`/`setAll()` batch methods | 2024 | Prevents race conditions with chunked cookies |
| `getSession()` for server auth | `getUser()` or `getClaims()` | 2025 | JWT validation prevents spoofed sessions |
| PlayCanvas legacy gltf loader | Container asset + `instantiateRenderEntity()` | v1.58+ | Old `playcanvas-gltf` repo deprecated |
| Zustand `create()` with external access | `createStore()` vanilla API | Zustand 4+ | Clean separation of React and non-React usage |
| PlayCanvas old input system | Extras `KeyboardMouseSource` + controllers | v2.8+ | Composable input system with damping |

**Deprecated/outdated:**
- `playcanvas-gltf` npm package: Deprecated, use container assets built into engine
- `@supabase/auth-helpers-nextjs`: Deprecated, use `@supabase/ssr`
- PlayCanvas `model` component: Legacy, use `render` component for new projects
- Zustand `create` for non-React: Use `createStore` from `zustand/vanilla`

## Open Questions

1. **PlayCanvas WebGPU vs WebGL2 for Phase 2**
   - What we know: PlayCanvas 2.16 supports both WebGPU and WebGL2 backends
   - What's unclear: Whether WebGPU is stable enough for production editor use, or if we should default to WebGL2
   - Recommendation: Default to WebGL2 for Phase 2 (wider browser support, more stable). Evaluate WebGPU in Phase 4 or later.

2. **Incremental IR Delta vs Full Recompile**
   - What we know: The adapter should support `applyDelta(delta: IRDelta)` for property changes, but the IR delta format isn't defined yet
   - What's unclear: Exact delta shape, which changes warrant full recompile vs incremental update
   - Recommendation: Start with full recompile (simpler, Phase 1 compiler exists). Profile performance. If recompile <16ms for typical scenes, defer incremental to later. If slow, define delta format in Plan 02-02.

3. **Database Schema for Projects**
   - What we know: Need a `projects` table with ECSON storage, owner, metadata
   - What's unclear: Whether to store ECSON as JSONB (queryable) or as a Supabase Storage file (handles large docs better), or both
   - Recommendation: JSONB for small-to-medium docs (Phase 2 scenes are small). Add a file-based fallback in Phase 5 when collaboration needs arise. Schema: `id UUID, owner_id UUID FK, name TEXT, ecson JSONB, thumbnail_url TEXT, entity_count INT, is_public BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ`.

4. **Marquee/Box Selection Implementation**
   - What we know: PlayCanvas has framebuffer-based `Picker` that supports rectangle selection, but it involves `readPixels()` which can stall the GPU pipeline
   - What's unclear: Performance impact for large scenes; whether a simpler frustum-based approach (project entity positions to screen space, check containment) is better
   - Recommendation: Start with frustum-based screen-space projection (no GPU stall, works for bounding boxes). If precision is insufficient, upgrade to Picker-based approach.

5. **"Keep Runtime Changes" Feasibility**
   - What we know: User wants this as aspirational; it means diffing the pre-play ECSON snapshot with the post-play state
   - What's unclear: How to capture meaningful changes (new entity positions after physics) vs noise (intermediate physics states). Transform-only diffing is tractable; component property diffing (materials changed by scripts) is complex.
   - Recommendation: Defer to future enhancement. The diff logic is not technically hard but the UX of "which changes do you want to keep?" is a design problem. Ship discard-all for Phase 2.

6. **Grid Rendering Approach**
   - What we know: PlayCanvas doesn't ship a built-in grid helper like Three.js's `GridHelper`
   - What's unclear: Best approach -- custom shader infinite grid vs mesh-based grid
   - Recommendation: Custom mesh grid entity created programmatically (simple `pc.Entity` with lines). An infinite shader grid is more elegant but adds complexity. Start simple, upgrade if needed.

## Sources

### Primary (HIGH confidence)
- [PlayCanvas Engine API v2.16.1](https://api.playcanvas.com/engine/) -- TransformGizmo, Gizmo, Application, Scene, StandardMaterial
- [PlayCanvas Standalone Guide](https://developer.playcanvas.com/user-manual/engine/standalone/) -- Programmatic app creation pattern
- [PlayCanvas Engine Source](https://github.com/playcanvas/engine) -- Verified gizmos, controllers, extras exports in `/src/extras/`
- [PlayCanvas Camera Controls](https://github.com/playcanvas/engine/blob/main/scripts/esm/camera-controls.mjs) -- OrbitController, FlyController, KeyboardMouseSource
- [Supabase Next.js SSR Auth](https://supabase.com/docs/guides/auth/server-side/nextjs) -- createServerClient, middleware, PKCE flow
- [Supabase AI Prompt: Next.js v16](https://supabase.com/docs/guides/getting-started/ai-prompts/nextjs-supabase-auth) -- Verified Next.js 16 patterns, deprecated patterns warning
- [Supabase GitHub OAuth](https://supabase.com/docs/guides/auth/social-login/auth-github) -- Social login setup
- [Zustand createStore](https://zustand.docs.pmnd.rs/apis/create-store) -- Vanilla store API
- [Zustand Slices Pattern](https://zustand.docs.pmnd.rs/guides/slices-pattern) -- Store composition
- [Zustand subscribeWithSelector](https://zustand.docs.pmnd.rs/middlewares/subscribe-with-selector) -- Selective subscriptions

### Secondary (MEDIUM confidence)
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) -- v2.x, 4.6.4 latest, active maintenance
- [react-arborist GitHub](https://github.com/brimdata/react-arborist) -- Virtualized tree, drag-drop, rename
- [react-hotkeys-hook GitHub](https://github.com/JohannesKlauss/react-hotkeys-hook) -- Keyboard shortcut hooks
- [Lucide React](https://lucide.dev/guide/packages/lucide-react) -- Icon library, tree-shakable
- [Sonner GitHub](https://github.com/emilkowalski/sonner) -- Toast notifications, shadcn default
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage/quickstart) -- File upload, public buckets
- [PlayCanvas Entity Picking](https://developer.playcanvas.com/tutorials/entity-picking/) -- Raycasting + framebuffer picking
- [Dockview](https://dockview.dev/) -- Docking library (deferred awareness)

### Tertiary (LOW confidence)
- PlayCanvas forum discussions on grid rendering -- no official grid helper API found; custom implementation needed
- Canvas `toDataURL()` WebGL timing -- browser-dependent; needs testing with PlayCanvas specific setup

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All core libraries verified via official docs, engine source inspection, and API references
- Architecture (Zustand bridge, PatchOps flow): HIGH -- Pattern verified from Zustand docs + PlayCanvas engine architecture; aligns with Phase 1 contracts
- Architecture (play-test transition): MEDIUM -- PlayCanvas `timeScale`/`autoRender` verified, but the snapshot/restore pattern is our own design (no reference implementation)
- Pitfalls: HIGH -- Verified via official docs, forum reports, and direct engine source inspection
- Adapter mapping (IR to PlayCanvas): MEDIUM -- Component mapping is straightforward but incremental delta format is not yet defined

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days -- stable stack, no major releases expected)
