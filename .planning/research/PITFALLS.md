# Pitfalls Research

**Domain:** Contract-first, operation-driven, portable 3D engine/editor with collaboration
**Researched:** 2026-02-19
**Confidence:** MEDIUM-HIGH -- synthesized from prototype codebase analysis (30+ components, 9 phases completed), PlayCanvas Editor/Engine source analysis, Babylon.js Editor source analysis, rebuild research documents (4 deep-dive papers), and established patterns from glTF/USD/OMI ecosystems. WebSearch unavailable for verification of latest 2026 developments.

---

## Critical Pitfalls

### Pitfall 1: The "Universal Format" Gravity Well -- Designing ECSON for Every Engine Upfront

**What goes wrong:**
Teams designing a "universal" 3D scene format attempt to abstract every concept across every target engine from day one. The format becomes a superset that no single engine fully supports, while simultaneously being a subset that no single engine finds sufficient. USD spent 10+ years reaching stability and still struggles with real-time interactivity. VRML/X3D attempted this in the 1990s-2000s and died from specification bloat -- X3D's spec grew to 800+ pages trying to cover every use case. Collada (COLLADA 1.5, 2008) tried to be the "universal 3D interchange" format and was abandoned by every major engine in favor of glTF, which succeeded specifically because it constrained its scope.

The gravity well: every new engine target reveals concepts that don't map cleanly. "Just add it to the schema" accumulates technical debt in the format itself. ECSON grows unbounded, the Canonical IR gains engine-specific branches, and adapters bloat from the promised ~1000 LoC to 5000+ LoC.

**Why it happens:**
The rebuild research (document 00) already identified 30+ component types, 4 target engines, and 8 divergent concepts (rotation representation, physics engines, coordinate systems, physics body models, collider parenting, material assignment, script lifecycle, event systems). The temptation is to handle all divergences in the schema design phase. But the schema cannot be validated without working adapters, and adapters cannot be validated without real games. This creates a chicken-and-egg problem that teams "solve" by specifying everything upfront.

**How to avoid:**
- Follow FOUNDATION.md's "2-template rule" rigorously: ECSON only gains new concepts when two independent templates require them. One template needing terrain? Put it in tuning. Two templates needing terrain? Promote to portable subset.
- Start ECSON with the intersection of PlayCanvas and Babylon.js, not the union. The rebuild research (document 00, Section 4.1) already mapped the common concepts -- transforms, mesh rendering, PBR materials, basic lights, cameras, rigid body physics, colliders, audio, and animation. This IS the v0 portable subset. Everything else starts in tuning.
- Cap the v0 ECSON schema at under 20 component types. The prototype had 30+ and many were never exercised in a real game template. Each component type is a maintenance multiplier across every adapter.
- Run the adapter size budget as a hard metric: if any adapter exceeds 1500 LoC, the Canonical IR is leaking abstraction. Investigate which component is causing the bloat and either simplify it or move it to tuning.

**Warning signs:**
- Schema discussions include "what if Godot/Unity needs..." before either adapter exists
- ECSON has component types with no golden fixture exercising them
- Canonical IR compiler has engine-name checks (`if (target === 'babylon')`)
- The portable subset definition keeps growing in meetings rather than shrinking
- More than 3 ECSON component types have no corresponding conformance test

**Phase to address:**
Phase 0 (Contracts First). Lock the v0 portable subset with conformance tests before any editor UI exists. Resist expansion until templates demand it.

**Real-world examples:**
- **VRML -> X3D**: Tried to standardize everything (scripting, routing, sensors, interpolators, shaders, geospatial, medical imaging). Died from complexity. No major engine adopted it.
- **COLLADA 1.5**: Universal interchange that every tool supported differently. glTF succeeded by being opinionated and constrained -- "the JPEG of 3D."
- **USD**: Took 15+ years from Pixar's internal use to broad adoption. Still has no interactivity model. AOUSD (2023) admits real-time use cases require custom extensions.
- **glTF's success pattern**: Started with geometry+materials+animation. Only added physics (KHR_physics_rigid_bodies) and interactivity (KHR_interactivity) as extensions after the core was stable and widely adopted.

---

### Pitfall 2: Operation-Based Collaboration Without Operational Semantics

**What goes wrong:**
PatchOps are defined with the right structural properties (deterministic, serializable, ordered, scoped, invertible) but without operational semantics that handle concurrent execution. Two users apply conflicting ops to the same entity property. Without a formal conflict resolution strategy, the system either:
(a) Uses last-write-wins, silently dropping one user's work,
(b) Locks at entity granularity, creating contention that makes collaboration feel broken, or
(c) Attempts CRDT/OT semantics retroactively, requiring a rewrite of the op application layer.

Figma's journey is instructive: they started with a custom OT system for 2D objects, and it took years to get right. Their key insight was that property-level last-write-wins with visibility (showing who changed what) is good enough for most editing, but structural operations (reparenting, deletion) require special handling because they interact with the tree topology.

**Why it happens:**
FOUNDATION.md specifies that PatchOps must be ordered, invertible, and validatable, but explicitly defers the conflict strategy: "conflict strategy documented (e.g. last-write-wins per property, OT/CRDT later)." This deferral is dangerous because the PatchOps application model (how ops compose, how conflicts resolve, what happens when ops arrive out-of-order) fundamentally shapes the op design. An op designed for sequential application may not be safely reorderable.

