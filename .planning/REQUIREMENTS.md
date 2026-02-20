# Requirements: Riff3D

**Defined:** 2026-02-19
**Core Value:** All meaningful edits flow through a deterministic operation pipeline (IQL -> PatchOps -> ECSON -> Canonical IR -> Adapters), ensuring portability, reproducibility, and safe AI-driven manipulation.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Contracts & Core Architecture

- [x] **CORE-01**: PatchOps spec fully defined — deterministic, serializable, ordered, scoped to stable IDs, validatable, invertible
- [x] **CORE-02**: Minimum PatchOps set implemented (CreateEntity, DeleteEntity, SetProperty, AddChild, RemoveChild, Reparent, AddComponent, RemoveComponent, SetComponentProperty, AddAsset, RemoveAsset, ReplaceAssetRef, AddKeyframe, RemoveKeyframe, SetKeyframeValue, BatchOp)
- [x] **CORE-03**: ECSON schema defined with schema version, stable IDs for entities/assets/components, editor sugar that compiles down
- [x] **CORE-04**: ECSON forward migrations implemented with versioning scaffold
- [x] **CORE-05**: Canonical IR spec defined — minimal, normalized, explicit, round-trip safe for portable subset
- [x] **CORE-06**: Canonical IR compiler (ECSON -> Canonical IR) implemented
- [x] **CORE-07**: Portable subset v0 defined and implemented (scene graph, transforms, parenting, mesh refs, baseline PBR materials, lights, cameras, basic animation, events/triggers)
- [x] **CORE-08**: Engine tuning/escape hatch schema defined (per-engine sections that never override portable semantics)
- [x] **CORE-09**: Operation IDs + Entity IDs are globally unique and stable across sessions
- [x] **CORE-10**: Component registry with schema-driven property definitions, types, defaults, and editor hints

### Testing & Conformance

- [x] **TEST-01**: 5-10 golden fixture projects created covering transforms+parenting, materials+lights, simple animation, events/triggers, character stub, timeline stub
- [x] **TEST-02**: Round-trip tests passing (ECSON -> Canonical IR -> ECSON for portable subset)
- [x] **TEST-03**: PatchOps replay determinism tests (ECSON0 + ops -> ECSON1 matches snapshot; replay twice yields identical output)
- [ ] **TEST-04**: Adapter conformance tests per runtime target (fixtures render/behave within tolerance)
- [x] **TEST-05**: Performance budgets defined and enforced (load time, memory ceiling, FPS baseline for web runtime)

### Editor Core

- [x] **EDIT-01**: 3D viewport with orbit/pan/zoom and WASD fly-camera
- [x] **EDIT-02**: Transform gizmos (translate/rotate/scale) with configurable snap-to-grid
- [x] **EDIT-03**: Scene hierarchy tree view with drag-to-reparent, multi-select, search/filter
- [x] **EDIT-04**: Properties/inspector panel auto-generated from component schemas
- [x] **EDIT-05**: Undo/redo via invertible PatchOps with per-user undo stacks
- [x] **EDIT-06**: Copy/paste/duplicate within same scene
- [x] **EDIT-07**: Grid/snap system with configurable grid size and rotation snap
- [x] **EDIT-08**: Save and auto-save (ECSON to persistent storage, auto-save on interval + significant changes)
- [x] **EDIT-09**: Asset library/object palette with curated starter assets (primitives, props, materials, characters)
- [x] **EDIT-10**: Play-test from editor (editor -> runtime transition without page reload)

### Rendering & Scene

- [x] **RNDR-01**: PBR materials (color, metalness, roughness, emissive at minimum)
- [x] **RNDR-02**: Lighting (directional, point, spot + ambient/environment)
- [x] **RNDR-03**: Camera entities (perspective and orthographic)
- [x] **RNDR-04**: GLB/glTF import with textures, materials, and embedded animations
- [x] **RNDR-05**: Environment settings (skybox color/image, fog type/density, ambient light)

### Runtime & Adapters

