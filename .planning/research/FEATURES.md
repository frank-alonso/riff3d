# Feature Research

**Domain:** Web-based 3D engine/editor collaboration platform
**Researched:** 2026-02-19
**Confidence:** MEDIUM-HIGH (synthesized from prototype research, reference codebase analysis, PlayCanvas/Babylon.js editor source inspection, FOUNDATION.md architecture, and established competitor knowledge)

## Feature Landscape

This document maps the feature space for web-based 3D engine/editors and collaboration platforms, categorized by what users expect (table stakes), what creates competitive advantage (differentiators), and what to deliberately avoid (anti-features). Features are further mapped to Riff3D's fun-first wedge vs. pro-capable foundation layers, with PatchOps implications and dependency chains noted throughout.

### Competitive Landscape Summary

| Product | Type | Key Strengths | Key Gaps |
|---------|------|---------------|----------|
| **Unity** | Desktop native engine/editor | Full-featured editor, massive ecosystem, C# scripting, Asset Store | No web editor, no real-time collaboration (Git-based workflows), steep learning curve |
| **Unreal Engine** | Desktop native engine/editor | Visual quality, Blueprints visual scripting, UEFN for Fortnite | Heavy (100GB+), no web editor, complex for casual creators |
| **Godot** | Desktop open-source engine/editor | Lightweight, open-source, GDScript, scenes-as-files, signal/slot system | No web editor, no real-time collaboration, small asset ecosystem |
| **PlayCanvas** | Web-based engine + cloud editor | Real-time collaboration, web-native, WebGPU support, template system, script attributes | Cloud-dependent (no offline), limited built-in game logic components, pro features paywalled |
| **Babylon.js Editor** | Desktop app (Electron) for Babylon.js | Node Material Editor, Particle Editor, multiple project templates (Next.js, SolidJS, Vanilla) | Desktop-only, no real-time collaboration, no game-specific features |
| **Three.js Editor** | Minimal web-based editor | Zero-install, open-source, direct Three.js manipulation | Extremely bare-bones, no collaboration, no game logic, no save/publish |
| **Figma** | Web-based 2D design tool | Gold-standard multiplayer cursors, presence, commenting, components/variants, Dev Mode | 2D only -- but its collaboration patterns are the benchmark |
| **Spline** | Web-based 3D design tool | Beautiful UI, real-time collaboration, 3D for designers (not engineers), animations, interactions | No game logic, no physics engine, limited programmability, design-focused not game-focused |
| **Vectary** | Web-based 3D design tool | Product visualization, AR preview, team workspaces, embeddable 3D | No game logic, no physics, product/marketing focus |
| **Roblox Studio** | Desktop game creation platform | Massive player base, built-in monetization, Team Create collaboration, Lua scripting | Desktop-only, locked to Roblox platform, kids-focused, no portability |
| **Fortnite Creative / UEFN** | Desktop game creation within Fortnite | Unreal quality, massive audience, Verse scripting | Locked to Fortnite, requires Epic launcher, steep learning curve |

### Key Competitive Insights

1. **PlayCanvas is the closest web-based competitor.** It has real-time collaboration, a web editor, templates, and a script system. But it lacks opinionated game-creation workflows -- it is a general-purpose engine editor, not a game-creation platform.

2. **Spline proves web 3D collaboration works.** Spline has shown that real-time multiplayer 3D editing in the browser is viable and appealing. Its limitation is that it targets designers, not game creators.

3. **Figma sets the collaboration bar.** Any collaborative tool in 2026 is compared to Figma. Multiplayer cursors, presence indicators, commenting, and component systems are expected, not differentiating.

4. **No web-based tool combines editing + game logic + collaboration.** PlayCanvas has editing + collaboration. Roblox has editing + game logic. Nobody has all three in the browser.

5. **Core (Manticore Games) shut down in 2023.** "Roblox but different" is not a viable strategy. Differentiation must come from the creation workflow and portability, not just being another platform.

---

## Table Stakes (Users Expect These)

Features users assume exist. Missing these means the product feels incomplete or broken.

### Editor Core

