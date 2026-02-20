# Phase 4: Dual Adapter Validation - Research

**Researched:** 2026-02-20
**Domain:** Babylon.js adapter implementation, incremental IR delta updates, engine switching UI, visual conformance testing
**Confidence:** HIGH

## Summary

Phase 4 builds a Babylon.js adapter that renders all golden fixtures from Canonical IR, adds incremental property-level delta updates to both adapters (replacing full scene rebuild), enables engine switching in the editor, and validates cross-engine conformance. The existing codebase provides a strong foundation: the PlayCanvas adapter (818 LoC core) demonstrates the exact pattern the Babylon adapter should follow, the `EngineAdapter` interface defines the contract, and the Canonical IR types are stable from Phases 1-3.

The Babylon.js adapter (targeting `@babylonjs/core ~8.52`) maps cleanly to the existing IR types. Key translation points are well-documented in `.planning/research/BABYLON_ADVANCE_RESEARCH.md`: class hierarchy dispatch (IR component type determines Babylon node class), roughness direct pass-through (no inversion unlike PlayCanvas), FOV/angle degree-to-radian conversion, and left-handed coordinate system awareness (though for the portable subset of primitives, handedness is handled by Babylon internally). The incremental delta system requires evolving the `EngineAdapter` interface to add an `applyDelta(delta: IRDelta)` method alongside the existing `rebuildScene()`, and modifying the scene slice to compute property-level diffs instead of full recompilation on every edit.

**Primary recommendation:** Follow the PlayCanvas adapter structure exactly for the Babylon adapter (scene-builder, component-mappers, environment), with the key differences being: (1) class-based node creation instead of component-based, (2) PBRMetallicRoughnessMaterial for direct roughness mapping, (3) degree-to-radian conversion for FOV and spot light angles, and (4) `node.rotationQuaternion` instead of `setLocalRotation()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Engine switching UX
- Switcher lives in the **main editor toolbar** (top bar), not the viewport header
- Switching shows a **loading overlay** on the viewport while the new engine initializes
- **Camera position carries over** on switch; selection resets (preserve camera only)
- Active engine indicated by a **subtle engine icon** next to the switcher (not a text label)
- Switching requires a **confirmation dialog** ("Switch to Babylon.js? Scene will reload.")
- Switcher is **disabled during play-test mode** -- must return to edit mode first
- Design constraint: architect adapter state serialization so hot-swap during play could be added later

#### Visual consistency expectations
- Target: **same scene, correct materials** -- objects in right positions, materials look right, lighting reasonable
- Rendering differences in shadow softness, anti-aliasing, ambient occlusion are acceptable
- Must-match list: **Claude's discretion** based on what Canonical IR actually carries (geometry, PBR, lights at minimum)
- **Dev-only comparison tool** for conformance validation -- side-by-side snapshots, not in the main editor UI
- Brief **tooltip on the engine switcher** noting rendering may vary slightly between engines

#### Engine tuning visibility
- Engine tuning shown as a **collapsible "Engine Tuning" section** in the inspector panel
- Flagged as an **advanced editor feature** -- future phases may add a beginner/advanced mode toggle to hide these
- **Only active engine's tuning visible** by default; subtle toggle to peek at other engine's tuning (dimmed/read-only)
- **Subtle badge/dot** on the engine switcher if the current engine has custom tuning applied
- Tuning supported at **both scene-level and per-entity level** -- per-entity only when user explicitly opts in (not on every entity by default)

#### Default engine & persistence
- Engine choice is a **project-level setting** (stored with the project, not per-user preference)
- New projects default to **PlayCanvas** (primary adapter, battle-tested through Phases 1-3)
- Engine choice persists in the project -- reopening loads the last-used engine

### Claude's Discretion
- Exact must-match feature list for visual conformance (based on IR capabilities)
- Loading overlay design and animation
- Confirmation dialog copy and styling
- Dev comparison tool implementation details
- How engine tuning badge indicates custom tuning presence

### Deferred Ideas (OUT OF SCOPE)
- **Beginner/advanced editor mode toggle** -- ability to show/hide advanced options (like engine tuning) for simpler UX for beginners. Broader editor capability, not Phase 4 scope.
- **Play-mode engine hot-swap** -- switching engines during play-test without stopping. Locked for Phase 4, but architecture should not preclude it.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADPT-02 | Babylon.js adapter compiles Canonical IR to Babylon.js runtime (universality validation) | Babylon advance research maps every IR concept (nodes, transforms, materials, lights, cameras, environment) to Babylon.js equivalents. PBRMetallicRoughnessMaterial aligned with IR roughness convention. Class hierarchy dispatch pattern documented. |
| ADPT-03 | Adapter incremental update (property-level deltas, not full recompile on every edit) | IRDelta type design documented. Both adapters need `applyDelta()` method. Babylon.js auto-dirty system means property mutations are immediate -- no batch needed. PlayCanvas similarly supports immediate property mutation. |
| ADPT-04 | Both adapters pass conformance tests for golden fixtures within defined tolerance | Conformance harness exists (`packages/conformance`). Visual E2E tests exist with Playwright screenshot comparison. Must-match list derived from IR portable subset: geometry primitives, PBR materials, 3 light types, cameras, transforms, environment. |
| TEST-04 | Adapter conformance tests per runtime target (fixtures render/behave within tolerance) | Existing visual baseline tests (`fixture-render.visual.ts`) can be extended to test both engines. Unit-level conformance via the existing harness. Per-fixture tolerance bands needed. |
| PORT-03 | Tuning sections per engine target that degrade gracefully when unsupported | ECSON `EngineTuningSchema` already exists on both Entity and ComponentInstance. IR preserves tuning in `node.tuning`. Adapters read their own key (e.g., `tuning.playcanvas`, `tuning.babylon`) and ignore others. Inspector needs collapsible tuning UI. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@babylonjs/core` | ~8.52 | Babylon.js engine runtime | Latest stable, tree-shakeable ES modules, all features needed for adapter |
| `@babylonjs/loaders` | ~8.52 | glTF/GLB loading for Babylon | Required for GLB import support in Babylon adapter |
| `playcanvas` | ~2.16 | PlayCanvas engine (existing) | Already installed, primary adapter |
| `vitest` | ^4.0 | Unit testing | Already in monorepo, used for all packages |
| `@playwright/test` | ^1.58 | Visual regression / E2E | Already configured for visual baseline tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@babylonjs/havok` | ^1.0 | Physics for Babylon | Only if physics testing needed in Phase 4 (likely deferred to Phase 7) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@babylonjs/core` (full) | Individual subpath imports | Better tree-shaking but more complex imports; use barrel import for adapter simplicity, optimize in Phase 7 if needed |
| `PBRMetallicRoughnessMaterial` | `PBRMaterial` | PBRMaterial has more features but requires roughness inversion (microSurface); MetallicRoughness aligns with IR directly |

