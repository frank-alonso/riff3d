# Architecture Research

**Domain:** Web-based 3D engine/editor collaboration platform with portable scene representations
**Researched:** 2026-02-19
**Confidence:** HIGH — based on direct source code analysis of PlayCanvas engine, PlayCanvas editor, Babylon.js, Babylon editor, and extensive prototype research documents (canonical layer, universal schema, IQL, spatial validation). Collaboration patterns from PlayCanvas editor's ShareDB/OT implementation examined directly.

## System Overview

```
                        ┌────────────────────────────────────────────────────────┐
                        │                  AI / Human Authoring                   │
                        │                                                        │
                        │   IQL (Intent Language)    Editor UI    MCP Tools      │
                        └──────────────────────┬─────────────────────────────────┘
                                               │
                                               │ Produces
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            PatchOps (Operation Layer)                            │
│                                                                                  │
│   CreateEntity │ DeleteEntity │ SetProperty │ AddComponent │ RemoveComponent     │
│   AddChild │ RemoveChild │ Reparent │ AddKeyframe │ BatchOp │ ...               │
│                                                                                  │
│   Properties: deterministic, serializable, ordered, scoped, validatable,         │
│               invertible                                                         │
└──────────────────────────────┬───────────────────────────────────────────────────┘
                               │
                               │ Mutates
                               ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        ECSON (Editor Source-of-Truth)                             │
│                                                                                  │
│   ┌─────────────┐  ┌──────────────────┐  ┌───────────────┐  ┌───────────────┐  │
│   │ Entity Map   │  │ Asset Registry    │  │ Event Wiring  │  │ Game Settings │  │
│   │ (flat, by ID)│  │ (materials,      │  │ (flat graph)  │  │ (template,    │  │
│   │              │  │  meshes, etc.)   │  │               │  │  win conds)   │  │
│   └──────────────┘  └──────────────────┘  └───────────────┘  └───────────────┘  │
│                                                                                  │
│   Schema versioned │ Migrations │ Stable IDs │ Editor sugar allowed              │
└──────────────────────────────┬───────────────────────────────────────────────────┘
                               │
                               │ Compiles to
                               ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                       Canonical IR (Portable Representation)                     │
│                                                                                  │
│   Resolved assets │ Compiled behaviors │ Dual rotation (Euler + Quat)           │
│   Discriminated component union │ Compiled event graph │ glTF-aligned            │
│   Topologically sorted nodes │ Layer bitmasks │ Network config                   │
│                                                                                  │
│   Properties: minimal, normalized, explicit, round-trip safe                     │
└──────────────────────────────┬───────────────────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   PlayCanvas Adapter     │  │   Babylon.js Adapter     │
│   (~1000-1200 LoC)       │  │   (~1000-1200 LoC)       │
│                          │  │                          │
│   Entity → pc.Entity     │  │   Entity → TransformNode │
│   MeshRenderer → render  │  │   MeshRenderer → Mesh    │
│   Light → light          │  │   Light → *Light         │
│   RigidBody → rigidbody  │  │   RigidBody → PhysicsAgg │
│   Collider → collision   │  │   Collider → PhysicsShape│
│   Script → script comp   │  │   Behavior → Behavior<T> │
└──────────────────────────┘  └──────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **IQL Compiler** | Parses intent language, resolves references (names, tags, spatial), expands presets, generates PatchOps. Never mutates ECSON directly. | PatchOps engine, preset/modifier registries |
| **PatchOps Engine** | Validates ops against schema, applies ops to ECSON, generates inverses for undo, serializes ops for collaboration log. | ECSON store, undo/redo stack, collaboration layer |
| **ECSON Store** | Authoritative project state. Flat entity map, asset registry, event wiring, game settings. Schema versioned with migrations. | PatchOps engine, Canonical IR compiler, editor UI |
| **Canonical IR Compiler** | Resolves assets, compiles high-level behaviors to primitives, computes dual rotations, builds dispatch tables, topologically sorts nodes. | ECSON store, engine adapters |
| **Engine Adapters** | Thin translators from Canonical IR to engine-specific runtime calls. One per target engine. | Canonical IR compiler, engine runtimes |
| **Editor UI** | React-based panels (viewport, hierarchy, inspector, asset browser). Reads from ECSON, writes through PatchOps only. | PatchOps engine (writes), ECSON store (reads) |
| **Collaboration Layer** | Shared operation log, conflict resolution (LWW per property initially), presence, cursors. | PatchOps engine, network transport |
| **Conformance Harness** | Golden fixtures, round-trip tests, adapter conformance tests, performance budgets. | All packages (validation) |

## How PlayCanvas Actually Works (Source Code Analysis)

### Scene Graph Architecture

PlayCanvas uses a **GraphNode** base class (`src/scene/graph-node.js`) that provides the transform hierarchy. **Entity** (`src/framework/entity.js`) extends GraphNode and adds the component system. Key findings from source:

- **Transform is on the node**, not a separate component. Position, rotation (quaternion internally, Euler for serialization), and scale are GraphNode properties.
- **Parent-child is stored as `_children` array** on the GraphNode, with each child having a `_parent` reference.
- **GUIDs are used for entity identity** (`entity.setGuid(data.resource_id)` in the scene parser).
- **Tags system** is built into GraphNode via a `Tags` helper class.

### Component System (ECS Pattern)

PlayCanvas uses a **Component + ComponentSystem** pattern, not pure ECS:

```
ComponentSystemRegistry
  ├── RenderComponentSystem (manages all RenderComponent instances)
  ├── LightComponentSystem
  ├── RigidBodyComponentSystem
  ├── ScriptComponentSystem
  └── ... (20+ systems)
