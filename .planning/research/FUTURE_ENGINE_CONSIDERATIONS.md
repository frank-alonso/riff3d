# Future Engine Considerations

**Researched:** 2026-02-19
**Purpose:** Identify contract-level gotchas from future target engines that could affect Phase 1 decisions
**Scope:** Unity 6, Unreal Engine 5, Godot 4, Bevy, Stride, O3DE, Defold + general cross-engine patterns
**Confidence:** MEDIUM-HIGH (web research + official docs + existing source code analysis)

---

> **GRAVITY WELL WARNING**
>
> This document exists to surface contract-level risks early, NOT to expand the Canonical IR's scope.
> PITFALLS.md Pitfall 1 ("The Universal Format Gravity Well") explicitly warns against designing
> ECSON/IR for engines that don't have working adapters yet. Everything in this document should be
> evaluated through the lens of: "Does this require a schema change that would be painful to migrate
> later?" If yes, consider it now. If no, file it for the adapter implementation phase (v4.0+).
>
> The 2-template rule still governs portable subset expansion. No findings here override that.

---

## When to Consult This Document

- **Phase 1 (Contracts):** During IR schema review and conformance harness design
- **Phase 4 (Dual Adapter):** When validating that the Babylon.js adapter doesn't bake in web-only assumptions
- **Phase 8 (Ejection):** When designing the ejection adapter interface
- **v4.0 (Platform Expansion):** When actually building Unity/Godot/Unreal adapters

---

## 1. Coordinate System Landscape

The biggest cross-engine divergence. Three distinct camps:

| Engine | Handedness | Up | Forward | Rotation Unit | Euler Order |
|--------|------------|-----|---------|---------------|-------------|
| **glTF 2.0** | Right | +Y | +Z | N/A (quat) | N/A |
| **PlayCanvas** | Right | +Y | -Z | Degrees | XYZ intrinsic |
| **Babylon.js** | **Left** | +Y | +Z | Radians | YXZ intrinsic |
| **Three.js** | Right | +Y | -Z | Radians | XYZ intrinsic |
| **Unity 6** | **Left** | +Y | +Z | Degrees | YXZ intrinsic |
| **Unreal 5** | **Left** | **+Z** | +X | Degrees | ZYX (YPR) |
| **Godot 4** | Right | +Y | -Z | Radians | YXZ intrinsic |
| **Bevy** | Right | +Y | -Z | Radians | YXZ |
| **Stride** | Right | +Y | -Z | Radians | YXZ |
| **O3DE** | Right | **+Z** | +Y | Degrees | ZYX |
| **Defold** | Right | +Y | -Z | Radians | -- |

### Key Findings

**Handedness conversion is not just axis negation.** Converting right-to-left (for Unity/Babylon/Unreal) also requires:
- Triangle winding order reversal (counterclockwise to clockwise)
- Quaternion component sign changes: glTF `(qx,qy,qz,qw)` → Unity `(-qx,-qy,qz,qw)`
- Cross product sign inversion in any derived calculations

**Unreal is the hardest target.** Left-handed + Z-up + centimeters + X-forward means every spatial value needs axis remapping (`UE_pos = (gltf_x, -gltf_z, gltf_y) * 100`), quaternion transformation, and unit scaling. This is well-understood math but must be applied to every position, rotation, and direction vector consistently.

**Quaternion storage is universal (x,y,z,w).** Every game engine stores quaternions scalar-last. Only math libraries (Eigen, some textbooks) use (w,x,y,z). The IR's `QuaternionSchema = z.object({x,y,z,w})` is correct.

### Action Items

| Priority | Action | Phase |
|----------|--------|-------|
| **P0** | Document "right-handed, Y-up, quaternion (x,y,z,w), degrees for Euler" as formal IR conventions | Phase 1 (01-04 review) |
| **P1** | Add `coordinateSystem` metadata to `CanonicalScene` for explicit declaration | Phase 1 (if schema not yet locked) |
| **None** | Axis conversion math is adapter-level, not contract-level | v4.0 |