**Installation:**
```bash
pnpm add @babylonjs/core@~8.52 --filter @riff3d/adapter-babylon
pnpm add @babylonjs/loaders@~8.52 --filter @riff3d/adapter-babylon
```

## Architecture Patterns

### Recommended Package Structure
```
packages/adapter-babylon/
├── src/
│   ├── adapter.ts              # BabylonAdapter class implementing EngineAdapter
│   ├── scene-builder.ts        # buildScene() -- IR nodes to Babylon scene graph
│   ├── environment.ts          # applyEnvironment() -- fog, ambient, skybox
│   ├── types.ts                # Re-export EngineAdapter + Babylon-specific types
│   ├── index.ts                # Public exports
│   ├── component-mappers/
│   │   ├── index.ts            # applyComponents() registry + barrel
│   │   ├── mesh-renderer.ts    # IR MeshRenderer -> CreateBox/Sphere/etc
│   │   ├── material.ts         # IR Material -> PBRMetallicRoughnessMaterial
│   │   ├── light.ts            # IR Light -> DirectionalLight/PointLight/SpotLight
│   │   └── camera.ts           # IR Camera -> UniversalCamera
│   └── editor-tools/           # Phase 4 scope: minimal (no gizmos/selection yet)
│       └── index.ts
├── __tests__/
│   ├── scene-builder.test.ts
│   ├── component-mappers.test.ts
│   ├── environment.test.ts
│   └── helpers/
│       └── babylon-mocks.ts    # globalThis stubs like PlayCanvas adapter tests
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Pattern 1: Class Hierarchy Dispatch (Babylon Node Creation)

**What:** Unlike PlayCanvas where all nodes are `Entity` with dynamic components, Babylon requires creating the correct class based on IR component types.

**When to use:** Every time an IR node is translated to a Babylon scene graph node.

**Example:**
```typescript
// Source: BABYLON_ADVANCE_RESEARCH.md section 15.1
import { TransformNode, Mesh, Scene } from "@babylonjs/core";
import { CreateBox, CreateSphere } from "@babylonjs/core/Meshes/Builders";
import type { CanonicalNode } from "@riff3d/canonical-ir";

