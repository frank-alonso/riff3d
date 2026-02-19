# Roadmap: Riff3D

## Overview

Riff3D is built contracts-first: specs before implementations, primary adapter before secondary, collaboration before game features, game features before templates. Every phase delivers a verifiable capability, and review gates at critical boundaries ensure the foundation is solid before building on it. The 69 v1 requirements map across 8 delivery phases and 3 review phases, progressing from pure TypeScript contracts through a closed-loop editor, dual adapter validation, real-time collaboration, game runtime, templates with party system, AI authoring, and finally VR support. Beyond v1, the roadmap outlines v2+ milestones for marketplace, native apps, engine adapters, visual scripting, and advanced features.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Contracts & Testing Spine** - Define all specs (PatchOps, ECSON, Canonical IR), build golden fixtures, prove round-trip determinism
- [ ] **Phase 2: Closed-Loop Editor** - Minimal editor shell with PlayCanvas adapter proving the full pipeline end-to-end
- [ ] **Phase 3: Review Gate: Foundation** - Validate contracts and closed-loop before building on them
- [ ] **Phase 4: Dual Adapter Validation** - Babylon.js adapter proves Canonical IR is truly engine-agnostic
- [ ] **Phase 5: Collaboration** - Real-time co-editing with Yjs CRDTs, presence, and conflict resolution
- [ ] **Phase 6: Review Gate: Core Platform** - Validate collaboration, adapter conformance, and editor stability before game layer
- [ ] **Phase 7: Game Runtime & Behaviors** - Physics, character controller, behavior components, game state machine, event wiring
- [ ] **Phase 8: Templates, Party System & Ejection** - Four game templates, party/playlist system, game ejection to standalone projects
- [ ] **Phase 9: AI Authoring** - IQL intent language, MCP server, scene compression, safety rules
- [ ] **Phase 10: VR & Asymmetric Play** - WebXR integration, VR controls, asymmetric VR+flat-screen sessions
- [ ] **Phase 11: Review Gate: v1 Complete** - Full integration review, performance validation, golden path end-to-end

## Phase Details

### Phase 1: Contracts & Testing Spine
**Goal**: All core contracts (PatchOps, ECSON, Canonical IR) are specified, implemented, and proven via golden fixtures with deterministic round-trip tests -- no browser needed
**Depends on**: Nothing (first phase)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CORE-07, CORE-08, CORE-09, CORE-10, TEST-01, TEST-02, TEST-03, TEST-05, PORT-02
**Success Criteria** (what must be TRUE):
  1. A golden fixture ECSON file can be compiled to Canonical IR and back to ECSON with the portable subset preserved identically
  2. Applying a sequence of PatchOps to an empty ECSON document, then replaying those same ops on a fresh document, produces identical output both times
  3. Every PatchOp type has a documented inverse, and applying an op then its inverse returns the document to its original state
  4. The component registry defines at least 15 component types with typed schemas, defaults, and editor hints -- and Zod validates all of them
  5. The monorepo package structure (ecson, patchops, canonical-ir, fixtures, conformance) is established with correct dependency boundaries enforced by Turborepo
**Plans**: TBD

Plans:
- [ ] 01-01: Monorepo scaffold and package structure
- [ ] 01-02: ECSON schema, versioning, and migration infrastructure
- [ ] 01-03: PatchOps spec, engine, and inverse generation
- [ ] 01-04: Canonical IR spec and compiler
- [ ] 01-05: Portable subset v0 and component registry
- [ ] 01-06: Golden fixtures and round-trip/determinism tests

### Phase 2: Closed-Loop Editor
**Goal**: A user can open the editor, see a 3D scene rendered by PlayCanvas, make edits via gizmos and panels, undo/redo changes, and play-test the scene -- the entire pipeline works end-to-end
**Depends on**: Phase 1
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08, EDIT-09, EDIT-10, RNDR-01, RNDR-02, RNDR-03, RNDR-04, RNDR-05, ADPT-01, PROJ-01, PROJ-02, PROJ-03
**Success Criteria** (what must be TRUE):
  1. A user can log in, create a new project, and see it in their project dashboard with a thumbnail
  2. The 3D viewport renders a scene with PBR materials, lighting, and camera controls (orbit/pan/zoom/fly) -- all powered by the PlayCanvas adapter reading Canonical IR
  3. A user can add entities, move/rotate/scale them with gizmos, edit properties in the inspector, reparent in the hierarchy tree, and every edit flows through PatchOps (verifiable in operation log)
  4. Undo/redo works across all edit types, and auto-save persists the ECSON document so closing and reopening the browser restores the exact scene state
  5. Pressing "Play" transitions to runtime mode where the scene runs without a page reload, and pressing "Stop" returns to the editor with all edits preserved
