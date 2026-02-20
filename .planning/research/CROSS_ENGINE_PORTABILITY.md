# Cross-Engine Portability Research

> Research date: 2026-02-19
> Context: Riff3D Canonical IR design -- what must the portable layer handle?

---

## 1. Coordinate System Landscape

### Comprehensive Table

| Engine | Handedness | Up Axis | Forward Axis | Rotation Unit | Default Euler Order |
|---|---|---|---|---|---|
| **glTF 2.0** | Right | +Y | +Z | N/A (quaternions) | N/A |
| **PlayCanvas** | Right | +Y | -Z | Degrees | XYZ (intrinsic) |
| **Babylon.js** | **Left** | +Y | +Z | Radians | YXZ (intrinsic) |
| **Three.js** | Right | +Y | -Z | Radians | XYZ (intrinsic) |
| **Unity** | **Left** | +Y | +Z | Degrees | YXZ (intrinsic) / ZXY (extrinsic) |
| **Unreal** | **Left** | **+Z** | +X | Degrees | Yaw-Pitch-Roll (YPR = ZYX) |
| **Godot 4** | Right | +Y | -Z | Radians | YXZ (intrinsic) |
| **Bevy** | Right | +Y | -Z | Radians | YXZ (common convention) |
| **Stride** | Right | +Y | -Z | Radians | YXZ |
| **O3DE** | Right | **+Z** | +Y | Degrees | ZYX |
| **Defold** | Right | +Y | -Z | Radians | -- (primarily 2D) |

### Key Observations

**Handedness split:**
- Right-handed: glTF, PlayCanvas, Three.js, Godot, Bevy, Stride, O3DE, Defold
- Left-handed: Babylon.js, Unity, Unreal

**Up axis split:**
- Y-up: Most engines (PlayCanvas, Babylon, Three.js, Unity, Godot, Bevy, Stride, Defold)
- Z-up: Unreal, O3DE

**Forward axis is the worst inconsistency:**
- +Z forward: glTF, Babylon.js, Unity (because left-handed flips Z meaning)
- -Z forward: PlayCanvas, Three.js, Godot, Bevy, Stride
- +X forward: Unreal

### Canonical IR Recommendation

**Use glTF conventions: right-handed, Y-up, +Z forward.** This is the closest to an industry standard and matches the interchange format most engines already import/export through. Conversion required:

| Target | Handedness Fix | Up Fix | Forward Fix |
|---|---|---|---|
| PlayCanvas | None | None | Negate Z |
| Babylon.js | Negate Z | None | None |
| Three.js | None | None | Negate Z |
| Unity | Negate Z (or X) | None | None |
| Unreal | Negate Z, swap Y/Z | Swap Y/Z | Remap axes |
| Godot 4 | None | None | Negate Z |

**Critical gotcha:** Handedness conversion is NOT just negating one axis. It also requires winding order reversal for triangle indices, flipping cross products, and inverting determinants of transform matrices. Every engine's glTF importer already handles this, but our adapters must replicate the same logic.

### What glTF Does

glTF 2.0 specifies right-handed Y-up with +Z forward. All conforming importers must convert from this basis. The spec is explicit about this. However, the forward axis convention (+Z) has been a source of community confusion -- issue #1043 on the glTF repo discusses this extensively. In practice, importers for left-handed engines (Babylon, Unity) negate the Z axis on import.

---

## 2. Transform Representation

### Euler Angle Orders by Engine

| Engine | Internal Euler Order | Convention Type | Unit |
|---|---|---|---|
| PlayCanvas | XYZ | Intrinsic | Degrees |
| Babylon.js | YXZ | Intrinsic (local axes) | Radians |
| Three.js | XYZ (default, configurable) | Intrinsic | Radians |
| Unity | YXZ | Intrinsic (= ZXY extrinsic) | Degrees |
| Unreal | YPR (Yaw=Z, Pitch=Y, Roll=X) | Intrinsic ZYX | Degrees |
| Godot 4 | YXZ | Intrinsic | Radians |
| Bevy | YXZ (common), all 24 supported | Intrinsic | Radians |

**The danger:** Even when two engines both say "YXZ", one may mean intrinsic and the other extrinsic. The same angles produce different orientations. Godot's documentation explicitly warns about this: their YXZ intrinsic is NOT the same as Blender's YXZ extrinsic.

### Gimbal Lock

Gimbal lock occurs when the second rotation in a 3-rotation Euler sequence reaches +/-90 degrees, collapsing one degree of freedom. This affects ALL Euler representations regardless of order. The only mitigation is:

1. Store rotations as quaternions internally (all engines do this)
2. Only convert to Euler for display/editing
3. Use the engine's preferred Euler order for display to minimize surprise gimbal lock positions

### Quaternion Storage Conventions