```

- **Component** (`src/framework/components/component.js`): Data holder attached to an Entity. Has an `entity` ref and `system` ref. Properties are defined by a `schema` array and getter/setter pairs are auto-built.
- **ComponentSystem** (`src/framework/components/system.js`): Singleton manager per component type. Stores component data in `this.store[entity.getGuid()]`. Handles `addComponent(entity, data)` and `removeComponent(entity)`.
- **ComponentSystemRegistry** (`src/framework/components/registry.js`): Central registry holding all ComponentSystem instances. Accessed via `app.systems.rigidbody`, `app.systems.render`, etc.
- **Component ordering** is handled via a static `order` property on each Component class — lower numbers get enabled first.
- **Schema-driven accessors**: Component properties are defined in a schema array. `_buildAccessors` iterates the schema and creates `Object.defineProperty` getter/setters that fire `set` events on change.

### Serialization Format

The PlayCanvas scene parser (`src/framework/parsers/scene.js`) reveals the actual scene JSON format:

```javascript
// Scene data structure (from parser)
data.entities = {
  "resource_id_1": {
    name: "MyEntity",
    resource_id: "resource_id_1",
    parent: null,           // null = root
    children: ["resource_id_2", "resource_id_3"],
    position: [0, 0, 0],
    rotation: [0, 0, 0],   // Euler angles
    scale: [1, 1, 1],
    enabled: true,
    tags: ["tag1"],
    components: {
      render: { type: "box", materialAsset: 12345 },
      rigidbody: { type: "dynamic", mass: 1 },
      collision: { type: "box", halfExtents: [0.5, 0.5, 0.5] }
    }
  }
}
```

Key observations:
- **Flat entity map** keyed by `resource_id` (GUID), not a nested tree
- **Parent/child via references**: `parent` field + `children` array (both present)
- **Transform on entity, not in components**: `position`, `rotation`, `scale` are entity-level
- **Compression support**: Scene parser handles a `compressedFormat` for production scenes
- **Two-pass parsing**: First pass creates all entities, second pass builds hierarchy

### Editor Architecture (PlayCanvas Editor Source)

The PlayCanvas editor uses **Observer pattern + ShareDB for real-time collaboration**:

- **Entity as Observer** (`src/editor-api/entity.ts`): Each editor Entity wraps a `@playcanvas/observer` Observer. The Observer tracks all property changes and emits events. Properties are accessed via `entity.get('resource_id')`, `entity.get('position')`, etc.
- **ObserverHistory** integrates with the editor History for undo/redo at the property level, with a prefix path like `entity.{resource_id}.{property}`.
- **History system** (`src/editor-api/history.ts`): Uses `@playcanvas/observer`'s History class. Actions have `name`, `redo()`, and `undo()` functions. `addAndExecute()` runs redo immediately.
- **ShareDB for collaboration** (`src/editor-api/realtime/`): The editor uses ShareDB (an OT-based real-time collaboration library) over WebSocket for scene sync. Scene data is a ShareDB document. Operations are JSON patches with paths: `{ p: ['entities', entityId], oi: entityData }` for insert, `od: {}` for delete.

### Editor Entity Operations

From `src/editor-api/entities/create.ts`:
- `createEntity(data, options)` creates an Entity, adds it to the entities collection, submits a ShareDB operation, inserts into parent's children, and registers an undo/redo history action.
- Undo captures entity data before deletion, redo re-creates with the same `resource_id`.
- Separate modules for: `create.ts`, `delete.ts`, `copy.ts`, `paste.ts`, `duplicate.ts`, `reparent.ts`.

## How Babylon.js Actually Works (Source Code Analysis)

### Scene Graph Architecture

Babylon.js uses an **imperative scene graph** (NOT ECS):

- **Node** (`packages/dev/core/src/node.ts`): Base class for all scene objects. Has `name`, `id`, `uniqueId`, parent-child hierarchy, `metadata` dictionary, and `Behavior` support. Uses `@serialize()` decorators for serialization.
- **TransformNode** extends Node: adds position, rotation, scaling.
- **AbstractMesh** extends TransformNode: adds mesh data, material references.
- **Mesh** extends AbstractMesh: concrete renderable geometry.
- **Scene** (`packages/dev/core/src/scene.ts`): Root container holding flat arrays: `meshes`, `lights`, `cameras`, `materials`, `textures`, `skeletons`, `particleSystems`, etc.

### Behavior System

Babylon's Behavior interface (`packages/dev/core/src/Behaviors/behavior.ts`) is minimal and clean:

```typescript
interface Behavior<T> {
  name: string;
  init(): void;
  attach(target: T): void;
  detach(): void;
  attachedNode: Nullable<T>;
}
```

- No schema/property system — behaviors are pure code with typed properties
- Built-in behaviors: PointerDragBehavior, SixDofDragBehavior, FollowBehavior, etc.
- Behaviors are **not serialized** in `.babylon` files by default — they are runtime-attached

### Serialization Format

Babylon's `.babylon` format uses **flat arrays per type** at the top level:

```json
{
  "cameras": [...],
  "lights": [...],
  "materials": [...],
  "meshes": [...],
  "geometries": { "boxes": [...], "spheres": [...] },
  "particleSystems": [...],
  "skeletons": [...],
  "actions": [...]
}
```

Key differences from PlayCanvas:
- **Type-specific arrays** instead of a single entity map with component bags
- **No universal component system** — each type (Mesh, Light, Camera) is a different class hierarchy
- **Materials are top-level** objects referenced by ID
- **Geometries are separate** from meshes (shared vertex data)
- **Parent-child via `parentId`** string reference on each object
- **Physics on the mesh** (impostor type, mass, friction) not as separate components
- **Actions** stored as tree structure (type/name/properties/children)
- **Metadata** dictionary on any node for custom data

### Babylon Editor

The Babylon Editor (`/home/frank/babylon-editor`) uses:
- **Simple undo/redo stack** (`editor/src/tools/undoredo.ts`): A flat array of `{ undo, redo, action, onLost }` items with index tracking. Max 200 items.
- **Property-based undo**: `registerSimpleUndoRedo` captures `{ object, property, oldValue, newValue }` and uses `setInspectorEffectivePropertyValue` to apply.
- **Electron-based** (not web-native for the editor itself, though Babylon.js engine is web)

## Adapter Design: Mapping Riff3D Concepts to Engines

### Universal Mapping Table (from Source Code Analysis)

| Riff3D Canonical IR | PlayCanvas (verified in source) | Babylon.js (verified in source) |
|---------------------|-------------------------------|-------------------------------|
| **Entity** (scene node) | `Entity extends GraphNode` | `TransformNode` / `Mesh` (depends on components) |
| **Transform** | Entity-level: `position`, `rotation`, `scale` (Euler) | Node-level: `position`, `rotation` (Euler radians), `scaling` |
| **Parent-child** | `entity.addChild()`, `parent` ref, `children` array | `node.parent = parentNode` |
| **MeshRenderer** (primitive) | `addComponent('render', { type: 'box' })` | `MeshBuilder.CreateBox()` |
| **MeshRenderer** (asset) | `addComponent('render', { asset: modelAsset })` | `SceneLoader.ImportMesh()` |
| **Light** | `addComponent('light', { type, color, intensity })` | `new DirectionalLight()` / `new PointLight()` / `new SpotLight()` |
| **Camera** | `addComponent('camera', { fov, near, far })` | `new FreeCamera()` / `new ArcRotateCamera()` |
| **RigidBody** | `addComponent('rigidbody', { type, mass })` | `new PhysicsAggregate(node, shape, { mass })` |
| **Collider** | `addComponent('collision', { type, halfExtents })` (separate component) | Part of `PhysicsAggregate` or separate `PhysicsShape` |
| **AudioSource** | `addComponent('sound', { ... })` | `new Sound(name, url, scene)` |
| **Script/Behavior** | `addComponent('script', { scripts: { name: { attributes } } })` | `node.addBehavior(new CustomBehavior())` |
| **Tags** | `entity.tags.add('tag')` (Tags helper on GraphNode) | `Tags.AddTagsTo(node, 'tag')` (utility class) |
| **Material** | Asset system: `MaterialAsset` referenced by ID | `new PBRMaterial(name, scene)` or `new StandardMaterial()` |
| **Animation** | `addComponent('anim', { stateGraph })` | `AnimationGroup`, `Animatable` |

### Critical Adapter Interface

```typescript
interface EngineAdapter {
  readonly name: string;