| Feature | Why Expected | Complexity | PatchOps Needed | Fun-First / Pro | Notes |
|---------|--------------|------------|-----------------|-----------------|-------|
| 3D viewport with orbit/pan/zoom | Every 3D tool from Unity to Spline to Three.js Editor has this. Users cannot work without spatial navigation. | LOW | No (view-only) | Both | WASD fly-camera needed for larger scenes. Spline and PlayCanvas both support multiple camera modes. |
| Object transform gizmos (translate/rotate/scale) | Universal 3D editing primitive across all tools. Figma has equivalent 2D transform handles. | LOW | SetProperty (transform) | Both | Snap-to-grid is expected. PlayCanvas and Babylon.js Editor both provide snap controls. |
| Scene hierarchy / tree view | Unity Hierarchy, Roblox Explorer, PlayCanvas Entity panel, Godot Scene tree. Users need to find and organize objects. | MEDIUM | AddChild, RemoveChild, Reparent | Both | Must support drag-to-reparent, multi-select, search/filter. Figma's layer panel is the UX benchmark. |
| Properties / inspector panel | Standard in all editors (Unity Inspector, PlayCanvas Inspector, Babylon.js properties panel). | MEDIUM | SetProperty, SetComponentProperty | Both | Dynamic form generation from component schemas. Typed property schemas from the universal schema research enable auto-generated inspectors. |
| Undo/redo | Universal expectation. Every creative tool from Figma to Unity to Photoshop has this. Losing work without undo is unacceptable. | HIGH | All ops must be invertible via BatchOp | Both | Especially hard with collaboration. Per-user undo stacks needed. FOUNDATION.md requires PatchOps to be invertible. The operation log is the undo backbone. |
| Copy/paste/duplicate | Basic editing operation in every tool. | LOW | CreateEntity (batch), SetProperty (batch) | Both | Must work within same scene. Cross-scene clipboard is v1.x. |
| Grid/snap system | PlayCanvas, Unity, Roblox all have configurable snap. Essential for level design alignment. | LOW | No (editor-local) | Both | Configurable grid size, rotation snap increments. Visual grid helper in viewport. |
| Save / auto-save | Losing work is unforgivable. Every creation tool auto-saves (Figma, Google Docs, Spline). | MEDIUM | No (persistence layer) | Both | ECSON to persistent storage. Auto-save on interval + on significant changes. Must handle save conflicts in collaborative sessions. |
| Asset library / object palette | Roblox Toolbox, PlayCanvas Asset panel, Unity Asset Store. Users need pre-made assets to build with. | MEDIUM | AddAsset, ReplaceAssetRef | Both | Curated starter library is critical. Empty library = empty scenes = users leave. Need at minimum: basic primitives, props, materials, characters. |
| Play-test from editor | Roblox "Play" button, Unity Play Mode, Godot "Run Scene". Instant test loop is essential. | MEDIUM | No (runtime transition) | Both | Must transition from editor state to runtime without page reload. FOUNDATION.md golden path: "Edit via Verbs/Tools -> Play -> Iterate." |

### Collaboration Core

| Feature | Why Expected | Complexity | PatchOps Needed | Fun-First / Pro | Notes |
|---------|--------------|------------|-----------------|-----------------|-------|
| Multiplayer cursors / presence | Figma made this the standard. Spline has it. PlayCanvas has it. Users expect to see who is in the document. | MEDIUM | No (ephemeral state) | Both | Colored cursors with user names. Both 2D overlay and 3D viewport indicators. Figma/Spline quality is the benchmark. |
| Object-level locking | PlayCanvas uses entity locking for concurrent editing. Figma components lock when being edited. | MEDIUM | No (lock management layer) | Both | FOUNDATION.md: "shared operation log model, conflict strategy documented." Hierarchical locking -- locking parent locks descendants. |
| User avatars / identity in session | Figma shows user bubbles. Spline shows collaborator list. Users need to know who is working on what. | LOW | No (presence layer) | Both | Display name, avatar color, connection status. |

### Project Management

| Feature | Why Expected | Complexity | PatchOps Needed | Fun-First / Pro | Notes |
|---------|--------------|------------|-----------------|-----------------|-------|
| User accounts + authentication | Every platform requires accounts. Cannot save work without identity. | MEDIUM | No (auth layer) | Both | Social logins (Google, Discord, GitHub). |
| Project list / dashboard | Figma home screen, PlayCanvas dashboard, Unity Hub. Users need to find their work. | LOW | No (CRUD) | Both | List created projects with thumbnails, last-modified dates. |
| Shareable project links | Figma share links, Google Docs links, PlayCanvas project URLs. | LOW | No (URL routing) | Both | Deep-link into specific project/scene. |

### Rendering & Scene

| Feature | Why Expected | Complexity | PatchOps Needed | Fun-First / Pro | Notes |
|---------|--------------|------------|-----------------|-----------------|-------|
| PBR materials (basic) | Every modern 3D tool supports PBR. PlayCanvas, Babylon.js, Three.js all use PBR pipelines. | MEDIUM | SetComponentProperty (material) | Both | Part of FOUNDATION.md portable subset: "materials (baseline PBR-ish subset)." Color, metalness, roughness, emissive at minimum. |
| Lighting (directional, point, spot) | Part of FOUNDATION.md portable subset. Every 3D editor has basic lighting. | LOW | CreateEntity + AddComponent | Both | Environment/ambient lighting also needed. Shadows are expected but can be lower quality on mobile. |
| Camera entities | Part of FOUNDATION.md portable subset. Users need to set up game cameras. | LOW | CreateEntity + AddComponent | Both | Perspective and orthographic projection. |
| GLB/glTF import | The standard 3D interchange format. Every web 3D tool supports it. PlayCanvas, Babylon.js, Three.js all have native glTF loading. | MEDIUM | AddAsset + CreateEntity | Both | This is how users bring in external 3D models. Must handle textures, materials, animations embedded in GLB. |
| Environment settings (skybox, fog) | PlayCanvas scene settings, Unity Lighting window, Babylon.js scene properties. Expected for any 3D scene. | LOW | SetProperty (environment) | Both | Skybox color/image, fog type/density, ambient light settings. |

---

## Differentiators (Competitive Advantage)

Features that set Riff3D apart. Not required by the market, but create the unique value proposition.

### Core Differentiator: Contract-First Operation Architecture

