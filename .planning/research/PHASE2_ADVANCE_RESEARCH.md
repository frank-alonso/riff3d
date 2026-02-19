# Phase 2 Advance Research: Closed-Loop Editor

**Researched:** 2026-02-19 (advance, during Phase 1 execution)
**Purpose:** Reduce Phase 2 planning time by pre-researching PlayCanvas adapter integration, gizmo/selection systems, editor architecture patterns, and Next.js + canvas integration.
**Sources:** PlayCanvas engine source (`/home/frank/playcanvas-engine/`), PlayCanvas editor source (`/home/frank/playcanvas-editor/`), web research (Next.js 16, React 19, Zustand 5).

---

## Table of Contents

1. [PlayCanvas Adapter Integration](#1-playcanvas-adapter-integration)
2. [Gizmo & Selection System](#2-gizmo--selection-system)
3. [Editor Architecture Patterns](#3-editor-architecture-patterns)
4. [Next.js + Canvas Integration](#4-nextjs--canvas-integration)
5. [Cross-Cutting: PlayCanvas → Riff3D Mapping](#5-cross-cutting-playcanvas--riff3d-mapping)
6. [Recommendations & Decisions](#6-recommendations--decisions)
7. [Reference Files](#7-reference-files)

---

## 1. PlayCanvas Adapter Integration

### 1.1 Application Lifecycle

**Initialization sequence:**
```typescript
const app = new pc.Application(canvas, {
  graphicsDeviceOptions: { alpha: false, xrCompatible: true }
});
app.setCanvasFillMode(pc.FILLMODE_NONE);      // Manual resize for panel layout
app.setCanvasResolution(pc.RESOLUTION_AUTO);   // Match CSS size to buffer
app.start();                                    // Begins rAF loop
```

**Key lifecycle methods:**
- `app.start()` — fires `start`, `initialize`, `postinitialize`, begins rAF
- `app.destroy()` — tears down everything (entities, systems, assets, graphics device)
- `app.autoRender = false` — skip rendering, still run updates
- `app.renderNextFrame = true` — force single frame render
- `app.timeScale` — control physics/animation speed without affecting render

**Source files:**
- `/home/frank/playcanvas-engine/src/framework/application.js` — Application class
- `/home/frank/playcanvas-engine/src/framework/app-base.js` — AppBase with main loop (`makeTick` at line 2042)

### 1.2 Entity/Component System

**Entity creation:**
```typescript
const entity = new pc.Entity("name", app);
entity.setLocalPosition(x, y, z);
entity.setLocalEulerAngles(rx, ry, rz);  // Degrees, XYZ order
entity.setLocalScale(sx, sy, sz);
entity.addComponent('render', { type: 'box' });
app.root.addChild(entity);
```

**Built-in component systems:** render, model, camera, light, rigidbody, collision, joint, animation, anim, sound, audiolistener, particlesystem, element, screen, script, gsplat, zone

**Component property modification — all incremental, no rebuild:**
```typescript
entity.render.castShadows = false;  // Immediate
entity.light.intensity = 2.0;       // Immediate
entity.camera.fov = 55;             // Immediate
```

**Component events for observation:**
```typescript
entity.render.on('set_castShadows', (name, oldVal, newVal) => { ... });
entity.on('enabled', (enabled) => { ... });
```

### 1.3 Scene Graph & Transforms

**Hierarchy operations:**
```typescript
parent.addChild(entity);     // Add + dirtify transforms
entity.removeChild(child);   // Remove child
entity.destroy();            // Recursive destroy
entity.reparent(newParent);  // Reparent
```

**Transform spaces:**
- Local: `setLocalPosition/Rotation/EulerAngles/Scale` + getters
- World: `setPosition/Rotation/EulerAngles` + getters
- `syncHierarchy()` called automatically during render phase
- `_dirtyLocal` / `_dirtyWorld` flags track stale transforms

### 1.4 Programmatic Scene Building from Canonical IR

**Two-phase construction pattern (required for hierarchy):**
```typescript
function buildSceneFromIR(ir: CanonicalIR): Map<string, pc.Entity> {
  const entityMap = new Map<string, pc.Entity>();

  // Phase 1: Create all entities with components
  for (const node of ir.nodes) {
    const entity = new pc.Entity(node.name, app);
    entity.setLocalPosition(...node.transform.position);
    entity.setLocalEulerAngles(...node.transform.rotation);
    entity.setLocalScale(...node.transform.scale);
    for (const [type, data] of Object.entries(node.components)) {
      entity.addComponent(type, mapIRComponentToPC(type, data));
    }
    entityMap.set(node.id, entity);
  }

  // Phase 2: Build hierarchy (deferred to allow out-of-order references)
  for (const node of ir.nodes) {
    const entity = entityMap.get(node.id)!;
    const parent = node.parent ? entityMap.get(node.parent)! : app.root;
    parent.addChild(entity);
  }

  return entityMap;
}
```

**Key gotcha from PlayCanvas editor source:** Hierarchy operations should be deferred in batches (`setTimeout`) to allow GUID references to resolve when creating multiple entities at once.

### 1.5 Incremental Delta Application

PlayCanvas is designed for property-level incremental updates — no scene rebuild needed:

```typescript
function applyDelta(entityMap: Map<string, pc.Entity>, delta: IRDelta): void {
  const entity = entityMap.get(delta.entityId);
  if (!entity) return;

  // Transform deltas
  if (delta.position) entity.setLocalPosition(...delta.position);
  if (delta.rotation) entity.setLocalEulerAngles(...delta.rotation);
  if (delta.scale) entity.setLocalScale(...delta.scale);

  // Component property deltas
  if (delta.componentUpdates) {
    for (const [type, props] of Object.entries(delta.componentUpdates)) {
      const comp = entity[type as keyof pc.Entity];
      if (comp) Object.assign(comp, props);
    }
  }

  // Component add/remove
  if (delta.addComponent) entity.addComponent(delta.addComponent.type, delta.addComponent.data);
  if (delta.removeComponent) entity.removeComponent(delta.removeComponent);
}
```

### 1.6 PBR Material Mapping

**PlayCanvas StandardMaterial → Portable Subset PBR:**

| Portable Subset | PlayCanvas Property | Notes |
|-----------------|-------------------|-------|
| baseColor | `material.diffuse` (Color) | RGB, no alpha |
| baseColorMap | `material.diffuseMap` (Texture) | |
| metallic | `material.metalness` (0-1) | Note: "metalness" not "metallic" |
| metallicMap | `material.metalnessMap` | |
| roughness | `1 - material.gloss` | **Inverted!** PC uses gloss (1=glossy) |
| roughnessMap | `material.glossMap` | Needs channel inversion |
| normalMap | `material.normalMap` | |
| aoMap | `material.aoMap` | |
| emissive | `material.emissive` (Color) | |
| emissiveMap | `material.emissiveMap` | |
| emissiveIntensity | `material.emissiveIntensity` | |
| opacity | `material.opacity` (0-1) | |
| opacityMap | `material.opacityMap` | |

**Critical gotcha:** PlayCanvas uses **gloss** (1 = smooth) while glTF and most PBR pipelines use **roughness** (1 = rough). The adapter must invert: `pcGloss = 1 - irRoughness`.

### 1.7 Asset System

```typescript
const asset = new pc.Asset(name, type, { url: path });
app.assets.add(asset);
app.assets.load(asset);
asset.ready((loadedAsset) => {
  entity.render.material.diffuseMap = loadedAsset.resource;
});
```

**GLB loading:**
```typescript
app.assets.loadFromUrl(url, 'container', (err, containerAsset) => {
  const modelAsset = containerAsset.resource.model;
  entity.addComponent('render', { type: 'asset', asset: modelAsset });
});
```

### 1.8 Play Mode Control

**Main loop phases per frame:**
1. Delta time (clamped to `maxDeltaTime`, scaled by `timeScale`)
2. `frameupdate` event
3. Input update
4. `systems.fire('update', dt)` — scripts, behaviors
5. `systems.fire('animationUpdate', dt)` — animation blending
6. `systems.fire('postUpdate', dt)` — physics integration
7. `framerender` event
8. Render (if `autoRender || renderNextFrame`)
9. `frameend` event

**Edit-to-play transition:** PlayCanvas editor pauses edit-mode bindings; scene state lives in backend (ShareDB), not local snapshots. Simple approach: pause observer bindings, let engine run freely, resume bindings on stop.

---

## 2. Gizmo & Selection System

### 2.1 Built-in Engine Gizmos

PlayCanvas ships full translate/rotate/scale gizmos in `src/extras/gizmo/`. These are **production-ready** and used by the official editor.

**Setup:**
```typescript
const layer = pc.Gizmo.createLayer(app, 'Gizmo Layer');
const translateGizmo = new pc.TranslateGizmo(camera.camera, layer);
const rotateGizmo = new pc.RotateGizmo(camera.camera, layer);
const scaleGizmo = new pc.ScaleGizmo(camera.camera, layer);
```

**Gizmo types and shapes:**
- **TranslateGizmo:** ArrowShape (axes), PlaneShape (2-axis), SphereShape (center)
- **RotateGizmo:** ArcShape (axis rings + free ring), SphereShape (center)
- **ScaleGizmo:** BoxLineShape (axes), PlaneShape (2-axis), BoxShape (center)

**Key API:**
```typescript
gizmo.attach(nodes);          // Attach to selected entities (array)
gizmo.detach();                // Detach all
gizmo.coordSpace = 'world';   // or 'local'
gizmo.snap = true;
gizmo.snapIncrement = 0.5;
gizmo.size = 1.0;

// Events
gizmo.on('transform:start', (point, x, y) => { /* cache initial state */ });
gizmo.on('transform:move', (point, x, y) => { /* transient update */ });
gizmo.on('transform:end', () => { /* commit PatchOp */ });
```

**Snap implementation (internal):**
```typescript
if (this.snap) {
  translateDelta.mulScalar(1 / this.snapIncrement);
  translateDelta.round();
  translateDelta.mulScalar(this.snapIncrement);
}
```

**Theming:**
```typescript
gizmo.setTheme({
  shapeBase: { x: new pc.Color(1,0,0), y: new pc.Color(0,1,0), z: new pc.Color(0,0,1) },
  shapeHover: { x: new pc.Color(1,1,0), y: new pc.Color(1,1,0), z: new pc.Color(1,1,0) },
});
```

### 2.2 GizmoHandler Pattern

From `/home/frank/playcanvas-engine/examples/src/examples/misc/editor.gizmo-handler.mjs`:

```typescript
class GizmoHandler {
  private _gizmos: Record<string, pc.TransformGizmo>;
  private _type = 'translate';
  private _nodes: pc.GraphNode[] = [];

  constructor(camera: pc.CameraComponent) {
    const layer = pc.Gizmo.createLayer(camera.system.app);
    this._gizmos = {
      translate: new pc.TranslateGizmo(camera, layer),
      rotate: new pc.RotateGizmo(camera, layer),
      scale: new pc.ScaleGizmo(camera, layer),
    };
  }

  get gizmo() { return this._gizmos[this._type]; }

  attach(nodes: pc.GraphNode[], clear = false) {
    if (clear) this._nodes.length = 0;
    for (const node of nodes) {
      if (!this._nodes.includes(node)) this._nodes.push(node);
    }
    this.gizmo.attach(this._nodes);
  }

  switch(type: string) {
    const coordSpace = this.gizmo.coordSpace;
    this.gizmo.detach();
    this._type = type;
    this.gizmo.attach(this._nodes);
    this.gizmo.coordSpace = coordSpace;
  }

  clear() {
    this._nodes.length = 0;
    this.gizmo.detach();
  }
}
```

### 2.3 Selection & Picking

**PlayCanvas Picker (color-based ID picking):**
```typescript
const picker = new pc.Picker(app, canvas.width, canvas.height);
picker.prepare(camera, app.scene);
const meshInstances = picker.getSelection(screenX, screenY);
// Traverse up to find Entity: meshInstance.node → findAncestorEntity()
```

**Rectangle selection:**
```typescript
picker.getSelection(x, y, width, height);  // Returns all MeshInstances in rect
```

**Editor picking pipeline:**
1. `pointerdown` → record start position
2. `pointermove` → if moved > 8px, it's a drag (not a click)
3. `pointerup` without drag → `Picker.getSelection(x, y)` → `viewport:pick:node` event
4. Ctrl+drag → rectangle select → collect unique entities

**Coordination (prevent conflicts):**
- During gizmo drag: disable camera orbit + disable picking
- During camera orbit: picking still enabled (click-to-select works)

### 2.4 Camera Controls

**Orbit camera** (from PlayCanvas editor):
- Orbits around virtual pivot point
- Left-click + drag rotates (pitch ±89.99°, yaw unlimited)
- Implementation: `quat.setFromEulerAngles(pitch, yaw, 0)` → offset from pivot

**Pan:** Shift+drag moves camera parallel to view plane
**Zoom:** Scroll wheel adjusts distance (perspective) or orthoHeight (ortho)
**Focus:** Frame selected entity by computing bounding box + setting pivot + distance

### 2.5 Grid Rendering

```typescript
// Build grid mesh with colored lines
const mesh = new pc.Mesh(app.graphicsDevice);
mesh.setPositions(positions);  // Line endpoints
mesh.setColors32(colors);      // Per-vertex colors (axis lines colored)
mesh.update(pc.PRIMITIVE_LINES, true);
const meshInstance = new pc.MeshInstance(mesh, material, gridNode);
layer.addMeshInstances([meshInstance]);
```

Settings: `gridDivisions` (count), `gridDivisionSize` (world units).

---

## 3. Editor Architecture Patterns

### 3.1 Observer Pattern (Most Critical for Riff3D)

PlayCanvas editor uses `@playcanvas/observer` for all reactive data binding. **This maps directly to PatchOps.**

**Core pattern:**
```
Data change → Observer.set(path, value) → Events fire → UI updates + Engine updates + History records
```

**Observer API:**
- `observer.get(path)` — read value at path
- `observer.set(path, value)` — set value, fires `*:set` event
- `observer.unset(path)` — remove value, fires `*:unset` event
- `observer.insert(path, value, index)` — array insert, fires `*:insert`
- `observer.remove(path, index)` — array remove, fires `*:remove`

**ObserverSync converts mutations to operations (like PatchOps):**
```typescript
// Object property: {p: ['entities', 'guid', 'position'], oi: [1,0,0], od: [0,0,0]}
// Array insert:    {p: ['entities', 'guid', 'tags', 0], li: 'tag1'}
// Array remove:    {p: ['entities', 'guid', 'tags', 0], ld: 'tag1'}
```

**Key insight:** Riff3D's PatchOps serve the same role as ObserverSync operations. The Zustand store + PatchOps system replaces Observer + ShareDB.

### 3.2 Undo/Redo Architecture

**ObserverHistory** automatically records mutations:
- Listens to `*:set`, `*:unset`, `*:insert`, `*:remove` events
- Uses prefix scoping (e.g., `entity.{id}.`) for per-entity undo
- Generates action objects: `{ name, undo: () => void, redo: () => void, combine?: boolean }`

**Gizmo undo pattern:**
1. `transform:start` → cache initial transform, disable history
2. `transform:move` → update entity directly (transient, no history)
3. `transform:end` → re-enable history, record single discrete action with cached→final values

**Riff3D mapping:** PatchOps already have inverses. The undo stack is a stack of PatchOps (or PatchOp batches). Gizmo drags produce a single batch PatchOp on `transform:end`.

### 3.3 Schema-Driven Inspector

PlayCanvas editor generates property panels from schema metadata:
```typescript
type Attribute = {
  label: string;
  path: string;             // Observer path to bind
  type: string;             // UI element type: 'number', 'string', 'color', 'asset', 'select', 'slider'
  args?: Record<string, any>; // min, max, step, options, etc.
};
```

**Riff3D mapping:** Zod schemas have `editorHints` baked in (from Phase 1 component registry). The inspector reads these hints to auto-generate UI fields. This is the same pattern.

### 3.4 Viewport Entity Binding

From `/home/frank/playcanvas-editor/src/launch/viewport/viewport-binding-entities.ts`:

1. Create engine entity from data: `new pc.Entity(name)`
2. Set transform from data
3. Queue parenting (deferred with `setTimeout` for out-of-order creation)
4. Add components in batch

**Riff3D mapping:** The adapter's `loadScene(ir)` creates engine entities from Canonical IR using the same pattern. `applyDelta(delta)` updates individual entities incrementally.

### 3.5 Play Mode = Simple

PlayCanvas editor's play mode:
- Suspends edit-mode bindings (Observer → Engine sync)
- Engine continues running (physics, scripts, animation)
- Scene state preserved in backend, not local snapshots
- "Stop" resumes edit-mode bindings

**Riff3D approach:** Before play, snapshot ECSON state. During play, engine runs freely. On stop, restore ECSON snapshot and recompile to Canonical IR → rebuild adapter scene.

---

## 4. Next.js + Canvas Integration

### 4.1 SSR Avoidance

**Required pattern: `'use client'` + `next/dynamic` with `ssr: false`**

`'use client'` alone is NOT sufficient — Next.js still pre-renders on server. PlayCanvas references `window`/WebGL at module scope → SSR crash.

```typescript
// viewport-loader.tsx
'use client';
import dynamic from 'next/dynamic';

export const ViewportPanel = dynamic(
  () => import('./PlayCanvasViewport'),
  { ssr: false, loading: () => <ViewportSkeleton /> }
);
```

**Key constraint:** `ssr: false` can ONLY be used inside a Client Component. Cannot use in Server Components.

### 4.2 Canvas Ref with React 19 Cleanup

React 19 callback refs can return cleanup functions (breaking change from React 18):

```typescript
const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
  if (!canvas) return;

  const app = new pc.Application(canvas, { graphicsDeviceOptions: { alpha: false } });
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.start();
  appRef.current = app;

  return () => {           // React 19 cleanup — called on unmount
    app.destroy();
    appRef.current = null;
  };
}, []);                    // MUST be stable — re-creation destroys WebGL context
```

**Critical rules:**
- Store `Application` in `useRef`, NOT `useState` (prevents re-renders)
- Wrap canvas component in `React.memo()` (isolates from parent re-renders)
- Canvas element has no React children (leaf node, nothing to reconcile)
- `useCallback` with `[]` deps ensures stable ref identity

### 4.3 Zustand Bridge: React ↔ Engine

**Architecture: Vanilla store + subscribeWithSelector**

```typescript
import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';

export const editorStore = createStore<EditorState>()(
  subscribeWithSelector((set, get) => ({
    selectedEntityIds: [],
    activeTransform: null,
    selectEntities: (ids) => set({ selectedEntityIds: ids }),
    updateTransform: (t) => set({ activeTransform: t }),
  }))
);
```

**React side:**
```typescript
import { useStore } from 'zustand';
const selectedIds = useStore(editorStore, (s) => s.selectedEntityIds);
```

**Engine adapter side (no React dependency):**
```typescript
const unsub = editorStore.subscribe(
  (state) => state.selectedEntityIds,
  (ids, prevIds) => { highlightEntities(ids); },
  { equalityFn: shallow }
);
// Cleanup: unsub() in adapter.dispose()
```

### 4.4 High-Frequency Update Strategy (Gizmo Transforms)

**Problem:** Gizmo moves at 60fps. Writing to Zustand → React re-render at 60fps = bad.

**Solution: Two-tier updates**

| Tier | Frequency | Path | React Re-render? |
|------|-----------|------|-----------------|
| Transient | 60fps (during drag) | Ref + direct DOM mutation | No |
| Committed | On drag end | Zustand → PatchOp → React | Yes |

```typescript
// During gizmo drag — transient, bypasses React
function onGizmoMove(pos: pc.Vec3) {
  transformRef.current = [pos.x, pos.y, pos.z];
  positionDisplay.textContent = `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`;
}

// On drag end — committed, creates PatchOp
function onGizmoDragEnd(finalPos: pc.Vec3) {
  editorStore.getState().commitTransform(entityId, finalPos);
}
```

**Throttled inspector during drag:**
```typescript
useEffect(() => {
  let rafId: number;
  const unsub = editorStore.subscribe(
    (s) => s.activeTransform,
    (t) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setDisplayTransform(t));
    }
  );
  return () => { unsub(); cancelAnimationFrame(rafId); };
}, []);
```

### 4.5 Resize Handling

**Pattern: ResizeObserver on container + PlayCanvas FILLMODE_NONE**

```typescript
const container = canvas.parentElement!;
const observer = new ResizeObserver((entries) => {
  const { width, height } = entries[0].contentRect;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  app.resizeCanvas(width, height);
});
observer.observe(container);
```

**PlayCanvas internals:** `resizeCanvas(w, h)` in `FILLMODE_NONE` sets CSS size directly, then `updateCanvasSize()` syncs the buffer resolution via `RESOLUTION_AUTO`.

**Performance:** Throttle resize to ~30fps during panel drag; do final precise resize on drag end.

### 4.6 Editor Shell Layout

**Recommended: `react-resizable-panels` (^2.x)**

```
PanelGroup (horizontal)
├── Panel (left: hierarchy + assets)
│   └── PanelGroup (vertical)
│       ├── Panel (hierarchy tree)
│       ├── PanelResizeHandle
│       └── Panel (asset browser)
├── PanelResizeHandle
├── Panel (center: viewport — dynamic, ssr:false)
├── PanelResizeHandle
└── Panel (right: inspector)
```

**Features:** defaultSize/minSize/maxSize, collapsible panels, keyboard accessible, layout persistence via `onLayout` callback, nested groups.

**Note:** `shadcn/ui` wraps this as `<Resizable>` with Tailwind styling — natural fit for Riff3D's Tailwind 4 stack.

### 4.7 Dynamic Import Strategy

Two-level code split to keep PlayCanvas (~1MB) out of initial bundle:

1. `next/dynamic` with `ssr: false` → viewport component chunk
2. Dynamic `import('playcanvas')` inside viewport → engine chunk

```typescript
// Inside PlayCanvasViewport.tsx (already code-split via dynamic import)
useEffect(() => {
  import('playcanvas').then((pc) => { pcRef.current = pc; setReady(true); });
}, []);
```

### 4.8 Why NOT @playcanvas/react

Explicitly wrong for Riff3D:
1. CLAUDE.md rule: "viewport is engine-native, NOT React components"
2. Couples 3D scene to React reconciler — breaks adapter pattern
3. Adapter needs imperative `initialize/loadScene/applyDelta/dispose` — wrapper adds friction
4. Would fight PatchOps-driven mutation model

---

## 5. Cross-Cutting: PlayCanvas → Riff3D Mapping

| PlayCanvas Concept | Riff3D Equivalent | Notes |
|-------------------|-------------------|-------|
| Observer + events (`*:set`, `*:unset`) | PatchOps + Zustand store | All mutations through operations |
| ObserverSync (→ ShareDB ops) | PatchOps → Yjs CRDT (Phase 5) | Same role: serialize mutations for collaboration |
| ObserverHistory (auto-tracked undo) | PatchOps inverse stack | PatchOps already define inverses |
| Entity Observer (data model) | ECSON document | Source of truth for scene state |
| Viewport Binding (Observer → Engine) | Adapter.applyDelta(IRDelta) | Canonical IR deltas, not ECSON |
| ShareDB operations | Yjs shared document ops | Different protocol, same concept |
| Component Schema + `$editorType` | Zod schema + `editorHints` | Schema-driven inspector generation |
| PCUI BindingTwoWay | React controlled components + Zustand | React's model is inherently two-way-capable |
| SceneParser.parse(json) | Adapter.loadScene(CanonicalIR) | Build engine scene from data |
| `Picker` (color-based picking) | Same — use PlayCanvas Picker directly | No need to reimplement |
| Gizmo extras (translate/rotate/scale) | Same — use PlayCanvas gizmos directly | Well-tested, production-ready |

---

## 6. Recommendations & Decisions

### 6.1 Confirmed Choices

| Decision | Rationale |
|----------|-----------|
| Use PlayCanvas engine gizmos directly | Production-tested, full snap/coord-space/multi-select support |
| Use PlayCanvas Picker for selection | Color-based ID picking, supports rect select |
| `react-resizable-panels` for layout | Mature, accessible, Tailwind-compatible via shadcn/ui |
| `zustand/vanilla` + `subscribeWithSelector` for bridge | Works both inside and outside React, selector-based subscriptions |
| `next/dynamic` + `ssr: false` for viewport | Handles SSR avoidance + code splitting in one shot |
| React 19 callback ref with cleanup | Clean lifecycle, no useEffect needed for canvas init/destroy |
| `FILLMODE_NONE` + `ResizeObserver` | Correct for panel-based layout (not window-filling) |
| Two-tier update (transient + committed) | Prevents 60fps React re-renders during gizmo drag |

### 6.2 New Package Dependencies (Phase 2)

| Package | Version | Purpose |
|---------|---------|---------|
| `playcanvas` | ~2.16 | 3D engine (primary adapter) |
| `react-resizable-panels` | ^2.x | Editor panel layout |
| `@next/bundle-analyzer` | latest | Verify code splitting |

Note: `zustand` (^5.x) already in stack from CLAUDE.md.

### 6.3 Open Questions for Phase 2 Planning

1. **Play mode state management:** Snapshot ECSON before play, restore on stop? Or simpler engine pause/resume like PlayCanvas editor?
2. **Asset storage:** Supabase Storage for uploaded GLBs/textures? Or local-first with sync?
3. **shadcn/ui adoption:** Use shadcn/ui components (Button, Input, Select, etc.) for inspector panels? Natural Tailwind fit but adds dependency.
4. **Camera controller:** Port PlayCanvas editor's orbit/pan/zoom, or use engine's built-in OrbitCamera script?

### 6.4 Gotchas to Watch

1. **Gloss vs roughness inversion** — PlayCanvas uses gloss (1=smooth), glTF/IR uses roughness (1=rough). Adapter must invert.
2. **Deferred hierarchy construction** — When creating many entities, defer parenting with microtask to allow GUID references to resolve.
3. **Stable callback ref** — Canvas ref MUST be wrapped in `useCallback([])`. Unstable ref = WebGL context recreation = crash.
4. **ResizeObserver throttling** — Resize canvas at ~30fps during drag, full-res on drag end. Unthrottled causes jank.
5. **WebGL context limit** — Browsers allow ~8-16 active contexts. Don't recreate Application on re-render.
6. **`ssr: false` in Client Components only** — Cannot use `next/dynamic({ ssr: false })` in Server Components with App Router.

---

## 7. Reference Files

### PlayCanvas Engine
| File | Contains |
|------|----------|
| `/home/frank/playcanvas-engine/src/framework/application.js` | Application class |
| `/home/frank/playcanvas-engine/src/framework/app-base.js` | Main loop (makeTick), resize |
| `/home/frank/playcanvas-engine/src/framework/entity.js` | Entity class |
| `/home/frank/playcanvas-engine/src/scene/graph-node.js` | Transform + hierarchy |
| `/home/frank/playcanvas-engine/src/framework/components/*/` | Component implementations |
| `/home/frank/playcanvas-engine/src/scene/materials/standard-material.js` | PBR material |
| `/home/frank/playcanvas-engine/src/framework/asset/asset-registry.js` | Asset management |
| `/home/frank/playcanvas-engine/src/framework/parsers/scene.js` | Scene from JSON |
| `/home/frank/playcanvas-engine/src/extras/gizmo/` | Gizmo system (translate/rotate/scale) |
| `/home/frank/playcanvas-engine/src/extras/gizmo/shape/` | Gizmo shapes |
| `/home/frank/playcanvas-engine/examples/src/examples/misc/editor.gizmo-handler.mjs` | GizmoHandler reference |

### PlayCanvas Editor
| File | Contains |
|------|----------|
| `/home/frank/playcanvas-editor/src/editor-api/entity.ts` | Entity Observer wrapper |
| `/home/frank/playcanvas-editor/src/editor-api/history.ts` | Undo/redo History API |
| `/home/frank/playcanvas-editor/src/editor-api/selection.ts` | Selection + SelectionHistory |
| `/home/frank/playcanvas-editor/src/common/observer-sync.ts` | Observer → ShareDB ops |
| `/home/frank/playcanvas-editor/src/editor/inspector/attributes-inspector.ts` | Schema-driven inspector |
| `/home/frank/playcanvas-editor/src/editor-api/schema/components.ts` | Component schema |
| `/home/frank/playcanvas-editor/src/editor/viewport/viewport.ts` | Viewport initialization |
| `/home/frank/playcanvas-editor/src/editor/viewport/viewport-pick.ts` | Picker/selection |
| `/home/frank/playcanvas-editor/src/editor/viewport/viewport-grid.ts` | Grid rendering |
| `/home/frank/playcanvas-editor/src/editor/viewport/gizmo/gizmo-transform.ts` | Gizmo↔editor integration |
| `/home/frank/playcanvas-editor/src/editor/viewport/camera/camera-orbit.ts` | Orbit camera |
| `/home/frank/playcanvas-editor/src/editor/viewport/camera/camera-pan.ts` | Pan camera |
| `/home/frank/playcanvas-editor/src/launch/viewport/viewport-binding-entities.ts` | Observer→Engine sync |
| `/home/frank/playcanvas-editor/src/launch/viewport/viewport-binding-assets.ts` | Asset hot-reload |
| `/home/frank/playcanvas-editor/src/editor-api/realtime/scene.ts` | ShareDB collaboration |

---

*Research conducted 2026-02-19 during Phase 1 execution. To be consumed by Phase 2 planning (gsd:plan-phase).*