  // Load Canonical IR into runtime scene
  loadScene(ir: CanonicalScene, container: HTMLElement): Promise<RuntimeScene>;

  // Apply incremental update (from PatchOps → IR diff)
  applyDelta(scene: RuntimeScene, delta: CanonicalDelta): void;

  // Generate standalone project from IR
  eject(ir: CanonicalScene, options: EjectOptions): Promise<ProjectOutput>;

  // Map individual component to runtime
  mapComponent(component: CanonicalComponent, node: CanonicalNode): RuntimeComponent;

  // Dispose/cleanup
  dispose(scene: RuntimeScene): void;
}
```

The adapter interface must support both **full scene load** (initial) and **incremental delta application** (for real-time editing preview). This is critical — rebuilding the entire scene on every PatchOp would be unacceptable for editor responsiveness.

### Key Divergences to Handle in Adapters

| Divergence | Riff3D Canonical IR Approach | PlayCanvas Adapter | Babylon.js Adapter |
|---|---|---|---|
| **Rotation** | Store both Euler (degrees) + Quaternion | Use Euler (native) | Convert degrees to radians |
| **Coordinate system** | Y-up right-handed | Native match | Native match (but Unity adapter will need left-hand flip) |
| **Physics bodies** | Separate RigidBody + Collider components | Map to separate `rigidbody` + `collision` components (natural fit) | Combine into `PhysicsAggregate` |
| **Behaviors/Scripts** | `BehaviorComponent` with typed properties | Generate `pc.createScript()` with `attributes.add()` | Generate `class extends Behavior<Node>` |
| **Materials** | Asset registry with PBR properties | Create `StandardMaterial` or `Material` asset | Create `PBRMaterial` with property mapping |
| **Entity creation** | All entities are uniform nodes | All entities are `pc.Entity` (uniform) | Type-specific: `TransformNode` vs `Mesh` vs `Light` (adapter must pick correct class) |

## Collaboration Architecture

### PlayCanvas Editor: ShareDB/OT (Actual Implementation)

From source code analysis of the PlayCanvas editor, their collaboration architecture is:

1. **ShareDB** (Operational Transform library) provides the conflict resolution backbone
2. **WebSocket** transport with authentication, reconnection (3 attempts), and keep-alive pings
3. **Scene is a ShareDB document** — operations use JSON OT paths: `{ p: ['entities', entityId], oi: entityData }`
4. **Observer pattern** bridges ShareDB changes to the editor UI — remote operations trigger Observer events that update the local state
5. **Operations are submitted locally** then synced — `submitOp([op])` is non-blocking
6. **No explicit locking** in the source code examined — ShareDB's OT handles concurrent edits at the property level

### Riff3D Collaboration Strategy

Riff3D's collaboration should be **PatchOps-native**, not bolted on:

#### Phase 1: LWW Per Property (Ship First)

**Last-Write-Wins per property path** is the simplest correct strategy:

```typescript
interface CollaborationOp {
  opId: string;           // Unique operation ID
  userId: string;         // Who made the edit
  timestamp: number;      // Lamport timestamp (not wall clock)
  patchOp: PatchOp;       // The actual operation
}