| System | Component Order | Notes |
|---|---|---|
| Unity | (x, y, z, w) | Scalar-last in memory |
| Unreal (FQuat) | (x, y, z, w) | Scalar-last |
| Three.js | (x, y, z, w) | Scalar-last |
| PlayCanvas (Quat) | (x, y, z, w) | Scalar-last |
| Babylon.js | (x, y, z, w) | Scalar-last |
| Godot | (x, y, z, w) | Scalar-last |
| Bevy (glam) | (x, y, z, w) | Scalar-last |
| Rapier | (x, y, z, w) | Scalar-last |
| glTF | (x, y, z, w) | Scalar-last |
| **Math literature** | **(w, x, y, z)** | **Scalar-first** |
| Eigen (C++) | Constructor: (w,x,y,z) / Memory: (x,y,z,w) | **Mixed!** |
| USD/Pixar | API: (w,x,y,z) / Internal: (x,y,z,w) | **Mixed!** |
| MuJoCo, MATLAB, Blender | (w, x, y, z) | Scalar-first |

**Game engines have standardized on (x,y,z,w).** Math libraries and scientific tools tend toward (w,x,y,z). For the Canonical IR, **(x,y,z,w) is the clear choice** since every target engine uses it.

**Gotcha:** When interoperating with USD or scientific tools, conversion is just a reorder of array elements, but getting it wrong silently produces incorrect rotations that can be hard to debug (the quaternion is still unit-length, just wrong).

### Scale: Uniform vs Non-Uniform

**Non-uniform scale is a minefield for physics:**

- **Unity Physics:** Only primitive colliders (Box, Sphere, Capsule, Cylinder) support non-uniform scale. Mesh/Convex/Terrain colliders do NOT.
- **Godot/Jolt:** Non-uniform scale on capsule/circle shapes is not supported; produces warnings or incorrect behavior.
- **Rapier:** Collider shapes are defined with explicit dimensions (half-extents), not scale transforms. Non-uniform scale must be baked into shape parameters.
- **PhysX:** Rigid body scaling must be applied to shapes individually, not the body itself.
- **Bullet/ammo.js:** Similar to PhysX -- scale on compound shapes requires per-child-shape application.

**Canonical IR recommendation:** Store scale as `Vector3` (non-uniform supported for rendering), but flag in physics components whether non-uniform scale is used. Adapters must decompose non-uniform scale into per-shape dimensions rather than applying a scale transform to the physics body.

### Does Storing Both Euler + Quaternion Cover All Cases?

**Yes, with caveats:**

1. The quaternion is the authoritative rotation. The Euler angles are a **display convenience**.
2. Multiple Euler representations map to the same quaternion. When converting quaternion-to-Euler, the engine's preferred order must be used to get "nice" numbers.
3. **Edge case:** Animation curves authored in Euler space can produce different interpolation paths than quaternion slerp. If an animation was authored with Euler keyframes, storing only quaternion keyframes loses the intended interpolation behavior (especially around 180-degree rotations where slerp takes the short path but Euler interpolation might go the long way).
4. **Edge case:** Some tools (Blender) author animations in Euler space with a specific order. Converting to quaternion and back with a different order can produce different Euler values at each keyframe, which looks wrong to artists even though the orientation is identical.

---

## 3. Physics Abstraction Landscape

### Component Architecture: Separate vs Combined

| Engine/Physics | RigidBody | Collider/Shape | Separate Components? |
|---|---|---|---|
| Unity (PhysX) | Rigidbody | Collider (Box/Sphere/Mesh/...) | **Yes** -- separate components |
| Unity DOTS Physics | PhysicsBody | PhysicsCollider | **Yes** |
| Unreal (Chaos) | Built into Actor physics | Collision shapes on components | **Merged** -- physics is part of the component |
| Godot 4 (GodotPhysics/Jolt) | RigidBody3D node | CollisionShape3D child node | **Yes** -- parent/child nodes |
| PlayCanvas (ammo.js/Bullet) | RigidBody component | Collision component | **Yes** -- separate components on same entity |
| Babylon.js (Havok) | PhysicsBody | PhysicsShape | **Yes** -- can be independent or via PhysicsAggregate |
| Bevy (Rapier) | RigidBody component | Collider component | **Yes** -- separate ECS components |
| Three.js (cannon/rapier) | Body | Shape | **Yes** -- library-level separation |

**Universal pattern:** Nearly all modern engines use separate body + shape. The Canonical IR should model this as two separate component types: `RigidBody` (mass, type, damping, CCD settings) and `Collider` (shape type, dimensions, offset, material properties).

### Physics Shape Support Matrix