The prototype used message-based deltas (document 00, Section 1.6) with object locking. This worked for small teams but broke down when two users edited related objects (parent/child transforms, shared materials, event wires connecting objects across lock boundaries).

**How to avoid:**
- Classify PatchOps into three conflict categories from day one:
  1. **Commutative ops** (property sets on independent paths): Safe for last-write-wins. Most ops fall here.
  2. **Structural ops** (CreateEntity, DeleteEntity, Reparent, AddChild, RemoveChild): Require causal ordering. A DeleteEntity must invalidate pending ops targeting that entity.
  3. **Cross-entity ops** (AddWire, RemoveWire, SetComponentProperty with entity-ref values): Require reference validation after application -- the target entity might be deleted by a concurrent op.
- Implement a vector clock or lamport timestamp per operation, not just sequential ordering. This enables detecting concurrent vs. causal relationships.
- Build the "conflict visible, never silent" principle into the operation log from Phase 0. Every conflict (even resolved automatically via LWW) gets logged. The UI can show "Alex's change to position.x was overridden by your change" in an activity feed.
- Do NOT attempt full CRDT semantics for the scene graph. CRDTs for trees are an active research area with unsolved problems (move operations on trees, the "AW-move" problem). Instead, use server-authoritative ordering with client prediction, similar to game networking.

**Warning signs:**
- Undo on one client undoes another client's operation
- Two users editing sibling properties of the same component produces unexpected values
- Deleting an entity while another user has it selected causes a crash or ghost reference
- Reparenting an entity while another user edits a child produces orphaned nodes
- The operation log grows but nobody is testing replay determinism

**Phase to address:**
Phase 0 (Contracts) for classification and basic semantics. Phase 2 (Collaboration-ready core) for full implementation. The op classification in Phase 0 prevents the need to reclassify later.

**Real-world examples:**
- **Figma**: Custom OT with per-property LWW and structural-op special handling. Took multiple years of refinement. Their success came from making conflicts visible, not invisible.
- **Google Docs**: Full OT implementation. Required dedicated research team. Way overkill for 3D scene editing but demonstrates the gap between "we have operations" and "concurrent operations work correctly."
- **PlayCanvas Editor**: Uses a realtime collaboration layer with per-entity observation. Their `entities-migrations.ts` (analyzed in source) shows they handle schema evolution per-entity on load -- implying that concurrent edits can produce inconsistent entity shapes that need runtime patching.
- **Multiplayer game editors** (Roblox Studio, Unity Collab): Roblox uses server-authoritative with per-instance locking. Unity Collab (deprecated) used file-level locking and was widely considered broken for real-time collaboration, leading to Unity's pivot to Plastic SCM for version control rather than real-time sync.

---

### Pitfall 3: Adapter Abstraction Collapses to Lowest Common Denominator

**What goes wrong:**
The portable subset starts with a sensible intersection of engine capabilities, but over time, feature pressure forces the adapters to either (a) implement features that one engine cannot support (leading to silent behavioral differences), or (b) restrict features to what all engines can do identically (lowest common denominator, making no engine look good).

PlayCanvas's graphics device abstraction (analyzed in source: `graphics-device-create.js`) shows the pattern done right for a focused scope: WebGL2 and WebGPU both implement the same GraphicsDevice interface, with graceful fallback. But this works because the abstraction boundary is at the rendering API level -- a narrow, well-defined surface. A 3D *scene* abstraction is vastly wider.

The specific danger for Riff3D: physics behavior will differ between engines. PlayCanvas uses Ammo.js, Babylon.js uses Havok/Cannon, and each has different constraint solvers, collision detection algorithms, and numerical behavior. A "bouncy platform" with restitution=0.95 will behave differently across engines. Users will expect identical behavior and blame the platform.

**Why it happens:**
Each engine has different strengths. PlayCanvas has better batching and draw call optimization. Babylon.js has superior PBR rendering and node materials. When building game templates, developers naturally reach for each engine's strengths. The Canonical IR then needs to represent these engine-specific capabilities, and the "thin adapter" concept breaks down.

The rebuild research (document 01, Section 6.2) estimated adapters at 800-1200 LoC. This is only achievable if the Canonical IR stays at the intersection. The moment adapters need to handle divergent physics behavior, material system differences, or scripting lifecycle mismatches, they grow dramatically.

**How to avoid:**
- Define "conformance tolerance" quantitatively for the portable subset. Example: "A bouncing ball with restitution=0.8 dropped from 2m must bounce to between 1.4m and 1.7m on all adapters." This prevents pixel-perfect matching (impossible) while preventing gross behavioral divergence (unacceptable).
- Physics is the biggest divergence risk. Accept it early: declare physics as "capability-detected" in v0 portable subset, not "guaranteed identical." The Canonical IR specifies physics *intent* (this body is dynamic, has mass X, bounciness Y) but adapters translate to engine-native implementations. Use golden fixture tolerance tests, not exact matching.
- Never expose engine-specific material features through the portable subset. If Babylon.js has superior subsurface scattering, that goes in `tuning.babylon`, not in the portable PBR material spec.
- Maintain a strict "adapter code budget" metric in CI. When an adapter exceeds the budget, that is a signal that the Canonical IR needs refactoring, not that the adapter needs more code.