| Feature | Value Proposition | Complexity | PatchOps Needed | Layer | Notes |
|---------|-------------------|------------|-----------------|-------|-------|
| PatchOps as universal edit language | **No competitor has this.** Every edit flows through a deterministic, serializable, replayable operation system. Enables AI manipulation, collaboration, undo/redo, and audit trail from a single primitive. | HIGH | This IS PatchOps | Foundation | FOUNDATION.md: "All meaningful edits flow through PatchOps. No hidden state mutations." This is the architectural moat. PlayCanvas has Observer for data binding; Unity has SerializedProperty; but neither exposes operations as first-class. |
| IQL (intent language) for AI authoring | **No competitor has this.** 90-97% token reduction vs raw JSON for AI-assisted scene building. "Describe your game and watch it build." | HIGH | Compiles to PatchOps | Foundation | IQL research shows 12x cost reduction for AI sessions. IQL as MCP server enables Claude Code integration. PlayCanvas has no AI authoring layer. |
| ECSON -> Canonical IR -> Engine Adapters | **No competitor has this portable pipeline.** A scene authored in Riff3D can compile to PlayCanvas, Babylon.js, Godot, or Unity projects via thin adapters. | HIGH | No (compilation pipeline) | Foundation | glTF-aligned canonical IR. Adapter research estimates ~1000-2000 LoC per engine target. Needle Engine is the closest precedent but is Unity->web only, not bidirectional. |
| Deterministic operation replay | PatchOps are replayable: ECSON0 + ops = ECSON1, always. Enables time-travel debugging, branch/merge workflows, and collaboration merge strategies. | MEDIUM | All ops by definition | Foundation | FOUNDATION.md: "Deterministic: same input state + same ops = same output." No competitor offers deterministic replay of editing operations. |

### Core Differentiator: Verb-Driven UX (Fun-First Wedge)

| Feature | Value Proposition | Complexity | PatchOps Needed | Layer | Notes |
|---------|-------------------|------------|-----------------|-------|-------|
| Opinionated verb surface ("Add Character", "Make It Bouncy", "Start Game") | **No web 3D tool does this.** Unity/PlayCanvas expose raw components. Roblox requires scripting. Riff3D verbs map to PatchOps and produce working game elements with one click. | MEDIUM | Each verb = 1+ PatchOps | Fun-first | FOUNDATION.md: "Opinionated surface area (verbs)... These verbs map cleanly to PatchOps and are easy for AI to generate/modify safely." This IS the fun-first wedge. |
| Template-driven development ("Pick Template -> Edit -> Play") | **Quality templates as playable starting points, not empty baseplates.** Roblox starts empty. Core had complex frameworks. Riff3D templates are complete, playable games you customize. | HIGH | Templates = ECSON documents | Fun-first | FOUNDATION.md: "Templates are the primary way we validate what belongs in the core." 2-template rule for core promotion. Initial: Party Game Starter, Character Playground, Physics Toy, Cinematic Clip. |
| Golden path workflow | A single, stable, low-friction blessed workflow that always works. Reduces cognitive load for new users. | MEDIUM | Validates PatchOps coverage | Fun-first | FOUNDATION.md: "Pick Template -> Edit via Verbs/Tools (PatchOps) -> Play (Web Runtime) -> Iterate -> Save/Share." If this breaks, it is a priority regression. |
| Pre-built behavior components (ScoreZone, Timer, KillZone, Spawner, etc.) | Drag-and-drop game logic without scripting. 30+ gameplay components proven in prototype. Roblox requires Lua. PlayCanvas requires JavaScript. | HIGH | AddComponent, SetComponentProperty | Fun-first | Prototype had 30+ behavior components across 6 categories. These compile to trigger volumes + actions in Canonical IR. Component quality is make-or-break for the fun-first layer. |

### Differentiator: Real-Time Collaborative 3D Editing (Web-Native)

| Feature | Value Proposition | Complexity | PatchOps Needed | Layer | Notes |
|---------|-------------------|------------|-----------------|-------|-------|
| Web-based real-time co-editing | Roblox Team Create requires desktop app. UEFN requires Epic launcher. PlayCanvas is web-based but cloud-dependent. Riff3D: open a link, start editing together. | HIGH | All PatchOps broadcast via operation log | Both | PlayCanvas and Spline have proven this works in browsers. The differentiator is combining it with game logic authoring, not just visual editing. |
| Embodied avatar editing | **No competitor does this.** Walk around the 3D scene as your avatar while editing. Bridges the gap between "editor" and "game." | MEDIUM | No (presence/avatar layer) | Fun-first | Unique to Riff3D vision from prototype research. Makes collaborative editing feel like a game itself. |
| "Request control" for locked objects | Beyond simple locking. Figma-inspired flow where users can request access, owner can grant. Reduces frustration from lock contention. | LOW | No (lock management) | Both | PlayCanvas does not have this -- it uses simple entity locking. |

### Differentiator: Portability & Openness

| Feature | Value Proposition | Complexity | PatchOps Needed | Layer | Notes |
|---------|-------------------|------------|-----------------|-------|-------|
| Game ejection (export as standalone project) | **No game creation platform allows this.** Roblox, Fortnite, Core all locked content to their platform. Riff3D ejects clean Vite+R3F projects (and eventually PlayCanvas, Babylon, Godot, Unity). | HIGH | No (reads ECSON/Canonical IR) | Pro | Canonical IR research: ejection = Canonical IR -> Engine Adapter -> standalone project. Adapter estimated ~1000-2000 LoC per target. |
| Engine-agnostic scene format (ECSON + Canonical IR) | Scenes authored once can target multiple runtimes. No vendor lock-in. Aligns with glTF/KHR standards where possible. | HIGH | PatchOps define the authoring format | Pro | Universal schema research: flat entity map, shared asset registry, typed property schemas, separated physics. glTF-aligned Canonical IR with RIFF_ extensions for game-specific data. |
| Schema versioning + migrations | ECSON has explicit version fields and migration support. Old scenes always load in new editors. | MEDIUM | No (migration pipeline) | Foundation | FOUNDATION.md: "ECSON must include: schema version, migrations." PlayCanvas handles this via server-side migration; Riff3D does it client-side for offline capability. |

