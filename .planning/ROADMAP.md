# Roadmap: Riff3D

## Overview

Riff3D is built contracts-first: specs before implementations, primary adapter before secondary, collaboration before game features, game features before templates. Every phase delivers a verifiable capability, and review gates at critical boundaries ensure the foundation is solid before building on it. The 69 v1 requirements map across 8 delivery phases and 3 review phases, progressing from pure TypeScript contracts (with CI, property-based tests, conformance harness, and a Rapier physics evaluation spike from day one) through a closed-loop editor, dual adapter validation, real-time collaboration, game runtime, templates with party system, and AI authoring. VR support (Phase 10) is labeled as v1.1 expansion -- it ships after v1 core launch. Phase 8 completion represents a shippable product; Phase 9 (AI) is a core differentiator included if ready. Beyond v1, the roadmap outlines v2+ milestones for marketplace, native apps, engine adapters, visual scripting, and advanced features.

## Phase Review Protocol

Every delivery phase follows the **Phase Review Protocol** (see `.planning/PHASE_REVIEW_PROTOCOL.md`) with two review points:

1. **Pre-execution (advisory, optional for standard phases):** After planning is complete, Claude publishes a plan summary and Codex reviews for feasibility, completeness, and architecture alignment. This is advisory — not blocking. **Mandatory** for Review Gate phases (3, 6, 11) and novel-architecture phases (9). **Optional** for standard delivery phases (4, 5, 7, 8, 10) — skip unless the phase introduces genuinely new architectural territory. The GSD plan checker handles structural validation; Codex adds most value on post-execution code review.
2. **Post-execution (gate decision):** After all plans are executed, Claude produces an evidence packet and Codex performs a full technical audit. The review loop is: Evidence → Codex Review → Claude Response → Codex Final Review → Gate Decision (`PASS`, `PASS_WITH_CONDITIONS`, or `FAIL`).

Review Gate phases (3, 6, 11) run an expanded-scope version that also assesses cross-phase integration, cumulative debt, and architecture drift. If Codex is unavailable, reviews are deferred with a `DEFERRED_REVIEW` status and must be completed before the next Review Gate. All review artifacts live in `.planning/reviews/phase-<N>/`.

### Phase Execution Checklist

Every delivery phase follows this sequence. A phase is not complete until all steps are done:

1. [ ] **Plan** — Research and create all plan files (XX-01 through XX-NN)
2. [ ] **Pre-execution review** *(optional for standard phases; mandatory for phases 3, 6, 9, 11)* — Publish `PHASE_<N>_PLAN_SUMMARY.md`, run `codex-review.sh plan-review <N>`, write response. If skipped, note "Pre-execution review: skipped (standard delivery phase)" in the phase review directory.
3. [ ] **Execute** — Execute all plans in order (mid-phase checkpoint recommended for phases with 5+ plans)
4. [ ] **Post-execution review** — Publish `PHASE_<N>_EVIDENCE.md`, run full Codex review loop (evidence → review → response → final review → decision)
5. [ ] **Gate pass** — Phase marked complete only after `PASS` or `PASS_WITH_CONDITIONS`

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Contracts & Testing Spine** - Define all specs (PatchOps, ECSON, Canonical IR), build golden fixtures (including adversarial), prove round-trip determinism, CI pipeline, fast-check property tests, conformance harness, Rapier evaluation spike
- [x] **Phase 2: Closed-Loop Editor** - Minimal editor shell with PlayCanvas adapter proving the full pipeline end-to-end
- [x] **Phase 3: Review Gate: Foundation** - Validate contracts and closed-loop before building on them
- [ ] **Phase 4: Dual Adapter Validation** - Babylon.js adapter proves Canonical IR is truly engine-agnostic
- [ ] **Phase 5: Collaboration** - Real-time co-editing with Yjs CRDTs, presence, and conflict resolution
- [ ] **Phase 6: Review Gate: Core Platform** - Validate collaboration, adapter conformance, and editor stability before game layer
- [ ] **Phase 7: Game Runtime & Behaviors** - Physics, character controller, behavior components, game state machine, event wiring
- [ ] **Phase 8: Templates, Party System & Ejection** - Four game templates, party/playlist system, game ejection to standalone projects
- [ ] **Phase 9: AI Authoring** - IQL intent language, MCP server, scene compression, safety rules
- [ ] **Phase 10: VR & Asymmetric Play (v1.1 Expansion)** - WebXR integration, VR controls, asymmetric VR+flat-screen sessions
- [ ] **Phase 11: Review Gate: v1 Complete** - Full integration review, performance validation, golden path end-to-end

## Phase Details