| Shape | PhysX | Havok | Jolt | Rapier | Bullet/ammo.js | Chaos |
|---|---|---|---|---|---|---|
| Box | Yes | Yes | Yes | Yes | Yes | Yes |
| Sphere | Yes | Yes | Yes | Yes | Yes | Yes |
| Capsule | Yes | Yes | Yes | Yes | Yes | Yes |
| Cylinder | Yes | Yes | Yes | Yes | Yes | Yes |
| Cone | Yes | -- | Yes | Yes | Yes | -- |
| Convex Hull | Yes | Yes | Yes | Yes | Yes | Yes |
| Triangle Mesh | Yes | Yes | Yes | Yes* | Yes | Yes |
| Heightfield | Yes | Yes | Yes | Yes | Yes | Yes |
| Compound | Yes | Yes | Yes | Yes | Yes | Yes |

*Rapier note: Triangle meshes on dynamic bodies are strongly discouraged (no interior volume = objects get stuck). Use convex decomposition instead.

**Safe portable subset for Canonical IR:** Box, Sphere, Capsule, Convex Hull, Compound. These are universally supported with consistent behavior. Cylinder and Cone have some gaps. Triangle Mesh should be static-only.

### Trigger Volumes / Sensors

**Universally supported** across all major physics engines:

- **PhysX:** `PxShapeFlag::eTRIGGER_SHAPE`
- **Havok:** Phantom shapes / trigger volumes
- **Jolt:** `isSensor = true` on body
- **Rapier:** `setSensor(true)` on collider -- detects intersection events only
- **Bullet/ammo.js:** Ghost objects (`btGhostObject`)
- **Godot:** Area3D node
- **PlayCanvas:** Trigger component / collision with no rigidbody

**Difference:** Sensors in Rapier emit intersection events only (enter/exit), not contact events. PhysX triggers don't generate contact points either. This is consistent enough for a portable abstraction: `{ isTrigger: boolean }` on the collider component.

### Joints / Constraints

**This is the highest-variance area in physics portability.**

| Joint Type | PhysX | Jolt | Rapier | Bullet | Havok |
|---|---|---|---|---|---|
| Fixed | Yes | Yes | Yes | Yes | Yes |
| Spherical/Ball | Yes | Yes | Yes | Yes | Yes |
| Revolute/Hinge | Yes | Yes | Yes | Yes | Yes |
| Prismatic/Slider | Yes | Yes | Yes | Yes | Yes |
| Distance/Spring | Yes | Yes | Yes | Yes | Yes |
| Rope | -- | -- | Yes | -- | -- |
| Cone Twist | Yes (D6) | SwingTwist | -- | Yes | Yes |
| 6DOF (Generic) | D6 Joint | SixDOF | Generic | Generic6Dof | Yes |
| Gear | Yes | -- | -- | -- | -- |
| Path | -- | Yes | -- | -- | -- |

**Portable joint subset:** Fixed, Spherical, Revolute, Prismatic, Distance/Spring. These are universally available. The 6DOF/Generic joint CAN express all the others but configuration differs wildly. Gear and Path joints are engine-specific.

**Recommendation for Canonical IR:** Include the 5 universal joint types. Do NOT attempt to abstract 6DOF joints portably -- the parameterization is too different across engines. Flag them as "engine-specific" and handle in adapters.

### Character Controllers

**Not portably abstractable.** Each engine has a deeply integrated character controller with different assumptions:

- **Unity:** Capsule-based, kinematic, built-in step/slope handling
- **Unreal:** UCapsuleComponent with movement component, supports crouching/flying/swimming modes
- **Godot:** CharacterBody3D with move_and_slide(), velocity-based
- **PlayCanvas:** No built-in character controller -- roll your own with rigidbody
- **Babylon.js:** Capsule/cylinder/box character controller, physics-based
- **Rapier:** KinematicCharacterController helper class

**Canonical IR recommendation:** Do NOT include a "character controller" component. Instead, expose the building blocks (capsule collider + kinematic body + configuration data) and let adapters compose engine-specific controllers. Include a `CharacterControllerConfig` metadata component with `stepHeight`, `slopeAngle`, `capsuleRadius`, `capsuleHeight` that adapters can use.

---

## 4. Material / PBR Portability

### Metallic-Roughness: Is It Universal?

**Yes -- metallic-roughness PBR is the de facto standard.** All modern engines support it:

- glTF 2.0 core uses metallic-roughness as the default PBR model
- Unity (Standard Shader, URP, HDRP): metallic-roughness
- Unreal: metallic-roughness (with some custom parameters)
- Godot: metallic-roughness (ORM texture support)
- PlayCanvas: metallic-roughness (Physical material)
- Babylon.js: metallic-roughness (PBRMaterial)
- Three.js: metallic-roughness (MeshStandardMaterial)
- Bevy: metallic-roughness