function createNodeFromIR(scene: Scene, node: CanonicalNode): TransformNode {
  // Check if node has a MeshRenderer component
  const meshComp = node.components.find(c => c.type === "MeshRenderer");

  if (meshComp) {
    const primitive = meshComp.properties["primitive"] as string;
    switch (primitive) {
      case "box": return CreateBox(node.name, {}, scene);
      case "sphere": return CreateSphere(node.name, { segments: 32 }, scene);
      // ... other primitives
    }
  }

  // Bare transform node (no renderable component)
  return new TransformNode(node.name, scene);
}
```

### Pattern 2: Roughness Direct Pass-Through (Babylon Material)

**What:** Babylon's PBRMetallicRoughnessMaterial uses roughness 0-1 (same as IR). No inversion needed (unlike PlayCanvas which inverts to gloss).

**When to use:** Material component mapping.

**Example:**
```typescript
// Source: Context7 Babylon.js docs, PBRMetallicRoughnessMaterial
import { PBRMetallicRoughnessMaterial, Color3, Scene } from "@babylonjs/core";
import type { CanonicalComponent } from "@riff3d/canonical-ir";

function createMaterial(scene: Scene, comp: CanonicalComponent): PBRMetallicRoughnessMaterial {
  const props = comp.properties;
  const mat = new PBRMetallicRoughnessMaterial("mat", scene);

  if (typeof props["baseColor"] === "string") {
    mat.baseColor = Color3.FromHexString(props["baseColor"]);
  }
  if (typeof props["metallic"] === "number") {
    mat.metallic = props["metallic"];
  }
  if (typeof props["roughness"] === "number") {
    mat.roughness = props["roughness"]; // Direct -- no inversion!
  }
  // Emissive
  if (typeof props["emissive"] === "string") {
    mat.emissiveColor = Color3.FromHexString(props["emissive"]);
  }
  // Opacity
  if (typeof props["opacity"] === "number") {
    mat.alpha = props["opacity"];
  }
  // Double-sided
  if (props["doubleSided"] === true) {
    mat.backFaceCulling = false;
    mat.twoSidedLighting = true;
  }

  return mat;
}
```

### Pattern 3: Degree-to-Radian Conversion

**What:** The IR stores FOV and spot light cone angles in degrees (matching ECSON). Babylon.js uses radians for FOV and spot light `angle`.

**When to use:** Camera FOV mapping, spot light angle mapping.

**Example:**
```typescript
const DEG_TO_RAD = Math.PI / 180;

// Camera FOV: IR degrees -> Babylon radians
camera.fov = (props["fov"] as number) * DEG_TO_RAD;

// Spot light: IR outerConeAngle degrees -> Babylon angle radians
spotLight.angle = (props["outerConeAngle"] as number) * DEG_TO_RAD;
// Inner/outer cone approximation via exponent
const innerAngle = (props["innerConeAngle"] as number) * DEG_TO_RAD;
const outerAngle = spotLight.angle;
// exponent controls falloff -- approximate from inner/outer ratio
spotLight.exponent = outerAngle > 0 ? 2 * (1 - innerAngle / outerAngle) + 0.1 : 2;
```

### Pattern 4: Quaternion Rotation (Always Use rotationQuaternion)

**What:** Babylon.js has mutually exclusive rotation modes (Euler vs Quaternion). Setting one clears the other. Since IR stores quaternions, always use `rotationQuaternion`.

**When to use:** Every transform application on Babylon nodes.

**Example:**
```typescript
import { Quaternion, Vector3 } from "@babylonjs/core";