---

## 2. Entity-to-Engine-Node Mapping

### The One-to-Many Problem (Godot)

The most architecturally significant finding. Godot uses **node-type inheritance** instead of components:

```
Riff3D Entity:                    Godot Scene Tree:
"player" {                        CharacterBody3D
  MeshRenderer: {...}       →       ├── CollisionShape3D
  CharacterController: {...}        ├── MeshInstance3D
  Collider: {...}                   └── Camera3D
}
```

One IR entity becomes a subtree of 3-4 nodes. This is NOT unique to Godot — Babylon.js already creates different node types (TransformNode vs Mesh) depending on components. Godot just makes it extreme.

**UE5 has a similar pattern:** An Actor contains a component tree (RootComponent → child SceneComponents). A single IR entity with offset mesh rendering would need to become an Actor with a StaticMeshComponent at a local offset.

### Contract Implication

The `EngineAdapter` interface should NOT assume 1:1 entity-to-node mapping. The current interface:

```typescript
mapComponent(component: CanonicalComponent, node: CanonicalNode): RuntimeComponent;
```

Should be generalized (or documented) to allow adapters to create subtrees:

```typescript
// Adapter receives full entity context, returns whatever engine structure it needs
mapEntity(node: CanonicalNode): RuntimeNode; // RuntimeNode may be a tree
```

**No IR schema change needed.** The IR remains flat entities with component bags. Adapters handle decomposition. This is already implicitly true but should be documented as a formal contract property.

---

## 3. Physics Model Compatibility

### Universal Pattern: Separate Body + Shape

Nearly all engines use separate concepts for physics body and collision shape, validating the IR's `RigidBody` + `Collider` separation:

| Engine | Body | Shape | Separation |
|--------|------|-------|------------|
| PlayCanvas | `rigidbody` component | `collision` component | Separate |
| Babylon.js | `PhysicsAggregate` | Part of aggregate | Combined (adapter splits) |
| Unity | `Rigidbody` | `BoxCollider`, etc. | Separate |
| Unreal | `BodyInstance` on mesh | Mesh collision or separate | Combined |
| Godot | `RigidBody3D` node | `CollisionShape3D` child node | Separate (parent-child) |
| Bevy | `RigidBody` component | `Collider` component | Separate |

### Portable Shape Subset

All physics engines support: **Box, Sphere, Capsule, Convex Hull, Triangle Mesh, Compound**

The IR's current shape types (`box`, `sphere`, `capsule`, `cylinder`, `cone`, `mesh`) are mostly portable:
- `cylinder` — Not natively supported in PhysX (Unity default). Adapter uses convex hull approximation.
- `cone` — Same limitation. Adapter uses convex hull or mesh collider.
- These are acceptable — they're in the IR's shape enum and adapters handle the approximation.

### Joints/Constraints — High Variance

5 universally portable joint types: **Fixed, Ball/Socket, Hinge, Slider/Prismatic, Spring/Distance**

More exotic joints (Gear, Rack-and-Pinion, D6/6DOF) vary significantly. The IR's current portable subset correctly excludes joints — they should remain in engine tuning until the 2-template rule promotes them.

### Trigger Volumes

Universal concept but implemented differently:
- PlayCanvas/Babylon: Collider with `isTrigger: true`
- Godot: Completely different node type (`Area3D` vs `RigidBody3D`)
- Unity: Collider with `isTrigger` checkbox

The IR's `Collider.isTrigger: boolean` works for most engines. **Godot is the outlier** — the adapter would need to detect `isTrigger` and create an `Area3D` instead of attaching to a physics body. This is an adapter concern.

### Action Items

| Priority | Action | Phase |
|----------|--------|-------|
| **None** | Current `RigidBody` + `Collider` separation is validated | -- |
| **P2** | Document physics units (meters, kg) in IR spec | Phase 1 (01-04 review) |
| **None** | Joints are correctly excluded from portable subset | -- |