### Phase 1: Contracts & Testing Spine
**Goal**: All core contracts (PatchOps, ECSON, Canonical IR) are specified, implemented, and proven via golden fixtures with deterministic round-trip tests -- no browser needed. Includes conformance harness, CI pipeline, property-based tests, and a Rapier physics evaluation spike.
**Depends on**: Nothing (first phase)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CORE-07, CORE-08, CORE-09, CORE-10, TEST-01, TEST-02, TEST-03, TEST-05, PORT-02
**Success Criteria** (what must be TRUE):
  1. A golden fixture ECSON file can be compiled to Canonical IR and back to ECSON with the portable subset preserved identically
  2. Applying a sequence of PatchOps to an empty ECSON document, then replaying those same ops on a fresh document, produces identical output both times
  3. Every PatchOp type has a documented inverse, and applying an op then its inverse returns the document to its original state
  4. The component registry defines at least 15 component types with typed schemas, defaults, and editor hints -- and Zod validates all of them
  5. The monorepo package structure (ecson, patchops, canonical-ir, fixtures, conformance) is established with correct dependency boundaries enforced by Turborepo
  6. CI pipeline (GitHub Actions + Turborepo) runs test, lint, and typecheck on every push from day one
  7. fast-check property tests verify PatchOps invariants (apply-inverse identity, replay determinism, batch equivalence, structural integrity)
  8. PatchOps include origin categories (user/AI/system/replay) and a format version field
  9. At least one adversarial golden fixture exercises deep hierarchies, reparent chains, shared materials, cross-entity event wires, and interleaved op logs
  10. Conformance harness MVP with round-trip tests, replay determinism, and performance benchmark infrastructure is operational
  11. glTF extension allowlist v0 is published with fixture coverage per extension
  12. Rapier.js evaluation spike is completed with findings documented (determinism, bundle size, feature coverage)

Plans:
- [x] 01-01: Monorepo scaffold, CI pipeline, and package structure
- [x] 01-02: ECSON schema, Zod validators, versioning, and migration infrastructure
- [x] 01-03: PatchOps spec, engine, inverse generation, origin policy, and format versioning
- [x] 01-04: Canonical IR spec, compiler, and portable subset v0
- [x] 01-05: Component registry (15+ types) with typed schemas, editor hints, and glTF extension allowlist
- [x] 01-06: Golden fixtures (5 clean + 1 adversarial), conformance harness, fast-check property tests, and Rapier evaluation spike
- [x] 01-07: Phase 1 Review (Pre-execution plan review + post-execution evidence audit → Gate decision)

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
**Plans**: 8 plans

Plans:
- [x] 02-01: Next.js editor shell, auth, and project management (Wave 1)
- [x] 02-02: 3D viewport with PlayCanvas adapter integration (Wave 2)
- [x] 02-03: Transform gizmos, grid/snap, and selection system (Wave 3)
- [x] 02-04: Scene hierarchy, inspector panel, and component editing (Wave 4)
- [x] 02-05: Undo/redo, copy/paste, save/auto-save (Wave 4)
- [x] 02-06: Asset library, GLB import, and environment settings (Wave 5)
- [x] 02-07: Play-test mode (edit-to-runtime transition) (Wave 5)
- [x] 02-08: Phase 2 Review (Pre-execution plan review + post-execution evidence audit → Gate decision: PASS_WITH_CONDITIONS) (Wave 6)

### Phase 3: Review Gate: Foundation
**Goal**: Validate that the contracts are sound and the closed-loop editor is stable before building collaboration and the second adapter on top of it. This is an **expanded-scope review** (per Phase Review Protocol) that also assesses cross-phase integration across Phases 1-2, cumulative debt from any PASS_WITH_CONDITIONS decisions, architecture drift, and carry-forward reconciliation.
**Depends on**: Phase 2
**Requirements**: (none -- review phase)
**Prerequisites**: All deferred reviews from Phases 1-2 must be completed before this gate proceeds.
**Success Criteria** (what must be TRUE):
  1. All golden fixtures load, edit, save, compile, and render without errors in the editor
  2. PatchOps operation log accurately captures every edit made through the UI -- no hidden state mutations exist
  3. Round-trip tests pass at 100% for the portable subset (ECSON to Canonical IR to ECSON)
  4. Performance budgets (load time, memory, FPS) are met for all golden fixture projects running in the PlayCanvas adapter
  5. All carry-forward actions from Phase 1-2 reviews are resolved or explicitly re-scheduled
  6. No unaddressed architecture drift from original contract definitions
**Plans**: 7 plans