**Specular-Glossiness** is the older workflow. glTF had it as an extension (`KHR_materials_pbrSpecularGlossiness`) but it's now effectively deprecated. The newer `KHR_materials_specular` + `KHR_materials_ior` extensions bring specular control into the metallic-roughness workflow.

**Canonical IR recommendation:** Use metallic-roughness exclusively. If importing specular-glossiness content, convert at import time. The conversion is well-documented (glossiness = 1 - roughness, specular maps require more complex conversion but tools like glTF-Transform handle it).

### Texture Coordinate Conventions (UV Origin)

| System | UV Origin | V Direction |
|---|---|---|
| **glTF** | **Top-left** | V increases downward |
| OpenGL | Bottom-left | V increases upward |
| DirectX | Top-left | V increases downward |
| Vulkan | Top-left | V increases downward |
| Unity | Bottom-left (OpenGL) | Flips on import |
| Unreal | Top-left | Matches DirectX |
| Three.js | Bottom-left (OpenGL) | Flips Y on glTF import |
| Babylon.js | Top-left | Matches DirectX convention |
| PlayCanvas | Top-left | Matches glTF |
| Godot | Top-left (for imported assets) | Handles conversion |

**glTF specifies top-left origin** (matching DirectX/Vulkan). OpenGL-based engines (Three.js, Unity) must flip the V coordinate on import. All major engines' glTF importers handle this automatically.

**Canonical IR recommendation:** Use glTF convention (top-left origin, V increases downward). This matches the spec and most engines' import paths.

### Normal Map Conventions

| Engine | Normal Map Format | Y/Green Channel |
|---|---|---|
| **glTF** | **OpenGL** | **Y+ (up)** |
| Unity | OpenGL | Y+ (up) |
| Unreal | **DirectX** | **Y- (down)** |
| Godot | OpenGL | Y+ (up) |
| PlayCanvas | OpenGL (follows glTF) | Y+ (up) |
| Babylon.js | **DirectX** | **Y- (down)** (has `invertNormalMapY` flag) |
| Three.js | OpenGL | Y+ (up) |
| Bevy | OpenGL | Y+ (up) |

**The split:** glTF, Unity, Godot, Three.js, PlayCanvas, Bevy use OpenGL convention (Y+). Unreal and Babylon.js use DirectX convention (Y-). The conversion is trivially flipping the green channel.

**Canonical IR recommendation:** Store normal maps in OpenGL convention (Y+) to match glTF spec. Adapters for Unreal and Babylon.js flip the green channel on export. Babylon.js can also handle this with `material.invertNormalMapY = true` at runtime without modifying the texture.

### Alpha Modes

glTF defines three alpha modes that are universally supported:

| Mode | Behavior | Universal? |
|---|---|---|
| `OPAQUE` | Alpha ignored, fully opaque | Yes -- all engines |
| `MASK` | Binary transparency at cutoff threshold | Yes -- all engines (with `alphaCutoff` parameter) |
| `BLEND` | Alpha blending with background | Yes -- all engines |

**Additional modes some engines support:** Premultiplied alpha, additive blending, custom blend modes. These are NOT portable.

**Canonical IR recommendation:** Support the three glTF modes. Map engine-specific blend modes to metadata that adapters can use.

### sRGB vs Linear Color Space

**Universal rule for PBR textures:**

| Texture Type | Color Space | Reason |
|---|---|---|
| Base color (albedo) | sRGB | Perceptual color, gamma-encoded |
| Emissive | sRGB | Perceptual color |
| Normal map | Linear | Directional data, not color |
| Metallic | Linear | Physical parameter |
| Roughness | Linear | Physical parameter |
| Occlusion (AO) | Linear | Lighting data |
| ORM (packed) | Linear | All data channels |

**All engines agree on this.** The rendering pipeline converts sRGB textures to linear on GPU read (hardware sRGB decoding), performs lighting math in linear space, then applies gamma correction (or tone mapping) at output.

**Canonical IR recommendation:** Store a `colorSpace` field per texture slot (`"sRGB"` or `"linear"`). The mapping above is the default. Adapters must ensure the engine applies the correct sampler settings (sRGB vs linear decode).

---

## 5. Ejection / Export Patterns

### How Existing Tools Handle Multi-Engine Export

#### glTF Ecosystem

glTF is the closest thing to a universal 3D interchange format. Key lessons:

1. **Per-engine importers do the heavy lifting.** The format itself is minimal and well-specified. Each engine's importer handles coordinate conversion, texture flipping, material mapping, etc.
2. **Extensions are the escape hatch.** When the core spec can't represent something, extensions (KHR_, EXT_) add capability. But extension support varies wildly across engines.
3. **Lossy round-trips.** Export from Engine A to glTF and import to Engine B almost always loses engine-specific data (custom shader parameters, LOD settings, physics tuning, etc.).
4. **Units:** glTF uses meters. Unity uses meters. Unreal uses centimeters. This scaling factor is a constant source of bugs.