// Conflict resolution: for same property path, highest timestamp wins
// For structural ops (create/delete entity), use causal ordering
```

Why LWW first:
- PatchOps are already **scoped to stable IDs** and **path-based** — LWW maps naturally
- No merge function complexity
- Last editor to touch a property "wins" — intuitive for 2-4 user collaboration
- Matches how PlayCanvas actually works (ShareDB OT resolves to latest write for same path)

#### Phase 2: Operational Transform on PatchOps

If LWW proves insufficient (property-level conflicts causing lost work), upgrade to OT:

```typescript
interface OTTransform {
  // Given two concurrent operations, transform them so both can be applied
  transform(op1: PatchOp, op2: PatchOp): [PatchOp, PatchOp];
}
```

PatchOps are already structured for OT:
- **Path-based** (like JSON OT / ShareDB)
- **Deterministic** (same state + same op = same result)
- **Invertible** (can compute undo from the op)
- **Scoped to stable IDs** (no array index issues)

The key OT cases for scene graphs:
- **Concurrent property edits on same entity**: LWW or merge (e.g., position components merge independently)
- **Concurrent structural changes**: Delete vs. edit on same entity — delete wins, edit is dropped
- **Concurrent reparent**: Two users reparent same entity — last timestamp wins
- **Create vs. create**: No conflict (different entity IDs)

#### Phase 3: CRDT (If Needed)

For offline-first or eventually-consistent scenarios, scene graph CRDTs:

- **Yjs** or **Automerge** for the ECSON document
- Map ECSON's flat entity map to a CRDT Map
- Each entity's properties as a CRDT Map
- Children ordering as a CRDT Sequence
- Event wiring as a CRDT Set

This is likely overkill for the initial use case (2-8 users in real-time) but the architecture should not preclude it. **The key design decision**: PatchOps as the operation format means the collaboration layer is swappable — LWW, OT, or CRDT can all consume the same PatchOps.

### Shared Operation Log

All PatchOps are appended to an ordered log:

```
Op Log: [op1, op2, op3, op4, ...]
  │                         │
  │  ┌──────────────────────┘
  │  │
  ▼  ▼
┌─────────────┐
│ ECSON State  │  = replay(initial, ops[0..n])
│ (computed)   │
└─────────────┘
```

The ECSON state at any point is the result of replaying all ops from the beginning. This gives:
- **Undo/redo** — pop/push from the log with inverses
- **Collaboration** — merge remote ops into the log
- **Time travel** — reconstruct any historical state
- **Auditing** — full edit history
- **AI safety** — AI-generated PatchOps can be reviewed before application

## ECSON Schema Evolution

### Versioning Strategy

```typescript
interface ECSONDocument {
  schemaVersion: number;   // Monotonically increasing
  // ... rest of document
}
```

### Migration Pattern

```typescript
interface Migration {
  from: number;
  to: number;
  migrate(doc: ECSONDocument): ECSONDocument;
}

const MIGRATIONS: Migration[] = [
  {
    from: 1, to: 2,
    migrate(doc) {
      // Example: split RigidBody into RigidBody + Collider
      for (const [id, entity] of Object.entries(doc.entities)) {
        if (entity.components['rigid-body']) {
          const rb = entity.components['rigid-body'];
          entity.components['collider'] = {
            type: 'Collider',
            enabled: true,
            properties: { shape: rb.properties.colliderShape, /* ... */ }
          };
          delete rb.properties.colliderShape;
        }
      }
      doc.schemaVersion = 2;
      return doc;
    }
  }
];