Plans:
- [x] 03-01: Adapter unit tests (CF-P2-01) -- mock PlayCanvas, test all adapter modules
- [x] 03-02: Test fixture migration (CF-P2-03) -- migrate to SceneDocumentSchema.parse()
- [x] 03-03: Adapter split + CI LoC enforcement (CF-P2-04) -- subpath exports, budget script
- [x] 03-04: RLS policy tests (CF-P2-02) -- mocked structural + Supabase integration
- [x] 03-05: Drag-preview ghost + performance budgets -- ghost entity, raycasting, tiered thresholds
- [x] 03-06: E2E smoke test + visual baseline beta -- Playwright, golden-path, screenshots
- [x] 03-07: Review gate: expanded-scope Codex audit + human verification (PASS_WITH_CONDITIONS)

### Phase 4: Dual Adapter Validation
**Goal**: The Babylon.js adapter proves the Canonical IR is truly engine-agnostic -- all golden fixtures render and behave within tolerance on both PlayCanvas and Babylon.js
**Depends on**: Phase 3
**Requirements**: ADPT-02, ADPT-03, ADPT-04, TEST-04, PORT-03
**Success Criteria** (what must be TRUE):
  1. All golden fixtures render on both PlayCanvas and Babylon.js with visual output within defined tolerance bands
  2. A user can switch between PlayCanvas and Babylon.js rendering in the editor and see consistent scene representation
  3. Editing a property in the editor updates the active adapter incrementally (property-level delta) without rebuilding the entire scene
  4. Engine tuning sections in ECSON are respected by the target adapter and gracefully ignored by the other
**Plans**: 5 plans

Plans:
- [ ] 04-01: Babylon.js adapter core + EngineAdapter/IRDelta extraction to canonical-ir (Wave 1)
- [ ] 04-02: Incremental delta update system for both adapters (Wave 2)
- [ ] 04-03: Engine switching UI, tuning inspector, and project-level engine persistence (Wave 2)
- [ ] 04-04: Conformance test suite, visual regression with tolerance bands, property tests (Wave 3)
- [ ] 04-05: Phase 4 Review (Pre-execution plan review + post-execution evidence audit + human verification → Gate decision) (Wave 4)

### Phase 5: Collaboration
**Goal**: Two or more users can edit the same project simultaneously with real-time presence, conflict resolution, and independent undo stacks
**Depends on**: Phase 4
**Requirements**: COLLAB-01, COLLAB-02, COLLAB-03, COLLAB-04, COLLAB-05
**Collaboration Backend**: Decided during Phase 5 planning (GSD discuss-phase). Leading candidate: Hocuspocus v3 (MIT, self-hosted, auth/persistence/scaling hooks, production-ready). Note: Hocuspocus v2+ uses multiplexed WebSockets incompatible with standard y-websocket providers -- choosing it is a commitment to its client library. Other evaluated options: Y-Sweet (Rust, S3 persistence), PartyKit/Cloudflare (edge-first), Liveblocks (managed SaaS). Vercel does not support persistent WebSockets -- collaboration server requires separate infrastructure.
**Success Criteria** (what must be TRUE):
  1. Two users editing the same scene see each other's changes appear within 2 seconds, with colored cursors and name labels visible in both the 2D panels and 3D viewport
  2. When two users edit different properties of the same entity simultaneously, both edits are preserved (no silent overwrites)
  3. A user can lock an entity (and its descendants) for exclusive editing, and other users see a visual lock indicator and cannot modify locked objects
  4. A user can walk around the 3D scene as an embodied avatar while editing, and other users see their avatar moving in real-time
  5. Each user has an independent undo stack -- undoing on one client does not undo another user's operations
**Plans**: 6 plans

Plans:
- [ ] 05-01: Carry-forward viewport fixes + mechanical enforcement + CLAUDE.md alignment (Wave 1)
- [ ] 05-02: Hocuspocus server + ECSON<->Y.Doc sync bridge + per-user undo + collab save (Wave 2)
- [ ] 05-03: Presence awareness, collaborator bar, 2D hierarchy indicators, 3D frustum cones (Wave 3)
- [ ] 05-04: Entity locking with hierarchical propagation, read-only inspector, viewport tint (Wave 3)
- [ ] 05-05: Embodied avatar mode -- capsule mesh, WASD walk, toolbar toggle (Wave 4)
- [ ] 05-06: Phase 5 Review (post-execution evidence audit + gate decision) (Wave 5)