// CRITICAL: Always set rotationQuaternion, never mix with Euler rotation
node.position = new Vector3(
  transform.position.x,
  transform.position.y,
  transform.position.z,
);
node.rotationQuaternion = new Quaternion(
  transform.rotation.x,
  transform.rotation.y,
  transform.rotation.z,
  transform.rotation.w,
);
node.scaling = new Vector3(
  transform.scale.x,
  transform.scale.y,
  transform.scale.z,
);
```

### Pattern 5: IRDelta for Incremental Updates

**What:** Instead of full scene rebuild on every PatchOp, compute a minimal delta describing what changed and apply it to the live engine scene.

**When to use:** After every PatchOp dispatch, instead of recompile + rebuildScene.

**Example:**
```typescript
// New type in canonical-ir package
interface IRDelta {
  type: "node-transform" | "node-visibility" | "component-property" | "environment" | "node-add" | "node-remove" | "node-reparent";
  nodeId?: string;
  path?: string;          // e.g., "transform.position", "components[0].properties.baseColor"
  value?: unknown;
  previousValue?: unknown;
  // For node-add/remove: full node data
  node?: CanonicalNode;
}

// EngineAdapter interface extension
interface EngineAdapter {
  // Existing
  loadScene(scene: CanonicalScene): void;
  rebuildScene(scene: CanonicalScene): void;
  // New
  applyDelta(delta: IRDelta): void;
}
```

### Pattern 6: Engine Switching with Camera Serialization

**What:** When the user switches engines, serialize the camera state from the current adapter, dispose it, initialize the new adapter, load the scene, and restore the camera state.

**When to use:** Engine switcher in top bar.

**Example:**
```typescript
interface SerializedCameraState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  mode: "fly" | "orbit";
}