function migrateDocument(doc: ECSONDocument): ECSONDocument {
  let current = doc;
  for (const migration of MIGRATIONS) {
    if (current.schemaVersion === migration.from) {
      current = migration.migrate(structuredClone(current));
    }
  }
  return current;
}
```

Key principles:
- **Forward migrations only** (backward optional) — matches FOUNDATION.md
- **Migrations are pure functions** — input document in, output document out
- **Migrations run on load** — documents are always upgraded to current version
- **Migrations are tested** — golden fixtures include version-1, version-2, etc. variants
- **Additive preferred** — new fields with defaults are non-breaking; removing or renaming requires migration

## Recommended Monorepo Structure

```
packages/
├── ecson/                    # ECSON schema + store + migrations
│   ├── src/
│   │   ├── schema.ts             # TypeScript interfaces (Entity, ComponentInstance, etc.)
│   │   ├── store.ts              # ECSON document store (read/write)
│   │   ├── migrations.ts         # Schema version migrations
│   │   ├── validation.ts         # Zod schemas for runtime validation
│   │   └── index.ts
│   └── __tests__/
│
├── patchops/                 # PatchOps spec + engine + validators
│   ├── src/
│   │   ├── types.ts              # PatchOp discriminated union
│   │   ├── engine.ts             # Apply ops to ECSON state
│   │   ├── inverse.ts            # Compute inverse ops for undo
│   │   ├── validate.ts           # Validate ops against schema
│   │   ├── serialize.ts          # Serialize/deserialize ops
│   │   └── index.ts
│   └── __tests__/
│
├── canonical-ir/             # Canonical IR spec + compiler
│   ├── src/
│   │   ├── types.ts              # CanonicalScene, CanonicalNode, CanonicalComponent
│   │   ├── compiler.ts           # ECSON → Canonical IR compilation
│   │   ├── behavior-compiler.ts  # High-level behaviors → primitives
│   │   ├── asset-resolver.ts     # Resolve asset references
│   │   ├── event-compiler.ts     # EventWire[] → dispatch table
│   │   └── index.ts
│   └── __tests__/
│
├── iql/                      # IQL parser + compiler
│   ├── src/
│   │   ├── parser.ts             # IQL text → AST
│   │   ├── compiler.ts           # AST → PatchOps
│   │   ├── presets.ts            # Preset registry (platform, arena, etc.)
│   │   ├── modifiers.ts          # Behavior modifier registry (bouncy, slippery)
│   │   ├── resolver.ts           # Name/tag/spatial reference resolution
│   │   └── index.ts
│   └── __tests__/
│
├── editor/                   # Editor UI (React + viewport)
│   ├── src/
│   │   ├── panels/               # Hierarchy, Inspector, AssetBrowser, Viewport
│   │   ├── tools/                # Transform gizmo, selection, grid
│   │   ├── commands/             # Editor commands (create, delete, reparent, etc.)
│   │   ├── collaboration/        # Presence, cursors, conflict UI
│   │   ├── stores/               # Editor-specific Zustand stores
│   │   └── index.ts
│   └── __tests__/
│
├── runtime-web/              # Web runtime (manages adapter lifecycle)
│   ├── src/
│   │   ├── runtime.ts            # Scene loading, play/edit mode toggle
│   │   ├── adapters/
│   │   │   ├── adapter.ts            # Adapter interface
│   │   │   ├── playcanvas.ts         # PlayCanvas adapter
│   │   │   └── babylon.ts            # Babylon.js adapter
│   │   └── index.ts
│   └── __tests__/
│
├── fixtures/                 # Golden projects + snapshots
│   ├── projects/
│   │   ├── 01-transforms-parenting.ecson.json
│   │   ├── 02-materials-lights.ecson.json
│   │   ├── 03-simple-animation.ecson.json
│   │   ├── 04-events-triggers.ecson.json
│   │   ├── 05-character-stub.ecson.json
│   │   └── ...
│   ├── snapshots/                # Expected Canonical IR outputs
│   └── patchop-logs/             # Determinism replay logs
│
└── conformance/              # Test harness
    ├── src/
    │   ├── round-trip.test.ts        # ECSON → IR → ECSON
    │   ├── replay.test.ts            # PatchOps determinism
    │   ├── adapter-conformance.test.ts  # Per-adapter rendering checks
    │   └── performance.test.ts       # Budget enforcement
    └── __tests__/
```

### Structure Rationale

- **ecson/**: The document format package has zero runtime dependencies. It defines the schema, validates documents, and handles migrations. Everything else depends on this.
- **patchops/**: The operation engine depends only on ecson/. It does not know about the editor UI, the Canonical IR, or any adapter. This isolation ensures PatchOps are testable in isolation and replayable anywhere.
- **canonical-ir/**: The compiler depends on ecson/ and produces an output that adapters consume. It does not depend on any adapter — adapters depend on it.
- **iql/**: Depends on patchops/ and ecson/. Purely additive — removing IQL does not break anything.
- **editor/**: Depends on patchops/ (for making edits), ecson/ (for reading state), and runtime-web/ (for viewport rendering). Does NOT depend on canonical-ir/ directly — the runtime handles that.
- **runtime-web/**: Depends on canonical-ir/ and the adapter interface. The editor passes ECSON, the runtime compiles to IR and hands to the active adapter.
- **fixtures/ + conformance/**: Depend on everything. They are the regression backbone.

## Architectural Patterns

### Pattern 1: All Edits Through PatchOps (Non-Negotiable)

**What:** Every meaningful state change (create entity, set property, reparent, add component) must produce a PatchOp that is applied to ECSON. No "hidden" mutations inside UI components.

**Why:** This is the contract that enables undo/redo, collaboration, deterministic replay, AI safety, and time travel. It matches how PlayCanvas editor works — every edit goes through Observer + ShareDB operations.

**Trade-offs:** Slightly more indirection than direct state mutation. Every UI action must construct a PatchOp first. Worth it because the entire system's integrity depends on it.

```typescript
// WRONG: Direct state mutation in a React component
function handlePositionChange(entityId: string, newPos: Vec3) {
  ecsonStore.entities[entityId].transform.position = newPos; // BAD
}