#### USD (Universal Scene Description)

**What worked:**
- Composition arcs (references, payloads, variants, inherits) enable massive scene collaboration
- Non-destructive layered overrides (like Photoshop layers for 3D)
- Strong schema system for typed data

**What didn't work / remains challenging:**
- Custom schemas are NOT portable between facilities. Your physics schema may be incompatible with another studio's.
- Layer structure must match between collaborators or the benefits evaporate
- The format evolves rapidly -- studios report difficulty keeping up with spec changes
- Flattening composed scenes loses the composition structure, making re-editing difficult
- Game engine integration is still immature compared to VFX pipelines

**Lessons for Riff3D:**
- Keep the Canonical IR "flat" (pre-composed). Composition belongs in ECSON (the editor format), not the portable layer.
- Don't create custom schemas that won't be understood outside your toolchain. Stick to well-known data shapes.

#### FBX (Autodesk)

**Cautionary tale for portability:**
- Proprietary binary format with no public spec
- FBX SDK has restrictive licensing that prevents open-source use
- Coordinate system is AMBIGUOUS -- depends on the exporting application (Maya vs Max vs Blender all produce different FBX files)
- Conversion is only reliable for Maya-exported content using default settings
- The Godot team explicitly recommends glTF over FBX for asset exchange

**Lesson:** An opaque or ambiguous format specification makes portability exponentially harder. The Canonical IR must be unambiguous in its conventions.

### Ejection vs Export

**Export = produce a file that another tool can read.** The scene data is translated to a format the target understands.

**Ejection = produce a standalone, runnable project** in the target engine's native format. This is fundamentally different because:

1. **Project structure:** Each engine has its own directory layout, manifest files, build configuration
2. **Code generation:** Scripts/behaviors must be emitted in the target engine's scripting language or framework
3. **Asset pipeline:** Textures, models, and materials must be in the format the engine's asset pipeline expects (not just a scene file)
4. **Dependencies:** The ejected project needs engine packages, plugins, and dependencies properly configured
5. **Build tooling:** Package.json, .csproj, Cargo.toml, .uproject -- each engine has its own build system

**For Riff3D:** The adapter pattern supports both. Export = adapter reads Canonical IR and produces engine-native scene data. Ejection = adapter additionally scaffolds the project structure, emits configuration files, and generates boilerplate code. Ejection is a superset of export.

---

## 6. Event / Scripting Portability

### Event System Patterns by Engine

| Engine | Pattern | API Shape | Event Identity |
|---|---|---|---|
| PlayCanvas | Observer/EventEmitter | `fire(name, ...args)` / `on(name, callback)` | String name |
| Babylon.js | Observable | `observable.add(callback)` / `observable.notifyObservers(data)` | Observable instance |
| Three.js | EventDispatcher | `dispatchEvent({type, ...})` / `addEventListener(type, callback)` | String type |
| Unity | Delegate/Event | `event Action<T>` / `myEvent += handler` | C# delegate type |
| Unreal | Delegate/Multicast | `DECLARE_DYNAMIC_MULTICAST_DELEGATE` / `AddDynamic` | C++ macro type |
| Godot | Signal | `signal my_signal` / `emit_signal("name")` / `connect("name", callable)` | String name + Signal type |
| Bevy | Event/Observer | `EventWriter<T>::send(event)` / `EventReader<T>::read()` | Rust type |

### Can These Be Expressed as "Source + Event -> Target + Action" Wires?

**Yes, with constraints.** The common abstraction is:

```
Wire {
  source: EntityRef        // Who emits
  event: string            // What happened (e.g., "collision:enter", "click", "timer:complete")
  target: EntityRef        // Who receives
  action: string           // What to do (e.g., "setVisible", "playAnimation", "destroy")
  parameters?: Record      // Additional data
}
```

This covers the vast majority of visual scripting / no-code behavior wiring. It maps cleanly to:
- PlayCanvas: `source.fire(event)` -> `target.on(event, action)`
- Babylon.js: `source.observable.add(...)` -> call action on target
- Godot: `source.connect(signal, target, method)`
- Unity: `source.Event += target.Handler`

**Limitations:**
- Complex control flow (conditionals, loops, state machines) doesn't fit the simple wire model
- Data transformation between source event and target action parameters requires an expression layer
- Timing (debounce, delay, sequence) requires additional nodes

### glTF KHR_interactivity

Released for public review in June 2024, approaching ratification as of early 2025.

**What it defines:**
- **Behavior graphs** (node-based visual programming) embedded in glTF files
- Nodes represent operations (math, logic, flow control, event handling)
- **Custom event nodes** fire when application-defined events occur
- Lifecycle events (onStart, onTick)
- Interaction events (onSelect, onHover for XR)
- Animation control (play, pause, seek)
- Property access (get/set node transforms, material properties)