// In the viewport component or engine manager:
async function switchEngine(targetEngine: "playcanvas" | "babylon"): Promise<void> {
  // 1. Serialize camera from current adapter
  const cameraState = currentAdapter.serializeCameraState();

  // 2. Dispose current adapter
  currentAdapter.dispose();

  // 3. Create new adapter
  const newAdapter = targetEngine === "playcanvas"
    ? new PlayCanvasAdapter()
    : new BabylonAdapter();

  // 4. Initialize on same canvas
  await newAdapter.initialize(canvas);

  // 5. Load current scene
  const scene = editorStore.getState().canonicalScene;
  if (scene) newAdapter.loadScene(scene);

  // 6. Restore camera
  newAdapter.restoreCameraState(cameraState);
}
```

### Anti-Patterns to Avoid

- **Sharing engine-specific types across adapters:** Each adapter must have its own types. The shared interface is `EngineAdapter` from `@riff3d/adapter-playcanvas/types.ts` (to be extracted to a shared location or duplicated).
- **Mixing Euler and Quaternion in Babylon:** Setting `node.rotation` (Euler) clears `node.rotationQuaternion`. Always use quaternion consistently.
- **Full recompile for every property change:** The current `dispatchOp -> compile(ecsonDoc) -> rebuildScene()` flow is O(n) per edit. Delta updates reduce this to O(1) per property change.
- **Babylon `node.uniqueId` for IR mapping:** uniqueId is a number, not string. Use `node.id = irNodeId` instead for direct string-based lookup.
- **Creating ShadowGenerator per light unconditionally:** Only create ShadowGenerator for lights with `castShadows: true`. Shadow maps are expensive.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PBR material creation | Custom shader code | `PBRMetallicRoughnessMaterial` | Handles all PBR edge cases, glTF-aligned, avoids shader compilation bugs |
| Color hex parsing | Manual hex-to-RGB | `Color3.FromHexString()` / `Color4.FromHexString()` | Babylon built-in, handles all formats |
| Mesh primitives | Manual vertex buffer creation | `CreateBox`, `CreateSphere`, etc. from `@babylonjs/core/Meshes/Builders` | Correct UV coordinates, normals, tangents |
| Shadow mapping | Custom depth pass | `ShadowGenerator` | Handles shadow cascades, filtering, bias |
| GLB loading | Custom binary parser | `SceneLoader.ImportMeshAsync` with `@babylonjs/loaders` | Full glTF 2.0 spec compliance, extension support |
| Screenshot comparison | Pixel-by-pixel manual diff | Playwright `toHaveScreenshot()` with tolerance | Built-in perceptual diff, threshold support |

**Key insight:** Babylon.js has a mature builder/factory API for every primitive and material type. The adapter should use these APIs exclusively, never constructing raw geometry or shader code.

## Common Pitfalls

### Pitfall 1: Rotation Duality (Euler vs Quaternion)
**What goes wrong:** Setting `node.rotation` (Euler in radians) and then later setting `node.rotationQuaternion` (or vice versa) causes one to clear the other, leading to seemingly random rotation resets.
**Why it happens:** Babylon.js explicitly nulls one when the other is set (by design, to prevent ambiguity).
**How to avoid:** ALWAYS set `rotationQuaternion` on all Babylon nodes. Never touch `node.rotation`. The IR stores quaternions.
**Warning signs:** Rotations snap to (0,0,0) after certain operations; some entities face wrong direction.

### Pitfall 2: Camera and Light Are NOT TransformNode
**What goes wrong:** Trying to set `.scaling` on a Camera or Light node throws or has no effect. Cameras use `position + target` instead of transforms.
**Why it happens:** Babylon's class hierarchy: Camera extends Node (not TransformNode), Light extends Node (not TransformNode).
**How to avoid:** Apply transforms differently per node type. For cameras: use `position` and compute direction from quaternion. For lights: use `position` and `direction` from quaternion. For meshes/empty: full position/rotation/scale.
**Warning signs:** TypeScript errors about missing `.scaling`; lights pointing wrong direction.

### Pitfall 3: Babylon.js Left-Handed Coordinate System
**What goes wrong:** Objects appear mirrored or in unexpected positions compared to PlayCanvas.
**Why it happens:** Babylon.js uses left-handed Y-up coordinates; the IR uses right-handed Y-up (matching glTF/PlayCanvas).
**How to avoid:** For the portable subset (primitives, not imported meshes), Babylon's builders already produce correct geometry. The key concern is Z-axis direction: Babylon forward is +Z, PlayCanvas forward is -Z. For cameras and directional lights, negate the Z component of direction vectors derived from quaternions.
**Warning signs:** Cameras face away from scene; directional light shadows project incorrectly.

### Pitfall 4: Texture invertY Default
**What goes wrong:** Textures appear upside-down in Babylon compared to PlayCanvas.
**Why it happens:** Babylon defaults `invertY: true` for textures, but glTF convention is `invertY: false`.
**How to avoid:** Always specify `invertY: false` when creating textures for glTF-sourced content.
**Warning signs:** UV-mapped textures appear flipped vertically.

### Pitfall 5: Full Rebuild Performance on Complex Scenes
**What goes wrong:** Editor becomes sluggish when editing properties because every keystroke triggers a full scene rebuild (compile + destroy all + recreate all).
**Why it happens:** Current architecture: `dispatchOp -> compile(fullDoc) -> adapter.rebuildScene(fullScene)`.
**How to avoid:** Implement IRDelta system: map PatchOp type to minimal delta, apply delta directly to live engine entities via entityMap lookup. Fall back to full rebuild only for structural changes (add/remove entity, reparent).
**Warning signs:** Frame drops during inspector edits; visible flicker as entities are destroyed and recreated.

### Pitfall 6: SpotLight Angle Model Mismatch
**What goes wrong:** Spot lights in Babylon have different cone shape than PlayCanvas.
**Why it happens:** PlayCanvas uses separate `innerConeAngle` / `outerConeAngle` (degrees). Babylon uses `angle` (radians, outer cone) + `exponent` (falloff control). There is no 1:1 mapping of inner cone angle.
**How to avoid:** Map `outerConeAngle` (degrees) to Babylon `angle` (radians) directly. Approximate inner cone via `exponent` calculation. Document the approximation in conformance tolerance notes.
**Warning signs:** Spot light illumination pattern differs between engines (expected -- document in tolerance bands).

### Pitfall 7: ShadowGenerator Lifecycle
**What goes wrong:** Memory leaks or crashes when shadows are enabled/disabled via property edits.
**Why it happens:** Unlike PlayCanvas where `castShadows` is a property on the light component, Babylon requires creating/disposing a separate `ShadowGenerator` object and adding mesh casters explicitly.
**How to avoid:** Maintain a `lightId -> ShadowGenerator` map in the adapter. Create ShadowGenerator only when light has `castShadows: true`. On delta update toggling shadows, create or dispose the generator accordingly.
**Warning signs:** Shadow artifacts after property edits; increasing memory usage over time.

### Pitfall 8: Engine Switching Canvas Context Loss
**What goes wrong:** WebGL context is lost when switching engines because both try to use the same canvas.
**Why it happens:** Disposing one WebGL context and creating another on the same canvas element can fail in some browsers.
**How to avoid:** Either: (a) create a fresh canvas element for each engine switch, or (b) dispose the engine completely (including WebGL context) and wait a frame before initializing the new engine. Option (a) is more reliable.
**Warning signs:** Black viewport after engine switch; "WebGL context lost" browser console error.

## Code Examples

### Babylon.js Scene Initialization
```typescript
// Source: Context7 /babylonjs/documentation
import { Engine, Scene, Color4 } from "@babylonjs/core";