// RIGHT: Through PatchOps
function handlePositionChange(entityId: string, newPos: Vec3) {
  patchOps.apply({
    type: 'SetProperty',
    entityId,
    path: 'transform.position',
    value: newPos
  });
}
```

### Pattern 2: Flat Entity Map with Parent References

**What:** Entities stored as `Record<string, Entity>` (flat map keyed by stable ID), with parent-child relationships expressed via `parentId` string reference and `order` number.

**Why:** Both PlayCanvas and Babylon.js use flat maps internally. Random access is O(1). Granular PatchOps can target any entity without touching siblings or parents. Reparenting is a single field change. Collaboration is simpler (no array index conflicts).

**Trade-offs:** Tree traversal requires reconstruction from parentId links. Keep a computed children index in memory (rebuilt on structural changes).

```typescript
interface Entity {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  enabled: boolean;
  tags: string[];
  layers: string[];
  transform: Transform;
  components: Record<string, ComponentInstance>;
  metadata: Record<string, unknown>;
}

// ECSON document stores entities as flat map
entities: Record<string, Entity>

// Runtime maintains computed children index
childrenIndex: Record<string, string[]>  // parentId → sorted child IDs
```

### Pattern 3: Schema-Driven Component Registry

**What:** Every component type is registered with a typed property schema, default values, editor hints, and event/action port descriptors. The editor UI auto-generates inspector forms from the schema.

**Why:** PlayCanvas does this — component schemas drive accessor generation (`_buildAccessors`). Babylon takes a different approach (class inheritance), but for a portable system, schema-driven is better because the schema is serializable and engine-agnostic.

**Trade-offs:** More upfront work to define schemas. Requires a schema language that covers all property types (numbers, vectors, colors, enums, asset refs, entity refs).

```typescript
interface ComponentDefinition {
  type: string;
  category: 'rendering' | 'physics' | 'gameplay' | 'audio' | 'ui' | 'logic';
  description: string;
  singleton: boolean;
  properties: PropertySchema[];
  events: PortDescriptor[];
  actions: PortDescriptor[];
}

interface PropertySchema {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'vec2' | 'vec3' | 'vec4' | 'color' |
        'enum' | 'asset-ref' | 'entity-ref' | 'json';
  default: unknown;
  constraints?: { min?: number; max?: number; step?: number; enumValues?: string[] };
  editorHint?: 'color' | 'slider' | 'dropdown' | 'curve' | 'asset-ref';
}
```

### Pattern 4: Separate Asset Registry

**What:** Materials, textures, meshes, audio clips, animation clips, and scripts are stored in a top-level `assets` map in the ECSON document, referenced by ID from components.

**Why:** Both PlayCanvas and Babylon store materials as separate objects referenced by ID. Shared materials across entities (change once, update everywhere). Enables an asset browser panel. Smaller scene files (no duplicated material data). Required for any non-trivial project.

**Trade-offs:** Asset reference resolution adds a lookup step. Dangling references possible (asset deleted but still referenced) — validation catches this.

### Pattern 5: Behavior Compilation

**What:** High-level gameplay behaviors (ScoreZone, KillZone, MovingPlatform) are defined as ECSON components with rich schemas, but compile down to Canonical IR primitives that any engine can execute: trigger volumes + actions + force applications.

**Why:** This is the key insight from the prototype's canonical layer research. Without compilation, every adapter must understand 30+ gameplay-specific component types. With compilation, adapters only need to implement ~10 concrete primitive types.

**Trade-offs:** Compilation adds a step. Some behaviors may not compile cleanly to primitives and need engine-specific `BehaviorComponent` implementations. The `BehaviorDefinition` type handles this with per-engine implementation references and a fallback behavior graph.

## Data Flow

### Edit Flow (Single User)

```
User Action (click, drag, type)
    │
    ▼
Editor Command (create, move, set property)
    │
    ▼
PatchOp Construction
    │
    ├── Validate against schema
    ├── Compute inverse (for undo)
    │
    ▼
PatchOps Engine: apply to ECSON Store
    │
    ├── Append to operation log
    ├── Push inverse to undo stack
    │
    ▼
ECSON Store Update (entities, assets, wiring)
    │
    ├── Notify editor UI (React re-render)
    │
    ▼
Runtime: incremental IR update → Adapter delta → Viewport re-render
```

### Edit Flow (Collaborative)

```
User A types in inspector          User B drags a gizmo
    │                                  │
    ▼                                  ▼