**How well it maps:**
- The behavior graph model is MORE expressive than simple wires -- it includes flow control, variables, and math nodes
- It's designed for portability across viewers/engines
- Magic Leap has implemented runtime playback in Unity via UnityGLTF
- Google's Android XR supports it through Jetpack XR SDK
- The node types are extensible but the core set is well-defined

**Canonical IR recommendation:** Support both simple wires (for most use cases) and a behavior graph subset (for complex interactions). The wire model is sufficient for MVP. If/when full scripting portability is needed, KHR_interactivity's behavior graph model is the most promising standard to align with.

---

## 7. Animation Portability

### Keyframe Animation Data Model

glTF defines the most portable animation model:

```
Animation {
  channels: [{
    target: { node: NodeRef, path: "translation" | "rotation" | "scale" | "weights" }
    sampler: SamplerRef
  }]
  samplers: [{
    input: AccessorRef    // Keyframe times (seconds)
    output: AccessorRef   // Keyframe values
    interpolation: "STEP" | "LINEAR" | "CUBICSPLINE"
  }]
}
```

**Is this universal?** Mostly yes:

| Feature | glTF | Unity | Unreal | Godot | PlayCanvas | Babylon.js |
|---|---|---|---|---|---|---|
| Position keyframes | Yes | Yes | Yes | Yes | Yes | Yes |
| Rotation keyframes | Yes (quat) | Yes (quat) | Yes (quat) | Yes (quat) | Yes (quat) | Yes (quat) |
| Scale keyframes | Yes | Yes | Yes | Yes | Yes | Yes |
| Morph targets | Yes (weights) | Yes (blendshapes) | Yes (morph targets) | Yes | Yes | Yes |
| Step interpolation | Yes | Yes (Constant) | Yes (Step) | Yes | Yes | Yes |
| Linear interpolation | Yes | Yes | Yes | Yes | Yes | Yes |
| Cubic interpolation | Yes (CubicSpline with tangents) | Yes (multiple curve types) | Yes (Cubic) | Yes (Cubic) | Yes | Yes |
| Custom property animation | No (core) / Yes (KHR_animation_pointer) | Yes | Yes | Yes | Yes | Yes |

**Gap:** glTF core only animates transform + morph weights. Custom property animation (e.g., material color, light intensity) requires the `KHR_animation_pointer` extension, which is not yet widely supported. Unity's UnityGLTF supports import/export with this extension, but exported files may not load in Three.js.

### Animation State Machines

**High variance -- not portably abstractable.**

| Engine | State Machine System | Features |
|---|---|---|
| Unity | Animator Controller (Mechanim) | States, transitions with conditions, blend trees, layers, IK |
| Unreal | Animation Blueprints + State Machines | States, transitions, blend spaces, montages, notification events |
| Godot | AnimationTree + StateMachine | States, transitions, blend modes, one-shot |
| PlayCanvas | No built-in state machine | Manual implementation required |
| Babylon.js | AnimationGroup + manual state management | No built-in state machine |
| Three.js | AnimationMixer + manual state management | No built-in state machine |

**Canonical IR recommendation:** Do NOT attempt to portably represent animation state machines. Instead:
1. Export individual animation clips (keyframe data is portable)
2. Include state machine metadata as an opaque/advisory blob
3. Let adapters compose engine-specific state machines from clips + transition rules

### Skeletal Animation Portability

**Bone naming is the biggest challenge.** There is no universal standard.

| Convention | Used By | Root Bone |
|---|---|---|
| Mixamo (`mixamorig:Hips`, `mixamorig:Spine`, etc.) | Adobe Mixamo, many free assets | No explicit root (Hips is top) |
| Unity Humanoid (`Hips`, `Spine`, `LeftUpperArm`, etc.) | Unity Mechanim | Yes (explicit root) |
| VRM (`hips`, `spine`, `leftUpperArm`, etc.) | VRChat, VRM standard | Yes |
| Unreal Mannequin (`pelvis`, `spine_01`, `clavicle_l`, etc.) | Unreal Engine | Yes (`root`) |
| Custom per-studio | AAA games, film VFX | Varies |

**Retargeting challenges:**
1. **Different bone counts:** Mixamo has ~65 bones, Unity Humanoid requires minimum 15, VRM defines 52 standard bones
2. **Different rest poses:** T-pose vs A-pose vs custom bind poses affect how animations transfer
3. **Scale differences:** Mixamo skeletons have different proportions than VRM skeletons -- naive keyframe copying causes distortion
4. **Missing root bone:** Mixamo lacks a root bone, which matters for root motion extraction
5. **Naming inconsistency:** Even within a convention, casing and prefixes vary (`LeftArm` vs `leftArm` vs `arm_L` vs `arm.L`)

