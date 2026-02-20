# Advance Research: Babylon.js Engine & Editor

**Researched:** 2026-02-19 (advance, during Phase 1 execution)
**Purpose:** Pre-research Babylon.js adapter patterns for Phase 4 (Dual Adapter Validation) AND inform Phase 1 Canonical IR design to ensure engine-agnostic compatibility from day one.
**Sources:** Babylon.js engine source (`/home/frank/babylonjs/`), Babylon.js editor source (`/home/frank/babylon-editor/`), code exploration of core packages.

---

## Table of Contents

1. [Scene Graph & Node Hierarchy](#1-scene-graph--node-hierarchy)
2. [Transform Model](#2-transform-model)
3. [Scene Creation & Render Loop](#3-scene-creation--render-loop)
4. [Entity Creation Patterns](#4-entity-creation-patterns)
5. [PBR Material System](#5-pbr-material-system)
6. [Asset & Texture Pipeline](#6-asset--texture-pipeline)
7. [Incremental Updates & Observables](#7-incremental-updates--observables)
8. [Animation System](#8-animation-system)
9. [Physics Integration](#9-physics-integration)
10. [Gizmo System](#10-gizmo-system)
11. [Picking & Raycasting](#11-picking--raycasting)
12. [Editor Architecture Patterns](#12-editor-architecture-patterns)
13. [Cross-Engine Mapping: Babylon.js vs PlayCanvas vs Canonical IR](#13-cross-engine-mapping)
14. [Phase 1 Compatibility Implications](#14-phase-1-compatibility-implications)
15. [Recommendations & Gotchas](#15-recommendations--gotchas)
16. [Reference Files](#16-reference-files)

---

## 1. Scene Graph & Node Hierarchy

### 1.1 Inheritance Chain

Babylon.js uses a deep class hierarchy (unlike PlayCanvas's flat Entity model):

```
Node (base — id, name, parent, children, enabled, behaviors)
├── TransformNode (extends Node — position, rotation, scaling, worldMatrix)
│   ├── AbstractMesh (extends TransformNode — material, visibility, picking, physics)
│   │   ├── Mesh (concrete — geometry, vertex data, instances)
│   │   ├── InstancedMesh
│   │   ├── GroundMesh
│   │   └── LinesMesh
│   └── [Bones, etc.]
├── Camera (extends Node — NOT TransformNode!)
│   ├── TargetCamera → FreeCamera → UniversalCamera
│   └── ArcRotateCamera
└── Light (extends Node — NOT TransformNode!)
    ├── HemisphericLight
    └── ShadowLight
        ├── PointLight
        ├── DirectionalLight
        └── SpotLight
```

**Key differences from PlayCanvas:**
- PlayCanvas: Single `Entity` class, components added dynamically (`entity.addComponent('render', {...})`)
- Babylon.js: Class hierarchy determines capability. A `Mesh` IS renderable; a `TransformNode` is NOT.
- Cameras and Lights extend `Node` directly, not `TransformNode` — they have position/direction but NOT the full `TransformNode` API (no `.scaling`, different rotation model)

**Source:** `/home/frank/babylonjs/packages/dev/core/src/node.ts`, `/home/frank/babylonjs/packages/dev/core/src/Meshes/transformNode.ts`

### 1.2 Node Base Properties

```typescript
// node.ts (lines 88-127)
name: string;                    // Display name
id: string;                      // String identifier (NOT auto-generated unique)
uniqueId: number;                // Auto-generated per scene (number, not string!)
metadata: any;                   // User-defined data bag
parent: Nullable<Node>;          // Parent node (setter handles reparenting)
isVisible: boolean;              // Getter/setter
inheritVisibility: boolean;      // Child inherits parent visibility
enabled: boolean;                // With setEnabled(value) method
_children: Nullable<Node[]>;     // Internal — managed via parent property
_worldMatrix: Matrix;            // Cached world matrix
```

### 1.3 Parent/Child Operations

```typescript
// Reparenting via parent setter (node.ts lines 223-264)
child.parent = newParent;  // Removes from old parent, adds to new, marks dirty

// TransformNode convenience methods (transformNode.ts lines 835-852)
parent.addChild(child);    // Sets child.parent = this
parent.removeChild(child); // Sets child.parent = null

// Querying
node.getChildren(predicate?, directOnly?): Node[]
node.getDescendants(directOnly?, predicate?): Node[]
node.getChildMeshes(directOnly?, predicate?): AbstractMesh[]
node.isDescendantOf(ancestor): boolean
```

### 1.4 Disposal

Disposal is **recursive by default** (like PlayCanvas):

```typescript
// node.ts (lines 946-977)
node.dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void
// doNotRecurse = false (default) → disposes all descendants
// Fires onDisposeObservable, clears behaviors, removes from scene
```

---

## 2. Transform Model

### 2.1 Local Transforms

**Source:** `/home/frank/babylonjs/packages/dev/core/src/Meshes/transformNode.ts` (lines 61-250)

```typescript
// Position — Vector3, default (0,0,0)
node.position = new Vector3(x, y, z);
node.position.x = 5;  // Direct mutation works, auto-dirties

// Rotation — Euler angles in RADIANS (Vector3), default (0,0,0)
node.rotation = new Vector3(rx, ry, rz);  // Radians!

// Rotation — Quaternion (alternative, mutually exclusive with Euler)
node.rotationQuaternion = new Quaternion(x, y, z, w);
// Setting quaternion clears Euler; setting Euler clears quaternion

// Scale — Vector3, default (1,1,1)
node.scaling = new Vector3(sx, sy, sz);
```

**Critical: Rotation duality.** Euler and Quaternion are mutually exclusive:
- Setting `rotation` (Euler) nulls `rotationQuaternion`
- Setting `rotationQuaternion` zeroes `rotation`
- glTF loader always sets quaternion; Euler users must be aware

### 2.2 World Transforms

```typescript
// Force recompute
node.computeWorldMatrix(true);

// Read world-space
node.getWorldMatrix(): Matrix
node.getAbsolutePosition(): Vector3
node.setAbsolutePosition(pos: Vector3): TransformNode

// Direction vectors from world matrix
node.forward: Vector3  // Normalized Z axis
node.up: Vector3       // Normalized Y axis
node.right: Vector3    // Normalized X axis
```

### 2.3 Dirty Flag System

```typescript
// Automatic — all property setters call _markAsDirtyInternal()
// Manual check
node.isSynchronized(): boolean
node.isSynchronizedWithParent(): boolean

// Freeze optimization (skip recomputation)
node.freezeWorldMatrix(newWorldMatrix?, decompose?): TransformNode
node.unfreezeWorldMatrix(): TransformNode
```

### 2.4 Pivot Point

```typescript
node.setPivotMatrix(matrix: Matrix, postMultiply?: boolean): TransformNode
node.getPivotMatrix(): Matrix
```

---

## 3. Scene Creation & Render Loop

### 3.1 Initialization Sequence

```typescript
// 1. Create engine from canvas
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);  // true = antialias

// 2. Create scene
const scene = new Scene(engine);
scene.clearColor = new Color4(0.2, 0.2, 0.3, 1.0);

// 3. Add camera (required for rendering)
const camera = new UniversalCamera("camera", new Vector3(0, 5, -10), scene);
camera.setTarget(Vector3.Zero());
camera.attachControl(canvas, true);

// 4. Add light
const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);

// 5. Start render loop
engine.runRenderLoop(() => scene.render());

// 6. Handle resize
window.addEventListener("resize", () => engine.resize());

// 7. Cleanup
engine.dispose();  // Or scene.dispose()
```

### 3.2 Scene Collections

```typescript
scene.rootNodes: Node[]          // Parentless nodes
scene.meshes: AbstractMesh[]     // All meshes
scene.lights: Light[]            // All lights
scene.cameras: Camera[]          // All cameras
scene.activeCamera: Camera       // Current render camera
scene.activeCameras: Camera[]    // For multi-viewport
```

### 3.3 Render Loop Control

```typescript
// Start/stop
engine.runRenderLoop(callback);
engine.stopRenderLoop(callback?);

// Single frame
scene.render();  // One frame

// Scene timing
scene._animationTime: number     // Running animation clock
scene._frameId: number           // Frame counter
```

**PlayCanvas equivalent:** `app.start()` / `app.autoRender = false` / `app.renderNextFrame = true`

---

## 4. Entity Creation Patterns

### 4.1 Mesh Primitives (Builder Pattern)

**Source:** `/home/frank/babylonjs/packages/dev/core/src/Meshes/Builders/`

```typescript
import { CreateBox, CreateSphere, CreateCylinder, CreatePlane, CreateGround } from "@babylonjs/core";

const box = CreateBox("box", { size: 2 }, scene);
const sphere = CreateSphere("sphere", { diameter: 2, segments: 32 }, scene);
const cylinder = CreateCylinder("cyl", { height: 3, diameter: 1 }, scene);
const plane = CreatePlane("plane", { size: 5 }, scene);
const ground = CreateGround("ground", { width: 10, height: 10 }, scene);

// Position after creation
box.position = new Vector3(0, 1, 0);
box.material = myMaterial;
```

**Available builders:** Box, Sphere, Cylinder, Capsule, Plane, Ground, Torus, Disc, Ribbon, Tube, Lines, plus 10+ more specialized shapes.

### 4.2 Lights

```typescript
// Directional (sun-like)
const dirLight = new DirectionalLight("dir", new Vector3(-1, -1, 0), scene);
dirLight.intensity = 1.0;
dirLight.diffuse = new Color3(1, 1, 1);

// Point (omni)
const pointLight = new PointLight("point", new Vector3(0, 5, 0), scene);
pointLight.intensity = 1.0;
pointLight.range = 20;

// Spot
const spotLight = new SpotLight("spot", position, direction, angle, exponent, scene);

// Hemisphere (ambient-like)
const hemiLight = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);

// Common properties
light.diffuse: Color3;
light.specular: Color3;
light.intensity: number;
light.range: number;          // For point/spot
```

### 4.3 Cameras

```typescript
// Perspective (default)
const camera = new UniversalCamera("cam", new Vector3(0, 5, -10), scene);
camera.fov = 0.8;            // Radians (not degrees!)
camera.minZ = 0.1;           // Near plane
camera.maxZ = 1000;          // Far plane

// Orthographic
camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
camera.orthoLeft = -10;
camera.orthoRight = 10;
camera.orthoTop = 10;
camera.orthoBottom = -10;

// Controls
camera.attachControl(canvas, true);  // Keyboard + mouse
camera.speed = 0.5;
camera.angularSensibility = 1000;
```

---

## 5. PBR Material System

### 5.1 Material Classes

**Source:** `/home/frank/babylonjs/packages/dev/core/src/Materials/PBR/`

Two main PBR material classes:
- **`PBRMaterial`** — Full-featured, many properties, complex
- **`PBRMetallicRoughnessMaterial`** — Simplified, glTF-aligned, **recommended for Riff3D adapter**

```typescript
// Recommended: PBRMetallicRoughnessMaterial (glTF-aligned)
const mat = new PBRMetallicRoughnessMaterial("mat", scene);
mat.baseColor = new Color3(1, 0, 0);       // RGB
mat.metallic = 0.0;                          // 0-1
mat.roughness = 0.5;                         // 0-1 (direct, NOT inverted!)
mat.baseTexture = new Texture("albedo.png", scene);
mat.metallicRoughnessTexture = texture;      // B=metallic, G=roughness
```

### 5.2 Portable Subset PBR Mapping

| Portable Subset | PBRMetallicRoughnessMaterial | PBRMaterial | Notes |
|-----------------|---------------------------|-------------|-------|
| baseColor | `baseColor` (Color3) | `albedoColor` (Color3) | Direct RGB mapping |
| baseColorMap | `baseTexture` | `albedoTexture` | |
| metallic | `metallic` (0-1) | `metallic` (Nullable<number>) | Same semantics |
| roughness | `roughness` (0-1) | `roughness` (Nullable<number>) | **Direct! No inversion needed** |
| metallicRoughnessMap | `metallicRoughnessTexture` | `metallicTexture` | B=metallic, G=roughness |
| normalMap | *(via PBRMaterial)* `bumpTexture` | `bumpTexture` | Tangent-space normal map |
| aoMap | *(via PBRMaterial)* `ambientTexture` | `ambientTexture` | + `ambientTextureStrength` (0-1) |
| emissiveColor | `emissiveColor` (Color3) | `emissiveColor` (Color3) | (0,0,0) default |
| emissiveIntensity | *(via PBRMaterial)* `emissiveIntensity` | `emissiveIntensity` | 1.0 default |
| emissiveMap | `emissiveTexture` | `emissiveTexture` | |
| opacity | `alpha` (0-1) | `alpha` (0-1) | From Material base class |
| opacityMap | *(via PBRMaterial)* `opacityTexture` | `opacityTexture` | |

### 5.3 Roughness Handling — The Inversion Story

| Engine | Property | Semantics | Adapter Action |
|--------|----------|-----------|----------------|
| PlayCanvas | `material.gloss` | 1 = smooth, 0 = rough | `pcGloss = 1 - irRoughness` |
| Babylon.js `PBRMetallicRoughnessMaterial` | `roughness` | 0 = smooth, 1 = rough | **Direct pass-through** |
| Babylon.js `PBRMaterial` | `microSurface` | 0.9 default (glossiness) | `microSurface = 1 - irRoughness` |

**Recommendation:** Use `PBRMetallicRoughnessMaterial` for the Babylon adapter — it aligns with glTF and requires NO roughness inversion. Reserve `PBRMaterial` only if advanced features (subsurface, sheen, clearcoat) are needed later.

### 5.4 Alpha/Transparency Modes

```typescript
// Transparency modes (Material.ts constants)
PBRMaterial.MATERIAL_OPAQUE = 0            // No transparency
PBRMaterial.MATERIAL_ALPHATEST = 1         // Discard below threshold
PBRMaterial.MATERIAL_ALPHABLEND = 2        // Blend with background
PBRMaterial.MATERIAL_ALPHATESTANDBLEND = 3 // Both

// Alpha test threshold
material._alphaCutOff = 0.4;              // Default cutoff

// Use alpha from base color texture
material._useAlphaFromAlbedoTexture = false;

// Culling
material.backFaceCulling = true;           // Default
material.twoSidedLighting = false;
```

### 5.5 Unlit Rendering

```typescript
material.unlit = true;  // Disables all lighting calculations
```

---

## 6. Asset & Texture Pipeline

### 6.1 Texture Creation

```typescript
// From URL
const tex = new Texture("path/to/image.png", scene);

// From data
const tex = Texture.LoadFromDataString("name", base64Data, scene);

// Options
const tex = new Texture(url, scene, {
  noMipmap: false,
  invertY: false,         // glTF standard: false
  samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
  useSRGBBuffer: true,    // For color textures (not normal maps)
});

// Wrapping
tex.wrapU = Texture.WRAP_ADDRESSMODE;   // 0=CLAMP, 1=WRAP, 2=MIRROR
tex.wrapV = Texture.WRAP_ADDRESSMODE;

// UV channel
tex.coordinatesIndex = 0;  // Which UV set to use
```

### 6.2 GLB/glTF Loading

```typescript
import { SceneLoader } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";  // Side-effect import registers loader

// Load into existing scene
const result = await SceneLoader.ImportMeshAsync("", rootUrl, filename, scene);
// result.meshes, result.lights, result.cameras, result.animationGroups, etc.

// Load as container (doesn't add to scene automatically)
const container = await SceneLoader.LoadAssetContainerAsync(rootUrl, filename, scene);
container.addAllToScene();  // Or selectively add
```

**glTF Material Loading Flow:**
```
_loadMaterialAsync → createMaterial (new PBRMaterial)
  → loadMaterialBasePropertiesAsync (normal, occlusion, emissive)
  → _loadMaterialMetallicRoughnessPropertiesAsync (baseColor, metallic, roughness)
  → loadMaterialAlphaProperties (OPAQUE/MASK/BLEND)
```

### 6.3 Environment Setup

```typescript
// IBL environment texture (HDR/EXR)
scene.environmentTexture = new HDRCubeTexture("env.hdr", scene, 512);
// Or: CubeTexture.CreateFromPrefilteredData("env.env", scene);

// Fog
scene.fogMode = Scene.FOGMODE_EXP2;  // NONE, EXP, EXP2, LINEAR
scene.fogColor = new Color3(0.9, 0.9, 0.9);
scene.fogDensity = 0.01;
scene.fogStart = 20;   // For LINEAR mode
scene.fogEnd = 60;     // For LINEAR mode

// Image processing (tone mapping, exposure)
scene.imageProcessingConfiguration.toneMappingEnabled = true;
scene.imageProcessingConfiguration.exposure = 1.0;
```

---

## 7. Incremental Updates & Observables

### 7.1 Observable System

**Source:** `/home/frank/babylonjs/packages/dev/core/src/Misc/observable.ts`

Babylon.js uses `Observable<T>` extensively (equivalent to EventEmitter/signals):

```typescript
// Subscribe
const observer = observable.add((eventData, eventState) => { ... });

// One-time subscription
observable.addOnce((eventData) => { ... });

// Unsubscribe
observer.remove();
// Or: observable.removeCallback(callback);

// Notify
observable.notifyObservers(data);

// Cleanup
observable.clear();
```

**Key features:**
- Mask-based filtering (bitmask on subscribe and notify)
- WeakRef optimization for memory safety
- Deferred removal to avoid callback skipping during iteration
- Priority ordering via `makeObserverTopPriority()` / `makeObserverBottomPriority()`

### 7.2 Key Node/Scene Observables

```typescript
// Node lifecycle
node.onDisposeObservable: Observable<Node>
node.onEnabledStateChangedObservable: Observable<boolean>
node.onClonedObservable: Observable<Node>

// Transform
transformNode.onAfterWorldMatrixUpdateObservable: Observable<TransformNode>

// Scene render cycle
scene.onBeforeRenderObservable: Observable<Scene>
scene.onAfterRenderObservable: Observable<Scene>
scene.onBeforeAnimationsObservable: Observable<Scene>
scene.onReadyObservable: Observable<Scene>

// Material
material.onDisposeObservable: Observable<Material>
```

### 7.3 Incremental Property Updates

All property changes are immediate and auto-dirty — no rebuild needed:

```typescript
// Transform — immediate, marks dirty automatically
mesh.position.x = 5;
mesh.rotation.y = Math.PI / 4;
mesh.scaling = new Vector3(2, 1, 1);

// Material — immediate
material.albedoColor = new Color3(1, 0, 0);
material.metallic = 0.5;
material.roughness = 0.8;

// Light — immediate
light.intensity = 2.0;
light.diffuse = new Color3(1, 0.8, 0.6);

// Material freeze for batch updates
material.freeze();     // Prevent shader recompilation
// ... make multiple changes ...
material.unfreeze();   // Recompile once
```

**No batch/transaction API** — changes are per-frame anyway since the render loop batches them naturally.

---

## 8. Animation System

### 8.1 Creating Animations

**Source:** `/home/frank/babylonjs/packages/dev/core/src/Animations/`

```typescript
// Create animation targeting a property path
const anim = new Animation(
  "positionAnim",           // Name
  "position.x",             // Target property (dot-notation path on target object)
  30,                        // Frames per second
  Animation.ANIMATIONTYPE_FLOAT,  // Data type
  Animation.ANIMATIONLOOPMODE_CYCLE  // Loop mode
);

// Set keyframes
anim.setKeys([
  { frame: 0, value: 0 },
  { frame: 30, value: 5 },
  { frame: 60, value: 0 },
]);

// Assign to node
mesh.animations.push(anim);

// Play
scene.beginAnimation(mesh, 0, 60, true);  // target, from, to, loop
// Or directly:
scene.beginDirectAnimation(mesh, [anim], 0, 60, true, 1.0);
```

### 8.2 Animation Data Types

```typescript
Animation.ANIMATIONTYPE_FLOAT       // Single number
Animation.ANIMATIONTYPE_VECTOR3     // Position, rotation, scaling
Animation.ANIMATIONTYPE_QUATERNION  // Quaternion rotation
Animation.ANIMATIONTYPE_MATRIX      // Full matrix
Animation.ANIMATIONTYPE_COLOR3      // RGB color
Animation.ANIMATIONTYPE_COLOR4      // RGBA color
Animation.ANIMATIONTYPE_VECTOR2     // 2D vector
Animation.ANIMATIONTYPE_SIZE        // Width/height

// Loop modes
Animation.ANIMATIONLOOPMODE_CYCLE              // Restart
Animation.ANIMATIONLOOPMODE_CONSTANT           // Stop at last frame
Animation.ANIMATIONLOOPMODE_YOYO               // Reverse
Animation.ANIMATIONLOOPMODE_RELATIVE           // Add offset each loop
Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT
```

### 8.3 Animation Groups

```typescript
const group = new AnimationGroup("walk", scene);
group.addTargetedAnimation(posAnim, mesh);
group.addTargetedAnimation(rotAnim, mesh);

// Playback
group.start(true, 1.0, 0, 60);  // loop, speedRatio, from, to
group.pause();
group.stop();
group.goToFrame(30);

// Blending
group.weight = 0.5;          // 0-1 blend weight
group.isAdditive = true;     // Additive blending
group.enableBlending = true;
group.blendingSpeed = 0.05;

// Events
group.onAnimationGroupEndObservable.add(() => { ... });
group.onAnimationGroupLoopObservable.add(() => { ... });
```

### 8.4 Additive Animations

```typescript
Animation.MakeAnimationAdditive(sourceAnimation, referenceFrame?, range?, cloneOriginal?);
AnimationGroup.MakeAnimationAdditive(sourceGroup, options);
```

---

## 9. Physics Integration

### 9.1 Physics V2 (Modern — Havok)

**Source:** `/home/frank/babylonjs/packages/dev/core/src/Physics/v2/`

```typescript
// Enable physics on scene
import HavokPhysics from "@babylonjs/havok";
const havokInstance = await HavokPhysics();
const havokPlugin = new HavokPlugin(true, havokInstance);
scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);

// Add physics to mesh
const aggregate = new PhysicsAggregate(
  mesh,                          // TransformNode
  PhysicsShapeType.BOX,          // SPHERE, BOX, CYLINDER, CAPSULE, MESH, CONVEX_HULL
  {
    mass: 1,                     // 0 = static, >0 = dynamic
    friction: 0.5,
    restitution: 0.3,
  },
  scene
);

// Access physics body
aggregate.body.setLinearVelocity(new Vector3(0, 5, 0));
aggregate.body.applyImpulse(impulse, location);

// Motion types
PhysicsMotionType.STATIC     // Non-moving
PhysicsMotionType.DYNAMIC    // Fully simulated
PhysicsMotionType.ANIMATED   // Kinematic — pushes others but unaffected

// Sync control
aggregate.body.disablePreStep = false;  // Update physics from transform each frame
aggregate.body.disableSync = false;     // Update transform from physics each frame
```

### 9.2 Supported Engines

- **Havok** (v2, modern, recommended) — production quality
- Legacy v1: Cannon.js, Oimo.js, Ammo.js (PhysicsImpostor pattern, deprecated)

**Riff3D note:** Phase 7 uses Rapier.js for physics. The Canonical IR physics representation should be engine-agnostic (shape types, mass, friction, restitution) — the adapter maps to Havok for Babylon, Rapier for PlayCanvas/standalone.

---

## 10. Gizmo System

### 10.1 Individual Gizmos

**Source:** `/home/frank/babylonjs/packages/dev/core/src/Gizmos/`

```typescript
// Create gizmos (need UtilityLayerRenderer)
const utilLayer = new UtilityLayerRenderer(scene);
const posGizmo = new PositionGizmo(utilLayer);
const rotGizmo = new RotationGizmo(utilLayer);
const scaleGizmo = new ScaleGizmo(utilLayer);

// Attach to node
posGizmo.attachedNode = mesh;  // Or attachedMesh

// Configuration
posGizmo.snapDistance = 0.5;        // Snap increment
posGizmo.planarGizmoEnabled = true; // Show plane drag handles
posGizmo.coordinatesMode = GizmoCoordinatesMode.World;  // Or Local

// Events (same pattern for all gizmo types)
posGizmo.onDragStartObservable.add((event) => { /* cache initial value */ });
posGizmo.onDragObservable.add((event) => { /* transient update */ });
posGizmo.onDragEndObservable.add((event) => { /* commit PatchOp */ });
```

### 10.2 GizmoManager (Convenience)

```typescript
const gizmoManager = new GizmoManager(scene);
gizmoManager.positionGizmoEnabled = true;
gizmoManager.rotationGizmoEnabled = false;
gizmoManager.scaleGizmoEnabled = false;
gizmoManager.usePointerToAttachGizmos = true;  // Auto-attach on click

gizmoManager.attachToMesh(mesh);

// State
gizmoManager.isHovered: boolean;
gizmoManager.isDragging: boolean;

// Events
gizmoManager.onAttachedToMeshObservable.add((mesh) => { ... });
```

### 10.3 Comparison with PlayCanvas Gizmos

| Feature | PlayCanvas | Babylon.js |
|---------|-----------|------------|
| Import | `pc.TranslateGizmo` (engine extras) | `PositionGizmo` (core) |
| Render layer | `pc.Gizmo.createLayer()` | `UtilityLayerRenderer` |
| Attach | `gizmo.attach(nodes[])` (array) | `gizmo.attachedNode = node` (single) |
| Snap | `gizmo.snap = true; gizmo.snapIncrement = 0.5` | `gizmo.snapDistance = 0.5` |
| Coord space | `gizmo.coordSpace = 'world'` | `gizmo.coordinatesMode = GizmoCoordinatesMode.World` |
| Events | `transform:start/move/end` | `onDragStart/onDrag/onDragEnd` |
| Multi-select | Native (pass array) | Manual (attach to parent TransformNode) |

---

## 11. Picking & Raycasting

```typescript
// Screen-space picking
const pickResult = scene.pick(screenX, screenY, predicate?, fastCheck?, camera?);

// Result
pickResult.hit: boolean;
pickResult.pickedMesh: AbstractMesh;
pickResult.pickedPoint: Vector3;        // World position
pickResult.distance: number;
pickResult.faceId: number;
pickResult.getNormal(): Vector3;
pickResult.getTextureCoordinates(): Vector2;

// Multi-pick (all intersections)
const results = scene.multiPick(screenX, screenY);

// Ray-based picking
const ray = scene.createPickingRay(screenX, screenY, Matrix.Identity(), camera);
const hit = scene.pickWithRay(ray, predicate);

// Action-based (alternative)
mesh.actionManager = new ActionManager(scene);
mesh.actionManager.registerAction(
  new ExecuteCodeAction(ActionManager.OnPickTrigger, () => { ... })
);
```

**PlayCanvas equivalent:** `Picker.getSelection(x, y)` — color-based ID picking. Babylon uses ray-triangle intersection by default (more accurate but slower for complex meshes).

---

## 12. Editor Architecture Patterns

### 12.1 Undo/Redo — Two-Tier Command Model

**Source:** `/home/frank/babylon-editor/editor/src/tools/undoredo.ts`

```typescript
// Tier 1: Simple property changes (most common)
type SimpleUndoRedoStackItem = {
  object: any;
  property: string;      // Dot-notation path
  oldValue: any;
  newValue: any;
};

// Tier 2: Complex operations
type UndoRedoStackItem = {
  undo: () => void;
  redo: () => void;
};

// Global stack, max 200 items
registerSimpleUndoRedo(item: SimpleUndoRedoStackItem): void
registerUndoRedo(item: UndoRedoStackItem): void
undo(): void
redo(): void

// Observables for UI refresh
onUndoObservable: Observable<void>
onRedoObservable: Observable<void>
```

**Gizmo undo pattern:** Cache initial value on drag start, register undo/redo on drag end with cloned old/new values. Identical pattern to PlayCanvas editor.

**Riff3D mapping:** PatchOps already encode both the operation and its inverse — no need for separate undo/redo stacks. The PatchOp IS the undo/redo record.

### 12.2 Inspector — Polymorphic Type Dispatch

```typescript
// Each inspector implements static predicate
class EditorTransformNodeInspector {
  static IsSupported(object: any): boolean { return object instanceof TransformNode; }
  render() { /* field components */ }
}

// Inspector panel filters and renders matching inspectors
const inspectors = EditorInspector._inspectors
  .filter((i) => i.IsSupported(editedObject))
  .map((i) => <i.inspector object={editedObject} />);
```

**Field components** use dot-notation property paths:
```typescript
<EditorInspectorNumberField object={mesh} property="position.x" label="X" />
<EditorInspectorVectorField object={mesh} property="position" label="Position" />
<EditorInspectorColorField object={material} property="albedoColor" label="Base Color" />
```

**Property path resolution:**
```typescript
function getInspectorPropertyValue(object: any, property: string): any {
  const parts = property.split(".");
  let value = object;
  for (const part of parts) value = value[part];
  return value;
}
```

**Riff3D mapping:** Zod schemas with `editorHints` serve the same role as the type dispatch + field components. The inspector auto-generates from schema metadata.

### 12.3 Play Mode — Separate Scene Instance

The Babylon editor creates a **completely separate Scene** for play mode:

1. Export current scene to `.babylon` files
2. Compile user scripts with esbuild
3. Create new `Scene` instance on the same engine
4. Load exported files into play scene
5. Enable physics, attach controls
6. On stop: dispose play scene, return to edit scene (unchanged)

**Includes hot reload:** Watches `src/` directory, recompiles scripts and restarts play on change.

**Riff3D approach comparison:** Snapshot ECSON before play, run engine freely, restore ECSON on stop. Simpler because Riff3D's state is in ECSON/PatchOps, not in the engine scene graph.

### 12.4 Selection & Scene Graph

- Blueprint.js Tree component for hierarchy view
- Observable-driven updates: `onNodesAddedObservable`, `onNodeModifiedObservable`
- Selection expands parent chain in tree automatically
- Copy/paste uses undo/redo registration

### 12.5 Layout

- `flexlayout-react` for dockable/resizable panels (PlayCanvas editor uses custom panel system)
- Components: Preview (3D viewport), Inspector, Graph (hierarchy), Console, Assets, Animations

---

## 13. Cross-Engine Mapping

### 13.1 Scene Graph Concepts

| Concept | PlayCanvas | Babylon.js | Canonical IR |
|---------|-----------|------------|--------------|
| Base node | `Entity` (all-purpose) | `Node` → `TransformNode` → `Mesh` (hierarchy) | `IRNode` (flat, with component types) |
| Add child | `parent.addChild(entity)` | `child.parent = parent` or `parent.addChild(child)` | `parentId` field on node |
| Reparent | `entity.reparent(newParent)` | `child.parent = newParent` | PatchOp: `Reparent` |
| Dispose | `entity.destroy()` (recursive) | `node.dispose()` (recursive by default) | PatchOp: `DeleteEntity` |
| Components | `entity.addComponent('render', data)` | Class determines type (Mesh, Light, Camera) + Behaviors | Component array on IRNode |
| Identity | `entity.getGuid()` (string UUID) | `node.id` (string) + `node.uniqueId` (number) | `entityId` (nanoid string) |

### 13.2 Transform Model

| Property | PlayCanvas | Babylon.js | Canonical IR Recommendation |
|----------|-----------|------------|---------------------------|
| Position | `setLocalPosition(x,y,z)` | `node.position = new Vector3(x,y,z)` | `[x, y, z]` array |
| Rotation | Euler in **degrees** (XYZ) | Euler in **radians** (XYZ) OR Quaternion | **Quaternion `[x,y,z,w]`** — lossless, no unit ambiguity |
| Scale | `setLocalScale(x,y,z)` | `node.scaling = new Vector3(x,y,z)` | `[x, y, z]` array |
| World position | `getPosition()` | `getAbsolutePosition()` | Computed by adapter |
| Dirty system | `_dirtyLocal` / `_dirtyWorld` flags | `_isDirty` + `_markAsDirtyInternal()` | Not in IR — adapter concern |

**Critical decision for Phase 1:** Canonical IR should store rotation as **quaternion** `[x, y, z, w]`. Both engines handle quaternions natively. Euler angles differ in units (degrees vs radians) and can suffer gimbal lock. The adapter converts quaternion to engine-native format.

### 13.3 PBR Materials

| Property | PlayCanvas | Babylon.js (MetallicRoughness) | Canonical IR |
|----------|-----------|-------------------------------|--------------|
| Base color | `material.diffuse` (Color) | `material.baseColor` (Color3) | `baseColor: [r, g, b]` (0-1) |
| Base color map | `material.diffuseMap` | `material.baseTexture` | `baseColorMap: assetRef` |
| Metallic | `material.metalness` (0-1) | `material.metallic` (0-1) | `metallic: number` (0-1) |
| Roughness | `1 - material.gloss` **INVERTED** | `material.roughness` (0-1) **DIRECT** | `roughness: number` (0-1, glTF convention) |
| Normal map | `material.normalMap` | `material.bumpTexture` (via PBRMaterial) | `normalMap: assetRef` |
| AO map | `material.aoMap` | `material.ambientTexture` | `aoMap: assetRef` |
| Emissive color | `material.emissive` (Color) | `material.emissiveColor` (Color3) | `emissiveColor: [r, g, b]` |
| Emissive intensity | `material.emissiveIntensity` | `material.emissiveIntensity` | `emissiveIntensity: number` |
| Emissive map | `material.emissiveMap` | `material.emissiveTexture` | `emissiveMap: assetRef` |
| Opacity | `material.opacity` (0-1) | `material.alpha` (0-1) | `opacity: number` (0-1) |
| Opacity map | `material.opacityMap` | `material.opacityTexture` | `opacityMap: assetRef` |

### 13.4 Lights

| Property | PlayCanvas | Babylon.js | Canonical IR |
|----------|-----------|------------|--------------|
| Type enum | `'directional'`, `'point'`, `'spot'` | Class: `DirectionalLight`, `PointLight`, `SpotLight` | `type: 'directional' \| 'point' \| 'spot' \| 'hemisphere'` |
| Color | `light.color` (Color) | `light.diffuse` (Color3) | `color: [r, g, b]` |
| Intensity | `light.intensity` (0-∞) | `light.intensity` (0-∞) | `intensity: number` |
| Range | `light.range` | `light.range` | `range: number` (point/spot) |
| Direction | `entity.forward` (from rotation) | `light.direction` (Vector3) | Derived from node rotation |
| Spot angle | `light.innerConeAngle` / `outerConeAngle` | `light.angle` + `light.exponent` | `innerAngle`, `outerAngle` (radians) |
| Shadows | `light.castShadows` | `new ShadowGenerator(size, light)` | `castShadows: boolean` |

### 13.5 Cameras

| Property | PlayCanvas | Babylon.js | Canonical IR |
|----------|-----------|------------|--------------|
| FOV | `camera.fov` (degrees) | `camera.fov` (radians) | `fov: number` (radians, glTF convention) |
| Near/Far | `camera.nearClip` / `farClip` | `camera.minZ` / `maxZ` | `near`, `far` |
| Ortho mode | `camera.projection = PROJECTION_ORTHOGRAPHIC` | `camera.mode = Camera.ORTHOGRAPHIC_CAMERA` | `projection: 'perspective' \| 'orthographic'` |
| Ortho size | `camera.orthoHeight` | `orthoLeft/Right/Top/Bottom` | `orthoSize: number` (half-height, adapters compute L/R/T/B) |

### 13.6 Animation

| Concept | PlayCanvas | Babylon.js | Canonical IR |
|---------|-----------|------------|--------------|
| Animation clip | `AnimTrack` + `AnimClip` | `Animation` (keyframes) | `AnimationClip` with keyframes array |
| Animation group | `AnimStateGraph` | `AnimationGroup` | `AnimationGroup` (clip refs + targets) |
| Target property | Component path string | Dot-notation path string | Standardized property path |
| Keyframe | `{ time, value }` (seconds) | `{ frame, value }` (frame number) | `{ time, value }` (seconds, adapters convert to frames) |
| Blending | Anim layer weights | `group.weight` + `isAdditive` | `weight`, `additive` flags |
| Loop mode | `LOOP_REPEAT`, `LOOP_ONCE` | `ANIMATIONLOOPMODE_CYCLE`, `CONSTANT`, `YOYO` | `loop: 'none' \| 'repeat' \| 'yoyo'` |

---

## 14. Phase 1 Compatibility Implications

These findings should inform Canonical IR design decisions during Phase 1:

### 14.1 Rotation: Use Quaternions in Canonical IR

Both engines support quaternions natively. Euler angles differ in units:
- PlayCanvas: degrees
- Babylon.js: radians

**Recommendation:** Store quaternions `[x, y, z, w]` in Canonical IR. Adapters convert to engine-native rotation representation. ECSON can store user-friendly Euler degrees for the editor, but the IR uses quaternions.

### 14.2 Roughness: Use glTF Convention (0 = smooth, 1 = rough)

- PlayCanvas uses inverted gloss (adapter must invert)
- Babylon.js `PBRMetallicRoughnessMaterial` uses roughness directly (no inversion)

**Recommendation:** Canonical IR uses `roughness` (0-1, glTF convention). PlayCanvas adapter inverts. Babylon adapter passes through.

### 14.3 Node Identity: String IDs

- PlayCanvas uses string GUIDs
- Babylon.js uses string `id` + numeric `uniqueId`

**Recommendation:** Canonical IR uses nanoid strings (already decided). Adapters maintain `irId → engineNode` maps. Babylon adapter can set `node.id = irId` for direct lookup.

### 14.4 Component Model: Flat Component Arrays

- PlayCanvas: `entity.addComponent(type, data)` — dynamic
- Babylon.js: Class hierarchy determines capability — static

**Recommendation:** Canonical IR uses flat component arrays on nodes. The Babylon adapter maps component types to class instantiation:
- `render` component → `Mesh` creation
- `light` component → `PointLight`/`DirectionalLight`/`SpotLight` creation
- `camera` component → `UniversalCamera` creation
- Behavior components → `Behavior` attachment

### 14.5 FOV and Angles: Use Radians

- PlayCanvas uses degrees for FOV and Euler angles
- Babylon.js uses radians
- glTF uses radians

**Recommendation:** Canonical IR uses radians for all angles (FOV, spot light angles). ECSON stores user-friendly degrees for the editor inspector. The ECSON→IR compiler converts degrees to radians.

### 14.6 Animation Time: Use Seconds

- PlayCanvas uses seconds
- Babylon.js uses frame numbers with FPS

**Recommendation:** Canonical IR uses seconds for animation keyframe times. Babylon adapter converts: `frame = time * fps`.

---

## 15. Recommendations & Gotchas

### 15.1 Confirmed Choices for Babylon Adapter

| Decision | Rationale |
|----------|-----------|
| Use `PBRMetallicRoughnessMaterial` | glTF-aligned, no roughness inversion, simpler API |
| Use `PhysicsAggregate` (v2 API) | Modern, Havok-backed, cleaner than v1 impostors |
| Use individual gizmos (not GizmoManager) | More control over events, matches PlayCanvas pattern |
| Map IR node → Babylon class by component type | `render`→Mesh, `light`→Light, `camera`→Camera, bare→TransformNode |
| Store `irId` as Babylon `node.id` | Direct lookup without separate map |
| Use `Observable` subscriptions for state sync | Native Babylon pattern, matches adapter interface |

### 15.2 Gotchas to Watch

1. **Camera/Light are NOT TransformNode** — They extend `Node` directly. No `.scaling` property. Rotation works differently (direction vector for lights, target for cameras). The adapter must handle transform application differently per node type.

2. **Rotation duality** — Setting Euler clears quaternion and vice versa. If the IR uses quaternions, always set `rotationQuaternion` on Babylon nodes. Never mix.

3. **uniqueId is a number, not string** — Cannot use nanoid directly as `uniqueId`. Use `node.id` (string) for IR mapping instead.

4. **No native multi-select gizmo** — PlayCanvas gizmos accept an array of nodes. Babylon gizmos attach to one node. For multi-select transforms, create a temporary parent `TransformNode`, parent selected nodes to it, attach gizmo to parent.

5. **Texture `invertY` defaults** — Babylon defaults to `invertY: true` for regular textures but glTF loader sets `false`. Ensure consistency by always specifying `invertY: false` for glTF-sourced textures.

6. **Material property names differ** — `albedoColor` vs `baseColor` vs `diffuseColor` depending on which material class. Stick to `PBRMetallicRoughnessMaterial` for consistency.

7. **Scene disposal order** — Dispose meshes before materials, materials before textures. Or just call `scene.dispose()` which handles order automatically.

8. **Physics engine async init** — Havok requires async initialization (`await HavokPhysics()`). Must be initialized before creating any physics aggregates.

9. **No component add/remove at runtime** — Unlike PlayCanvas where you can `addComponent('render', ...)` / `removeComponent('render')`, Babylon requires creating a new node type. To change a TransformNode to a Mesh, you'd need to create a new Mesh, copy properties, and swap references.

### 15.3 Adapter LoC Budget Estimate

Given Babylon.js's class hierarchy (requiring type-specific handling for meshes, lights, cameras), the adapter will likely need:
- Scene building: ~200 LoC (type dispatch + property mapping)
- Material mapping: ~150 LoC (PBR subset + texture handling)
- Delta application: ~200 LoC (incremental property updates)
- Gizmo integration: ~100 LoC (attach/detach + events)
- Animation mapping: ~150 LoC (keyframe conversion + groups)
- Lifecycle (init/dispose): ~100 LoC

**Total estimate: ~900 LoC** — well within the 1500 LoC adapter budget.

---

## 16. Reference Files

### Babylon.js Engine (Core)

| File | Contains |
|------|----------|
| `/home/frank/babylonjs/packages/dev/core/src/node.ts` | Node base class (parent/child, behaviors, dispose) |
| `/home/frank/babylonjs/packages/dev/core/src/Meshes/transformNode.ts` | TransformNode (position, rotation, scaling, worldMatrix) |
| `/home/frank/babylonjs/packages/dev/core/src/Meshes/abstractMesh.ts` | AbstractMesh (material, visibility, picking) |
| `/home/frank/babylonjs/packages/dev/core/src/Meshes/mesh.ts` | Mesh (geometry, vertex data) |
| `/home/frank/babylonjs/packages/dev/core/src/Meshes/Builders/` | Primitive builders (box, sphere, cylinder, etc.) |
| `/home/frank/babylonjs/packages/dev/core/src/scene.ts` | Scene class (collections, render, fog, environment) |
| `/home/frank/babylonjs/packages/dev/core/src/Engines/` | Engine initialization and render loop |
| `/home/frank/babylonjs/packages/dev/core/src/Materials/PBR/pbrMaterial.ts` | Full PBR material |
| `/home/frank/babylonjs/packages/dev/core/src/Materials/PBR/pbrMetallicRoughnessMaterial.ts` | Simplified PBR (recommended) |
| `/home/frank/babylonjs/packages/dev/core/src/Materials/PBR/pbrBaseMaterial.ts` | PBR base properties |
| `/home/frank/babylonjs/packages/dev/core/src/Materials/material.ts` | Material base (alpha, culling) |
| `/home/frank/babylonjs/packages/dev/core/src/Materials/Textures/texture.ts` | Texture class |
| `/home/frank/babylonjs/packages/dev/core/src/Materials/Textures/baseTexture.ts` | BaseTexture properties |
| `/home/frank/babylonjs/packages/dev/core/src/Lights/` | Light classes (directional, point, spot, hemisphere) |
| `/home/frank/babylonjs/packages/dev/core/src/Cameras/` | Camera classes |
| `/home/frank/babylonjs/packages/dev/core/src/Misc/observable.ts` | Observable<T> implementation |
| `/home/frank/babylonjs/packages/dev/core/src/Animations/animation.ts` | Animation class + keyframes |
| `/home/frank/babylonjs/packages/dev/core/src/Animations/animationGroup.ts` | AnimationGroup |
| `/home/frank/babylonjs/packages/dev/core/src/Animations/animatable.core.ts` | Animatable (runtime animation) |
| `/home/frank/babylonjs/packages/dev/core/src/Physics/v2/physicsAggregate.ts` | PhysicsAggregate (v2) |
| `/home/frank/babylonjs/packages/dev/core/src/Physics/v2/physicsBody.ts` | PhysicsBody |
| `/home/frank/babylonjs/packages/dev/core/src/Gizmos/positionGizmo.ts` | Position gizmo |
| `/home/frank/babylonjs/packages/dev/core/src/Gizmos/rotationGizmo.ts` | Rotation gizmo |
| `/home/frank/babylonjs/packages/dev/core/src/Gizmos/scaleGizmo.ts` | Scale gizmo |
| `/home/frank/babylonjs/packages/dev/core/src/Gizmos/gizmoManager.ts` | GizmoManager |
| `/home/frank/babylonjs/packages/dev/core/src/Collisions/pickingInfo.ts` | Picking result |
| `/home/frank/babylonjs/packages/dev/core/src/Behaviors/behavior.ts` | Behavior interface |

### Babylon.js Loaders

| File | Contains |
|------|----------|
| `/home/frank/babylonjs/packages/dev/loaders/src/glTF/2.0/glTFLoader.ts` | glTF/GLB loading pipeline |
| `/home/frank/babylonjs/packages/dev/loaders/src/glTF/2.0/pbrMaterialLoadingAdapter.ts` | Material loading adapter |
| `/home/frank/babylonjs/packages/dev/loaders/src/glTF/2.0/materialLoadingAdapter.ts` | IMaterialLoadingAdapter interface |

### Babylon.js Editor

| File | Contains |
|------|----------|
| `/home/frank/babylon-editor/editor/src/tools/undoredo.ts` | Undo/redo stack + commands |
| `/home/frank/babylon-editor/editor/src/editor/layout/preview/gizmo.ts` | Gizmo ↔ editor integration |
| `/home/frank/babylon-editor/editor/src/editor/layout/inspector.tsx` | Inspector panel (polymorphic dispatch) |
| `/home/frank/babylon-editor/editor/src/editor/layout/inspector/fields/` | Field components (number, vector, color, etc.) |
| `/home/frank/babylon-editor/editor/src/editor/layout/inspector/fields/property.ts` | Dot-notation property resolution |
| `/home/frank/babylon-editor/editor/src/editor/layout/graph.tsx` | Scene hierarchy tree + selection |
| `/home/frank/babylon-editor/editor/src/editor/layout/preview/play.tsx` | Play mode lifecycle |
| `/home/frank/babylon-editor/editor/src/editor/main.tsx` | Editor state + layout |
| `/home/frank/babylon-editor/editor/src/project/save/scene.ts` | Scene serialization (save) |
| `/home/frank/babylon-editor/editor/src/project/load/scene.ts` | Scene deserialization (load) |
| `/home/frank/babylon-editor/editor/src/editor/observables.ts` | Editor observables |

---

*Research conducted 2026-02-19 during Phase 1 execution. Primary consumer: Phase 4 planning (Dual Adapter Validation). Secondary consumer: Phase 1 Canonical IR design (engine-agnostic compatibility decisions).*