### Differentiator: Party/Multiplayer Game Platform

| Feature | Value Proposition | Complexity | PatchOps Needed | Layer | Notes |
|---------|-------------------|------------|-----------------|-------|-------|
| Playlist / party session system | **No competitor does this.** Mario Party has curated boards; Roblox has no playlist concept. Grouping games into playlists with cumulative scoring creates the party experience. | HIGH | No (runtime/session layer) | Fun-first | Architecturally significant -- games must report scores to a parent session. Score normalization across game types needs design work. |
| Instant play-test with friends | No publish step needed. Invite friends directly into your editor session to play-test. Roblox requires publishing to test with others. | MEDIUM | No (room management) | Fun-first | Huge iteration speed advantage. Colyseus room for editor extends to support play-test mode. |
| Cross-game cumulative scoring | Track scores across multiple games in a party session. What makes a "party" feel cohesive. | MEDIUM | No (session layer) | Fun-first | No established pattern for normalizing points-based vs. placement-based scores. Needs design research. |
| Between-game ceremony (scores, standings, transitions) | Mario Party's "after mini-game" screens with standings and fanfare. Makes party games exciting. | MEDIUM | No (UI/animation layer) | Fun-first | Polish here is critical for party feel. v1.x feature -- basic results screen for v1. |
| Shareable join links | Click a link to join a game or party session. Zero-install access. | LOW | No (URL routing) | Fun-first | Deep-link into specific game/playlist. |

### Differentiator: AI-First Authoring

| Feature | Value Proposition | Complexity | PatchOps Needed | Layer | Notes |
|---------|-------------------|------------|-----------------|-------|-------|
| IQL as MCP server for AI assistants | Claude Code, Cursor, or any MCP client can create/modify 3D scenes via tool calls. No other 3D tool offers this. | MEDIUM | IQL compiles to PatchOps | Foundation | IQL research: 4 MCP tools (execute_iql, describe_scene, list_presets, validate_iql). Enables "describe your game and watch it build" workflow. |
| Scene context compression (97% token reduction) | AI can understand the full scene state in ~350 tokens instead of ~12,000 tokens of raw JSON. More room for reasoning. | MEDIUM | No (read-only) | Foundation | IQL DESCRIBE ALL output. Critical for practical AI-assisted scene building at scale. |
| Spatial validation for AI-generated levels | Deterministic validation that AI-placed platforms are reachable given character physics. LLMs cannot reliably reason in 3D space (~55% accuracy vs 87% human baseline). | MEDIUM | No (validation layer) | Foundation | Spatial validation research: jump arc physics, reachable envelope computation, difficulty-as-percentage-of-max-range. |

---

## Anti-Features (Deliberately NOT Building)

Features that seem good but create problems for Riff3D specifically.

| Anti-Feature | Why Requested | Why Problematic | What to Do Instead |
|--------------|---------------|-----------------|-------------------|
| Visual scripting (node-based, Blueprints-style) | "Roblox has Lua, UEFN has Verse + Blueprints, we need visual scripting." | Massive implementation effort. Node editors are hard to build well (PlayCanvas uses PCUI-Graph, a dedicated library). Creates a second programming paradigm to maintain. The pre-built component library + event wiring already covers 80%+ of use cases. | Pre-built behavior component library for common patterns. Event wiring (WHEN trigger DO action). IQL for AI-assisted authoring. Simple scripting for the remaining 20% power-user cases. Evaluate visual scripting for v2+ only. |
| Full asset creation tools (modeling, texturing, sculpting) | "Users should be able to make everything in-platform." | Competing with Blender/Maya/Substance is insane. Even Babylon.js Editor's built-in tools are limited. Terrible ROI. Web-based 3D modeling tools are universally bad. Splits focus from the core value. | Curated asset library + GLB/glTF import. Primitive-based building for level design. Partner with asset marketplaces later. |
| In-platform voice/video chat | "Players need to communicate during games." | WebRTC is complex, expensive to scale, and creates moderation nightmares (COPPA compliance). Discord already exists and every gamer has it. | Discord integration link in lobbies. Text chat only for in-game communication. Quick-chat phrases/emotes for mobile. |
| Marketplace / economy (user asset trading) | "Let users sell assets and game passes like Roblox." | Requires payment processing, fraud prevention, tax compliance, content moderation at scale. Massive legal and operational overhead. Premature for a new platform. | Free curated asset library for v1. Creator tipping for v1.x. Full marketplace only at significant scale. |
| Native mobile/desktop apps | "Roblox has native apps, we need them too." | Massive development overhead. Three codebases (or Electron/React Native with 3D limitations). App store review processes. The web-first approach is the differentiator, not a limitation. | PWA for mobile home-screen install. Progressive enhancement for capable devices. Native apps only if web performance proves unacceptable at scale. |
| Complex terrain system | "Need terrain editing like Unity/Unreal." | Terrain engines are extremely complex (LOD, texturing, sculpting). Overkill for mini-games which are typically small, bounded arenas. | Pre-made terrain pieces (platforms, ramps, islands) as assets. Simple heightmap import if needed. |
| Shader graph editor | "Need custom materials like Unity Shader Graph or PlayCanvas Node Material Editor." | Babylon.js has NME (Node Material Editor) -- it is a substantial product in itself. Custom shader authoring is pro-tier complexity that conflicts with the fun-first wedge. | PBR material properties in inspector (color, metalness, roughness). Pre-set material library. Shader graph is a v2+ pro-tier feature if needed. |
| Procedural generation tools | "Auto-generate levels for infinite replayability." | Extremely complex to do well. Bad procedural generation is worse than hand-crafted levels. Misaligned with the "create your own game" vision. | Randomizable spawn points and object placement within hand-crafted layouts. Template variants for variety. IQL SCATTER command for AI-assisted procedural-ish placement. |
| Full animation authoring (keyframe editor, state machine UI) | "Need to animate objects in the editor." | Animation timeline editors are complex standalone products (Unity Animator, PlayCanvas Anim State Graph editor). | FOUNDATION.md portable subset includes "basic animation (transform keyframes)." Import animations from GLB. Event/trigger-based motion (MovingPlatform, PathFollower components). Full animation authoring is v2+. |
| Replay/recording system | "Let players watch replays of games." | Requires recording all game state over time, storage for replays, playback engine. High complexity for a feature most casual players rarely use. | Screenshot/clip capture. Spectator mode covers live watching. Replay system only for v2+ competitive features. |
| Plugin/extension marketplace | "Let developers build editor plugins like Unity or VS Code." | Plugin API design is extremely hard to get right. Creates backwards compatibility burden. Premature before core stabilizes. | FOUNDATION.md's template-driven development serves this need. Custom components can be registered. Full plugin API is v2+ after the core contracts are frozen. |
| Real-time multiplayer physics games at scale (50+ players) | "Support battle royale-style games." | Server-authoritative physics with 50+ players requires dedicated infrastructure, sophisticated interest management, and complex optimization. Rapier WASM on a single Colyseus server handles ~50 active rigid bodies max. | Target 2-8 player party games. Cap physics complexity per game. Server-authoritative for correctness, but small scale. Large-scale multiplayer is v2+. |