async function initBabylon(canvas: HTMLCanvasElement): Promise<{ engine: Engine; scene: Scene }> {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.05, 0.12, 1);

  // Start render loop
  engine.runRenderLoop(() => scene.render());

  return { engine, scene };
}
```

### Babylon.js Light Creation from IR
```typescript
// Source: Context7 /babylonjs/documentation, BABYLON_ADVANCE_RESEARCH.md section 4.2
import { DirectionalLight, PointLight, SpotLight, Vector3, Color3 } from "@babylonjs/core";
import type { CanonicalComponent } from "@riff3d/canonical-ir";

const DEG_TO_RAD = Math.PI / 180;

function createLight(scene: Scene, name: string, comp: CanonicalComponent): Light {
  const props = comp.properties;
  const lightType = props["lightType"] as string;
  const color = typeof props["color"] === "string"
    ? Color3.FromHexString(props["color"])
    : new Color3(1, 1, 1);
  const intensity = (props["intensity"] as number) ?? 1;

  switch (lightType) {
    case "directional": {
      const light = new DirectionalLight(name, new Vector3(0, -1, 0), scene);
      light.diffuse = color;
      light.intensity = intensity;
      return light;
    }
    case "point": {
      const light = new PointLight(name, Vector3.Zero(), scene);
      light.diffuse = color;
      light.intensity = intensity;
      light.range = (props["range"] as number) ?? 10;
      return light;
    }
    case "spot": {
      const outerAngle = ((props["outerConeAngle"] as number) ?? 45) * DEG_TO_RAD;
      const light = new SpotLight(name, Vector3.Zero(), new Vector3(0, -1, 0), outerAngle, 2, scene);
      light.diffuse = color;
      light.intensity = intensity;
      light.range = (props["range"] as number) ?? 15;
      return light;
    }
    default:
      return new PointLight(name, Vector3.Zero(), scene);
  }
}
```

### Babylon.js Camera Creation from IR
```typescript
// Source: Context7 /babylonjs/documentation, BABYLON_ADVANCE_RESEARCH.md section 4.3
import { UniversalCamera, Vector3, Camera } from "@babylonjs/core";

const DEG_TO_RAD = Math.PI / 180;

function createCamera(scene: Scene, name: string, comp: CanonicalComponent): UniversalCamera {
  const props = comp.properties;
  const camera = new UniversalCamera(name, Vector3.Zero(), scene);

  // FOV: IR stores degrees, Babylon uses radians
  camera.fov = ((props["fov"] as number) ?? 60) * DEG_TO_RAD;
  camera.minZ = (props["nearClip"] as number) ?? 0.1;
  camera.maxZ = (props["farClip"] as number) ?? 1000;

  // Orthographic mode
  if (props["projection"] === "orthographic") {
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    const orthoSize = (props["orthoSize"] as number) ?? 5;
    camera.orthoTop = orthoSize;
    camera.orthoBottom = -orthoSize;
    // Left/right computed from aspect ratio at render time
  }

  // Scene cameras disabled in editor mode (like PlayCanvas adapter)
  camera.detachControl();

  return camera;
}
```

### Babylon.js Fog Setup from IR Environment
```typescript
// Source: Context7 /babylonjs/documentation
import { Scene, Color3 } from "@babylonjs/core";
import type { CanonicalEnvironment } from "@riff3d/canonical-ir";