PatchOp: SetProperty              PatchOp: SetProperty
    │                                  │
    ├── Apply locally                  ├── Apply locally
    ├── Send to collab server          ├── Send to collab server
    │                                  │
    └──────────► Server ◄──────────────┘
                   │
                   ├── Order ops (Lamport timestamp)
                   ├── Detect conflicts (same path?)
                   │   └── LWW: highest timestamp wins
                   ├── Broadcast merged ops to all clients
                   │
              ┌────┴────┐
              ▼         ▼
          User A     User B
          applies    applies
          B's ops    A's ops
          (if not    (if not
          conflicted) conflicted)
```

### IQL → Runtime Flow

```
AI/Human: "SPAWN platform AT 0 3 0 PAINT red"
    │
    ▼
IQL Parser → AST: { verb: SPAWN, preset: platform, position: [0,3,0], color: red }
    │
    ▼
IQL Compiler:
    ├── Resolve preset → entity template + components
    ├── Generate entity ID
    ├── Apply modifiers (PAINT → material asset)
    │
    ▼
PatchOps: [CreateEntity, AddComponent(MeshRenderer), AddComponent(RigidBody),
           AddComponent(Collider), AddAsset(material)]
    │
    ▼
(Same flow as single-user edit above)
```

## Build Order (Dependency Chain)

### Phase 0: Contracts First

| Package | Deliverable | Why First |
|---------|-------------|-----------|
| `ecson` | Schema types, validation, migration scaffold | Everything depends on the document format |
| `patchops` | Op types, apply engine, inverse computation | All edits flow through this |
| `canonical-ir` | IR types, compiler from ECSON | Adapters consume this |
| `fixtures` | 5 golden projects (transforms, materials, animation, events, character stub) | Tests need fixtures from day one |
| `conformance` | Round-trip tests, replay tests | Prevents drift immediately |

**Exit criteria:** ECSON → PatchOps → ECSON round-trip passes for all fixtures. ECSON → Canonical IR → ECSON round-trip passes for portable subset.

### Phase 1: Closed Loop (Edit → Run)

| Package | Deliverable | Depends On |
|---------|-------------|------------|
| `runtime-web` | Adapter interface, one working adapter (PlayCanvas first) | `canonical-ir` |
| `editor` | Minimal shell: load fixture, apply ops, save, compile, run | `patchops`, `ecson`, `runtime-web` |

**Exit criteria:** Load a golden fixture in the editor, apply a PatchOp (move an entity), save ECSON, compile to Canonical IR, render in PlayCanvas adapter.

### Phase 2: Dual Adapter Validation

| Package | Deliverable | Depends On |
|---------|-------------|------------|
| `runtime-web` | Babylon.js adapter | `canonical-ir` |
| `conformance` | Adapter conformance tests (both adapters render fixtures within tolerance) | `fixtures`, both adapters |

**Exit criteria:** All golden fixtures render in both PlayCanvas and Babylon.js adapters. Conformance tests pass for both.

### Phase 3: Collaboration-Ready Core

| Package | Deliverable | Depends On |
|---------|-------------|------------|
| `patchops` | Shared operation log, LWW conflict resolution | Phase 1 |
| `editor` | Presence, cursors, multi-user editing | `patchops` collab features |

**Exit criteria:** Two users can edit the same ECSON document concurrently. Edits converge. Operation log is consistent.

### Phase 4: IQL + Templates

| Package | Deliverable | Depends On |
|---------|-------------|------------|
| `iql` | Parser, compiler, 10+ presets, 15+ modifiers | `patchops`, `ecson` |
| `fixtures` | Template fixtures (Party Game Starter, Character Playground, Physics Toy, Cinematic Clip) | `iql` |

**Exit criteria:** IQL commands produce correct PatchOps. Template fixtures pass round-trip and conformance.

### Dependency Graph

```
Phase 0: ecson ─────────────► patchops ─────────────► canonical-ir
           │                     │                        │
           └──────┬──────────────┘                        │
                  ▼                                       │
         fixtures + conformance                           │
                                                          │
Phase 1:                    editor (minimal) ◄── runtime-web (PlayCanvas adapter)
                                │                        │
Phase 2:                        │              runtime-web (+ Babylon adapter)
                                │                        │
                          conformance (dual adapter) ◄───┘
                                │
Phase 3:              patchops (collab) ──► editor (multi-user)
                                │