**Plans**: TBD

Plans:
- [ ] 02-01: Next.js editor shell, auth, and project management
- [ ] 02-02: 3D viewport with PlayCanvas adapter integration
- [ ] 02-03: Transform gizmos, grid/snap, and selection system
- [ ] 02-04: Scene hierarchy, inspector panel, and component editing
- [ ] 02-05: Undo/redo, copy/paste, save/auto-save
- [ ] 02-06: Asset library, GLB import, and environment settings
- [ ] 02-07: Play-test mode (edit-to-runtime transition)

### Phase 3: Review Gate: Foundation
**Goal**: Validate that the contracts are sound and the closed-loop editor is stable before building collaboration and the second adapter on top of it
**Depends on**: Phase 2
**Requirements**: (none -- review phase)
**Success Criteria** (what must be TRUE):
  1. All golden fixtures load, edit, save, compile, and render without errors in the editor
  2. PatchOps operation log accurately captures every edit made through the UI -- no hidden state mutations exist
  3. Round-trip tests pass at 100% for the portable subset (ECSON to Canonical IR to ECSON)
  4. Performance budgets (load time, memory, FPS) are met for all golden fixture projects running in the PlayCanvas adapter
**Plans**: TBD

Plans:
- [ ] 03-01: Foundation integration review and gap analysis

### Phase 4: Dual Adapter Validation
**Goal**: The Babylon.js adapter proves the Canonical IR is truly engine-agnostic -- all golden fixtures render and behave within tolerance on both PlayCanvas and Babylon.js
**Depends on**: Phase 3
**Requirements**: ADPT-02, ADPT-03, ADPT-04, TEST-04, PORT-03
**Success Criteria** (what must be TRUE):
  1. All golden fixtures render on both PlayCanvas and Babylon.js with visual output within defined tolerance bands
  2. A user can switch between PlayCanvas and Babylon.js rendering in the editor and see consistent scene representation
  3. Editing a property in the editor updates the active adapter incrementally (property-level delta) without rebuilding the entire scene
  4. Engine tuning sections in ECSON are respected by the target adapter and gracefully ignored by the other
**Plans**: TBD

Plans:
- [ ] 04-01: Babylon.js adapter implementation
- [ ] 04-02: Adapter incremental update system
- [ ] 04-03: Conformance test suite and tolerance validation

### Phase 5: Collaboration
**Goal**: Two or more users can edit the same project simultaneously with real-time presence, conflict resolution, and independent undo stacks
**Depends on**: Phase 4
**Requirements**: COLLAB-01, COLLAB-02, COLLAB-03, COLLAB-04, COLLAB-05
**Success Criteria** (what must be TRUE):
  1. Two users editing the same scene see each other's changes appear within 2 seconds, with colored cursors and name labels visible in both the 2D panels and 3D viewport
  2. When two users edit different properties of the same entity simultaneously, both edits are preserved (no silent overwrites)
  3. A user can lock an entity (and its descendants) for exclusive editing, and other users see a visual lock indicator and cannot modify locked objects
  4. A user can walk around the 3D scene as an embodied avatar while editing, and other users see their avatar moving in real-time
  5. Each user has an independent undo stack -- undoing on one client does not undo another user's operations
**Plans**: TBD

Plans:
- [ ] 05-01: Yjs integration and shared operation log
- [ ] 05-02: Presence, cursors, and awareness
- [ ] 05-03: Object locking and conflict resolution
- [ ] 05-04: Embodied avatar editing

### Phase 6: Review Gate: Core Platform
**Goal**: Validate that collaboration, dual adapters, and the editor form a stable platform before adding the game layer on top
**Depends on**: Phase 5
**Requirements**: (none -- review phase)
**Success Criteria** (what must be TRUE):
  1. Two concurrent users can collaboratively build a scene from scratch, play-test it, and save -- with no data loss or corruption
  2. Adapter conformance passes at 90%+ for both PlayCanvas and Babylon.js across all golden fixtures
  3. The editor handles 100+ entities in a scene without dropping below FPS baseline during editing or collaboration
**Plans**: TBD

Plans:
- [ ] 06-01: Core platform integration review and stress testing