**Canonical IR recommendation:**
1. Store bone names as-is from the source
2. Include an optional `humanoidMapping` that maps bones to a standard set (closest to Unity's Humanoid definition which is the most widely adopted)
3. Retargeting is an adapter concern, not an IR concern
4. Store bind pose explicitly (inverse bind matrices, as glTF does)

### Does glTF's Animation Model Cover What Engines Need?

**For basic animation, yes. For production use, it has gaps:**

| Capability | glTF Support | Gap? |
|---|---|---|
| Transform animation | Yes | No |
| Morph target animation | Yes | No |
| Custom property animation | Via KHR_animation_pointer | Partial (limited engine support) |
| Animation events/notifies | **No** | Yes -- engines use these heavily for footsteps, VFX triggers, etc. |
| Root motion | **No explicit support** | Yes -- must be extracted from hip bone translation |
| IK constraints | **No** | Yes -- engine-specific |
| Animation blending/layers | **No** | Yes -- runtime concern |
| State machine | **No** | Yes -- engine-specific |
| Max 4 bone influences | Core spec limit | Yes -- cloth/face need more (future spec update planned) |

---

## Summary: Portable Subset for Canonical IR

### What IS portable (include in IR):

| Domain | Portable Elements |
|---|---|
| Transforms | Position (vec3), Rotation (quaternion + display Euler), Scale (vec3) |
| Hierarchy | Parent-child relationships, named nodes |
| Meshes | Vertex data, indices, attributes (position, normal, UV, tangent, color, joints, weights) |
| Materials | Metallic-roughness PBR: baseColor, metallic, roughness, normal, occlusion, emissive |
| Alpha | Opaque, Mask (with cutoff), Blend |
| Textures | Image data + UV set index + color space tag (sRGB/linear) |
| Physics Bodies | Type (static/dynamic/kinematic), mass, friction, restitution, damping, CCD flag |
| Physics Shapes | Box, Sphere, Capsule, Convex Hull, Compound (static: + Triangle Mesh, Heightfield) |
| Triggers | isSensor flag on collider |
| Joints (basic) | Fixed, Ball, Hinge, Slider, Spring/Distance |
| Animation Clips | Keyframe data: time, value, interpolation (step/linear/cubic) for transform + morph |
| Cameras | Perspective (fov, near, far, aspect) and Orthographic (size, near, far) |
| Lights | Directional, Point, Spot (with intensity, color, range, cone angles) |
| Event Wires | Source + event name -> Target + action name + parameters |

### What is NOT portable (handle in adapters or metadata):

| Domain | Non-Portable Elements |
|---|---|
| Coordinate system | Conversion is adapter responsibility |
| Normal map Y-flip | Adapter flips green channel for DirectX-convention engines |
| Euler display | Adapter converts quaternion to engine-preferred Euler order |
| Animation state machines | Adapter composes from clips + transition metadata |
| Character controllers | Adapter constructs from config (step height, slope, capsule dims) |
| Custom material properties | Stored as metadata, adapter maps to engine-specific uniforms |
| 6DOF / advanced joints | Stored as metadata with per-engine configuration |
| Scripting / behaviors | Beyond simple wires, this is engine-specific |
| LOD configuration | Engine-specific mesh LOD systems |
| Particle systems | Extremely engine-specific |
| Audio spatialization | Engine-specific |
| Navigation meshes | Engine-specific generation |
| Post-processing | Engine-specific render pipeline |

### Critical Conversion Matrix (Quick Reference)

| Conversion | From IR | To PlayCanvas | To Babylon.js |
|---|---|---|---|
| Coordinates | RH, Y-up, +Z fwd | Negate Z | Negate Z (LH flip) |
| Rotation unit | Quaternion (x,y,z,w) | No change (internal quat) | No change (internal quat) |
| Euler display | IR stores radians | Convert to degrees | No change (radians) |
| Normal maps | OpenGL (Y+) | No change | Flip Y or set `invertNormalMapY` |
| UV origin | Top-left | No change | No change |
| Scale unit | Meters | No change | No change |
| Physics | Separate body + shape | Map to rigidbody + collision components | Map to PhysicsBody + PhysicsShape |

---

## Sources

### Coordinate Systems
- [Coordinate Systems of 3D Applications Guide](https://ahmetburul.medium.com/coordinate-systems-of-3d-applications-guide-ddfa2194ed88)
- [glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [Babylon.js Left-Handed System Discussion](https://news.ycombinator.com/item?id=6204483)
- [Bevy Coordinate System Discussion](https://github.com/bevyengine/bevy/discussions/10488)
- [Bevy Coordinate System Cheat Book](https://bevy-cheatbook.github.io/fundamentals/coords.html)
- [Godot Using 3D Transforms](https://docs.godotengine.org/en/stable/tutorials/3d/using_transforms.html)
- [Stride Forward Direction Discussion](https://github.com/stride3d/stride/discussions/1754)
- [glTF Forward Vector Convention Issue](https://github.com/KhronosGroup/glTF/issues/1043)

### Transform Representation
- [Quaternion Conventions Repository](https://github.com/clemense/quaternion-conventions)
- [Unity Rotation Manual](https://docs.unity3d.com/6000.2/Documentation/Manual/QuaternionAndEulerRotationsInUnity.html)
- [Unreal FRotator Documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Core/Math/TRotator)
- [Babylon.js Rotation Conventions](https://doc.babylonjs.com/features/featuresDeepDive/mesh/transforms/center_origin/rotation_conventions)
- [Three.js Euler Documentation](http://threejs.ir/docs/api/en/math/Euler.html)
- [Godot Euler Rotation Order Issue](https://github.com/godotengine/godot/issues/105115)
- [Bevy EulerRot Documentation](https://docs.rs/bevy/latest/bevy/prelude/enum.EulerRot.html)
- [PlayCanvas Euler Rotation Forum](https://forum.playcanvas.com/t/understanding-euler-rotation/4195)

### Physics
- [Rapier Colliders Documentation](https://rapier.rs/docs/user_guides/javascript/colliders/)
- [Rapier Joints Documentation](https://rapier.rs/docs/user_guides/javascript/joints/)
- [PhysX 5.4.1 Joints Documentation](https://nvidia-omniverse.github.io/PhysX/physx/5.4.1/docs/Joints.html)
- [Jolt Physics Constraints](https://deepwiki.com/jrouwe/JoltPhysics/3.4-constraints)
- [PlayCanvas Physics Basics](https://developer.playcanvas.com/user-manual/physics/physics-basics/)
- [Babylon.js Havok Plugin](https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin)
- [Unity Non-Uniform Scale Collider](https://discussions.unity.com/t/non-uniform-scaling-of-mesh-collider-unity-ecs-physics/1507187)

### Materials / PBR
- [glTF PBR Overview](https://www.khronos.org/gltf/pbr)
- [Converting Spec-Gloss to Metal-Rough](https://www.donmccurdy.com/2022/11/28/converting-gltf-pbr-materials-from-specgloss-to-metalrough/)
- [glTF Normal Map Y Channel Issue](https://github.com/KhronosGroup/glTF/issues/952)
- [glTF Texture Image Orientation Issue](https://github.com/KhronosGroup/glTF/issues/1021)
- [Babylon.js Normal Maps Documentation](https://doc.babylonjs.com/divingDeeper/materials/advanced/normalMaps)
- [Godot Normal Map Convention Proposal](https://github.com/godotengine/godot-proposals/issues/2989)
- [PlayCanvas Color Space Forum](https://forum.playcanvas.com/t/solved-color-space-of-textures/25173)

### Export / Ejection
- [Godot: Why We Should All Use glTF](https://godotengine.org/article/we-should-all-use-gltf-20-export-3d-assets-game-engines/)
- [USD Adoption Considerations (Foundry)](https://www.foundry.com/insights/film-tv/usd-things-to-consider)
- [Remedy Games OpenUSD Workflows](https://www.remedygames.com/article/developing-northlight-openusd-content-workflows)
- [FBX Coordinate System Confusion (Unity)](https://forum.unity.com/threads/fbx-coordinate-system-confusion.164144/)
- [glTF Per-Engine Importer Gotchas (UnityGLTF)](https://github.com/KhronosGroup/UnityGLTF)

### Events / Scripting
- [glTF KHR_interactivity Announcement](https://www.khronos.org/blog/gltf-interactivity-specification-released-for-public-comment)
- [KHR_interactivity Specification](https://github.com/KhronosGroup/glTF/blob/interactivity/extensions/2.0/Khronos/KHR_interactivity/Specification.adoc)
- [PlayCanvas Events Documentation](https://developer.playcanvas.com/user-manual/scripting/events/)
- [PlayCanvas Observer Library](https://github.com/playcanvas/observer)

### Animation
- [glTF Animation Tutorial](https://github.khronos.org/glTF-Tutorials/gltfTutorial/gltfTutorial_007_Animations.html)
- [Skeletal Animation in glTF (lisyarus)](https://lisyarus.github.io/blog/posts/gltf-animation.html)
- [Animation Retargeting (Wicked Engine)](https://wickedengine.net/2022/09/animation-retargeting/)
- [Understanding glTF Animation (Modelo)](https://www.modelo.io/damf/article/2024/07/07/1113/understanding-gltf-animation--a-comprehensive-guide)