---

## 4. Material/PBR Portability

### Metallic-Roughness is Universal

Every engine supports metallic-roughness PBR. The IR's glTF-aligned model is correct:

| IR Property | PlayCanvas | Babylon.js | Unity | Unreal | Godot |
|-------------|-----------|-----------|-------|--------|-------|
| baseColor | diffuse | albedoColor | _BaseColor | Base Color | albedo_color |
| metallic | metalness | metallic | _Metallic | Metallic | metallic |
| roughness | gloss (inverted!) | roughness | _Smoothness (inverted!) | Roughness | roughness |
| emissive | emissive | emissiveColor | _EmissionColor | Emissive Color | emission |

**Critical: Roughness vs Smoothness.** Unity and PlayCanvas (partially) use the inverse. The adapter MUST convert: `smoothness = 1.0 - roughness`. This should be a conformance test.

### Normal Map Y-Channel Split

| Convention | Engines |
|-----------|---------|
| **OpenGL (Y+)** | glTF, Unity, Godot, Three.js, PlayCanvas |
| **DirectX (Y-)** | Unreal, Babylon.js |

The IR should store normal maps in **OpenGL/glTF convention** (Y+ = green channel up). Adapters for DirectX-convention engines invert the green channel. This is a single-line shader or texture processing step.

### Light Intensity Units

| Engine | Unit |
|--------|------|
| PlayCanvas | Arbitrary scalar |
| Babylon.js | Arbitrary scalar |
| Unity | Mixed (lux for directional, lumens for point/spot) |
| Unreal | Physical units (candela, lumens, lux) |
| Godot | Energy (arbitrary scalar) |

The IR currently stores `intensity: number` without specifying units.

### Action Items

| Priority | Action | Phase |
|----------|--------|-------|
| **P0** | Add conformance test for roughness round-trip (verify not accidentally inverted) | Phase 1 (01-06) |
| **P1** | Document normal map convention (OpenGL Y+) in IR spec | Phase 1 |
| **P2** | Consider optional `intensityUnit` on Light component for future UE5 support | Phase 4 or later |
| **P2** | Consider optional `specular: number` (default 0.5) on Material for UE5 round-trip | Phase 4 or later |

---

## 5. Prefab/Template Systems

### The Pattern

Multiple engines have template/prefab systems with override chains:

| Engine | System | Override Model |
|--------|--------|---------------|
| Unity | Prefab Variants | PropertyModification list (path + value) |
| Unreal | Blueprint Classes | Class inheritance + CDO delta |
| Godot | Scene Inheritance | Inherited scene + property overrides |
| O3DE | Prefab System | JSON Patch-like path overrides |

### Contract Implication

The Canonical IR is **fully materialized** — no templates, no overrides, no inheritance chains. This is correct and intentional:

- The IR represents a resolved scene, not an authoring format
- Template relationships are an ECSON-level concern, not an IR concern
- Ejection pipelines can optionally reconstruct prefab relationships by detecting shared patterns

**One ECSON-level consideration for future phases:** Adding `prefabAssetId` and `prefabOverrides` to the Entity schema would enable better Unity/Godot ejection (reconstructing prefab instances instead of flattening everything). This is NOT needed in Phase 1 — it's a Phase 8 (ejection) concern.

### Action Items

| Priority | Action | Phase |
|----------|--------|-------|
| **None** | IR stays fully materialized — no change | -- |
| **P3** | Consider `prefabAssetId` on ECSON Entity for ejection fidelity | Phase 8 |

---

## 6. Event/Scripting Portability

### Event System Comparison

| Engine | Pattern | Wiring |
|--------|---------|--------|
| PlayCanvas | `fire()`/`on()`/`off()` | Code-based |
| Babylon.js | `Observable<T>` | Code-based |
| Unity | C# delegates/UnityEvent | Serialized in inspector |
| Godot | Signals with typed payloads | `.tscn` connections (scene-local) |
| Bevy | Typed `Event<T>` | System-based (not wired) |