Phase 4:              iql ──────┘
```

**Critical path:** ecson → patchops → canonical-ir → PlayCanvas adapter → editor shell. This is the minimum viable closed loop. Babylon adapter, IQL, and collaboration are parallel or follow-on work.

## Anti-Patterns

### Anti-Pattern 1: Skipping PatchOps for "Simple" Edits

**What people do:** Bypass PatchOps for "trivial" changes like toggling visibility, claiming it's "just a UI state."
**Why it's wrong:** Breaks undo, breaks collaboration, breaks replay. The operation log becomes incomplete. "Simple" edits compound — soon half the state is untracked.
**Do this instead:** Every persistent state change goes through PatchOps. Transient UI state (gizmo hover, panel resize) is exempt, but anything that affects ECSON is not.

### Anti-Pattern 2: Putting Engine-Specific Types in ECSON

**What people do:** Store `pc.Entity` references or `BABYLON.Mesh` objects in the document.
**Why it's wrong:** ECSON must be engine-agnostic. If ECSON contains PlayCanvas types, the Babylon adapter cannot consume it.
**Do this instead:** ECSON stores only plain TypeScript interfaces with JSON-serializable values. Engine-specific objects exist only inside adapters.

### Anti-Pattern 3: Adapter-Specific Component Logic

**What people do:** Put "if PlayCanvas then X, if Babylon then Y" inside the Canonical IR compiler.
**Why it's wrong:** The compiler should not know about adapters. That knowledge belongs in the adapters themselves.
**Do this instead:** The Canonical IR is engine-agnostic. Adapters map canonical types to engine-specific constructs. If a component cannot be expressed in the canonical format, it belongs in `tuning` (engine-specific hints that degrade gracefully).

### Anti-Pattern 4: Full Scene Rebuild on Every PatchOp

**What people do:** Recompile ECSON → Canonical IR → engine scene on every edit.
**Why it's wrong:** Destroys editor responsiveness. A scene with 200 entities takes measurable time to fully rebuild.
**Do this instead:** Incremental updates. PatchOps target specific entities/properties. The runtime adapter receives a delta and updates only the affected engine objects. Full recompilation only on load or major structural changes.

### Anti-Pattern 5: Collaboration at the Wrong Layer

**What people do:** Build collaboration at the adapter/runtime level (sync engine objects).
**Why it's wrong:** Each adapter would need its own collaboration logic. Engine objects are ephemeral and engine-specific.
**Do this instead:** Collaboration operates at the PatchOps level. Remote users receive PatchOps, apply them to their local ECSON, and their local runtime adapter reflects the changes. The collaboration layer never touches engine objects.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 concurrent editors | Single collab server, in-memory operation log. LWW per property. No optimization needed. |
| 10-100 concurrent editors | Operation log in a persistent store (Redis or Postgres). Server-side op batching. Consider OT for conflict-heavy scenarios. |
| 100+ concurrent editors | CRDT-based approach (Yjs/Automerge). Document partitioning (edit different scene regions independently). Operational compression (merge sequential property edits). |

### Scaling Priorities

1. **First bottleneck: Operation log throughput.** Frequent property edits (dragging a gizmo = 60 ops/sec) can overwhelm a naive broadcast. Solution: throttle/batch ops on the client (send at 10-20 Hz), debounce property edits, use binary encoding for position/rotation.
2. **Second bottleneck: Canonical IR compilation.** Large scenes take measurable time to compile. Solution: incremental compilation (only recompile changed nodes), lazy compilation (compile on demand for viewport, full compile on save/eject).
3. **Third bottleneck: Adapter scene graph size.** Both PlayCanvas and Babylon maintain internal scene graphs. Hundreds of entities with physics and rendering are expensive. Solution: LOD, culling, instancing — but these are engine-level optimizations, not architecture changes.

## Sources

- **PlayCanvas engine source code** (`/home/frank/playcanvas-engine/src/`) — Direct analysis of GraphNode, Entity, Component, ComponentSystem, ComponentSystemRegistry, SceneParser (HIGH confidence: primary source)
- **PlayCanvas editor source code** (`/home/frank/playcanvas-editor/src/`) — Direct analysis of Entity (Observer-based), History, create/delete/reparent operations, ShareDB real-time collaboration, Schema system (HIGH confidence: primary source)
- **Babylon.js source code** (`/home/frank/babylonjs/packages/dev/core/src/`) — Direct analysis of Node, Scene, Behavior interface, serialization patterns (HIGH confidence: primary source)
- **Babylon editor source code** (`/home/frank/babylon-editor/editor/src/`) — Direct analysis of undo/redo stack, project structure (MEDIUM confidence: smaller editor, less collaboration code)
- **Riff3D prototype research** (`/home/frank/riff3d-prototype/.planning/rebuild-research/`) — Universal Schema Research (00), Canonical Layer Research (01), IQL Research (02), Spatial Validation Research (03), FOUNDATION.md (HIGH confidence: prior validated research)
- **Riff3D prototype architecture** (`/home/frank/riff3d-prototype/.planning/research/ARCHITECTURE.md`) — Previous architecture research for R3F-based prototype (MEDIUM confidence: different architecture, but patterns transferable)
- **Transfer Thought research** (`/home/frank/riff3d-prototype/research/01-transfer-thought.md`) — JSON serialization pattern, publishing workflow (MEDIUM confidence: different engine, pattern-level insights)
- **React Three Game research** (`/home/frank/riff3d-prototype/research/02-react-three-game.md`) — Prefab/GameObject/ComponentData types, ComponentRegistry pattern (HIGH confidence: directly informed the universal schema)
- **ShareDB** — OT-based collaboration library used by PlayCanvas editor. Provides JSON OT operations over WebSocket (HIGH confidence: observed in PlayCanvas editor source code)
- **glTF 2.0 + KHR_interactivity / KHR_physics_rigid_bodies** — Canonical interchange format for 3D assets, being extended with interactivity and physics (MEDIUM confidence: from prototype research, not re-verified)
- **OMI Group glTF extensions** — Portable interactive 3D standards for physics, audio, spawn points (MEDIUM confidence: from prototype research, not re-verified)

---
*Architecture research for: Web-based 3D engine/editor collaboration platform*
*Researched: 2026-02-19*