- [x] **ADPT-01**: PlayCanvas adapter compiles Canonical IR to PlayCanvas runtime (primary web adapter)
- [ ] **ADPT-02**: Babylon.js adapter compiles Canonical IR to Babylon.js runtime (universality validation)
- [ ] **ADPT-03**: Adapter incremental update (property-level deltas, not full recompile on every edit)
- [ ] **ADPT-04**: Both adapters pass conformance tests for golden fixtures within defined tolerance

### Collaboration

- [ ] **COLLAB-01**: Shared operation log backed by Yjs CRDTs for real-time co-editing
- [ ] **COLLAB-02**: Multiplayer cursors and presence (colored cursors with user names, both 2D overlay and 3D viewport)
- [ ] **COLLAB-03**: Object-level locking with hierarchical lock propagation (locking parent locks descendants)
- [ ] **COLLAB-04**: Embodied avatar editing (walk around 3D scene as avatar while editing)
- [ ] **COLLAB-05**: Conflict resolution strategy (LWW per property initially, upgradeable to OT)

### Game Logic & Templates

- [ ] **GAME-01**: Pre-built behavior component library (ScoreZone, Timer, KillZone, Spawner, MovingPlatform, PathFollower, etc.)
- [ ] **GAME-02**: Verb-driven UX surface ("Add Character", "Make It Bouncy", "Start Game", etc.) mapping to PatchOps
- [ ] **GAME-03**: Game state machine (start, playing, end states with win/lose conditions)
- [ ] **GAME-04**: Event wiring system (WHEN trigger DO action)
- [ ] **GAME-05**: Template: Party Game Starter (spawn points, scoring, round loop, simple UI)
- [ ] **GAME-06**: Template: Character Playground (rig import, basic animation playback, simple interactions)
- [ ] **GAME-07**: Template: Physics Toy (portable physics behavior + explicit engine tuning)
- [ ] **GAME-08**: Template: Cinematic Clip (camera cuts, transform keyframes, events)
- [ ] **GAME-09**: Character entity model (skeleton refs, rig metadata)
- [ ] **GAME-10**: Timeline v0 (tracks, clips, events -- minimal)

### Party/Multiplayer Platform

- [ ] **PARTY-01**: Playlist/party session system (group games into playlists with cumulative scoring)
- [ ] **PARTY-02**: Instant play-test with friends (invite into editor session without publishing)
- [ ] **PARTY-03**: Cross-game cumulative scoring with score normalization
- [ ] **PARTY-04**: Shareable join links (deep-link into specific game/party/playlist)
- [ ] **PARTY-05**: Between-game ceremony (basic results screen with standings)

### AI Authoring

- [ ] **AI-01**: IQL intent language spec and compiler (human/AI-friendly, compiles to PatchOps)
- [ ] **AI-02**: IQL MCP server (execute_iql, describe_scene, list_presets, validate_iql tools)
- [ ] **AI-03**: Scene context compression (full scene state in ~350 tokens vs ~12,000 raw JSON)
- [ ] **AI-04**: IQL safety rules (validate operations before execution, prevent destructive actions)

### Portability & Openness

- [ ] **PORT-01**: Game ejection -- export Canonical IR as standalone web project (Vite + runtime)
- [x] **PORT-02**: Portable subset round-trips across ECSON <-> Canonical IR consistently
- [ ] **PORT-03**: Tuning sections per engine target that degrade gracefully when unsupported

### VR & Asymmetric Play

- [ ] **VR-01**: WebXR integration for VR headset play (Quest, etc.) in web runtime
- [ ] **VR-02**: VR player controls (teleport/smooth locomotion, grab interactions, hand tracking)
- [ ] **VR-03**: Asymmetric VR support -- VR and flat-screen players in the same game session
- [ ] **VR-04**: VR-aware game templates (at least one template supports VR + flat-screen asymmetric play)
- [ ] **VR-05**: VR comfort settings (snap turn, vignette, seated mode)

### Project Management

- [x] **PROJ-01**: User accounts and authentication (social logins: Google, Discord, GitHub)
- [x] **PROJ-02**: Project list/dashboard with thumbnails and last-modified dates
- [x] **PROJ-03**: Shareable project links (deep-link into specific project/scene)

## v2 Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Creator Economy