The IR's event wiring model (`source + event → target + action`) maps to all of these. The main gap is **typed payloads** — Godot signals carry typed parameters (e.g., `body_entered(body: Node3D)`). The IR's `PortDescriptor` should consider supporting parameter schemas for future adapter fidelity.

### Behavior Compilation Validated

Defold's **closed component set** (only ~13 built-in types, no custom components) proves that behavior compilation is not just an optimization — it's a hard requirement for some engines. A `ScoreZone` component must compile to `TriggerVolume + Script` for Defold, to `Area3D + GDScript` for Godot, and to `Blueprint ActorComponent` for Unreal.

The IR's behavior compilation approach (high-level components → primitive IR components) is architecturally correct.

### Action Items

| Priority | Action | Phase |
|----------|--------|-------|
| **None** | Behavior compilation approach validated | -- |
| **P3** | Consider typed parameters on PortDescriptor | Phase 7 (event wiring) |

---

## 7. Ejection Architecture

### Export vs Ejection

Critical distinction surfaced by the research:

- **Export:** Produce a scene file that an engine imports (glTF, FBX, .babylon)
- **Ejection:** Produce a complete, runnable project with build config, scaffolding, generated scripts, and importable assets

The Phase 8 ejection to Vite is "ejection." Future engine targets would also need ejection, not just export.

### Key Ejection Findings

**Do NOT generate binary engine formats.** Unity `.uasset`, Unreal `.uasset`/`.umap`, and Godot `.res` (binary) are unstable across engine versions. Instead:
- **Unity:** Generate a project with glTF meshes, PNG textures, generated C# MonoBehaviour stubs, and a setup script
- **Unreal:** Generate a project with glTF meshes, PNG textures, generated C++ or Blueprint stubs
- **Godot:** Generate `.tscn` (text format, stable) + `.gd` scripts + `.tres` resources

**Godot's `.tscn` is the friendliest target** — human-readable text format, well-documented, stable across versions, and directly generatable.

### Adapter Interface Consideration

The current `EngineAdapter.eject()` method should support engine-specific project generation:

```typescript
eject(ir: CanonicalScene, options: EjectOptions): Promise<ProjectOutput>;
// ProjectOutput should be a directory structure, not a single file
```

### Action Items

| Priority | Action | Phase |
|----------|--------|-------|
| **P2** | Ensure ejection interface produces directory structures, not single files | Phase 8 |
| **None** | Binary format generation is an anti-pattern — document this | v4.0 |

---

## 8. Animation Portability

### What's Portable

glTF's keyframe animation model is effectively universal:
- Transform keyframes (position, rotation, scale) with STEP/LINEAR/CUBICSPLINE interpolation
- Morph target weights
- Property animation (simple scalar/vector values over time)

### What's NOT Portable

| Feature | Variance |
|---------|----------|
| Animation events/notifies | Unity: AnimationEvent, Unreal: AnimNotify, Godot: method call track — all different |
| Root motion | Engine-specific extraction and application |
| IK (Inverse Kinematics) | Completely engine-specific |
| State machines | Every engine has its own (AnimatorController, AnimBP, AnimationTree) |
| Bone naming | No standard (Mixamo, Unity Humanoid, VRM, UE Mannequin all differ) |
| Retargeting | Engine-specific |

### Godot-Specific Gotcha

Godot's AnimationPlayer uses `NodePath("Path/To/Node:property")` relative paths. Since one IR entity expands to multiple Godot nodes, the adapter must maintain entity-to-node mappings for animation targeting.

### Action Items

| Priority | Action | Phase |
|----------|--------|-------|
| **None** | Current Animation component (keyframes) is correct for portable subset | -- |
| **P3** | Animation state machines belong in engine tuning, not portable subset | Phase 7 |
| **P3** | Bone naming standardization is a v3+ concern | v3.1 |