### Phase 7: Game Runtime & Behaviors
**Goal**: Users can add game logic to scenes using pre-built behavior components, wire events, control characters, and play-test complete game loops -- all authored through verbs and the inspector
**Depends on**: Phase 6
**Requirements**: GAME-01, GAME-02, GAME-03, GAME-04, GAME-09, GAME-10
**Success Criteria** (what must be TRUE):
  1. A user can add a character entity to a scene and control it with keyboard/touch input in play-test mode (third-person movement, jumping)
  2. A user can place behavior components (ScoreZone, KillZone, Timer, Spawner, MovingPlatform) from the verb surface or component palette and configure them in the inspector
  3. The game state machine progresses through lobby, countdown, playing, and results states -- with win/lose conditions triggering transitions
  4. A user can wire events ("WHEN player enters ScoreZone DO add 10 points") using the event system, and the wiring persists in ECSON and compiles to Canonical IR
  5. Timeline v0 allows placing clips on tracks with transform keyframes and event triggers that play back during runtime
**Plans**: TBD

Plans:
- [ ] 07-01: Physics integration and character controller
- [ ] 07-02: Behavior component library
- [ ] 07-03: Verb-driven UX surface
- [ ] 07-04: Game state machine and event wiring
- [ ] 07-05: Character entity model and timeline v0

### Phase 8: Templates, Party System & Ejection
**Goal**: Users can start from polished templates, play games together in party/playlist sessions with cumulative scoring, and export games as standalone web projects
**Depends on**: Phase 7
**Requirements**: GAME-05, GAME-06, GAME-07, GAME-08, PARTY-01, PARTY-02, PARTY-03, PARTY-04, PARTY-05, PORT-01
**Success Criteria** (what must be TRUE):
  1. A user can create a new project from any of four templates (Party Game Starter, Character Playground, Physics Toy, Cinematic Clip) and immediately play-test a working game/experience
  2. A user can invite friends via a shareable link to play-test a game directly from the editor without publishing
  3. A party host can create a playlist of games, and the system tracks cumulative scores across games with a between-game results ceremony showing standings
  4. A user can eject a game as a standalone Vite + runtime web project that runs independently of the Riff3D platform
  5. Each template exercises different portable subset capabilities and all pass conformance tests, validating the 2-template promotion rule
**Plans**: TBD

Plans:
- [ ] 08-01: Party Game Starter template
- [ ] 08-02: Character Playground and Physics Toy templates
- [ ] 08-03: Cinematic Clip template
- [ ] 08-04: Party session and playlist system
- [ ] 08-05: Cumulative scoring and between-game ceremony
- [ ] 08-06: Game ejection to standalone Vite project

### Phase 9: AI Authoring
**Goal**: AI agents (via IQL and MCP) can safely create and modify 3D scenes, with intent-level commands that compile to validated PatchOps
**Depends on**: Phase 8
**Requirements**: AI-01, AI-02, AI-03, AI-04
**Success Criteria** (what must be TRUE):
  1. An AI agent can issue IQL commands (SPAWN, SET, MOVE, PAINT, DELETE) through the MCP server and see the resulting scene changes reflected in the editor in real-time
  2. The IQL compiler rejects invalid or destructive operations before they reach the PatchOps layer, with clear error messages explaining why
  3. The describe_scene MCP tool returns a compressed scene representation under 500 tokens for a typical game scene (vs 10,000+ for raw JSON)
  4. Every IQL command produces valid, deterministic PatchOps -- the IQL-to-PatchOps compilation is tested with fixtures and the bypass test (IQL always goes through PatchOps, never direct mutation) passes in CI
**Plans**: TBD

Plans:
- [ ] 09-01: IQL language spec and compiler
- [ ] 09-02: MCP server implementation
- [ ] 09-03: Scene compression and safety rules

### Phase 10: VR & Asymmetric Play
**Goal**: Players can join games in VR headsets (WebXR) alongside flat-screen players, with full VR controls and comfort settings
**Depends on**: Phase 9
**Requirements**: VR-01, VR-02, VR-03, VR-04, VR-05
**Success Criteria** (what must be TRUE):
  1. A player can open a game link on a WebXR-capable device (Quest browser) and enter the game in immersive VR mode
  2. VR players can navigate (teleport or smooth locomotion), grab and interact with objects using hand tracking or controllers
  3. VR and flat-screen players coexist in the same game session -- each sees the other players and can interact with shared game objects
  4. At least one game template includes a VR-aware variant that provides meaningful asymmetric gameplay (different roles/perspectives for VR vs flat-screen)
  5. VR comfort settings (snap turn, vignette, seated mode) are accessible from the in-game menu
**Plans**: TBD

Plans:
- [ ] 10-01: WebXR integration and VR viewport
- [ ] 10-02: VR controls (locomotion, grab, hand tracking)
- [ ] 10-03: Asymmetric play and VR-aware template
- [ ] 10-04: VR comfort settings