- **ECON-01**: Creator marketplace for user-created assets and game templates
- **ECON-02**: Creator monetization (tipping, premium templates, asset sales)
- **ECON-03**: Payment processing and payout system

### Communication

- **COMM-01**: In-platform voice chat (WebRTC) during editing and gameplay
- **COMM-02**: Video chat for collaborative editing sessions
- **COMM-03**: Text chat with quick-chat phrases/emotes for mobile

### Procedural Generation

- **PROC-01**: AI-assisted level generation (rule-based + LLM-guided)
- **PROC-02**: Randomizable spawn points and object placement within hand-crafted layouts
- **PROC-03**: IQL SCATTER command for procedural-ish placement

### Advanced Animation

- **ANIM-01**: Full keyframe animation editor (timeline UI, curve editor)
- **ANIM-02**: Animation state machine UI (blend trees, transitions)
- **ANIM-03**: Animation retargeting across different character rigs

### Advanced Rendering

- **SHDR-01**: Shader graph editor (node-based material authoring)
- **SHDR-02**: Complex terrain system (LOD, texturing, sculpting)
- **SHDR-03**: Advanced VFX system (particle effects, post-processing)

### Platform Expansion

- **PLAT-01**: Native mobile app (web wrapper / PWA with native shell)
- **PLAT-02**: Native desktop app (Electron or Tauri wrapper)
- **PLAT-03**: Unity engine adapter (Canonical IR -> Unity project)
- **PLAT-04**: Godot engine adapter (Canonical IR -> Godot project)
- **PLAT-05**: Unreal engine adapter (Canonical IR -> Unreal project)
- **PLAT-06**: Custom R3F renderer adapter

### Extensibility

- **EXT-01**: Plugin/extension API for editor customization
- **EXT-02**: Plugin marketplace
- **EXT-03**: Custom component registration API (public)

### Competitive Features

- **COMP-01**: Replay/recording system (capture and playback game sessions)
- **COMP-02**: Spectator mode for live game watching
- **COMP-03**: Leaderboards and persistent player stats
- **COMP-04**: Large-scale multiplayer (50+ players, interest management)

### Advanced Characters

- **CHAR-01**: Advanced IK system
- **CHAR-02**: Retargeting across skeleton types
- **CHAR-03**: Facial animation and lip sync
- **CHAR-04**: VR avatar embodiment

### Visual Scripting