---

## 9. Adapter LoC Budget Expectations

Based on the research, expected adapter complexity varies significantly by engine architecture:

| Target | Expected LoC | Complexity Driver |
|--------|-------------|-------------------|
| PlayCanvas | ~1000-1200 | Natural fit (similar ECS model) |
| Babylon.js | ~1000-1200 | Left-handed conversion, PhysicsAggregate mapping |
| Godot | ~1500-2000 | Node-type decomposition, script generation |
| Unity | ~1200-1500 | Left-handed conversion, MonoBehaviour generation |
| Unreal | ~1500-2000 | Z-up + left-handed + cm + Actor/Component tree |
| Bevy | ~800-1000 | Pure ECS is the most natural fit for flat entities |

**If any adapter exceeds 2000 LoC, the IR abstraction is leaking.** This remains the key health metric.

---

## 10. Summary: What Affects Phase 1 Contracts

### Act on Now (Phase 1)

These findings should be incorporated into Phase 1 plan reviews:

1. **Document IR coordinate conventions formally** — right-handed, Y-up, quaternion (x,y,z,w), counterclockwise winding. Not just implied, stated in code comments and conformance tests.

2. **Document that one IR entity may map to N engine nodes** — the adapter interface contract should not assume 1:1 mapping.

3. **Add roughness round-trip conformance test** — ensure no accidental inversion (multiple engines use smoothness = 1 - roughness).

4. **Document normal map convention** — OpenGL Y+ (matches glTF).

5. **Document physics units** — meters for distance, kg for mass (glTF convention).

### Consider for Phase 4+ (Not Blocking)

6. Optional `coordinateSystem` metadata on CanonicalScene
7. Optional `specular` field on Material (for UE5 round-trip fidelity)
8. Optional `intensityUnit` on Light component
9. Typed parameters on event PortDescriptors

### File for v4.0 (Do Not Act Now)

10. All coordinate conversion math (adapter-level)
11. Prefab reconstruction during ejection
12. Blueprint/GDScript/MonoBehaviour generation
13. Bone naming standardization
14. Animation state machines

---

## Detailed Research References

For deep dives into specific engines, see:
- **Godot:** `.planning/research/GODOT_ADAPTER_RESEARCH.md`
- **Cross-engine patterns:** `.planning/research/CROSS_ENGINE_PORTABILITY.md`
- **Babylon.js:** `.planning/research/BABYLON_ADVANCE_RESEARCH.md`
- **PlayCanvas/Babylon source analysis:** `.planning/research/ARCHITECTURE.md`
- **Unity/Unreal:** Findings embedded in this document (from task research outputs)

---

## Sources

### Engine-Specific
- Unity 6: Official docs, UnityGLTF source, community discussions on coordinate conversion
- Unreal 5.4-5.7: Official docs, Chaos physics, Substrate materials, World Partition, OFPA
- Godot 4.3-4.4: Official docs, .tscn format spec, Jolt physics integration, signal system
- Bevy 0.15-0.16: Required Components, scene format, bevy_reflect, ECS architecture
- Stride: Entity-Component model, SDSL shaders, YAML serialization
- O3DE: Component Entity System, prefab patches, Gem system
- Defold: Game Object/Collection model, fixed component types, Factory system

### Cross-Engine
- glTF 2.0 specification (coordinate system, PBR model, animation)
- KHR_interactivity draft (behavior graphs)
- Quaternion conventions comparison (clemense/quaternion-conventions)
- Normal map convention comparison (OpenGL vs DirectX Y-channel)
- Physics engine shape support (PhysX, Jolt, Rapier, Havok, Chaos, Bullet)
- USD/FBX/COLLADA portability lessons

---
*Future Engine Considerations — researched 2026-02-19*
*Consult at: Phase 1 review, Phase 4, Phase 8, v4.0*
