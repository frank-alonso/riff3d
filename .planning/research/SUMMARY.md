# Project Research Summary

**Project:** Riff3D
**Domain:** Web-based 3D engine/editor collaboration platform with portable scene representations
**Researched:** 2026-02-19
**Confidence:** MEDIUM-HIGH

## Executive Summary

Riff3D is a contract-first, operation-driven, web-native 3D game creation platform targeting two audiences simultaneously: casual creators who want party games fast, and professional developers who need portability and composability. The core architectural insight — confirmed by deep analysis of PlayCanvas engine source, Babylon.js source, and the failed v1 prototype — is that ALL editor mutations must flow through a deterministic PatchOps layer sitting above a structured ECSON document model. This is not an aesthetic choice: it is what enables undo/redo, real-time collaboration, AI authoring, deterministic replay, and multi-engine ejection from a single unified system. PlayCanvas and Spotify's collaborative tools both prove this pattern at production scale.

The recommended approach is to build contracts first and resist the temptation to touch any editor UI until the ECSON schema, PatchOps engine, Canonical IR compiler, and golden fixture conformance tests are all proven in isolation. The monorepo structure (ecson → patchops → canonical-ir → adapters → editor) is the critical path. PlayCanvas (~2.16) is the primary runtime adapter target because its ECS maps naturally to the Canonical IR; Babylon.js (~8.51) is the validation adapter that proves engine-agnosticism. Yjs CRDTs replace the prototype's Colyseus-based locking for collaboration — they are offline-first and handle conflict resolution automatically.

The top risks are: (1) ECSON schema growing into a "universal format gravity well" that no single engine fully supports, (2) PatchOps lacking explicit conflict semantics before collaboration is layered on, and (3) the dual-adapter strategy producing two half-working adapters instead of one complete one. All three risks are avoidable by following FOUNDATION.md's 2-template rule for schema expansion, classifying every PatchOp's conflict category in Phase 0, and designating PlayCanvas as primary with Babylon.js as validation-only until conformance hits 90%.

### Mini-Game Template Research Addendum

For template-focused game design and AI-assistant authoring workflows, see:

- `.planning/research/MINIGAME_TEMPLATES_AI_PLAYBOOK.md` — archetype schema v2, fun scoring rubric, telemetry contracts, template promotion gates, and AI generation workflow constraints.

---

## Key Findings

### Recommended Stack

The stack is anchored by Next.js 16 + React 19 (already installed) for the editor shell, with PlayCanvas (~2.16) and Babylon.js (~8.51) as engine-native runtime adapters embedded in raw canvas elements — not React components. This React-editor / engine-viewport separation is proven by both PlayCanvas and Babylon.js editors themselves, and is a hard requirement for engine-agnostic rendering. Zustand (^5.0) bridges the React editor and the 3D viewport via a store that both subscribe to. Zod (^4.3) is both the validation layer and the schema definition language — Zod schemas ARE the ECSON spec.

For collaboration, Yjs (^13.6) with y-websocket replaces the prototype's Colyseus approach. Yjs is offline-first, handles CRDT conflict resolution automatically, and maps cleanly to ECSON's flat entity map via Y.Map nested types. Supabase handles auth, project metadata (Postgres), and asset storage (GLB, textures). The monorepo runs on pnpm + Turborepo with the dependency order: ecson → patchops → canonical-ir → adapters → editor.

**Core technologies:**
- **Next.js 16 + React 19:** Editor shell, routing, server components for lobby/profiles — already installed
- **PlayCanvas ~2.16:** Primary web runtime adapter — MIT licensed, ECS maps naturally to ECSON component model
- **Babylon.js ~8.51:** Validation web runtime adapter — Apache 2.0, imperative model proves engine-agnosticism of the IR
- **Zustand ^5.0:** Editor state bridge between React panels and 3D viewport — works outside React render cycle
- **Zod ^4.3:** ECSON schema definitions + runtime validation — single source of truth for all contracts
- **Yjs ^13.6 + y-websocket:** CRDT-based collaboration — offline-first, replaces Colyseus locking
- **Supabase:** Auth, Postgres (metadata), Storage (assets) — all backend needs in one
- **Vitest ^4.0 + Playwright ^1.58:** Testing spine — PatchOps determinism, round-trips, adapter conformance