### Phase 6: Review Gate: Core Platform
**Goal**: Validate that collaboration, dual adapters, and the editor form a stable platform before adding the game layer on top. This is an **expanded-scope review** (per Phase Review Protocol) that also assesses cross-phase integration across Phases 4-5, cumulative debt from all prior PASS_WITH_CONDITIONS decisions, architecture drift, and carry-forward reconciliation.
**Depends on**: Phase 5
**Requirements**: (none -- review phase)
**Prerequisites**: All deferred reviews from Phases 4-5 must be completed before this gate proceeds.
**Success Criteria** (what must be TRUE):
  1. Two concurrent users can collaboratively build a scene from scratch, play-test it, and save -- with no data loss or corruption
  2. Adapter conformance passes at 90%+ for both PlayCanvas and Babylon.js across all golden fixtures
  3. The editor handles 100+ entities in a scene without dropping below FPS baseline during editing or collaboration
  4. All carry-forward actions from Phase 4-5 reviews are resolved or explicitly re-scheduled
  5. No unaddressed cumulative technical debt from PASS_WITH_CONDITIONS decisions across Phases 1-5
**Plans**: TBD

Plans:
- [ ] 06-01: Core platform integration review, cross-phase audit, and stress testing

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
- [ ] 07-06: Phase 7 Review (Pre-execution plan review + post-execution evidence audit → Gate decision)

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
- [ ] 08-07: Phase 8 Review (Pre-execution plan review + post-execution evidence audit → Gate decision)

> **v1 Shippable Checkpoint:** Phase 8 completion represents a fully functional product (editor, dual adapters, collaboration, game runtime, templates, party system, ejection). This is the natural "ship v1" point. Phase 9 (AI Authoring) is a core differentiator and strong candidate for v1 inclusion -- pursue immediately and include if ready, but do not hard-gate launch on it.

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
- [ ] 09-04: Phase 9 Review (Pre-execution plan review + post-execution evidence audit → Gate decision)

### Phase 10: VR & Asymmetric Play (v1.1 Expansion)
**Goal**: Players can join games in VR headsets (WebXR) alongside flat-screen players, with full VR controls and comfort settings. This phase is labeled as v1.1 expansion -- it ships after v1 core launch, not as a launch gate.
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
- [ ] 10-05: Phase 10 Review (Pre-execution plan review + post-execution evidence audit → Gate decision)

### Phase 11: Review Gate: v1 Complete
**Goal**: Full integration review ensuring the entire v1 surface works end-to-end, performance targets are met, and the platform is ready for users. This is the **final expanded-scope review** (per Phase Review Protocol) covering all phases, all cumulative debt, full architecture conformance, and launch readiness.
**Depends on**: Phase 10
**Requirements**: (none -- review phase)
**Prerequisites**: All deferred reviews from all prior phases must be completed before this gate proceeds.
**Success Criteria** (what must be TRUE):
  1. The golden path (Pick Template, Edit via Verbs/Tools, Play, Iterate, Save/Share) works without friction for all four templates
  2. All 69 v1 requirements are verified as implemented and passing their success criteria
  3. Performance budgets are met across all scenarios: editor with 100+ entities, collaboration with 4+ users, runtime at 60fps on target hardware, VR at 72fps on Quest
  4. A new user can sign up, create a game from a template, invite a friend, play together, and share a link -- all within 10 minutes
  5. All carry-forward actions from all prior phase reviews are resolved — zero open items
  6. No unaddressed PASS_WITH_CONDITIONS debt remaining across the entire project
  7. Architecture conforms to original contract definitions or deviations are formally documented and approved
**Plans**: TBD

Plans:
- [ ] 11-01: v1 integration review, full cross-phase audit, performance validation, and launch readiness

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
| 1. Contracts & Testing Spine | 7/7 | Complete    | 2026-02-19 |
| 2. Closed-Loop Editor | 8/8 | Complete | 2026-02-20 |
| 3. Review Gate: Foundation | 7/7 | Complete (PASS_WITH_CONDITIONS) | 2026-02-20 |
| 4. Dual Adapter Validation | 5/5 | Complete (PASS_WITH_CONDITIONS) | 2026-02-20 |
| 5. Collaboration | 1/6 | In Progress | - |
| 6. Review Gate: Core Platform | 0/1 | Not started | - |
| 7. Game Runtime & Behaviors | 0/6 | Not started | - |
| 8. Templates, Party System & Ejection | 0/7 | Not started | - |
| 9. AI Authoring | 0/4 | Not started | - |
| 10. VR & Asymmetric Play (v1.1 Expansion) | 0/5 | Not started | - |
| 11. Review Gate: v1 Complete | 0/1 | Not started | - |

---
*Roadmap created: 2026-02-19*
*Last updated: 2026-02-20 — Phase 5 planned (6 plans in 5 waves)*
