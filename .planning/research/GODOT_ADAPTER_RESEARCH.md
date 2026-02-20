# Godot 4.x Adapter Research — Contract-Level Gotchas for Canonical IR

**Domain:** Godot 4.3/4.4 engine architecture analysis for Riff3D portable scene format
**Researched:** 2026-02-19
**Confidence:** MEDIUM-HIGH — based on official Godot documentation, community forums, GitHub issues, and architecture articles. No direct source code analysis (unlike PlayCanvas/Babylon.js research).
**Purpose:** Identify contract-level gotchas that affect Canonical IR design and adapter interface, NOT implementation planning for a Godot adapter (that is v2+).

---

## Executive Summary

Godot 4.x presents the most architecturally divergent target of any engine Riff3D might support. PlayCanvas and Babylon.js are both JavaScript engines with flat-ish scene representations and some flavor of component/behavior composition. Godot is fundamentally different: it uses a **node-type inheritance hierarchy** where behavior is encoded in the node's CLASS, not in attached components. This means a Riff3D entity with `{MeshRenderer, RigidBody, Collider}` components doesn't map to "one node with three components" in Godot — it maps to a **subtree of 3-4 nodes**, each a different class. This is the single most important finding for IR design.

The good news: Godot's coordinate system (right-handed Y-up) and serialization format (.tscn) are well-aligned with the existing IR design. The bad news: Godot's node-as-type architecture, mandatory parent-child relationships for physics, signal-based event system, and resource model all create pressure on the Canonical IR that, if not anticipated now, would require breaking changes later.

**Key contract-level implications (act on these now):**

1. The Canonical IR's `Entity` concept must NOT assume 1:1 mapping to engine nodes. A single IR entity may become a subtree in Godot.
2. The `Collider` component being separate from `RigidBody` in the IR is correct — but the IR must allow multiple colliders per entity (Godot supports multiple CollisionShape3D children).
3. Animation tracks in the IR must use entity-relative paths, not engine node paths, since one IR entity may expand to multiple engine nodes.
4. The event wiring system maps well to Godot signals, but the IR must support the concept of "signal parameters" (Godot signals carry typed payloads).

---

## 1. Scene Tree Model

### How Godot Works

Godot's fundamental architectural unit is the **Node**. Everything is a node. Scenes ARE trees of nodes. A `.tscn` file is a serialized node tree. The critical concepts:

- **Node hierarchy IS the architecture.** There is no separate "entity" concept. A `MeshInstance3D` IS a node. A `RigidBody3D` IS a node. They live in a tree.
- **Scene instancing:** A saved scene (`.tscn`) becomes a `PackedScene` resource. You can instance it inside other scenes. The instanced scene appears as a subtree in the parent scene.
- **Scene inheritance:** You can create a scene that "extends" another scene. The child scene starts with all the base scene's nodes and can override properties or add new children. In the `.tscn` file, this appears as `instance=ExtResource(id)` on the root node pointing to the base scene.

### Mapping Flat Entity Map to Godot Scene Tree

Riff3D's `Record<string, Entity>` with `parentId` references maps to Godot's tree like this:

```
Riff3D ECSON (flat):                     Godot Scene Tree:

entities: {                              World (Node3D)
  "root": { parentId: null },            ├── Player (CharacterBody3D)
  "player": { parentId: "root",          │   ├── CollisionShape3D
    components: {                         │   ├── MeshInstance3D
      MeshRenderer: {...},                │   │   └── [mesh resource]
      CharacterController: {...},         │   └── Camera3D
      Collider: {...}                     ├── Platform (StaticBody3D)
    }                                     │   ├── CollisionShape3D
  },                                      │   └── MeshInstance3D
  "camera": { parentId: "player" },       └── Light (DirectionalLight3D)
  "platform": { parentId: "root",
    components: {
      MeshRenderer: {...},
      RigidBody: { type: "static" },
      Collider: {...}
    }
  },
  "light": { parentId: "root",
    components: { Light: {...} }
  }
}
```

**Critical observation:** A single Riff3D entity (e.g., "player") with components `{MeshRenderer, CharacterController, Collider}` becomes a **subtree** in Godot:
- `CharacterBody3D` (root of the subtree — the physics body node type)
- `CollisionShape3D` (direct child — required for physics)
- `MeshInstance3D` (direct child — for rendering)

This is NOT a 1:1 entity-to-node mapping. The adapter must **decompose** a single IR entity into multiple Godot nodes.

### Scene Inheritance

Godot's inherited scenes are analogous to "prefab variants" in Unity. The `.tscn` header changes from `[gd_scene ...]` to referencing a base scene, and only overridden properties are stored. This maps loosely to Riff3D's template/preset concept but is more powerful (full OOP-style inheritance of node trees). For ejection, the adapter would likely use scene instancing (not inheritance) for spawned entities and inheritance for variant entities.

### Contract Implications