**Warning signs:**
- A game template looks or behaves noticeably differently between PlayCanvas and Babylon.js adapters
- One adapter has 2x the code of another (indicates the IR is biased toward one engine's model)
- Developers say "just use the PlayCanvas adapter" for certain features (de facto preference emerging)
- Conformance tests pass with wide tolerance bands that hide real behavioral differences
- Feature requests start with "in Babylon.js you can..." (engine-specific thinking leaking into core)

**Phase to address:**
Phase 0 (Contracts) for conformance tolerance definition. Phase 1 (Closed Loop) for first adapter validation. The second adapter (Babylon.js) is the real test -- if it can be written without changing the Canonical IR, the abstraction is sound.

**Real-world examples:**
- **Needle Engine**: Exports from Unity to three.js web runtime. Accepts visual differences between Unity and three.js rendering. Focuses on behavioral correctness rather than pixel-perfect matching. This is the right trade-off.
- **OMI Group glTF extensions**: Their multi-implementation requirement (Stage 4 requires implementations in multiple engines) specifically forces this issue early. Extensions that can't map cleanly across engines don't graduate.
- **React Native**: The "learn once, write anywhere" promise collapsed when developers expected pixel-perfect cross-platform rendering. The lesson: abstract behavior, accept visual variation.
- **OpenXR**: Succeeded by abstracting controller input semantics (grip, trigger, thumbstick) without trying to abstract hardware-specific haptics or tracking precision. Narrow scope, high conformance.

---

### Pitfall 4: Schema Evolution Hell (ECSON Migrations Over Time)

**What goes wrong:**
Every ECSON schema change requires a migration for every existing project. The rebuild research (document 00, Section 5.7) already redesigned the schema once -- moving from nested tree to flat entity map, adding shared asset registry, separating collider from rigid body. Each of these changes would have required migrations for every saved scene in the prototype.

As the product grows, schema changes accelerate: new component types, modified property schemas, structural changes to event wiring, game settings evolution. Without disciplined migration infrastructure, projects become unloadable, users lose work, and the team spends more time writing migrations than features.

PlayCanvas Editor's migration approach (analyzed in source: `entities-migrations.ts`) is revealing: they handle migration per-entity at load time by checking for missing properties and setting defaults. This means their migration code runs on EVERY load of EVERY entity, checking dozens of conditions. The file is 460+ lines of pure migration logic. This pattern works but creates cumulative performance cost and maintenance burden.

**Why it happens:**
Teams underinvest in migration infrastructure because it feels like "overhead" compared to features. The schema changes seem small individually ("just add this property"), but they compound. Without tooling, migrations are manual code that is tested once and then assumed to keep working.

The Riff3D rebuild is especially vulnerable because:
1. ECSON must support both editor sugar and canonical form
2. PatchOps stored in operation logs reference schema paths that may change
3. Golden fixtures must be updated alongside migrations
4. The 2-template rule means the schema expands as templates are added

**How to avoid:**
- Build migration infrastructure in Phase 0, not Phase 2. This includes:
  - Schema version field on every ECSON document
  - A migration registry mapping `{fromVersion, toVersion} -> migrationFn`
  - A migration test that loads every golden fixture through every migration path
  - A "migration lint" that detects schema changes without corresponding migrations
- Use the "additive-only with defaults" pattern for v0 changes (add new properties with defaults; never remove or rename properties). This is what PlayCanvas does and it avoids the need for complex per-entity migration logic.
- For structural changes (rare but necessary): implement as paired operations (old format reader + new format writer) rather than in-place mutation. The old format is read into an in-memory model, then serialized to the new format.
- Never store PatchOps with concrete schema paths in long-lived logs. Use stable property IDs or versioned path references. If the schema renames `position.y` to `transform.position[1]`, ops referencing the old path must still be replayable.
- Maintain a "schema changelog" as a living document. Every schema change gets an entry with: what changed, why, migration strategy, and which golden fixtures were affected.

**Warning signs:**
- A schema change is merged without a corresponding migration function
- Golden fixtures haven't been updated in more than 2 schema versions
- Loading old projects produces "undefined" values in the inspector for new properties
- Operation log replay produces different results than direct loading (schema version mismatch between ops and document)
- The migration file exceeds 500 lines (a la PlayCanvas's 460-line migration -- already approaching the limit)

**Phase to address:**
Phase 0 (Contracts). Migration infrastructure is a contract-level concern, not a feature-level concern.

**Real-world examples:**
- **PlayCanvas Editor** (`entities-migrations.ts`): 460+ lines of per-entity property checks. Functional but brittle -- relies on runtime detection rather than versioned migrations. A cautionary tale of what happens when migration infrastructure is deferred.
- **Unity .unity/.prefab YAML**: Uses class type IDs (numeric) for stability. When Unity adds a new component property, older scenes load with defaults. But structural changes (e.g., the move from MeshRenderer to MeshFilter+MeshRenderer) required complex import migration passes.
- **Figma**: Their file format migration system is considered one of their key engineering achievements. Every format change is a versioned migration, tested against thousands of real user files. They credit this with enabling rapid iteration without breaking existing files.
- **Blender .blend format**: Includes DNA structs (self-describing schema) in every file, enabling forward and backward compatibility. Complex to implement but extremely robust.

---

### Pitfall 5: IQL Becomes a Second Language to Maintain Instead of a Convenience Layer

**What goes wrong:**
IQL (Imagination Query Language) is designed as a thin convenience layer that compiles to PatchOps. But as AI integration deepens and power users adopt it, IQL accumulates features that create semantic gaps with the underlying PatchOps layer. The IQL compiler becomes a complex translator, IQL-specific bugs emerge that don't exist in the PatchOps path, and the team effectively maintains two editing languages.

The rebuild research (document 02) already shows signs of this: IQL defines spatial queries (`NEAREST`, `ABOVE`, `BELOW`), bulk operations (`FOREACH`, `SCATTER`), and composite presets (`arena:small` expanding to 5+ entities) that have no PatchOps equivalent. These are useful, but each one is a semantic expansion that the PatchOps layer doesn't understand.

**Why it happens:**
Token efficiency pressure from AI integration drives IQL feature growth. The 90-97% token savings documented in the research are real and economically significant (12x more sessions per dollar). This creates strong incentive to put more intelligence into IQL rather than keeping it as a thin expansion layer.

The CHAIN and SCATTER verbs (document 03) integrate physics-aware placement, difficulty curves, and reachability validation. These are valuable features, but they live entirely in the IQL layer, not in PatchOps. If the editor UI wants the same physics-aware placement, it must either go through IQL (coupling UI to the AI language) or reimplement the logic (duplication).

**How to avoid:**
- Enforce a strict compilation boundary: every IQL operation must produce a valid sequence of PatchOps. If an IQL feature cannot be expressed as PatchOps, the feature belongs in PatchOps (or a library layer), not in IQL.
- CHAIN/SCATTER/physics-aware placement should be implemented as a "placement library" that both IQL and the editor UI call. IQL's role is to surface this library's capabilities in token-efficient syntax, not to contain the logic.
- Maintain a "bypass test" in CI: for every IQL command, verify that the same result can be achieved through direct PatchOps. This ensures IQL never becomes the only way to do something.
- Defer IQL beyond basic SPAWN/SET/MOVE/PAINT/DELETE until the PatchOps layer is stable and exercised by the editor UI. The rebuild research recommends implementing IQL in 5 sub-phases -- follow that ordering.

**Warning signs:**
- Editor UI features bypass PatchOps and call IQL instead
- IQL compiler exceeds 2000 LoC (rebuild research estimated ~2000 LoC for the full Universal Schema -> Canonical IR compiler; IQL should be simpler)
- Bug reports say "works in IQL but not in the editor" or vice versa
- IQL presets define component combinations that the editor UI doesn't know about
- The IQL MCP server becomes the primary editing interface, with the visual editor as secondary

**Phase to address:**
Phase 0 (Contracts) for the compilation boundary rule. Phase 1 for basic IQL verbs. Advanced IQL (CHAIN, SCATTER, spatial queries) should wait until Phase 3+ when templates validate the need.

---

### Pitfall 6: The "Fun-First to Professional" Scaling Trap

**What goes wrong:**
The product starts with a "fun-first wedge" (party games, fast creation loops) but the architecture optimizes for this use case so deeply that professional features become impossible to add without a rewrite. Specific failure modes:

1. **Simplified UX hardens into limitations**: "Pick template -> customize -> play" works for party games but professional users need blank-canvas creation, custom scripting, and deep property control. If the opinionated verbs (FOUNDATION.md: "Add Character", "Make It Bouncy") are the ONLY editing interface, professionals leave.

2. **Performance budgets set too casually**: Party games with 50 objects and 8 players have very different performance profiles than professional scenes with 5000 objects and complex materials. If the system is optimized for the former (e.g., no frustum culling, no LOD, no spatial indexing), adding the latter is not incremental -- it is architectural.

3. **Game logic coupling**: The game state machine (lobby -> countdown -> playing -> results) is great for party games. Professional tools need different paradigms: cinematic timelines, training simulations, architectural walkthroughs. If GameSettings is deeply wired into the runtime, non-game use cases cannot use the platform.

**Why it happens:**
The rebuild's FOUNDATION.md explicitly designs for this progression: "Fun-first wedge, pro-capable foundation." But the prototype experience shows the opposite trend -- it built 30+ gameplay components (ScoreZone, KillZone, Trampoline, Conveyor, etc.) before establishing the foundation that would make them portable. Each gameplay component became a special case in the schema, serializer, and editor.

The "advanced modes without rewriting core contracts" promise requires the core contracts to be generic enough for both use cases. But generic enough for professional use conflicts with opinionated enough for fun-first adoption.

**How to avoid:**
- The editor must have TWO entry points from day one: (1) Template-based "pick and customize" (fun-first), and (2) Blank scene "create from scratch" (pro path). Both paths produce ECSON, use PatchOps, and compile to Canonical IR. The fun path is a thin UX layer over the pro path, not a different system.
- Game-specific concepts (GameSettings, WinConditions, GameStateMachine, HUD) must be a MODULE on top of the core, not part of the core. The core is: entities + components + transforms + assets + events. A "Cinematic Clip" template (mentioned in FOUNDATION.md) should work without GameSettings.
- Performance architecture must handle the worst case, not the common case. Implement spatial indexing (BVH or octree), frustum culling, and draw call batching in Phase 1, not "when scenes get big." These are O(1) cost when scenes are small and critical when scenes grow.
- Gate professional features behind "advanced mode" toggle in the UI, not behind architecture changes. Every professional feature is a combination of core capabilities (entities, components, ops), not a new system.

**Warning signs:**
- The word "GameSettings" appears in the Canonical IR (it should only be in game-template-specific data)
- Creating a scene without selecting a game template is not supported
- Performance degrades non-linearly between 100 and 500 objects (indicates missing spatial optimization)
- Template-specific components (ScoreZone, KillZone) are in the portable subset instead of tuning
- Professional users describe the editor as "limited" or "toy-like" after initial excitement

**Phase to address:**
Phase 0 (Contracts) for the core vs. module boundary. Phase 1 (Closed Loop) for the dual entry point. Performance architecture is Phase 0-1.

**Real-world examples:**
- **Roblox**: Started as a fun-first game creation platform. Scaled to professional development by ensuring the core (Instances, Properties, scripts) was generic. Game-specific features (leaderboards, badges) are modules, not core.
- **Canva -> Canva Enterprise**: Started fun-first (social media graphics), expanded to professional (brand management, video editing). Succeeded because the core canvas/layer/element model was generic. The "fun" features were templates and AI, not architectural constraints.
- **GameMaker**: Started as a simple 2D game tool. Attempting to add 3D features on top of a 2D-optimized architecture resulted in poor 3D performance. The lesson: the core architecture must not assume the initial use case is the only use case.

---

### Pitfall 7: Dual-Runtime Adapter Trap: Building Two Half-Working Adapters Instead of One Complete One

**What goes wrong:**
The FOUNDATION.md mandates "dual runtime adapters (PlayCanvas + Babylon.js) from day one." While this validates the abstraction, it also doubles the surface area for every feature. Teams oscillate between adapters, leaving both at 60-70% completion instead of one at 100%. Users encounter different bugs on different adapters, and the team cannot ship because neither adapter is production-ready.

**Why it happens:**
Every Canonical IR feature requires implementation in both adapters. When one adapter has a tricky mapping (e.g., Babylon.js PhysicsAggregate vs PlayCanvas rigidbody+collision), the team spends time on the harder adapter while the easier adapter accumulates feature debt. Bug reports on adapter A are deprioritized to work on adapter B's feature gap, and vice versa.

The rebuild research (document 01, Section 9.3) recommends: "Build iteratively -- Start with PlayCanvas adapter, extract patterns, then add Babylon." This is correct but requires discipline to follow. The temptation to prove the abstraction works with both adapters simultaneously is strong but counterproductive.

**How to avoid:**
- Designate ONE adapter as "primary" for Phase 0-1. All golden fixtures, conformance tests, and template development use this adapter. The second adapter is a "validation adapter" that passes conformance tests but is not the development target.
- Define "adapter parity" criteria: the second adapter must pass 90% of conformance tests before any game template targets it. This prevents "it works on PlayCanvas" from becoming the de facto standard.
- Never develop features adapter-first. Features are developed in the Canonical IR, proven in the primary adapter, then ported to the secondary adapter. If porting reveals an IR issue, fix the IR before adding workarounds in the adapter.
- Budget time explicitly: 70% primary adapter, 30% secondary adapter in Phase 0-1. Shift to 50/50 only after both pass conformance suite.

**Warning signs:**
- Bug reports include "which adapter?" as a standard question
- One adapter has 2x the test coverage of the other
- Developers have a preferred adapter and avoid the other
- Features land in one adapter weeks before the other
- The Canonical IR has `if (adapter === 'playcanvas')` branches

**Phase to address:**
Phase 0 (designate primary adapter). Phase 1 (prove with primary, validate with secondary). Phase 2+ for parity.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing component properties as `Record<string, unknown>` without typed schemas | Fast to add new components | No compile-time safety, runtime type errors, impossible to validate PatchOps statically, inspector UI must type-check at runtime | Never for portable subset components. Acceptable for `tuning` escape hatch properties. |
| Skipping golden fixture updates when schema changes | Faster iteration during prototyping | Conformance tests pass on stale data, schema drift goes undetected, old fixtures become invalid but nobody notices | Never. Golden fixtures are the contract's immune system. |
| Using JSON.stringify/parse for deep cloning in PatchOps | Simple implementation | Loses undefined values, fails on circular references, 10-100x slower than structured clone, breaks for typed arrays (Float32Array in mesh data) | Only for simple property values. Use `structuredClone` for complex objects. |
| Hardcoding component defaults in adapter code instead of ECSON schema | Faster adapter development | Adapters diverge on what "default" means, inspector shows different defaults than runtime, adapter A's default differs from adapter B's | Never. Defaults must live in the component definition within ECSON schema. |
| Implementing undo as state snapshots instead of operation inverses | Simpler to implement, always correct | Memory grows linearly with edit count, 50 undos on a complex scene = 50 full scene copies in memory, no selective undo possible | Only for Phase 0 proof of concept. Must move to operation-inverse undo before Phase 1 completion. |
| Bypassing PatchOps for "internal" state changes (selection, camera position, grid settings) | Avoids overhead for non-persistent state | The boundary between "editor state" (ephemeral) and "scene state" (persistent) blurs. Selection highlighting leaks into saved scenes. Camera position accidentally becomes a PatchOp. | Acceptable if the boundary is documented and enforced. Create explicit EphemeralState vs PersistentState types. |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Canonical IR -> PlayCanvas** | Mapping ECSON's Euler degrees directly to PlayCanvas, which also uses Euler degrees but with different rotation order conventions (PlayCanvas uses ZYX internally for some operations). | Store both Euler and quaternion in the Canonical IR (as specified in rebuild document 01). Use quaternion for the actual transform application. Let the Euler be display-only in the inspector. Test rotation conformance with a golden fixture that rotates 45 degrees on each axis. |
| **Canonical IR -> Babylon.js** | Using Babylon's `rotation` property (Euler radians) instead of `rotationQuaternion`. When `rotationQuaternion` is set, `rotation` is ignored. Mixing both causes silent bugs. | Always use `rotationQuaternion` in the Babylon adapter. Convert from Canonical IR's Euler degrees to quaternion before applying. Never set `mesh.rotation` directly. |
| **ECSON -> Canonical IR compilation** | Compiling high-level components (ScoreZone, MovingPlatform) inline during adapter generation, duplicating behavior logic per adapter. | Compile high-level components to canonical primitives (TriggerVolume + actions) in the IR compilation step, as specified in rebuild document 01. Adapters only handle canonical primitives. |
| **PatchOps -> Operation Log** | Storing ops as application-specific objects that are not JSON-serializable (containing function references, Map/Set objects, or class instances). | PatchOps must be pure JSON-serializable values. No functions, no class instances, no Map/Set. Use discriminated unions with `type` fields. Test serialization round-trip for every op type. |
| **IQL -> PatchOps compilation** | IQL presets generating entity IDs at compile time without checking for collisions with existing scene entities. | IQL compiler must receive the current scene state (or at minimum the set of existing entity IDs) to generate collision-free IDs. Use UUID v4 for entity IDs to minimize collision probability, but still validate. |
| **Golden fixtures -> Conformance tests** | Writing conformance tests that check exact values (position === [1, 0, 0]) instead of tolerance ranges. Floating-point differences between engines cause spurious failures. | Use epsilon-based comparison for all numeric values: `Math.abs(expected - actual) < tolerance`. Define tolerance per-property: position (0.001), rotation (0.01 degrees), color (1/255), physics simulation results (5% of expected value). |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| PatchOps replay as the scene loading strategy (replaying all ops from empty to reconstruct scene) | Load time grows linearly with edit history. A scene with 10,000 edits takes seconds to load even if the final scene has 50 entities. | Checkpoint strategy: persist ECSON snapshots periodically. Load from latest snapshot, replay only subsequent ops. Define checkpoint interval (every 100 ops or every save). | >500 ops without a checkpoint |
| Canonical IR compilation on every frame (recompiling when any property changes for live preview) | Frame drops during editing. Compilation involves asset resolution, behavior compilation, and event graph compilation -- too expensive for per-frame. | Dirty-flag system: track which ECSON sections changed, only recompile affected IR sections. For live preview, the adapter can apply property changes directly without full IR recompilation. | Any scene with >50 entities if full recompile happens per edit |
| Flat entity map without spatial indexing for editor operations (selection raycasting, viewport culling) | Selection click takes >100ms on scenes with 200+ entities. Editor viewport stutters when panning because every entity is tested for visibility. | Implement a BVH or octree for spatial queries. Update incrementally when entities move. This is cheap for small scenes and essential for large ones. | >200 entities on desktop, >50 on mobile |
| JSON serialization of large ECSON documents blocking the main thread | UI freezes during auto-save on complex scenes. The serializer holds the main thread for 50-100ms on a 1000-entity scene. | Use a Web Worker for serialization. Send the scene state via structured clone, serialize in the worker, write to storage from the worker. Main thread never blocks. | >500 entities or >100 assets with embedded data |
| Event graph evaluation without short-circuit optimization | Frame drops when many event wires are active. The compiled dispatch table is evaluated linearly for every event emission. | Pre-compute which wires are relevant per event source. Use a Map<sourceKey, Wire[]> lookup. Skip condition evaluation for wires with no condition. Batch delayed actions into a priority queue. | >50 active event wires with conditions |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| IQL commands accepted without server-side validation (trusting client-compiled PatchOps) | Malicious client sends crafted PatchOps that bypass IQL validation -- deleting other users' entities, modifying locked objects, corrupting scene state. | All PatchOps must be validated on the server against the current scene state and user permissions BEFORE application. IQL compilation happens client-side for responsiveness, but the server re-validates the resulting ops. |
| ECSON documents loaded from untrusted sources without schema validation | Malicious scene files with oversized arrays, circular references, or unexpected types cause memory exhaustion or runtime crashes when loaded. | Validate every ECSON document against the Zod schema before loading. Enforce size limits (max entities: 10,000, max assets: 1,000, max event wires: 500). Reject documents that exceed limits. |
| Adapter code generation without output sanitization (for ejection pipeline) | Code injection via malicious entity names, component properties, or asset paths that contain JavaScript when interpolated into generated adapter code. | Never interpolate user-provided strings directly into generated code. Use parameterized templates. Sanitize all entity names and property values for the target language's string literal syntax. |
| Canonical IR stored or transmitted with embedded asset data URIs | Large base64-encoded textures in the IR create denial-of-service vectors and inflate transmission size 33% due to base64 overhead. | Canonical IR references assets by URI, never embeds them. Assets are served separately via CDN with content-type validation. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| The "Contracts First" phase produces no visible product for weeks | Stakeholders lose confidence. Developers feel like they are writing specs, not building software. Momentum dies before the first demo. | Phase 0 should produce a VISIBLE artifact: a CLI tool that loads a golden fixture, compiles to Canonical IR, and renders in a web runtime. No editor UI, but something you can see and demo. "Look, this ECSON file renders as a 3D scene in PlayCanvas" is worth more than a perfect spec with no output. |
| Portable subset restrictions frustrate users who know what the underlying engine can do | Users see Babylon.js's node material editor working in demos but cannot access it through Riff3D's portable material system. They feel restricted by the abstraction. | Make the tuning escape hatch visible and easy to use. "This material uses portable PBR. Switch to Babylon.js-specific material for advanced options (not portable)." The trade-off must be explicit, not hidden. |
| Operation log / undo history is invisible | Users don't understand why undo sometimes does nothing (when the last op was on a different entity), or why redo is unavailable (when a new op was applied after undo). | Show the operation log as a sidebar panel (like Photoshop's History panel). Each op has a human-readable description: "Moved Platform 3 to [2, 5, 0]", "Changed material color to red". Users can click any point in history to restore that state. |
| Conformance test failures are developer-facing only | Users create a scene in PlayCanvas adapter, switch to Babylon.js, and it looks different. They have no way to know which features are portable and which will differ. | Tag every component property in the inspector with a portability indicator. Green = portable (identical across adapters). Yellow = approximate (visually similar). Red = engine-specific (tuning only). This eliminates surprise at adapter-switch time. |
| IQL's token efficiency is invisible to the user | Users don't understand why AI scene generation is cheaper/faster with IQL vs. direct manipulation. The economic benefit accrues to the platform, not the user. | Show a "generation cost" indicator when using AI features. "This scene modification used 45 tokens (IQL) vs. estimated 800 tokens (direct)." Users appreciate efficiency when it's made visible. |

## "Looks Done But Isn't" Checklist

- [ ] **PatchOps:** Often missing inverse operation generation -- verify by applying 100 random ops, then undoing all 100, and checking that the scene matches the original state exactly
- [ ] **ECSON Schema:** Often missing migration for edge cases (entity with no components, empty asset registry, event wires referencing deleted entities) -- verify by loading every golden fixture through every migration version jump
- [ ] **Canonical IR Compiler:** Often missing error handling for invalid ECSON input (circular parent references, duplicate entity IDs, asset references to nonexistent assets) -- verify with a "malformed input" test suite
- [ ] **Adapter conformance:** Often missing tolerance-based comparison for physics simulation results -- verify by running the "bouncing ball" fixture on both adapters and checking that results fall within defined tolerance bands
- [ ] **IQL Compiler:** Often missing reference resolution for entities created in the same batch (IQL line 3 references entity created in line 1) -- verify with a multi-line IQL batch that includes forward references
- [ ] **Operation Log:** Often missing compaction (log grows indefinitely, contains redundant ops like setting the same property 50 times) -- verify that log compaction produces the same final state as full replay
- [ ] **Golden Fixtures:** Often out of date with current schema version -- verify by checking schema version in every fixture matches the current ECSON schema version
- [ ] **Event Wiring:** Often missing cleanup when source or target entity is deleted -- verify by creating a wire, deleting the target entity, saving, loading, and checking that the orphaned wire is cleaned up or produces a warning
- [ ] **Tuning Escape Hatch:** Often not actually ignored by non-matching adapters (a tuning.babylon section causing errors in the PlayCanvas adapter) -- verify by loading a scene with tuning sections for every supported engine and checking that adapters ignore irrelevant tuning

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| ECSON schema becomes engine-biased (designed around PlayCanvas assumptions) | HIGH | Audit every schema type for engine-specific assumptions. Extract engine-specific properties to tuning sections. Rewrite affected component definitions. Update all golden fixtures. Regenerate all adapter mappings. Budget 3-5 weeks. |
| PatchOps lack operational semantics for collaboration | HIGH | Classify all existing ops. Add vector clock / causal ordering. Implement conflict detection and resolution for each classification. Re-test entire operation log replay system. Budget 4-6 weeks. |
| Adapter abstraction collapsed to lowest common denominator | MEDIUM | Identify which features were restricted unnecessarily. Move them from portable subset to per-adapter extensions with tuning fallbacks. Update conformance tests with wider tolerance bands where appropriate. Budget 2-3 weeks. |
| IQL became a second language (not a thin compilation layer) | MEDIUM | Extract IQL-specific logic (spatial queries, physics-aware placement) into shared libraries callable from both IQL and editor UI. Simplify IQL compiler to pure expansion + reference resolution. Budget 2-4 weeks. |
| Schema evolution has no migration infrastructure | HIGH | Build migration registry retroactively. Write migrations for every schema version gap. Back-fill golden fixtures for all previous versions. Budget 3-4 weeks, plus ongoing discipline. |
| Dual adapters are both half-complete | MEDIUM | Designate one as primary. Bring it to 100% conformance. Then port tested patterns to secondary adapter. Budget 2-3 weeks to close the gap. |
| Fun-first architecture blocks professional features | HIGH | Extract game-specific systems (GameSettings, WinConditions, HUD) into an optional module. Ensure the core works without them. Add blank-scene entry point. Budget 4-8 weeks depending on coupling depth. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Universal format gravity well | Phase 0: Lock v0 portable subset at <20 component types | Count component types in ECSON schema; verify each has a golden fixture and conformance test |
| Operation semantics for collaboration | Phase 0: Classify ops; Phase 2: Implement | Apply 50 concurrent random ops from 2 simulated clients; verify deterministic convergence within 5 seconds |
| Adapter lowest-common-denominator | Phase 0: Define conformance tolerance; Phase 1: Validate with both adapters | Run all golden fixtures through both adapters; measure behavioral divergence; verify within tolerance |
| Schema evolution hell | Phase 0: Build migration infrastructure | Load every golden fixture through every migration version jump; verify round-trip |
| IQL as second language | Phase 0: Define compilation boundary; Phase 1: Basic verbs only | For every IQL command, demonstrate equivalent PatchOps sequence; verify identical results |
| Fun-first to professional scaling | Phase 0: Core vs module boundary; Phase 1: Dual entry point | Create a scene without selecting a game template; verify it loads, edits, saves, and compiles to IR without GameSettings |
| Dual adapter trap | Phase 0: Designate primary; Phase 1: Prove with primary | Measure adapter code coverage; primary must be >90% before secondary gets development focus |
| Performance traps (spatial, serialization, event graph) | Phase 0: Performance budgets; Phase 1: Spatial indexing | Benchmark 500-entity scene: load <2s, selection <16ms, save <100ms, 60fps viewport |
| Security (PatchOps validation, ECSON loading, code generation) | Phase 0: Validation architecture; Phase 2: Penetration test | Attempt to apply PatchOps bypassing permissions; attempt to load malformed ECSON; attempt code injection via entity names |

## Prototype Lessons Aggregated

The Riff3D v1 prototype (analyzed across 9 phases, 30+ components, 4 rebuild research documents) provides direct evidence for several pitfalls:

| Prototype Finding | Pitfall It Validates | Specific Evidence |
|-------------------|---------------------|-------------------|
| R3F coupling in scene format (Three.js-specific Euler rotation, geometry types) | Universal format gravity well | Document 00, Section 1.7: "Scene format assumes Three.js concepts" |
| No shared asset registry (materials inline in components) | Schema becomes engine-biased | Document 00, Section 1.7: "No asset references -- components embed raw values" |
| Physics tied to Rapier (body types use Rapier-specific names) | Adapter lowest-common-denominator | Document 00, Section 1.7: "Physics tied to Rapier" |
| 30+ behavior components before foundation was stable | Fun-first blocks professional | Component list grew faster than foundation could support |
| Event wiring was scene-global (no grouping) | Schema evolution needed early | Document 00, Section 1.7: "Event wiring is scene-global -- can get unwieldy" |
| Single root node (can't represent multiple scenes) | Architecture locks in assumptions | Document 00, Section 1.7: "Single root node -- can't represent additive loading" |
| Message-based deltas without formal conflict model | Operation semantics gap | Document 00, Section 1.6: Object locking without property-level conflict resolution |
| Nested tree scene graph (O(n) lookup, complex reparenting) | Performance traps at scale | Document 00, Section 5.1: Moved to flat map for O(1) access |

## Sources

- **Riff3D v1 Prototype Analysis** -- Direct codebase analysis of `/home/frank/riff3d-prototype/` including 9 completed phases, 30+ component definitions, and 4 rebuild research documents (HIGH confidence: primary source)
- **Rebuild Research Documents** -- `/home/frank/riff3d-prototype/.planning/rebuild-research/00-04`: Universal schema, Canonical IR, IQL, and spatial validation research (HIGH confidence: authored for this project)
- **PlayCanvas Editor Source** -- `/home/frank/playcanvas-editor/src/`: Schema system, entity migrations (460+ lines), template conflict resolution, version control merge handling (HIGH confidence: direct code analysis)
- **PlayCanvas Engine Source** -- `/home/frank/playcanvas-engine/src/`: Graphics device abstraction (WebGL2/WebGPU adapter pattern), component system architecture (HIGH confidence: direct code analysis)
- **Babylon.js Editor Source** -- `/home/frank/babylon-editor/editor/src/`: Scene loading, physics shape handling, node parenting patterns (HIGH confidence: direct code analysis)
- **Babylon.js Engine Source** -- `/home/frank/babylonjs/packages/`: Engine architecture, package structure, physics integration patterns (HIGH confidence: direct code analysis)
- **FOUNDATION.md** -- `/home/frank/riff3d-prototype/.planning/rebuild-research/FOUNDATION.md`: Architecture spine, contracts, phase gates, 2-template rule (HIGH confidence: project specification)
- **glTF/USD/OMI Ecosystem** -- Patterns from glTF 2.0 extensions (KHR_interactivity, KHR_physics_rigid_bodies), USD composition model, OMI group multi-implementation requirements (MEDIUM confidence: training data, not verified against latest 2026 specs)
- **Failed Universal Format History** -- VRML/X3D specification bloat, COLLADA abandonment in favor of glTF, USD's 15-year maturation (MEDIUM confidence: well-documented industry history in training data)
- **Figma/Roblox Collaboration Patterns** -- Figma's OT approach, Roblox Studio's per-instance locking, Unity Collab deprecation (MEDIUM confidence: training data covering public engineering blog posts)

---
*Pitfalls research for: Contract-first, operation-driven, portable 3D engine/editor (Riff3D)*
*Researched: 2026-02-19*