### Phase 11: Review Gate: v1 Complete
**Goal**: Full integration review ensuring the entire v1 surface works end-to-end, performance targets are met, and the platform is ready for users
**Depends on**: Phase 10
**Requirements**: (none -- review phase)
**Success Criteria** (what must be TRUE):
  1. The golden path (Pick Template, Edit via Verbs/Tools, Play, Iterate, Save/Share) works without friction for all four templates
  2. All 69 v1 requirements are verified as implemented and passing their success criteria
  3. Performance budgets are met across all scenarios: editor with 100+ entities, collaboration with 4+ users, runtime at 60fps on target hardware, VR at 72fps on Quest
  4. A new user can sign up, create a game from a template, invite a friend, play together, and share a link -- all within 10 minutes
**Plans**: TBD

Plans:
- [ ] 11-01: v1 integration review, performance audit, and launch readiness

---

## v2+ Vision (Future Milestones)

Beyond v1, the following milestones outline the long-term product evolution. These are directional, not committed -- they will be planned in detail as v1 ships and validates assumptions.

### v2.0: Creator Economy & Communication
**Milestone Goal**: Transform Riff3D from a creation tool into a creator platform with marketplace, monetization, and real-time communication.

**Planned capabilities:**
- Creator marketplace for user-created assets and game templates (ECON-01)
- Creator monetization: tipping, premium templates, asset sales (ECON-02)
- Payment processing and payout system (ECON-03)
- In-platform voice chat via WebRTC during editing and gameplay (COMM-01)
- Video chat for collaborative editing sessions (COMM-02)
- Text chat with quick-chat phrases and emotes (COMM-03)
- Leaderboards and persistent player stats (COMP-03)
- Replay/recording system for game sessions (COMP-01)
- Spectator mode for live game watching (COMP-02)

### v2.1: Procedural Generation & Advanced AI
**Milestone Goal**: AI-assisted content creation that goes beyond editing into generation.

**Planned capabilities:**
- AI-assisted level generation: rule-based + LLM-guided (PROC-01)
- Randomizable spawn points and object placement (PROC-02)
- IQL SCATTER command for procedural placement (PROC-03)
- Large-scale multiplayer: 50+ players with interest management (COMP-04)

### v3.0: Advanced Authoring Tools
**Milestone Goal**: Professional-grade animation, shader, and scripting tools.

**Planned capabilities:**
- Full keyframe animation editor with timeline UI and curve editor (ANIM-01)
- Animation state machine UI with blend trees and transitions (ANIM-02)
- Animation retargeting across character rigs (ANIM-03)
- Shader graph editor: node-based material authoring (SHDR-01)
- Terrain system with LOD, texturing, sculpting (SHDR-02)
- Advanced VFX: particle effects, post-processing (SHDR-03)
- Node-based visual scripting (VSCR-01)
- Visual scripting debugger (VSCR-02)
- Visual scripting to code export (VSCR-03)

### v3.1: Advanced Characters
**Milestone Goal**: Production-quality character systems.

**Planned capabilities:**
- Advanced IK system (CHAR-01)
- Retargeting across skeleton types (CHAR-02)
- Facial animation and lip sync (CHAR-03)
- VR avatar embodiment (CHAR-04)

### v4.0: Platform Expansion & Extensibility
**Milestone Goal**: Native apps, engine adapters beyond web, and a public plugin ecosystem.

**Planned capabilities:**
- Native mobile app: PWA with native shell (PLAT-01)
- Native desktop app: Electron or Tauri (PLAT-02)
- Unity engine adapter (PLAT-03)
- Godot engine adapter (PLAT-04)
- Unreal engine adapter (PLAT-05)
- Custom R3F renderer adapter (PLAT-06)
- Plugin/extension API for editor customization (EXT-01)
- Plugin marketplace (EXT-02)
- Custom component registration API (EXT-03)

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Contracts & Testing Spine | 0/6 | Not started | - |
| 2. Closed-Loop Editor | 0/7 | Not started | - |
| 3. Review Gate: Foundation | 0/1 | Not started | - |
| 4. Dual Adapter Validation | 0/3 | Not started | - |
| 5. Collaboration | 0/4 | Not started | - |
| 6. Review Gate: Core Platform | 0/1 | Not started | - |
| 7. Game Runtime & Behaviors | 0/5 | Not started | - |
| 8. Templates, Party System & Ejection | 0/6 | Not started | - |
| 9. AI Authoring | 0/3 | Not started | - |
| 10. VR & Asymmetric Play | 0/4 | Not started | - |
| 11. Review Gate: v1 Complete | 0/1 | Not started | - |

---
*Roadmap created: 2026-02-19*
*Last updated: 2026-02-19*