- **IR entity MUST NOT assume 1:1 mapping to engine scene nodes.** The adapter contract should express: "one IR entity may produce N engine nodes." This is already implicitly true (Babylon.js creates separate TransformNode vs Mesh depending on components), but Godot makes it extreme.
- **Parent-child in IR is semantic, not structural.** IR `parentId` means "this entity's transform is relative to that entity." In Godot, the adapter inserts intermediate nodes (CollisionShape3D, etc.) that don't correspond to any IR entity.
- **Consider adding an `adapter.nodeCount(entity)` or similar introspection** to the adapter interface, so conformance tests can verify structural expectations.

---

## 2. Coordinate System

### Confirmed: Right-Handed Y-Up

Godot 4 uses a **right-handed coordinate system with Y-up**, same as glTF and web engines (PlayCanvas, Babylon.js). Cross product of +X and +Y yields +Z. This is aligned with the existing Canonical IR design.

### Subtlety: Forward Direction Mismatch

**This is a real gotcha.** While the coordinate system matches, the **forward direction convention** does not:

| System | Forward Direction | Up | Right |
|--------|-------------------|-----|-------|
| **glTF spec** | **+Z** | +Y | +X |
| **PlayCanvas** | **-Z** | +Y | +X |
| **Babylon.js** | **+Z** (in left-handed mode) or **-Z** | +Y | +X |
| **Godot 4** | **-Z** | +Y | +X |

Godot defines `Vector3.FORWARD = Vector3(0, 0, -1)`. The glTF spec defines the front of an asset as facing +Z. This means:

- **glTF models imported into Godot face backwards** by default. The front of the model (+Z in glTF) points in Godot's backward direction (+Z in Godot).
- Godot's `look_at()` function orients objects so their -Z axis points at the target.
- This is a known long-standing issue documented in [godot-proposals #6198](https://github.com/godotengine/godot-proposals/issues/6198).

### Contract Implications

- **The Canonical IR should explicitly specify forward direction convention.** Current IR says "glTF-aligned" — but glTF's +Z forward and Godot/PlayCanvas's -Z forward are at odds. The IR should pick one and document it. Recommendation: adopt **-Z forward** (matches PlayCanvas and Godot) and note that glTF assets may need a 180-degree Y rotation on import.
- **Rotation values in the IR are coordinate-system-independent** (Euler angles + quaternions), so the coordinate system itself is fine. But any **directional defaults** (e.g., "a spotlight points forward") need the forward convention documented.
- **This does NOT affect PlayCanvas or Babylon.js adapters today** since they handle glTF import internally, but a Godot adapter would need to apply the 180-degree correction on glTF mesh import.

---

## 3. Node Types vs Components

### The Fundamental Architecture Difference

Godot does not have an ECS or component system. Instead, **the node's CLASS determines its behavior**:

```
Node (base)
└── Node3D (has transform)
    ├── MeshInstance3D (renders a mesh)
    ├── Camera3D (is a camera)
    ├── Light3D
    │   ├── DirectionalLight3D
    │   ├── OmniLight3D (point light)
    │   └── SpotLight3D
    ├── PhysicsBody3D
    │   ├── StaticBody3D
    │   ├── RigidBody3D
    │   ├── CharacterBody3D
    │   └── AnimatableBody3D
    ├── Area3D (trigger volume)
    ├── CollisionShape3D (collision geometry)
    ├── AudioStreamPlayer3D
    ├── NavigationAgent3D
    └── ... many more
```

In PlayCanvas: `entity.addComponent('render', { type: 'box' })` adds rendering.
In Godot: the node IS a `MeshInstance3D`. You can't "add rendering" to a `RigidBody3D` — you add a `MeshInstance3D` as a **child node**.

### Mapping Table: Riff3D Components to Godot Node Types

| Riff3D IR Component | PlayCanvas | Babylon.js | Godot 4 |
|---------------------|-----------|-----------|---------|
| **Entity (empty)** | `pc.Entity` | `TransformNode` | `Node3D` |
| **MeshRenderer** | `render` component | `Mesh` class | `MeshInstance3D` child node |
| **Light (directional)** | `light` component | `DirectionalLight` | `DirectionalLight3D` node (IS the entity) |
| **Light (point)** | `light` component | `PointLight` | `OmniLight3D` node |
| **Light (spot)** | `light` component | `SpotLight` | `SpotLight3D` node |
| **Camera** | `camera` component | `FreeCamera` / `ArcRotateCamera` | `Camera3D` node |
| **RigidBody (dynamic)** | `rigidbody` component | `PhysicsAggregate` | `RigidBody3D` node (entity root changes type!) |
| **RigidBody (static)** | `rigidbody` component | `PhysicsAggregate` | `StaticBody3D` node |
| **RigidBody (kinematic)** | `rigidbody` component | `PhysicsAggregate` | `AnimatableBody3D` node |
| **CharacterController** | custom script | custom behavior | `CharacterBody3D` node |
| **Collider** | `collision` component | `PhysicsShape` | `CollisionShape3D` child node |
| **AudioSource** | `sound` component | `Sound` | `AudioStreamPlayer3D` node |
| **TriggerVolume** | collision + script | `PhysicsAggregate` sensor | `Area3D` node + `CollisionShape3D` child |
| **Script/Behavior** | `script` component | `Behavior<T>` | GDScript attached via `script` property |

### The "Entity Root Type" Problem

In PlayCanvas/Babylon.js, every entity starts as the same base type and gets components added. In Godot, the **root node of the subtree** must be the right TYPE:

- Entity with only `MeshRenderer` → root is `MeshInstance3D`
- Entity with `RigidBody (dynamic)` + `MeshRenderer` + `Collider` → root is `RigidBody3D`, with `MeshInstance3D` and `CollisionShape3D` as children
- Entity with `Light` → root IS `DirectionalLight3D` (no children needed)
- Entity with `CharacterController` + `MeshRenderer` + `Collider` → root is `CharacterBody3D`

**Priority rules the adapter must implement:**
1. If entity has `CharacterController` → root = `CharacterBody3D`
2. If entity has `RigidBody` → root = `RigidBody3D` / `StaticBody3D` / `AnimatableBody3D` (based on type)
3. If entity has `TriggerVolume` (Area) → root = `Area3D`
4. If entity has only `Light` → root = specific light type node
5. If entity has only `Camera` → root = `Camera3D`
6. If entity has only `MeshRenderer` → root = `MeshInstance3D`
7. Default → root = `Node3D`

### Contract Implications

- **The Canonical IR component model is correct as-is for web engines**, but Godot reveals that the IR's component composition semantics must be explicitly defined: "these components can coexist on one entity" vs "these are mutually exclusive." Currently implicit.
- **The `mapComponent()` method in the adapter interface is insufficient for Godot.** A Godot adapter needs a `mapEntity(entity: CanonicalNode): GodotNodeTree` that returns a subtree, not a `mapComponent()` that returns one thing per component.
- **Consider adding `mapEntity()` to the adapter interface** alongside `mapComponent()`, or generalizing `mapComponent()` to return a tree structure.
- **The component priority/exclusivity rules above should be documented in the IR spec** as "component combination semantics" even if web adapters don't strictly need them.

---

## 4. Resource System

### How Godot Resources Work

Everything reusable in Godot is a `Resource`: materials, meshes, textures, shaders, scripts, audio, fonts, animations, even custom data classes. Resources are:

- **Reference-counted** — shared across nodes, freed when no references remain
- **Saved as files:** `.tres` (text format, human-readable) or `.res` (binary format, faster to load)
- **Referenced by path:** `res://materials/red.tres` or by UID: `uid://c4cp0al3ljsjv`
- **Embeddable:** Resources can be embedded inline within `.tscn` files as `[sub_resource]` entries, or stored externally as `[ext_resource]` references

### Resource File Format (.tres)

A `.tres` file is structurally similar to `.tscn`:

```
[gd_resource type="StandardMaterial3D" format=3 uid="uid://c4cp0al3ljsjv"]

[resource]
albedo_color = Color(1, 0, 0, 1)
metallic = 0.5
roughness = 0.3
```

### How Resources Are Referenced in Scenes

In a `.tscn` file, resources appear in two ways:

**External (separate file):**
```
[ext_resource type="Material" uid="uid://c4cp0al3ljsjv" path="res://material.tres" id="1_7bt6s"]

[node name="Mesh" type="MeshInstance3D"]
material_override = ExtResource("1_7bt6s")
```

**Internal (embedded in scene):**
```
[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_k54se"]
albedo_color = Color(1, 0.639216, 0.309804, 1)

[node name="Mesh" type="MeshInstance3D"]
material_override = SubResource("StandardMaterial3D_k54se")
```

### Mapping to Riff3D Asset Registry

| Riff3D Asset Registry | Godot Resource System |
|-----------------------|-----------------------|
| Asset ID (nanoid) | Resource UID (`uid://...`) or path (`res://...`) |
| Material asset | `StandardMaterial3D` or `ShaderMaterial` resource |
| Mesh asset (primitive) | `BoxMesh`, `SphereMesh`, etc. (built-in Resource types) |
| Mesh asset (imported) | `.glb` / `.obj` imported as `Mesh` resource |
| Texture asset | `ImageTexture` / `CompressedTexture2D` resource |
| Audio clip | `AudioStream` resource |
| Script/behavior | `GDScript` / `CSharpScript` resource |
| Animation clip | `Animation` resource in an `AnimationLibrary` |

### Contract Implications

- **The Canonical IR's separate asset registry maps cleanly to Godot's resource system.** Both use ID-based references from scene nodes to shared assets. This is well-aligned.
- **Godot UIDs (`uid://...`) are globally unique, path-independent identifiers** — similar to Riff3D's nanoid-based asset IDs. The adapter would maintain a mapping table: IR asset ID -> Godot UID.
- **Embedded vs external resources:** For ejection, the adapter should prefer external `.tres` files (better for version control, matches Riff3D's explicit asset registry). Embedded `[sub_resource]` entries should be used only for trivial/unique resources.
- **Godot primitive meshes are Resources, not constructor calls.** Unlike Babylon.js (`MeshBuilder.CreateBox()`) or PlayCanvas (`{ type: 'box' }`), Godot's approach is `mesh = BoxMesh.new()` which is then assigned as a resource to `MeshInstance3D.mesh`. The IR's primitive mesh representation should be abstract enough for both approaches.

---

## 5. GDScript / GDExtension

### Script Attachment

In Godot, scripts attach to nodes via the `script` property:

**In .tscn:**
```
[ext_resource type="Script" path="res://player.gd" id="1_ig7tw"]

[node name="Player" type="CharacterBody3D"]
script = ExtResource("1_ig7tw")
```

**At runtime:**
```gdscript
var script = load("res://player.gd")
node.set_script(script)
```

A script "extends" the node type it's attached to:
```gdscript
# player.gd
extends CharacterBody3D

@export var speed: float = 5.0
@export var jump_velocity: float = 4.5

func _physics_process(delta):
    # movement logic
```

### GDExtension (Native Bindings)

GDExtension allows C++, Rust, or C# code to define new node types:

**Rust (gdext):**
```rust
#[derive(GodotClass)]
#[class(base=CharacterBody3D)]
struct Player {
    base: Base<CharacterBody3D>,
    #[export] speed: f32,
    #[export] jump_velocity: f32,
}
```

**C# (built-in):**
```csharp
public partial class Player : CharacterBody3D {
    [Export] public float Speed = 5.0f;
    [Export] public float JumpVelocity = 4.5f;
}
```

### What "Ejecting" a Behavior Component Looks Like

A Riff3D `BehaviorComponent` (e.g., ScoreZone with properties `{points: 10, resetOnScore: true}`) would eject to Godot as:

1. **An Area3D node** (for the trigger volume)
2. **A CollisionShape3D child** (for the trigger shape)
3. **A GDScript attached to the Area3D:**

```gdscript
# score_zone.gd
extends Area3D

@export var points: int = 10
@export var reset_on_score: bool = true

signal scored(body: Node3D, points: int)

func _on_body_entered(body: Node3D):
    if body.is_in_group("player"):
        scored.emit(body, points)
        if reset_on_score:
            # reset logic
```

### Contract Implications

- **The BehaviorComponent in the IR needs per-engine ejection templates**, as already planned. For Godot, the template generates a `.gd` script file + wires it via the `script` property on the appropriate node.
- **Godot's `@export` annotations map to the IR's PropertySchema.** `@export var speed: float = 5.0` corresponds to `{ name: "speed", type: "number", default: 5.0 }`. The adapter can auto-generate `@export` annotations from IR property schemas.
- **GDScript is dynamically typed but has optional type hints.** The adapter should generate typed GDScript (with `: float`, `: int`, etc.) from the IR's property types.
- **GDExtension (Rust/C++) is an alternative ejection target** for performance-critical behaviors, but GDScript should be the default ejection language (lowest barrier, most Godot-native).

---

## 6. Physics

### Godot's Physics Node Hierarchy

Godot 4.4 has Jolt physics built-in as a module (no longer a separate extension). The physics system uses NODE TYPES:

```
PhysicsBody3D (abstract)
├── StaticBody3D      — immovable (walls, floors)
├── RigidBody3D       — fully simulated dynamics
├── CharacterBody3D   — player-controlled with move_and_slide()
└── AnimatableBody3D  — script-driven movement that affects others

Area3D — trigger volume (overlaps, not collisions)

CollisionShape3D — defines collision geometry (MUST be direct child of a physics body or Area3D)
CollisionPolygon3D — 2D polygon extruded for 3D collision
```

### The Mandatory Parent-Child Requirement

**This is critical:** `CollisionShape3D` nodes MUST be **direct children** of a physics body node. Indirect children (children of children) are silently ignored. This means:

```
# WORKS:
RigidBody3D
├── CollisionShape3D   ← detected
└── MeshInstance3D

# DOES NOT WORK:
RigidBody3D
└── Node3D
    └── CollisionShape3D   ← SILENTLY IGNORED
```

### Mapping a Single IR Entity

A Riff3D entity with `{RigidBody(dynamic), Collider(box), MeshRenderer(box)}` maps to:

```
RigidBody3D                          ← from RigidBody component
├── CollisionShape3D                 ← from Collider component
│   └── shape = BoxShape3D resource  ← collider geometry
└── MeshInstance3D                   ← from MeshRenderer component
    └── mesh = BoxMesh resource      ← visual geometry
```

### Multiple Colliders

Godot supports multiple `CollisionShape3D` children on a single physics body (compound shapes). A Riff3D entity with multiple `Collider` components would map to multiple `CollisionShape3D` children. **However:** having multiple collision shapes on a RigidBody3D disables continuous collision detection (CCD), which can cause tunneling. This is a Godot/Jolt-specific behavioral difference.

### Area3D vs PhysicsBody3D

The IR's `TriggerVolume` component (if separate from `Collider`) maps to `Area3D` + `CollisionShape3D`, NOT to a `RigidBody3D` with a sensor flag. Godot uses entirely different node types for trigger volumes vs physics bodies.

**Key Jolt-specific gotcha:** With Jolt physics (default in 4.4), Area3D will NOT detect overlaps with StaticBody3D by default. This is a performance optimization. You must enable `physics/jolt_physics_3d/simulation/areas_detect_static_bodies` in project settings.

### Contract Implications

- **The IR's separate `RigidBody` + `Collider` components are correct.** They map to separate nodes in Godot (parent body + child collision shape).
- **The IR should support multiple `Collider` components per entity** (array of colliders, not a single one). Godot naturally supports this, and PlayCanvas also supports multiple collision components.
- **The IR should distinguish `TriggerVolume` from `Collider` at the type level.** In PlayCanvas, a trigger is a collision component with `trigger: true`. In Babylon.js, it's a PhysicsAggregate with sensor. In Godot, it's an entirely different node type (`Area3D` vs `PhysicsBody3D`). If the IR treats them identically, adapters need unreliable heuristics.
- **Physics behavioral differences (CCD, Area3D detection) should be documented as adapter-specific tolerance notes**, not encoded in the IR.

---

## 7. Scene Serialization (.tscn Format)

### Complete .tscn Structure

A Godot 4 `.tscn` file has four sections, in order:

```
# 1. File descriptor (header)
[gd_scene load_steps=4 format=3 uid="uid://cecaux1sm7mo0"]

# 2. External resources (references to other files)
[ext_resource type="Script" path="res://player.gd" id="1_ig7tw"]
[ext_resource type="PackedScene" uid="uid://7dqtlcu57oiv" path="res://weapon.tscn" id="2_abc12"]

# 3. Internal resources (embedded data)
[sub_resource type="SphereShape3D" id="SphereShape3D_tj6p1"]

[sub_resource type="SphereMesh" id="SphereMesh_4w3ye"]

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_k54se"]
albedo_color = Color(1, 0.639216, 0.309804, 1)

# 4. Nodes (the scene tree)
[node name="Ball" type="RigidBody3D"]
script = ExtResource("1_ig7tw")
mass = 2.0

[node name="CollisionShape" type="CollisionShape3D" parent="."]
shape = SubResource("SphereShape3D_tj6p1")

[node name="Mesh" type="MeshInstance3D" parent="."]
mesh = SubResource("SphereMesh_4w3ye")
surface_material_override/0 = SubResource("StandardMaterial3D_k54se")

[node name="Camera" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 5)

# 5. Scene instances (instanced child scenes)
[node name="Weapon" parent="." instance=ExtResource("2_abc12")]

# 6. Signal connections
[connection signal="body_entered" from="." to="." method="_on_body_entered"]
```

### Key Format Details

- **`parent` attribute**: Uses `.` for direct children of root, `Parent/Child` for deeper nesting. The root node has no parent attribute.
- **`instance` attribute**: References an `ext_resource` of type `PackedScene`. The instanced scene's internal nodes become children.
- **Properties**: Listed as `key = value` below the `[node]` header. Only non-default values are stored.
- **Transforms**: Stored as `Transform3D(bx, by, bz, rx, ry, rz, fx, fy, fz, ox, oy, oz)` — a 3x4 matrix (basis + origin). Alternatively, individual `position`, `rotation`, `scale` properties.
- **Resource IDs**: String-based in Godot 4 (e.g., `"1_7bt6s"`, `"SphereShape3D_tj6p1"`), not integers.
- **UIDs**: Global unique identifiers (`uid://...`) for cross-file references that survive file renames.

### Connection Format

Signal connections at the end of the file:
```
[connection signal="body_entered" from="PlayerDetection" to="." method="_on_player_detection_body_entered"]
[connection signal="pressed" from="UI/StartButton" to="." method="_on_start_button_pressed"]
```

Fields: `signal` (signal name), `from` (source node path), `to` (target node path), `method` (callback method name). Optional: `flags` (connection flags), `binds` (bound arguments).

### Contract Implications for Ejection

- **The .tscn format is human-readable and line-oriented** — excellent for version control and code generation. A Godot ejection adapter can generate .tscn files as text (no binary serialization needed).
- **The ejection output structure** for a Godot project would be:
  ```
  project.godot          # project settings
  scenes/
  ├── main.tscn          # root scene (from IR scene root)
  ├── player.tscn        # entity scenes (for complex entities)
  └── ...
  scripts/
  ├── player.gd          # behavior scripts
  └── score_zone.gd
  resources/
  ├── red_material.tres  # material resources
  └── ...
  assets/
  ├── model.glb          # imported 3D assets
  └── ...
  ```
- **The `EjectOptions` in the adapter interface should include a `format` field** to distinguish between "export as engine project" (Godot project structure) vs "export as scene file" (single .tscn).
- **Transform serialization**: The IR stores Euler + Quaternion. Godot's .tscn uses `Transform3D` (a 3x4 matrix). The adapter must convert. This is straightforward math but must be tested for round-trip fidelity.

---

## 8. Signal System

### How Signals Work

Signals are Godot's event system, based on the Observer pattern:

**Declaring signals (in GDScript):**
```gdscript
signal health_changed(new_health: int)
signal died
signal scored(body: Node3D, points: int)
```

**Emitting signals:**
```gdscript
health_changed.emit(current_health)
died.emit()
scored.emit(body, points)
```

**Connecting signals:**
```gdscript
# In code (runtime)
player.health_changed.connect(_on_health_changed)
score_zone.scored.connect(_on_scored)

# In .tscn (editor-time, serialized)
[connection signal="body_entered" from="ScoreZone" to="." method="_on_score_zone_body_entered"]
```

### Built-in Signals

Every node type has built-in signals:
- `Node`: `ready`, `tree_entered`, `tree_exited`
- `Area3D`: `body_entered`, `body_exited`, `area_entered`, `area_exited`
- `RigidBody3D`: `body_entered`, `body_exited`
- `Button`: `pressed`
- `Timer`: `timeout`

### Cross-Scene Signal Wiring

Signals between nodes in different scenes require one of:
1. **Direct reference via code:** The parent scene connects signals when instancing child scenes
2. **Event Bus / Autoload pattern:** A singleton script (Autoload) that holds globally-accessible signals, allowing any node to emit or connect without direct references
3. **Group-based dispatch:** Call methods on all nodes in a named group

The `.tscn` `[connection]` entries can only wire signals between nodes **within the same scene file**. Cross-scene connections must be done in code.

### Mapping to Riff3D Event Wiring

Riff3D's event wiring format:
```typescript
interface EventWire {
  id: string;
  source: { entityId: string; event: string };
  target: { entityId: string; action: string };
  parameters?: Record<string, unknown>;
}
```

This maps to Godot signals:
| Riff3D Event Wiring | Godot Signals |
|---------------------|---------------|
| `source.entityId` | `from` node path |
| `source.event` | `signal` name |
| `target.entityId` | `to` node path |
| `target.action` | `method` name |
| `parameters` | `binds` (partial — Godot binds are positional, not named) |

### Contract Implications

- **The EventWire format maps well to Godot signals.** The source-event-target-action pattern is a natural fit.
- **Godot signals carry typed payloads** (e.g., `body_entered(body: Node3D)`). The IR's event wiring should support **event parameter schemas** — what data does the event carry? Currently the IR has `parameters?: Record<string, unknown>` on the wire, but this is for static binds, not the dynamic payload.
- **Consider adding `eventSchema` to the component's event port descriptor:** `{ name: "body_entered", parameters: [{ name: "body", type: "entity-ref" }] }`. This already exists conceptually in the `PortDescriptor` but should be formalized.
- **Cross-scene wiring limitation:** Godot's `.tscn` connection entries only work within one scene. For ejection of cross-entity-tree event wires, the adapter must generate Autoload scripts or code-based connections. The IR should flag which wires are "local" (same scene) vs "global" (cross-scene).

---

## 9. Animation

### AnimationPlayer and AnimationTree

Godot's animation system is node-based (like everything else):

**AnimationPlayer node:**
- Placed as a child of the node tree it animates
- Contains `AnimationLibrary` resources, which contain `Animation` resources
- Each `Animation` has tracks that reference nodes by `NodePath`
- Track format: `NodePath("Path/To/Node:property")` — e.g., `NodePath("Mesh:position")`, `NodePath(".:rotation")`

**AnimationTree node:**
- Advanced animation blending and state machines
- Since Godot 4.2, inherits from `AnimationMixer` (shared base with `AnimationPlayer`)
- Can manage its own `AnimationLibrary` without needing a separate `AnimationPlayer`
- Supports blend trees, state machines, transitions

### Animation Tracks

Track types:
- **Property tracks**: Animate any node property (`position`, `rotation`, `scale`, `modulate`, custom properties)
- **Method call tracks**: Call methods on nodes at specific keyframe times
- **Bezier tracks**: Smooth curve-based animation for single float values
- **Audio tracks**: Trigger audio playback
- **Animation playback tracks**: Trigger other animations

### Critical Detail: NodePath References

Animation tracks reference target nodes using **relative NodePaths from the AnimationPlayer's root node**, NOT from the AnimationPlayer itself:

```
Character (Node3D) ← AnimationPlayer root
├── AnimationPlayer
├── Body (MeshInstance3D)
│   └── Head (MeshInstance3D)
└── CollisionShape3D

# Track paths:
# "Body:position" — animates Body's position
# "Body/Head:rotation" — animates Head's rotation
# ".:scale" — animates the root node's scale
```

### Mapping to Riff3D Animation

Riff3D's animation model (from the IR) uses component-relative paths:
```typescript
interface AnimationTrack {
  targetEntityId: string;
  propertyPath: string;  // e.g., "transform.position", "components.light.intensity"
  keyframes: Keyframe[];
}
```

The mapping challenge: **one IR entity may be multiple Godot nodes.** If the IR says "animate entity X's transform.position", which Godot node gets animated? The root of the subtree (the physics body)? The mesh child?

### Contract Implications

- **Animation tracks in the IR must use entity-level semantics**, not engine node paths. `targetEntityId` + `propertyPath` is correct. The adapter resolves which engine node(s) to animate.
- **The adapter must maintain a mapping:** IR entity ID -> Godot root node path. Animation tracks targeting an entity are resolved to the appropriate Godot node path.
- **Problem case: animating a component-specific property.** If the IR says "animate entity X, component MeshRenderer, property `color`", the Godot adapter must know that `MeshRenderer` maps to a child `MeshInstance3D` node and target that node's material property. This requires the adapter to maintain per-component node mappings, not just per-entity.
- **Method call tracks and audio tracks** in Godot have no direct equivalent in the IR's property-animation model. The IR should either (a) support "event tracks" (trigger actions at keyframe times) or (b) document that these are ejection-only features generated from behavior compilation.
- **AnimationTree (state machines, blending):** The IR's animation model should eventually support animation states and transitions, not just individual clips. This is a v2+ concern but the IR should not preclude it. Consider: `AnimationStateGraph` as a future IR concept.

---

## Cross-Cutting Gotcha Summary

### Things That Affect IR Design NOW (Phase 1)

| # | Gotcha | IR Impact | Severity |
|---|--------|-----------|----------|
| 1 | **Entity =/= Node** (one IR entity = N Godot nodes) | `mapEntity()` method needed in adapter interface; IR docs must state 1:N mapping is expected | HIGH |
| 2 | **Forward direction convention** (-Z vs +Z) | IR spec must explicitly declare forward direction; recommend -Z | MEDIUM |
| 3 | **Multiple colliders per entity** | IR must support array of colliders, not just one | MEDIUM |
| 4 | **TriggerVolume vs Collider distinction** | Keep as separate component types in IR, not a boolean flag | MEDIUM |
| 5 | **Event parameter schemas** | Add typed parameter schemas to event port descriptors | LOW |

### Things That Affect Adapter Interface NOW (Phase 1)

| # | Gotcha | Adapter Impact | Severity |
|---|--------|----------------|----------|
| 1 | **Node-type selection logic** | Adapter needs `mapEntity()` returning a node tree, not just `mapComponent()` | HIGH |
| 2 | **Animation node path resolution** | Adapter must maintain entity-to-node-subtree mapping for animation targeting | MEDIUM |
| 3 | **Transform serialization** | Godot uses Transform3D (3x4 matrix); adapter must convert from Euler/Quat | LOW |

### Things That Affect Ejection Design (Future)

| # | Gotcha | Ejection Impact | Severity |
|---|--------|-----------------|----------|
| 1 | **.tscn generation** | Text format, straightforward to generate | LOW |
| 2 | **Script generation** | GDScript from BehaviorComponent property schemas | MEDIUM |
| 3 | **Cross-scene signal wiring** | Needs Autoload pattern for global event wires | MEDIUM |
| 4 | **Resource file generation** | .tres files for materials, meshes | LOW |
| 5 | **Scene instancing vs inheritance** | Spawned entities → instancing; variants → inheritance | LOW |
| 6 | **project.godot generation** | Physics settings (Jolt Area3D detection), input maps | MEDIUM |
| 7 | **Jolt-specific physics settings** | Area3D + StaticBody3D detection disabled by default | LOW |

---

## Comparison: Architectural Divergence Across Targets

| Dimension | PlayCanvas | Babylon.js | Godot 4 |
|-----------|-----------|-----------|---------|
| **Entity model** | Uniform Entity + components | Class hierarchy (TransformNode/Mesh/Light) | Node type IS behavior |
| **1 IR Entity =** | 1 Entity | 1-2 Nodes (TransformNode vs Mesh) | 1-4+ Nodes (subtree) |
| **Component attachment** | `addComponent(type, data)` | Varies by class | Child node or `script` property |
| **Physics** | `rigidbody` + `collision` components | `PhysicsAggregate` (combined) | Separate node types + child CollisionShape3D |
| **Scripting** | Script component + attributes | Behavior interface | GDScript attached to node |
| **Events** | Component events + `app.fire()` | Observable pattern | Signal system |
| **Serialization** | JSON (flat entity map) | JSON (typed arrays) | .tscn (text, node tree) |
| **Coordinate system** | RH Y-up, -Z forward | Configurable (LH or RH) | RH Y-up, -Z forward |
| **Adapter complexity** | ~1000 LoC (natural fit) | ~1200 LoC (type mapping) | ~1500-2000 LoC (subtree expansion + script generation) |

---

## Recommendations

### For Phase 1 (Contracts & Testing Spine) — Act Now

1. **Document in the IR spec that one IR entity may map to N engine nodes.** The adapter interface's `mapComponent()` should be supplemented or replaced by `mapEntity(entity: CanonicalNode): unknown` which returns an opaque engine-specific result (a single entity in PlayCanvas, a node in Babylon.js, a subtree in Godot).

2. **Explicitly specify forward direction as -Z in the IR.** Document that glTF assets (which use +Z forward) receive a 180-degree Y-rotation correction at import time. This matches PlayCanvas and Godot conventions.

3. **Ensure the Collider component is an array** in the IR entity (or allow multiple Collider components per entity). PlayCanvas already supports multiple collision components. Godot requires multiple CollisionShape3D children for compound shapes.

4. **Keep TriggerVolume and Collider as distinct component types** in the IR. In Godot, they map to completely different node types (Area3D vs PhysicsBody3D child). Merging them with a boolean flag would make adapter logic unnecessarily complex.

### For Future Phases — Document Now, Implement Later

5. **Add event parameter schemas to PortDescriptor.** Godot signals carry typed payloads; the IR should model this for faithful round-trip.

6. **Plan for animation state graphs.** Godot's AnimationTree is a powerful state machine. The IR's animation model should eventually support states and transitions, not just linear clips.

7. **Budget the Godot adapter at 1500-2000 LoC** (vs 1000-1200 for web adapters). The node-type expansion logic and script generation add inherent complexity. If it exceeds 2000 LoC, that signals the IR abstraction is leaking.

8. **Ejection to Godot = project generation**, not just scene files. A Godot project needs `project.godot`, `.gdextension` files, autoload scripts, and a specific directory structure. The `EjectOptions` interface should support `targetFormat: 'project' | 'scene'`.

---

## Sources

- [Nodes and Scene Tree - Godot Docs DeepWiki](https://deepwiki.com/godotengine/godot-docs/6.1-nodes-and-scene-tree)
- [Nodes and scene instances - Godot Engine docs](https://docs.godotengine.org/en/stable/tutorials/scripting/nodes_and_scene_instances.html)
- [Creating instances - Godot Engine docs](https://docs.godotengine.org/en/stable/getting_started/step_by_step/instancing.html)
- [Scene organization - Godot Engine docs](https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html)
- [Using 3D transforms - Godot Engine docs](https://docs.godotengine.org/en/latest/tutorials/3d/using_transforms.html)
- [Add an option to fix Z-forward - godot-proposals #6198](https://github.com/godotengine/godot-proposals/issues/6198)
- [Forward direction docs issue - godot-docs #9159](https://github.com/godotengine/godot-docs/issues/9159)
- [Why isn't Godot an ECS-based game engine? - Godot Engine](https://godotengine.org/article/why-isnt-godot-ecs-based-game-engine/)
- [Node3D - Godot Engine docs](https://docs.godotengine.org/en/stable/classes/class_node3d.html)
- [MeshInstance3D - Godot Engine docs](https://docs.godotengine.org/en/stable/classes/class_meshinstance3d.html)
- [Resource System in Godot 4 - Tutorial](https://www.gotut.net/resource-system-in-godot-4/)
- [Resources - Godot Engine docs](https://docs.godotengine.org/en/stable/tutorials/scripting/resources.html)
- [TSCN file format - Godot Engine 4.4 docs](https://docs.godotengine.org/en/4.4/contributing/development/file_formats/tscn.html)
- [TSCN file format - Godot Engine stable docs](https://docs.godotengine.org/en/stable/engine_details/file_formats/tscn.html)
- [GDExtension system - Godot Engine docs](https://docs.godotengine.org/en/stable/tutorials/scripting/gdextension/index.html)
- [godot-rust/gdext - Rust bindings for Godot 4](https://github.com/godot-rust/gdext)
- [Jolt Physics integration PR #99895](https://github.com/godotengine/godot/pull/99895)
- [Collision shapes 3D - Godot Engine docs](https://docs.godotengine.org/en/latest/tutorials/physics/collision_shapes_3d.html)
- [CollisionShape3D - Godot Engine docs](https://docs.godotengine.org/en/stable/classes/class_collisionshape3d.html)
- [Allow physics bodies indirect children - godot-proposals #535](https://github.com/godotengine/godot-proposals/issues/535)
- [Using signals - Godot Engine docs](https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html)
- [Godot's Event Bus pattern](https://nicolaluigidau.wordpress.com/2024/05/25/sending-signals-across-your-godot-4-project-with-game-events/)
- [Godot Signals Complete Guide 2025](https://generalistprogrammer.com/tutorials/godot-signals-complete-guide-scene-communication)
- [Using AnimationTree - Godot Engine docs](https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html)
- [AnimationTree - Godot Engine 4.4 docs](https://docs.godotengine.org/en/4.4/tutorials/animation/animation_tree.html)
- [Animation Track types - Godot Engine docs](https://docs.godotengine.org/en/stable/tutorials/animation/animation_track_types.html)
- [Migrating Animations from Godot 4.0 to 4.3 - Godot Engine](https://godotengine.org/article/migrating-animations-from-godot-4-0-to-4-3/)
- [Inheritance in Godot 4 - Tutorial](https://www.gotut.net/inheritance-in-godot-4/)
- [The Book of Nodes: 3D - Medium](https://christinec-dev.medium.com/the-book-of-nodes-3d-4482ce8a145c)
- [Godot Jolt - Asset Library](https://godotengine.org/asset-library/asset/1918)
- [RigidBody3D - Godot Engine docs](https://docs.godotengine.org/en/stable/classes/class_rigidbody3d.html)

---

*Godot 4.x adapter research for Riff3D Canonical IR contract design*
*Researched: 2026-02-19*