---

## Feature Dependencies

```
[PatchOps Contract]
    |
    +--requires--> [ECSON Schema + Versioning]
    |                  |
    |                  +--enables--> [Scene Save/Load]
    |                  |                 |
    |                  |                 +--enables--> [Auto-save]
    |                  |                 |
    |                  |                 +--enables--> [Publishing]
    |                  |
    |                  +--enables--> [Canonical IR Compiler]
    |                                    |
    |                                    +--enables--> [Engine Adapters / Ejection]
    |                                    |
    |                                    +--enables--> [Conformance Tests]
    |
    +--enables--> [Undo/Redo (invertible ops)]
    |
    +--enables--> [Operation Log (collaboration foundation)]
    |                 |
    |                 +--enables--> [Real-time Co-editing]
    |                 |                 |
    |                 |                 +--requires--> [Object Locking]
    |                 |                 |
    |                 |                 +--enables--> [Multiplayer Cursors/Presence]
    |                 |                 |
    |                 |                 +--enables--> [Embodied Avatar Editing]
    |                 |
    |                 +--enables--> [Deterministic Replay]
    |
    +--enables--> [IQL Compiler]
                      |
                      +--enables--> [IQL MCP Server]
                      |
                      +--enables--> [AI-Assisted Scene Building]

[Component Registry]
    |
    +--requires--> [ECSON Schema (ComponentDefinition)]
    |
    +--enables--> [Inspector Panel (auto-generated UI)]
    |
    +--enables--> [Pre-built Behavior Components]
    |                 |
    |                 +--enables--> [Game Templates]
    |                 |                 |
    |                 |                 +--validates--> [Core Spec (2-template rule)]
    |                 |
    |                 +--enables--> [Event Wiring System]
    |
    +--enables--> [Verb Surface ("Add Character", "Make It Bouncy")]

[3D Viewport + Transform Gizmos]
    |
    +--requires--> [Scene Graph Rendering]
    |
    +--enables--> [Asset Library Integration]
    |
    +--enables--> [Play-test from Editor]
                      |
                      +--requires--> [Game State Machine]
                      |                   |
                      |                   +--requires--> [Physics Runtime]
                      |                   |
                      |                   +--enables--> [Win Conditions / Scoring]
                      |
                      +--enables--> [Instant Play-test with Friends]
                                        |
                                        +--requires--> [Multiplayer Infrastructure]
                                                           |
                                                           +--enables--> [Party/Playlist System]
                                                           |                 |
                                                           |                 +--enables--> [Cumulative Scoring]
                                                           |                 |
                                                           |                 +--enables--> [Between-Game Flow]
                                                           |
                                                           +--enables--> [Shareable Join Links]

[Canonical IR]
    +--requires--> [ECSON Schema]
    +--requires--> [Component Registry]
    +--enables--> [Web Runtime Adapter (first target)]
    +--enables--> [PlayCanvas Adapter]
    +--enables--> [Babylon.js Adapter]
    +--enables--> [Godot Adapter (future)]
    +--enables--> [Unity Adapter (future)]

[Golden Fixtures]
    +--requires--> [ECSON Schema]
    +--requires--> [PatchOps]
    +--enables--> [Round-trip Tests]
    +--enables--> [Conformance Tests]
    +--enables--> [Performance Budgets]
```

### Dependency Notes