- **VSCR-01**: Node-based visual scripting (Blueprints-style)
- **VSCR-02**: Visual scripting debugger
- **VSCR-03**: Visual scripting to code export

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full asset creation tools (modeling, texturing, sculpting) | Competing with Blender/Maya is not viable. GLB import + curated library covers the need. |
| Blockchain/NFT integration | No user demand, regulatory risk, reputational risk. |
| Cross-platform account linking (PSN, Xbox, Steam) | Premature -- requires platform partnerships and legal agreements. |
| Full engine parity across all adapters simultaneously | Adapters expand incrementally. Portable subset is the contract, not feature parity. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1: Contracts & Testing Spine | Complete |
| CORE-02 | Phase 1: Contracts & Testing Spine | Complete |
| CORE-03 | Phase 1: Contracts & Testing Spine | Complete |
| CORE-04 | Phase 1: Contracts & Testing Spine | Complete |
| CORE-05 | Phase 1: Contracts & Testing Spine | Complete |
| CORE-06 | Phase 1: Contracts & Testing Spine | Complete |
| CORE-07 | Phase 1: Contracts & Testing Spine | Complete |
| CORE-08 | Phase 1: Contracts & Testing Spine | Complete |
| CORE-09 | Phase 1: Contracts & Testing Spine | Complete |
| CORE-10 | Phase 1: Contracts & Testing Spine | Complete |
| TEST-01 | Phase 1: Contracts & Testing Spine | Complete |
| TEST-02 | Phase 1: Contracts & Testing Spine | Complete |
| TEST-03 | Phase 1: Contracts & Testing Spine | Complete |
| TEST-04 | Phase 4: Dual Adapter Validation | Pending |
| TEST-05 | Phase 1: Contracts & Testing Spine | Complete |
| EDIT-01 | Phase 2: Closed-Loop Editor | Complete |
| EDIT-02 | Phase 2: Closed-Loop Editor | Complete |
| EDIT-03 | Phase 2: Closed-Loop Editor | Complete |
| EDIT-04 | Phase 2: Closed-Loop Editor | Complete |
| EDIT-05 | Phase 2: Closed-Loop Editor | Complete |
| EDIT-06 | Phase 2: Closed-Loop Editor | Complete |
| EDIT-07 | Phase 2: Closed-Loop Editor | Complete |
| EDIT-08 | Phase 2: Closed-Loop Editor | Complete |
| EDIT-09 | Phase 2: Closed-Loop Editor | Complete |
| EDIT-10 | Phase 2: Closed-Loop Editor | Complete |
| RNDR-01 | Phase 2: Closed-Loop Editor | Complete |
| RNDR-02 | Phase 2: Closed-Loop Editor | Complete |
| RNDR-03 | Phase 2: Closed-Loop Editor | Complete |
| RNDR-04 | Phase 2: Closed-Loop Editor | Complete |
| RNDR-05 | Phase 2: Closed-Loop Editor | Complete |
| ADPT-01 | Phase 2: Closed-Loop Editor | Complete |
| ADPT-02 | Phase 4: Dual Adapter Validation | Pending |
| ADPT-03 | Phase 4: Dual Adapter Validation | Pending |
| ADPT-04 | Phase 4: Dual Adapter Validation | Pending |
| COLLAB-01 | Phase 5: Collaboration | Pending |
| COLLAB-02 | Phase 5: Collaboration | Pending |
| COLLAB-03 | Phase 5: Collaboration | Pending |
| COLLAB-04 | Phase 5: Collaboration | Pending |
| COLLAB-05 | Phase 5: Collaboration | Pending |
| GAME-01 | Phase 7: Game Runtime & Behaviors | Pending |
| GAME-02 | Phase 7: Game Runtime & Behaviors | Pending |
| GAME-03 | Phase 7: Game Runtime & Behaviors | Pending |
| GAME-04 | Phase 7: Game Runtime & Behaviors | Pending |
| GAME-05 | Phase 8: Templates, Party System & Ejection | Pending |
| GAME-06 | Phase 8: Templates, Party System & Ejection | Pending |
| GAME-07 | Phase 8: Templates, Party System & Ejection | Pending |
| GAME-08 | Phase 8: Templates, Party System & Ejection | Pending |
| GAME-09 | Phase 7: Game Runtime & Behaviors | Pending |
| GAME-10 | Phase 7: Game Runtime & Behaviors | Pending |
| PARTY-01 | Phase 8: Templates, Party System & Ejection | Pending |
| PARTY-02 | Phase 8: Templates, Party System & Ejection | Pending |
| PARTY-03 | Phase 8: Templates, Party System & Ejection | Pending |
| PARTY-04 | Phase 8: Templates, Party System & Ejection | Pending |
| PARTY-05 | Phase 8: Templates, Party System & Ejection | Pending |
| AI-01 | Phase 9: AI Authoring | Pending |
| AI-02 | Phase 9: AI Authoring | Pending |
| AI-03 | Phase 9: AI Authoring | Pending |
| AI-04 | Phase 9: AI Authoring | Pending |
| PORT-01 | Phase 8: Templates, Party System & Ejection | Pending |
| PORT-02 | Phase 1: Contracts & Testing Spine | Complete |
| PORT-03 | Phase 4: Dual Adapter Validation | Pending |
| VR-01 | Phase 10: VR & Asymmetric Play | Pending |
| VR-02 | Phase 10: VR & Asymmetric Play | Pending |
| VR-03 | Phase 10: VR & Asymmetric Play | Pending |
| VR-04 | Phase 10: VR & Asymmetric Play | Pending |
| VR-05 | Phase 10: VR & Asymmetric Play | Pending |
| PROJ-01 | Phase 2: Closed-Loop Editor | Complete |
| PROJ-02 | Phase 2: Closed-Loop Editor | Complete |
| PROJ-03 | Phase 2: Closed-Loop Editor | Complete |

**Coverage:**
- v1 requirements: 69 total
- Mapped to phases: 69
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after roadmap creation*