**Avoid:**
- React-Three-Fiber (couples 3D runtime to React, makes engine-agnostic adapters impossible)
- Three.js directly (no ECS, no physics, no serialization — would rebuild PlayCanvas poorly)
- Colyseus for editor collaboration (designed for game rooms, not document editing)
- Redux (too much boilerplate for high-frequency PatchOp application)

### Expected Features

**Must have (table stakes):**
- 3D viewport with orbit/pan/zoom and transform gizmos (translate/rotate/scale)
- Scene hierarchy tree with drag-to-reparent and search
- Inspector panel with dynamic forms auto-generated from component schemas
- Undo/redo via operation log (PatchOps must be invertible)
- Save/auto-save — ECSON persistence to Supabase
- Asset library with at minimum primitives, basic props, and materials
- Play-test from editor (Edit → Play transition without page reload)
- Multiplayer cursors and presence (Figma-quality is the bar)
- User accounts + authentication (Google, Discord, GitHub via Supabase)
- PBR materials, directional/point/spot lighting, camera entities
- GLB/glTF import

**Should have (competitive differentiators):**
- PatchOps as universal edit language (no competitor has this — enables everything else)
- IQL intent language for AI authoring (90-97% token reduction vs raw JSON)
- ECSON → Canonical IR → Engine Adapter pipeline (true engine-agnostic portability)
- Verb surface: "Add Character", "Make It Bouncy", "Start Game" mapped to PatchOps
- Pre-built behavior components: ScoreZone, KillZone, Spawner, Timer, Checkpoint (30+ target)
- Game templates as fully-playable starting points (Party Game Starter, Character Playground, Physics Toy, Cinematic Clip)
- Party/playlist system with cumulative scoring across games
- Game ejection to standalone Vite projects via Canonical IR adapters
- Embodied avatar editing (walk your scene while editing)

**Defer (v2+):**
- Visual scripting (node-based Blueprints) — pre-built components cover 80% of cases
- Full asset creation tools (modeling, texturing, sculpting) — import GLB instead
- Marketplace / economy — legal overhead, premature
- Real-time multiplayer at >8 player scale
- Godot/Unity adapters — validate Canonical IR first with PlayCanvas + Babylon
- Plugin/extension API — wait for contracts to stabilize

### Architecture Approach

The architecture is a strict layered pipeline: IQL/Editor UI → PatchOps (operations layer) → ECSON (source-of-truth document) → Canonical IR compiler → Engine Adapters. No layer can skip the one below it. The editor reads ECSON directly but writes only through PatchOps. Adapters read Canonical IR only — they never touch ECSON or PatchOps. Collaboration operates at the PatchOps level, meaning engine objects are never synced across clients; clients receive PatchOps, apply them to their local ECSON, and their adapter reflects changes. The monorepo package structure enforces these boundaries through the dependency graph.

**Major components:**
1. **ECSON Store** — Authoritative flat entity map (keyed by stable ID), asset registry, event wiring, game settings. Schema-versioned with migrations. Engine-agnostic JSON only.
2. **PatchOps Engine** — Applies CreateEntity/DeleteEntity/SetProperty/AddComponent/Reparent/BatchOp etc. to ECSON. Generates inverses for undo. Serializes ops to the shared operation log. All edits flow through here without exception.
3. **Canonical IR Compiler** — Resolves assets, compiles high-level behavior components (ScoreZone → TriggerVolume + actions), topologically sorts nodes, produces the normalized portable representation adapters consume.
4. **Engine Adapters (PlayCanvas + Babylon.js)** — Thin translators (~1000-1200 LoC each) from Canonical IR to engine-specific runtime calls. Incremental delta updates, not full scene rebuilds on every edit.
5. **Collaboration Layer** — Shared PatchOps log with Lamport timestamps, LWW conflict resolution per property path initially, Yjs CRDT for offline-first persistence.
6. **IQL Compiler** — Parses intent language, expands presets, resolves spatial references, outputs PatchOps. Never touches ECSON directly. A thin expansion layer, not a second language.
7. **Conformance Harness** — Golden fixtures, round-trip tests, adapter conformance with epsilon tolerance, performance budget enforcement in CI.