- **PatchOps require ECSON Schema:** Operations target stable entity/component IDs defined by the schema. The schema must exist before operations can be defined.
- **Undo/redo requires invertible PatchOps:** FOUNDATION.md mandates "Invertible (when applicable): support undo/redo via inverses or operational log." The operation architecture must be designed before any editor UI.
- **Collaboration requires Operation Log:** Real-time co-editing needs a shared operation log, not just state sync. The log architecture must be designed in Phase 0 even if collaborative features ship later.
- **Game Templates require stable Component Registry:** Templates are ECSON documents using behavior components. Components must be stable before templates can be authored. The 2-template rule governs core promotion.
- **Canonical IR requires both ECSON and Component Registry:** The compiler resolves abstract components into concrete engine-agnostic primitives. Both inputs must be stable.
- **Party System requires working Game Sessions:** Games must cleanly report results to a parent session. The game state machine and multiplayer infrastructure must work first.
- **IQL compiles to PatchOps:** IQL is purely additive -- it does not change the ECSON/IR/adapter pipeline. But it requires PatchOps to exist.
- **Verb surface maps to PatchOps:** Each verb ("Add Character", "Make It Bouncy") produces one or more PatchOps. Verbs are IQL presets surfaced in the UI.
- **Mobile play conflicts with mobile editing:** Games can be played on phones; the full editor should only target tablets and desktops. Trying to make the editor work on phones will compromise the desktop experience.

---

## MVP Definition

### Phase 0: Contracts First (Foundation)

Minimum viable architecture -- what FOUNDATION.md says must exist before any UI.

- [ ] **PatchOps spec + minimal implementation** -- the atomic edit language (CreateEntity, DeleteEntity, SetProperty, AddChild, RemoveChild, Reparent, AddComponent, RemoveComponent, SetComponentProperty, AddAsset, RemoveAsset, BatchOp)
- [ ] **ECSON schema + versioning + migrations scaffold** -- the project file format with stable IDs, schema version, editor sugar
- [ ] **Canonical IR spec + compiler** -- ECSON -> Canonical IR compilation for portable subset
- [ ] **5 golden fixtures + round-trip tests passing** -- transforms, materials, lights, animation stub, events/triggers
- [ ] **Component registry with typed property schemas** -- self-describing components for auto-generated inspectors

### Phase 1: Closed Loop (Edit -> Run)

Minimum viable product -- prove the golden path works.

- [ ] **Minimal editor shell** -- load fixture, apply PatchOps, save ECSON, compile to Canonical IR, run in web runtime
- [ ] **3D viewport + transform gizmos** -- the spatial editing foundation
- [ ] **Scene hierarchy + inspector** -- navigate and edit scene data
- [ ] **Undo/redo** -- operation-log based, preparing for collaboration
- [ ] **Basic save/load** -- ECSON persistence
- [ ] **Web runtime adapter** -- first engine target, renders Canonical IR
- [ ] **Verb surface (initial set)** -- "Add Box", "Add Light", "Move", "Paint" mapped to PatchOps

### Phase 2: Collaboration-Ready Core

- [ ] **Shared operation log model** -- even if real-time sync comes later
- [ ] **Conflict strategy documented** -- last-write-wins per property initially, OT/CRDT later
- [ ] **Object locking with hierarchical propagation** -- locking parent locks descendants
- [ ] **Multiplayer cursors + presence** -- who is editing what

### Phase 3: Game Runtime Foundations

- [ ] **Physics runtime** -- rigid bodies, collisions, triggers via portable subset
- [ ] **Character controller** -- third-person, keyboard + touch
- [ ] **Game state machine** -- lobby/countdown/playing/results
- [ ] **Pre-built behavior components** -- ScoreZone, Timer, KillZone, Spawner, Checkpoint (initial set)
- [ ] **Play-test from editor** -- "Play" button snapshots scene, runs in isolated context

### Add After Validation (v1.x)

Features to add once core loop (create -> play -> share) is validated.

- [ ] **Game templates** -- Party Game Starter, Character Playground, Physics Toy, Cinematic Clip (per FOUNDATION.md)
- [ ] **Party/playlist system** -- queue type, cumulative scoring
- [ ] **IQL compiler + MCP server** -- AI-assisted scene authoring
- [ ] **Game ejection** -- export as standalone Vite+R3F project
- [ ] **More behavior components** -- MovingPlatform, Conveyor, Trampoline, Teleporter, etc.
- [ ] **Touch controls for mobile play**
- [ ] **Embodied avatar editing**
- [ ] **Between-game ceremony** (standings, animations, transitions)
- [ ] **Additional engine adapters** -- PlayCanvas, Babylon.js

### Future Consideration (v2+)