function applyEnvironment(scene: Scene, env: CanonicalEnvironment): void {
  // Ambient light
  const ambientColor = Color3.FromHexString(env.ambientLight.color);
  scene.ambientColor = ambientColor.scale(env.ambientLight.intensity);

  // Fog
  if (env.fog.enabled) {
    const fogColor = Color3.FromHexString(env.fog.color);
    scene.fogColor = fogColor;

    switch (env.fog.type) {
      case "linear":
        scene.fogMode = Scene.FOGMODE_LINEAR;
        scene.fogStart = env.fog.near;
        scene.fogEnd = env.fog.far;
        break;
      case "exponential":
        scene.fogMode = Scene.FOGMODE_EXP;
        scene.fogDensity = env.fog.density;
        break;
      case "exponential2":
        scene.fogMode = Scene.FOGMODE_EXP2;
        scene.fogDensity = env.fog.density;
        break;
    }
  } else {
    scene.fogMode = Scene.FOGMODE_NONE;
  }

  // Skybox color as clear color
  if (env.skybox.type === "color" && env.skybox.color) {
    const skyColor = Color3.FromHexString(env.skybox.color);
    scene.clearColor = skyColor.toColor4(1);
  }
}
```

### Incremental Delta Application
```typescript
// Pattern for property-level delta in PlayCanvas adapter
function applyPropertyDelta(
  entityMap: Map<string, pc.Entity>,
  delta: IRDelta,
): void {
  if (delta.type === "node-transform" && delta.nodeId) {
    const entity = entityMap.get(delta.nodeId);
    if (!entity) return;

    const transform = delta.value as { position?: Vec3; rotation?: Quat; scale?: Vec3 };
    if (transform.position) {
      entity.setLocalPosition(transform.position.x, transform.position.y, transform.position.z);
    }
    if (transform.rotation) {
      entity.setLocalRotation(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
    }
    if (transform.scale) {
      entity.setLocalScale(transform.scale.x, transform.scale.y, transform.scale.z);
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Babylon.js v1 physics (PhysicsImpostor) | v2 PhysicsAggregate with Havok | Babylon 6.0+ | Adapter should use v2 API only |
| `PBRMaterial` (complex, many props) | `PBRMetallicRoughnessMaterial` (glTF-aligned) | Available since Babylon 4.x | Direct roughness mapping, no inversion |
| Babylon.js UMD bundles | ES module tree-shakeable packages (`@babylonjs/core`) | Babylon 5.x+ | Use `@babylonjs/core` for proper tree shaking |
| Full scene rebuild on every edit | IRDelta incremental updates | Phase 4 (new) | O(1) property updates instead of O(n) rebuild |

**Deprecated/outdated:**
- `BABYLON.Engine` global: Use `import { Engine } from "@babylonjs/core"` instead
- `PhysicsImpostor` (v1): Deprecated, use `PhysicsAggregate` (v2)
- `StandardMaterial` for PBR: Use `PBRMetallicRoughnessMaterial` for glTF-aligned rendering

## Must-Match Feature List (Claude's Discretion)

Based on what the Canonical IR actually carries and what both engines support, the following features MUST match across engines for conformance:

### Geometry (MUST match exactly)
- Primitive shapes: box, sphere, cylinder, capsule, cone, plane, torus
- Transform: position, rotation (quaternion), scale
- Parent-child hierarchy and node visibility

### Materials (MUST match within tolerance)
- Base color (hex -> RGB)
- Metallic value (0-1)
- Roughness value (0-1)
- Emissive color and intensity
- Opacity / alpha
- Double-sided rendering

### Lights (MUST match within tolerance)
- Directional light: color, intensity, shadows
- Point light: color, intensity, range
- Spot light: color, intensity, range, outer cone angle (inner cone is best-effort)

### Cameras
- Perspective vs orthographic projection
- FOV, near/far clip planes

### Environment
- Ambient light color and intensity
- Fog: linear/exponential/exponential2 with correct parameters
- Skybox color

### Acceptable Differences (tolerance bands)
- Shadow softness and edge quality
- Anti-aliasing quality
- Spot light inner cone falloff pattern (Babylon uses `exponent`, not `innerConeAngle`)
- Sub-pixel color differences from different tonemapping defaults
- Ambient occlusion (engine default settings differ)

## Engine Tuning Implementation Notes

### ECSON Schema (Already Exists)
The `EngineTuningSchema` is a `z.record(string, z.record(string, unknown))` on both `Entity` and `ComponentInstance`. The outer key is the engine name:

```json
{
  "tuning": {
    "playcanvas": { "shadowResolution": 4096 },
    "babylon": { "shadowQuality": "high", "usePCF": true }
  }
}
```

### Adapter Reading Pattern
Each adapter reads its own key and ignores others:

```typescript
// In PlayCanvas adapter
const pcTuning = node.tuning?.["playcanvas"] as Record<string, unknown> | undefined;
if (pcTuning?.["shadowResolution"]) {
  // Apply PlayCanvas-specific shadow resolution
}

// In Babylon adapter
const bjTuning = node.tuning?.["babylon"] as Record<string, unknown> | undefined;
if (bjTuning?.["usePCF"]) {
  // Enable PCF shadow filtering
}
```

### Graceful Degradation
When a Babylon-tuned project is opened with the PlayCanvas engine active:
- Babylon tuning keys are preserved in ECSON but NOT applied
- No errors, no warnings in console
- The portable subset renders identically
- Inspector shows "Engine Tuning" section but Babylon values are dimmed/read-only

### Project-Level Engine Setting
The engine choice needs to be stored in the ECSON document's `metadata` field:

```typescript
// In SceneDocument.metadata
{
  "metadata": {
    "preferredEngine": "playcanvas"  // or "babylon"
  }
}
```

Alternatively, a dedicated field on `SceneDocument`. Using `metadata` avoids schema changes.

## Open Questions

1. **EngineAdapter interface location**
   - What we know: The `EngineAdapter` interface is currently in `@riff3d/adapter-playcanvas/src/types.ts`. The Babylon adapter needs the same interface.
   - What's unclear: Should the interface be extracted to a shared package (e.g., `@riff3d/canonical-ir` or a new `@riff3d/adapter-types`), or should it be duplicated?
   - Recommendation: Extract to `@riff3d/canonical-ir` (it already defines what adapters consume). Add `EngineAdapter` interface and `IRDelta` type to the canonical-ir package. This keeps the dependency direction correct (adapters depend on canonical-ir).

2. **Canvas management during engine switch**
   - What we know: Both engines need a WebGL context on a canvas. Disposing one context and creating another on the same canvas can fail in some browsers.
   - What's unclear: Whether creating a fresh canvas element per switch is necessary, or if proper disposal timing is sufficient.
   - Recommendation: Replace the canvas element in the DOM during switch. This is the safest approach and avoids context lifecycle issues. The loading overlay naturally hides the swap.

3. **Incremental delta granularity**
   - What we know: PatchOps range from simple property changes (SetProperty) to structural changes (CreateEntity, DeleteEntity, Reparent). Simple property changes are the most frequent during editing.
   - What's unclear: How many PatchOp types can be delta-optimized vs. requiring full rebuild.
   - Recommendation: Start with delta support for: `SetProperty` (transform, visibility, component properties), `SetComponentProperty`. Fall back to full rebuild for: `CreateEntity`, `DeleteEntity`, `Reparent`, `AddComponent`, `RemoveComponent`, `BatchOp`. This covers 90%+ of editing operations.

4. **ViewportProvider generalization**
   - What we know: `ViewportProvider` currently holds a `React.RefObject<PlayCanvasAdapter | null>`. It needs to hold either adapter type.
   - What's unclear: How to type this generically without losing type safety for adapter-specific methods (gizmos, selection).
   - Recommendation: Change `ViewportProvider` to hold `React.RefObject<EngineAdapter | null>` for the generic interface. For adapter-specific features (gizmos, selection, camera controller), use a separate typed ref or a discriminated adapter type. Since editor tools (gizmo, selection, grid) are PlayCanvas-specific for now, they can check `adapter instanceof PlayCanvasAdapter` before accessing typed methods.

## Sources

### Primary (HIGH confidence)
- Context7 `/babylonjs/documentation` -- scene creation, PBR materials, fog, lights, cameras
- Local Babylon.js source `/home/frank/babylonjs/` -- class hierarchy, transform model, observable system
- Local Babylon editor source `/home/frank/babylon-editor/` -- undo/redo, gizmo integration, play mode
- Existing codebase -- PlayCanvas adapter (818 LoC core), Canonical IR types, ECSON schemas, editor store

### Secondary (MEDIUM confidence)
- `.planning/research/BABYLON_ADVANCE_RESEARCH.md` -- comprehensive cross-engine mapping (2026-02-19)
- `.planning/research/FUTURE_ENGINE_CONSIDERATIONS.md` -- coordinate systems, physics, materials (2026-02-19)
- npm registry -- `@babylonjs/core` v8.52.0 latest (verified 2026-02-20)

### Tertiary (LOW confidence)
- Spot light inner cone angle to exponent mapping -- approximate formula, needs empirical validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Babylon.js version verified, API patterns confirmed via Context7 and local source
- Architecture: HIGH -- PlayCanvas adapter provides proven template; IR types stable from Phase 1-3
- Pitfalls: HIGH -- documented from local source analysis and advance research
- Incremental delta: MEDIUM -- design is sound but implementation complexity may surface during coding
- Engine switching: MEDIUM -- canvas context lifecycle needs empirical validation

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable -- Babylon.js 8.x API is mature)