### Critical Pitfalls

1. **Universal Format Gravity Well** — ECSON grows to cover every engine upfront, becomes unusable superset. Avoid by capping v0 portable subset at under 20 component types, adding concepts only when two independent templates require them (the 2-template rule), and running adapter LoC budget as a hard CI metric (>1500 LoC = abstraction leak).

2. **PatchOps Without Operational Semantics** — Ops are designed for sequential application but collaboration requires concurrent execution. Avoid by classifying every op in Phase 0 into: commutative property sets (LWW safe), structural ops (require causal ordering), and cross-entity ops (require reference validation). Build "conflict visible, never silent" into the log from day one.

3. **Adapter Abstraction Collapses to Lowest Common Denominator** — Physics behavior differs across engines; feature pressure either restricts features to what all engines do identically, or introduces silent behavioral differences. Avoid by defining quantitative conformance tolerance bands for physics (not exact match), never exposing engine-specific capabilities through the portable subset, and maintaining strict adapter LoC budgets in CI.

4. **Schema Evolution Hell** — Every ECSON change requires migrations; without infrastructure this becomes unmanageable (PlayCanvas's 460-line entities-migrations.ts is the cautionary tale). Avoid by building migration infrastructure in Phase 0: schema version field, migration registry, migration tests against every golden fixture, additive-only changes with defaults for v0 schema.

5. **Dual Adapter Trap** — Two adapters both at 60-70% completion instead of one at 100%. Avoid by designating PlayCanvas as primary through Phase 0-1, developing all features in the Canonical IR first and proving in PlayCanvas, then porting to Babylon.js. Babylon.js must pass 90% conformance before any game template targets it.

---

## Implications for Roadmap

Based on the combined research, a 6-phase structure is recommended. Every phase gate has explicit exit criteria driven by the conformance harness — no phase is done until the tests pass.

### Phase 1: Contracts First (Foundation)

**Rationale:** Everything else depends on these contracts. The editor cannot be built without knowing what PatchOps look like. Adapters cannot be built without the Canonical IR. Collaboration cannot be designed without understanding op semantics. FOUNDATION.md's most important rule: define contracts before UI. This phase is 100% TypeScript + Zod + Vitest — no browser needed.

**Delivers:** ECSON schema with versioning and migration registry, PatchOps engine (all core op types with inverses), Canonical IR spec and compiler, 5 golden fixtures covering transforms/materials/lights/animation stub/events, conformance harness with round-trip tests and replay determinism tests.

**Addresses from FEATURES.md:** PatchOps contract (P0), ECSON schema (P0), Canonical IR (P0), Component registry (P0), Golden fixtures (P0)

**Avoids:** Universal format gravity well (by capping portable subset upfront), schema evolution hell (by building migration infrastructure now), operation semantics gap (by classifying all ops into conflict categories now)

**Research flag:** LOW — patterns are well-documented. ECSON design is validated by PlayCanvas scene parser analysis. PatchOps pattern is proven by prototype research.

### Phase 2: Closed Loop (Edit → Run)

**Rationale:** Prove the entire pipeline end-to-end with a minimal editor shell. The golden path (load fixture → apply PatchOps → save ECSON → compile to Canonical IR → render in PlayCanvas) must work before adding any collaboration, game logic, or second adapter. "Something you can see and demo" prevents momentum loss from a pure contracts-first phase.

**Delivers:** Minimal Next.js editor shell (no game features), 3D viewport with PlayCanvas adapter rendering Canonical IR, transform gizmos (translate/rotate/scale), scene hierarchy panel, inspector panel with schema-driven forms, undo/redo via operation log, basic ECSON save/load, verb surface initial set (Add Box, Add Light, Move, Paint).

**Uses from STACK.md:** Next.js + React + Tailwind + Radix UI for editor shell; PlayCanvas ~2.16 embedded in raw canvas; Zustand for state bridge; Immer for immutable mutations.

**Implements:** Editor UI component + PlayCanvas Adapter. Exit criteria: load a golden fixture, apply a PatchOp, save, compile, render. Undo the op, verify scene matches original.

**Avoids:** Dual adapter trap (PlayCanvas is primary; no Babylon work yet), full scene rebuild on every PatchOp (adapter must apply incremental deltas)

**Research flag:** LOW for editor shell — standard React patterns. MEDIUM for transform gizmo implementation details — may need phase-specific research.

### Phase 3: Dual Adapter Validation

**Rationale:** Adding Babylon.js is the acid test for the Canonical IR. If it can be written without changing the IR, the abstraction is sound. If it requires IR changes, fix the IR before proceeding. This phase validates the core architectural thesis.

**Delivers:** Babylon.js adapter (~1000-1200 LoC) implementing the full EngineAdapter interface, adapter conformance tests for both PlayCanvas and Babylon.js with epsilon tolerance, all 5 golden fixtures rendering within tolerance bands on both adapters, runtime adapter switching in the editor.

**Uses from STACK.md:** Babylon.js ~8.51 + @babylonjs/loaders; Vitest + Playwright for conformance.

**Implements:** Babylon.js Adapter + expanded Conformance Harness. Exit criteria: all golden fixtures pass conformance on both adapters within defined tolerance bands.

**Avoids:** Adapter abstraction collapse (tolerance bands prevent both over-restricting and silent divergence), Babylon-specific Euler/quaternion gotcha (always use rotationQuaternion, never mesh.rotation)

**Research flag:** MEDIUM — Babylon.js PhysicsAggregate vs PlayCanvas rigidbody+collision mapping needs careful validation. The rotation system difference (degrees vs radians, quaternion priority) is a known integration gotcha.

### Phase 4: Collaboration-Ready Core

**Rationale:** Collaboration must be built on PatchOps semantics, not bolted onto completed features. Building it after dual adapter validation means the op format is stable. Yjs provides the CRDT backbone; the Riff3D collaboration layer maps PatchOps to Yjs transactions.

**Delivers:** Yjs-backed ECSON document model (Y.Map entity store), y-websocket server deployed as long-running Node.js process, object-level locking with hierarchical propagation, multiplayer cursors and presence via Yjs awareness protocol, offline editing via y-indexeddb, LWW conflict resolution per property path, shared operation log with Lamport timestamps, conflict visibility in the UI (activity feed showing overridden changes).

**Uses from STACK.md:** Yjs ^13.6, y-websocket ^2.0, y-indexeddb ^9.0; Supabase for auth + project metadata; Zustand subscribeWithSelector for granular editor state updates.

**Implements:** Collaboration Layer + y-websocket server. Exit criteria: two concurrent users editing the same ECSON document converge within 5 seconds; undo on one client does not undo another client's operations.

**Avoids:** Operation semantics gap (LWW is explicitly implemented with Lamport timestamps, structural ops get causal ordering), tree CRDT unsolved problems (using server-authoritative ordering with client prediction, not pure CRDT for structural ops)

**Research flag:** MEDIUM — Yjs version compatibility (^13.6 confirmed from training data, needs npm verification before first install). y-websocket deployment patterns with Supabase persistence need validation.

### Phase 5: Game Runtime Foundations

**Rationale:** The game-specific layer sits on top of the stable foundation. Physics, character controller, game state machine, and behavior components are the fun-first wedge features. They must NOT contaminate the core — GameSettings is a module, not part of ECSON core schema.

**Delivers:** Physics runtime via PlayCanvas Ammo.js + Babylon.js Havok (abstracted in Canonical IR as intent, not implementation), character controller (third-person, keyboard + touch), game state machine (lobby/countdown/playing/results), initial behavior component set (ScoreZone, KillZone, Timer, Spawner, Checkpoint), Play-test from editor ("Play" button transitions from edit mode to isolated runtime), win conditions and basic scoring.

**Implements:** Game runtime module on top of the core pipeline. Exit criteria: a scene with a character, platforms, and a ScoreZone can be authored and play-tested in the editor within the golden path workflow.

**Avoids:** Fun-first to professional scaling trap (GameSettings is a module; creating a scene without a game template still works), performance trap for spatial indexing (BVH for selection raycasting implemented before large scenes exist)

**Research flag:** HIGH — Physics behavior tolerance between PlayCanvas Ammo.js and Babylon.js Havok needs explicit measurement and tolerance definition. Character controller implementation details (jump feel, collision response, touch input normalization) merit a focused research spike.

### Phase 6: Templates, Party System, and IQL

**Rationale:** Templates validate the full stack end-to-end. The 2-template rule (FOUNDATION.md) applies here: template development drives any remaining ECSON schema additions. IQL is additive and can be layered on once PatchOps are stable. The party/playlist system completes the fun-first differentiation.

**Delivers:** Initial game templates (Party Game Starter, Character Playground, Physics Toy, Cinematic Clip), party/playlist system with cumulative scoring and between-game ceremony, IQL compiler + MCP server (SPAWN/SET/MOVE/PAINT/DELETE verbs + 10+ presets + 15+ modifiers), spatial validation for AI-generated levels (jump arc physics, reachability graph), game ejection to standalone Vite projects via Canonical IR adapters, touch controls for mobile play.

**Uses from STACK.md:** All previously established stack. IQL is pure TypeScript with no new dependencies.

**Avoids:** IQL becoming a second language (strict compilation boundary — every IQL op produces valid PatchOps, bypass test in CI), Universal format gravity well (2-template rule gates any new ECSON schema additions during this phase)

**Research flag:** HIGH for party/playlist system — cross-game score normalization (points-based vs placement-based) needs design research. MEDIUM for IQL — the language design is well-researched but the MCP server integration with specific AI clients needs validation.

---

### Phase Ordering Rationale

The ordering strictly follows the dependency graph: contracts before implementations, primary adapter before secondary, collaboration before game features, game features before templates. This is not arbitrary — every layer depends on the one below being stable. The key insight from the prototype's failure mode is that 30+ behavior components were built before the schema that should represent them was stable, creating a migration nightmare and engine-coupling problems. This roadmap inverts that order.

Critical path: `ecson` → `patchops` → `canonical-ir` → PlayCanvas adapter → editor shell. Everything else is parallel or follow-on.

Collaboration in Phase 4 (not Phase 2) is a deliberate choice. The op format needs to be exercised by real editor usage before adding distributed semantics. Building collaboration too early means distributing an unstable op schema.

Game templates in Phase 6 (not Phase 1) follows the FOUNDATION.md principle that templates validate what belongs in the core, not the other way around. Templates authored in Phase 6 will reveal any remaining gaps in the Canonical IR's portable subset.

### Research Flags

**Needs dedicated research spike before implementation:**
- **Phase 5 (Game Runtime):** Physics tolerance between Ammo.js and Havok needs empirical measurement. Character controller feel is notoriously hard to get right. Both deserve a focused research session before implementation begins.
- **Phase 6 (Party System):** Cross-game score normalization has no established pattern in the literature. Design research needed before the data model is committed.
- **Phase 6 (IQL MCP Server):** MCP server integration patterns with Claude Code/Cursor need validation against actual client behavior.

**Standard patterns, research optional:**
- **Phase 1 (Contracts):** Zod schema design, PatchOps discriminated unions, and migration registries are well-documented patterns. Research would be optimization, not necessity.
- **Phase 2 (Closed Loop):** React editor shell with Zustand + Radix UI + Tailwind is standard. PlayCanvas canvas integration is documented in PlayCanvas engine source (already analyzed).
- **Phase 3 (Dual Adapter):** Babylon.js adapter mapping table is fully derived from source code analysis. Known gotchas (rotation system, PhysicsAggregate) are documented in ARCHITECTURE.md.
- **Phase 4 (Collaboration):** Yjs + y-websocket patterns are well-documented; Liveblocks and Tiptap both use identical patterns. Version verification (npm view) is the only prerequisite.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core framework (Next.js, React, PlayCanvas, Babylon.js, Zustand, Zod) verified from local repo files and installed packages. Yjs versions are MEDIUM — training data only, need npm verification before install. |
| Features | HIGH | Feature landscape derived from direct source analysis of PlayCanvas editor, Babylon.js editor, and prototype research. Competitor analysis (Figma, Roblox, Spline) is MEDIUM — based on training data knowledge of 2026 state. |
| Architecture | HIGH | Based on direct source code analysis of PlayCanvas engine (GraphNode, Entity, ComponentSystem, SceneParser), PlayCanvas editor (Observer, ShareDB, history), Babylon.js (Node, Behavior, Scene), and Babylon editor (undo/redo). Pattern validity cross-validated against prototype rebuild research (4 deep-dive documents). |
| Pitfalls | HIGH | 7 critical pitfalls are all grounded in specific evidence: prototype failure modes (document 00-03), PlayCanvas editor's 460-line migration file, COLLADA/VRML/USD historical failures, Figma's OT journey. Not speculative. |

**Overall confidence:** HIGH

### Gaps to Address

- **Yjs package versions:** Yjs ^13.6, y-websocket ^2.0, y-indexeddb ^9.0 are from training data. Run `npm view yjs version`, `npm view y-websocket version`, `npm view y-indexeddb version` before Phase 4 dependency installation. Major versions are likely correct; minor/patch need verification.

- **pnpm + Turborepo monorepo migration:** The project is currently a single Next.js app at `/home/frank/riff3d`. Migrating to a monorepo structure (apps/editor + packages/*) is a Phase 1 prerequisite. The migration strategy (move existing code into apps/editor, extract packages) needs a dedicated setup step at the start of Phase 1.

- **Cross-game score normalization:** No established pattern found in research for normalizing points-based (most points wins) vs. placement-based (best finishing position wins) scores in a party playlist. This is a design problem, not a technology problem. Needs design research in Phase 6 planning.

- **Physics tolerance bands:** ARCHITECTURE.md recommends quantitative conformance tolerance (e.g., "bouncing ball dropped from 2m must bounce to 1.4-1.7m on all adapters"). The actual numbers need empirical measurement from both PlayCanvas Ammo.js and Babylon.js Havok in Phase 3. Define tolerance by measuring, not by estimating.

- **IQL MCP client integration:** The IQL research documents MCP server design (4 tools: execute_iql, describe_scene, list_presets, validate_iql) but the actual MCP client integration with Claude Code / Cursor clients needs validation against real client behavior. This is a Phase 6 concern but worth confirming the MCP tool schema is stable before committing to it.

---

## Sources

### Primary (HIGH confidence)
- `/home/frank/playcanvas-engine/src/` — Direct analysis of GraphNode, Entity, Component, ComponentSystem, SceneParser serialization format
- `/home/frank/playcanvas-editor/src/` — Direct analysis of Observer-based entities, ShareDB collaboration, History system, entity CRUD operations
- `/home/frank/babylonjs/packages/dev/core/src/` — Direct analysis of Node, TransformNode, Scene, Behavior interface, serialization
- `/home/frank/babylon-editor/editor/src/` — Direct analysis of undo/redo stack, project structure
- `/home/frank/riff3d-prototype/.planning/rebuild-research/` — Universal Schema Research (00), Canonical IR (01), IQL (02), Spatial Validation (03), FOUNDATION.md — authoritative project documents
- `/home/frank/riff3d/package.json` — Next.js 16.1.6, React 19.2.3, Tailwind v4 confirmed installed

### Secondary (MEDIUM confidence)
- Prototype npm verification (2026-02-10): Zustand 5.0.11, Zod 4.3.6, Vitest 4.0.18, Playwright 1.58.2, Immer 11.1.4, nanoid 5.1.6, @tanstack/react-query 5.90.20, @supabase/supabase-js 2.95.3, @supabase/ssr 0.8.0
- Reference project analysis: Transfer Thought, React Three Game, WawaGuys, R3F Character Configurator — component registry patterns, serialization approaches
- Competitor knowledge: PlayCanvas, Spline, Figma, Roblox Studio, Babylon.js Editor feature sets

### Tertiary (LOW confidence, verify before use)
- Yjs ^13.6, y-websocket ^2.0, y-indexeddb ^9.0 — training data; run `npm view` before installing
- pnpm ^9, Turborepo ^2 — training data; major versions likely correct
- Automerge, Liveblocks, PartyKit comparative assessments — training data

---

*Research completed: 2026-02-19*
*Ready for roadmap: yes*