- [ ] **Godot/Unity adapters** -- validates Canonical IR is truly engine-agnostic
- [ ] **Visual scripting** -- only if component library + event wiring proves insufficient
- [ ] **Advanced lobby types** -- Mario Party board, vote screen
- [ ] **Character configurator** -- shared skeleton, category-based customization
- [ ] **Content moderation system** -- needed before public publishing at scale
- [ ] **Marketplace** -- user asset sharing/selling
- [ ] **AI-assisted creation beyond IQL** -- AI-generated assets, procedural layouts
- [ ] **Full animation authoring** -- keyframe editor, state machine UI
- [ ] **Plugin/extension API** -- after core contracts are frozen

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Layer |
|---------|------------|---------------------|----------|-------|
| PatchOps contract + spec | HIGH (enables everything) | HIGH | P0 | Foundation |
| ECSON schema + versioning | HIGH (enables everything) | HIGH | P0 | Foundation |
| Canonical IR + compiler | HIGH (portability) | HIGH | P0 | Foundation |
| Golden fixtures + round-trip tests | HIGH (prevents drift) | MEDIUM | P0 | Foundation |
| Component registry | HIGH (editor + runtime) | MEDIUM | P0 | Foundation |
| 3D viewport + gizmos | HIGH (can't edit without it) | LOW | P1 | Both |
| Scene hierarchy + inspector | HIGH (can't navigate without it) | MEDIUM | P1 | Both |
| Undo/redo (operation-log) | HIGH (work safety) | HIGH | P1 | Both |
| Save/load (ECSON persistence) | HIGH (work safety) | MEDIUM | P1 | Both |
| Web runtime adapter | HIGH (can't run without it) | MEDIUM | P1 | Foundation |
| Verb surface (initial) | HIGH (fun-first UX) | MEDIUM | P1 | Fun-first |
| Shared operation log | HIGH (collaboration foundation) | MEDIUM | P2 | Foundation |
| Object locking | HIGH (collaboration) | MEDIUM | P2 | Both |
| Multiplayer cursors/presence | HIGH (collaboration UX) | MEDIUM | P2 | Both |
| Physics runtime | HIGH (games need physics) | MEDIUM | P3 | Both |
| Character controller | HIGH (players need to move) | MEDIUM | P3 | Fun-first |
| Game state machine | HIGH (games need structure) | MEDIUM | P3 | Fun-first |
| Behavior components (core set) | HIGH (game logic) | HIGH | P3 | Fun-first |
| Play-test from editor | HIGH (iteration speed) | MEDIUM | P3 | Both |
| Game templates (initial 4) | HIGH (the killer feature) | HIGH | P4 | Fun-first |
| Party/playlist system | HIGH (key differentiator) | HIGH | P4 | Fun-first |
| IQL compiler + MCP | MEDIUM-HIGH (AI authoring) | MEDIUM | P4 | Foundation |
| Game ejection (Vite+R3F) | HIGH (portability) | HIGH | P5 | Pro |
| Touch controls (mobile play) | HIGH (audience reach) | MEDIUM | P5 | Fun-first |
| Additional engine adapters | MEDIUM (portability) | MEDIUM each | P5 | Pro |
| Embodied avatar editing | MEDIUM (unique experience) | MEDIUM | P5 | Fun-first |
| Character configurator | MEDIUM (player identity) | MEDIUM | P6 | Fun-first |
| Advanced lobby types | MEDIUM (party variety) | HIGH | P6 | Fun-first |
| Content moderation | MEDIUM (needed for scale) | HIGH | P6 | Both |
| Marketplace | LOW (premature) | HIGH | P7 | Pro |
| AI-generated assets | LOW (quality inconsistent) | HIGH | P7 | Pro |
| Plugin API | LOW (premature) | HIGH | P7 | Pro |

**Priority key:**
- P0: Contracts and specs -- must exist before any UI (FOUNDATION.md Phase 0)
- P1: Closed loop -- minimal edit->run cycle (FOUNDATION.md Phase 1)
- P2: Collaboration-ready core (FOUNDATION.md Phase 2)
- P3: Game runtime foundations (FOUNDATION.md Phase 3)
- P4: Templates + party system -- validates the fun-first thesis
- P5: Polish + portability -- ejection, mobile, additional adapters
- P6: Advanced features -- after product-market fit
- P7: Future -- only with significant scale

---

## Competitor Feature Analysis

| Feature | PlayCanvas | Spline | Figma (collab patterns) | Roblox Studio | Unity | Riff3D Approach |
|---------|-----------|--------|------------------------|---------------|-------|-----------------|
| **Web-based editor** | Yes (cloud) | Yes | Yes | No (desktop) | No (desktop) | Yes (web-native, offline-capable via ECSON) |
| **Real-time collaboration** | Yes (entity locking) | Yes (Figma-style) | Yes (gold standard) | Yes (Team Create) | No | Yes -- PatchOps-based operation log, Figma-quality presence |
| **Game logic authoring** | Script components (JS) | Basic interactions/states | N/A | Lua scripting | C# scripting | Pre-built behavior components + event wiring + IQL (no scripting required for basics) |
| **Physics engine** | Ammo.js built-in | No | N/A | Custom engine | PhysX/Havok | Rapier WASM (portable subset, server-authoritative) |
| **Templates** | Yes (project templates) | Yes (design templates) | Yes (community files) | Minimal (empty baseplate) | Asset Store templates | Fully playable game templates you customize -- template-driven development |
| **Publishing** | Yes (hosted play page) | Yes (embed/export) | Yes (prototype links) | Yes (to Roblox platform) | Manual build/deploy | One-click to shareable web link |
| **Export/portability** | Export as HTML/JS | Export to code (React, etc.) | Dev Mode handoff | Locked to Roblox | Full ownership | Ejectable to Vite+R3F, PlayCanvas, Babylon, Godot, Unity via Canonical IR |
| **Multiplayer game support** | Via scripting | No | N/A | Built-in (automatic replication) | Manual (Netcode, Photon) | Built-in via operation-driven architecture, server-authoritative |
| **AI authoring** | No | No | AI features (beta) | No | No | IQL language + MCP server -- 90-97% token efficiency |
| **Party/playlist system** | No | No | N/A | No | No | Native playlist system with cumulative scoring -- unique |
| **Pricing model** | Freemium (cloud) | Freemium | Freemium | Free to create, Robux economy | License ($$$) | Freemium platform |
| **Offline capability** | No (cloud-dependent) | Limited | No | Yes (desktop app) | Yes (desktop app) | Yes -- ECSON is local-first, sync when connected |
| **Version control** | Built-in (checkpoints/branches) | Limited | Version history | No (manual backups) | Git workflows | PatchOps operation log = built-in version history with deterministic replay |
| **Node material editor** | Yes (advanced) | No (presets) | N/A | No | Yes (Shader Graph) | No (anti-feature for v1 -- PBR inspector properties sufficient) |
| **Animation authoring** | Yes (Anim State Graph) | Yes (timeline) | Yes (prototyping) | Basic (Roblox Animator) | Yes (Animator, Timeline) | Import from GLB + transform keyframes (portable subset). Full authoring is v2+. |

---

## PatchOps Coverage Requirements

Every user-facing feature that modifies scene state must flow through PatchOps. Here is the mapping:

| User Action | PatchOps Required |
|-------------|-------------------|
| Add object to scene | CreateEntity + AddComponent (batch) |
| Delete object | DeleteEntity |
| Move/rotate/scale object | SetProperty (transform) |
| Change material color | SetComponentProperty |
| Add component to object | AddComponent |
| Remove component | RemoveComponent |
| Reparent object in hierarchy | Reparent |
| Add asset to project | AddAsset |
| Replace texture/mesh reference | ReplaceAssetRef |
| Wire events between components | AddKeyframe or custom WireOp |
| Change game settings | SetProperty (game settings path) |
| Change environment settings | SetProperty (environment path) |
| Batch operations (verb surface) | BatchOp wrapping multiple ops |
| IQL command execution | IQL compiler outputs PatchOps |

**Non-PatchOps state (ephemeral, not persisted):**
- Camera position/rotation (view-only)
- Object selection state
- Gizmo mode (translate/rotate/scale)
- Snap settings
- Multiplayer cursor positions
- Object lock state
- Play-test runtime state

---

## Riff3D-Specific Feature Mapping

### Fun-First Wedge Features
These features serve the "fast creation -> instant play" party/mini-game audience:
- Verb surface ("Add Character", "Make It Bouncy", "Start Game")
- Golden path workflow (Pick Template -> Edit -> Play -> Iterate -> Save/Share)
- Pre-built behavior components (30+ gameplay components)
- Game templates (Party Game Starter, Character Playground, Physics Toy, Cinematic Clip)
- Playlist/party session system
- Instant play-test with friends
- Shareable join links
- Between-game ceremony
- Touch controls for mobile play
- Embodied avatar editing

### Pro-Capable Foundation Features
These features serve game jam creators and professional workflows:
- PatchOps contract (deterministic, serializable, replayable operations)
- ECSON schema with versioning and migrations
- Canonical IR with engine adapters (portability)
- Game ejection (standalone projects)
- IQL for AI-assisted authoring
- Operation log with deterministic replay
- Conformance tests and golden fixtures
- Engine tuning / escape hatch for engine-specific features
- Schema extensibility (custom components)
- GitHub integration

### Foundation Features (Support Both Layers)
- 3D viewport + gizmos
- Scene hierarchy + inspector
- Undo/redo
- Save/load/auto-save
- Real-time collaboration (cursors, presence, locking)
- Component registry with typed schemas
- Physics runtime
- Asset library
- User accounts + authentication

---

## Sources

- **Riff3D prototype research** (`/home/frank/riff3d-prototype/.planning/research/FEATURES.md`, `SUMMARY.md`, `ARCHITECTURE.md`, `PITFALLS.md`) -- Feature landscape, competitor analysis, dependency chains (MEDIUM confidence)
- **FOUNDATION.md** (`/home/frank/riff3d-prototype/.planning/rebuild-research/FOUNDATION.md`) -- Architecture spine, phase gates, contracts, golden path, template-driven development (HIGH confidence -- authoritative document)
- **Universal Schema Research** (`/home/frank/riff3d-prototype/.planning/rebuild-research/00-universal-schema-research.md`) -- PlayCanvas engine analysis, Babylon.js engine analysis, universal schema design, 30+ component inventory (HIGH confidence -- direct codebase analysis)
- **Canonical IR Research** (`/home/frank/riff3d-prototype/.planning/rebuild-research/01-canonical-layer-research.md`) -- glTF/KHR extensions, OpenUSD patterns, OMI Group, Needle Engine, engine adapter architecture (MEDIUM-HIGH confidence)
- **IQL Research** (`/home/frank/riff3d-prototype/.planning/rebuild-research/02-iql-research.md`) -- Token efficiency analysis, language design, MCP server architecture (MEDIUM confidence -- novel design)
- **Spatial Validation Research** (`/home/frank/riff3d-prototype/.planning/rebuild-research/03-spatial-validation-research.md`) -- Jump arc physics, reachable envelope, AI spatial reasoning limitations (MEDIUM confidence)
- **PlayCanvas Editor source** (`/home/frank/playcanvas-editor/`) -- Editor structure analysis: realtime collaboration, templates, entity management, history, inspector, scripting, scene settings (HIGH confidence -- direct source analysis)
- **Babylon.js Editor source** (`/home/frank/babylon-editor/`) -- Desktop Electron app, Node Material Editor, Particle Editor, project templates (Next.js, SolidJS, Vanilla) (HIGH confidence -- direct source analysis)
- **Reference project analysis** (Transfer Thought, React Three Game, WawaGuys, R3F Character Configurator) -- Scene serialization, component registry, multiplayer patterns, character system (MEDIUM-HIGH confidence -- direct codebase analysis)
- **Competitor knowledge** (Unity, Unreal, Godot, Roblox Studio, Figma, Spline, Vectary) -- Feature sets and collaboration patterns (MEDIUM confidence -- training data, not verified against 2026 releases)

---
*Feature research for: Web-based 3D engine/editor collaboration platform*
*Researched: 2026-02-19*
