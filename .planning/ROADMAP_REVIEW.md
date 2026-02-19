# Roadmap Review: Riff3D

**Date:** 2026-02-19  
**Reviewed inputs:** `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`  
**Goal of this doc:** Evaluate current plan quality, highlight risks, propose focused research, identify OSS leverage, and define parallel execution strategy.

## What Is Strong

1. The contract-first spine is the right foundation. Defining PatchOps/ECSON/Canonical IR before UI makes AI safety, migration, and adapter portability tractable.
2. Dual-adapter pressure (PlayCanvas + Babylon.js) is a strong anti-lock-in forcing function early, not a late retrofit.
3. Review gates at Phases 3, 6, 11 are excellent; they create stop/go points before expensive layers.
4. Golden fixtures + conformance are exactly the right mechanism to control drift and regression.
5. The roadmap preserves a coherent product arc: creation loop first, multiplayer/game loop second, AI/VR last.
6. Requirement traceability (69/69 mapped) is already unusually disciplined for this stage.

## Main Concerns

## 1) Collaboration infrastructure/deployment mismatch risk

Your stack calls for Next.js and Yjs collaboration in v1. If you deploy the app on Vercel Functions, WebSocket server hosting is explicitly unsupported.  
Impact: collaboration architecture decisions in Phase 5 can fail late if transport assumptions are wrong.

Mitigation now:
- Pick one collaboration backend strategy in Phase 1 planning:
- `Self-hosted Yjs websocket/hocuspocus service` (separate infra from Next.js deployment).
- `Managed Yjs backend` (Liveblocks or equivalent).
- Add deployment constraints to requirements and architecture docs now.

## 2) “Independent undo per user” requires explicit Yjs transaction-origin design

Requirement `EDIT-05` and `COLLAB-05` assume independent undo stacks. Yjs supports selective undo with `UndoManager` and `trackedOrigins`, but this must be intentionally encoded in all mutation paths.

Mitigation now:
- Add a PatchOps origin policy doc (human user, AI agent, system migration, replay).
- Add tests asserting undo never undoes remote user operations.

## 3) Determinism requirement is at odds with cross-engine runtime behavior unless scoped tightly

You require deterministic operation pipeline and adapter conformance. Rendering and physics behavior across two engines can diverge for valid reasons.

Mitigation now:
- Split conformance into:
- `Semantic conformance` (entity/component graph, property state, event dispatch results).
- `Visual conformance` with tolerances (pixel diff threshold, camera/light standardization).
- Define what “portable subset deterministic” means without requiring full frame-identical output.

## 4) Physics portability could become a sinkhole

PlayCanvas is tied to ammo.js in its documented stack; Babylon has strong Havok integration and its own plugin flow. A physics-heavy portable subset too early will create endless adapter exceptions.

Mitigation now:
- Keep physics minimal for v1 portable subset.
- Treat advanced physics as capability tiers plus explicit engine tuning fields.
- Add a single canonical physics behavior fixture set before expanding game templates.

## 5) Scope width in v1 is very high

v1 currently includes dual adapters, collaboration, party sessions, AI authoring, and VR. Each of these can independently consume a startup roadmap.

Mitigation now:
- Define a “v1 Core GA” internal checkpoint after Phase 8 (before AI/VR) with hard quality bar.
- Treat Phases 9-10 as “v1.x expansion” unless strong business reason requires launch-day inclusion.

## 6) Asset pipeline and glTF extension policy is currently under-specified

You depend on GLB/glTF import and cross-engine behavior but do not yet define supported extensions/material feature matrix.

Mitigation now:
- Publish a strict glTF extension allowlist for v1.
- Add fixture coverage per extension (materials, animation, lights, skinning, morph targets).

## 7) Extensibility is deferred too late for a system that needs modular growth

Current requirements place plugin/extensibility work in v2+, but the v1 roadmap already spans many domains (editor UX, adapters, collaboration, runtime behaviors, AI, VR). Without an internal plugin boundary early, the codebase can become tightly coupled and hard to parallelize.

Mitigation now:
- Add an `internal plugin architecture` in v1 even if public third-party plugins remain v2+.
- Define stable extension points early: component registration, inspector property editors, import/export codecs, behavior packs, and command/verb registrations.
- Keep external plugin loading disabled until trust/sandbox/version policy is ready.

## Additional Research Recommended (High Value)

1. Collaboration backend decision memo:
- Compare self-hosted Yjs websocket/hocuspocus vs managed Yjs providers.
- Include auth model, persistence, cost, operational complexity, and scaling path.

2. Canonical IR vs glTF boundary:
- Decide exactly what stays in ECSON/IR vs imported asset payload references.
- Define extension pass-through strategy and downgrade behavior.

3. Adapter conformance harness:
- Define deterministic camera setup, render settings, and image-diff thresholds.
- Decide visual diff stack (Playwright screenshots + pixelmatch or equivalent).

4. Physics abstraction experiment:
- Run one spike implementing the same 3 fixtures in both engines with your planned component model.
- Measure mismatch classes before locking portable physics fields.

5. WebXR target matrix:
- Define supported device/browser matrix and required comfort features before Phase 10 implementation planning.

6. Migration/versioning policy:
- Decide schema evolution semantics (forward migration guarantees, deprecation windows, fixture upgrade process).

7. Plugin architecture ADR set:
- Define plugin manifest format, capability declarations, API versioning, and dependency constraints.
- Define trust tiers (`core`, `first-party`, `third-party`) and which capabilities each tier can access.
- Define how plugin outputs are forced through PatchOps (no direct state mutation).

## OSS / Existing Tooling To Outsource (Recommended)

## Core contracts and validation

- `zod` for typed runtime schema validation + TypeScript inference.
- `ajv` where strict JSON Schema compatibility/performance is needed.

## Property and determinism testing

- `fast-check` for property-based tests across PatchOps inverse/replay invariants.
- `vitest` snapshots for Canonical IR and serialized op streams.

## Collaboration

- `yjs` + `y-websocket` baseline (or Hocuspocus on top) for CRDT sync/awareness.
- Managed option: `@liveblocks/yjs` if you prefer lower ops burden.

## Rendering conformance

- `@playwright/test` screenshot assertions for fixed fixture cameras.
- `pixelmatch` for engine A/B diffing and tolerance reports.

## Auth and project access

- `Auth.js` for social providers and OAuth/OIDC flow handling.

## Physics

- For portable runtime physics abstraction experiments, evaluate `Rapier` as a canonical simulation layer for game logic invariants where feasible.
- Keep native engine physics integrations for engine-specific tuning paths.

## Modularity and plugin foundation

- Use package-level modularity first: monorepo packages for adapters, behaviors, templates, and editor features behind explicit interfaces.
- Use dynamic module boundaries only for non-critical extension surfaces at first (importers, behavior packs, inspector widgets).
- Keep plugin APIs data-oriented and contract-bound: plugin calls should emit PatchOps or schema-validated payloads, never mutate editor state directly.

## Critical Pitfalls and How To Avoid Them

1. Hidden state mutation in editor UI:
- Enforce mutation through PatchOps only by architecture and lint/test guards.

2. ID instability in collaborative/offline scenarios:
- Separate durable IDs (entity/component/op) from ephemeral client IDs.
- Add replay + merge tests with interleaved user timelines.

3. Golden fixtures that are too simple:
- Include nasty fixtures early: deep hierarchies, reparent chains, animation clips, tuning overrides, conflict cases.

4. Adapter performance collapse on incremental updates:
- Define performance budgets and benchmarks for “single-property update” and “100-entity scene edit” now.

5. Overloading portable subset with edge features:
- Keep promotion rule strict (2+ templates need it).
- Require conformance fixture before adding core schema fields.

6. Late discovery of deployment constraints:
- Lock runtime topology early (Next.js app + collaboration service + storage + auth).

7. Unbounded plugin API surface:
- Avoid exposing engine internals directly through extension APIs.
- Version extension APIs and require conformance tests for each plugin capability.
- Start with a narrow allowlist of extension points and expand only when two independent use cases need it.

## How To Parallelize The Work Better

Use the contracts as the seam. Organize workstreams that only meet at versioned interfaces.

## Parallel workstream proposal

1. `Contracts & Invariants` (Phase 1 owner):
- PatchOps, ECSON, Canonical IR specs.
- Migration and ID policy.
- Property-based and replay determinism tests.

2. `Fixture & Conformance Harness`:
- Golden fixtures authoring.
- Snapshot/image diff infrastructure and CI jobs.
- Adapter test oracle definitions.

3. `PlayCanvas Adapter`:
- Canonical IR ingestion + incremental updates.
- Performance instrumentation on fixture set.

4. `Babylon Adapter`:
- Mirror of PlayCanvas adapter with same fixture targets.
- Conformance gaps documented continuously.

5. `Editor Shell`:
- Next.js shell, hierarchy/inspector/gizmo UX.
- Strict PatchOps mutation plumbing.

6. `Collaboration Backbone`:
- Yjs doc model, room/auth model, persistence.
- Awareness/presence/locking policy and tests.

7. `Runtime Behaviors`:
- Game state machine/event wiring/behavior components behind stable component contracts.

## Dependency rules for safe parallelism

- Freeze `v0` contract package versions before adapters start.
- All workstreams consume fixtures from one shared fixture package.
- No adapter-specific fields enter portable schema without conformance evidence from both adapters.
- Every feature PR must include: contract impact note, fixture changes, and conformance result.
- Plugin/extension changes must include capability declaration updates and a compatibility test against the current API version.

## Suggested Roadmap Adjustments

1. Add an explicit “Phase 0.5: Runtime Topology & Collaboration ADRs” before Phase 2 completion.
2. Move “adapter incremental update system” earlier as a cross-cutting concern during Phase 2-4 overlap.
3. Add “Conformance Harness MVP” as a named Phase 1 deliverable, not just a Phase 4 concern.
4. Create a “v1 Core GA” gate after Phase 8 and treat AI/VR as expansion unless required for launch.
5. Add “Internal Plugin Foundation” to Phase 1-2 scope:
- v1 target is internal modularity and first-party plugin seams.
- Public third-party plugin marketplace remains v2+.

## Immediate Next Steps (Practical)

1. Write 3 ADRs this week:
- Collaboration backend/deployment topology.
- Determinism and conformance definition.
- Physics portability strategy.

2. Define golden fixture v0 list with acceptance criteria and ownership.

3. Create monorepo package skeleton immediately:
- `@riff3d/patchops`
- `@riff3d/ecson`
- `@riff3d/canonical-ir`
- `@riff3d/fixtures`
- `@riff3d/conformance`

4. Implement CI checks before feature build-out:
- Replay determinism.
- Inverse correctness.
- ECSON↔IR round-trip.
- Fixture adapter conformance smoke.

5. Add a plugin foundation sprint:
- Write `Plugin API v0` and capability model ADR.
- Build first extension points: `component registry providers`, `inspector field renderers`, and `importer adapters`.
- Add compatibility tests that fail when plugin API changes without version bump.

---

## Sources

Local project docs:
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/PROJECT.md`
- `.planning/STATE.md`

External references:
- Yjs UndoManager: https://docs.yjs.dev/api/undo-manager
- Yjs Awareness: https://docs.yjs.dev/api/about-awareness
- y-websocket (auth, awareness, scaling patterns): https://docs.yjs.dev/ecosystem/connection-provider/y-websocket
- Yjs overview (scaling note): https://docs.yjs.dev/
- Vercel limits (WebSockets): https://vercel.com/docs/platform/limits
- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers-and-middleware
- PlayCanvas supported model formats: https://developer.playcanvas.com/user-manual/assets/supported-formats/
- PlayCanvas glTF/GLB feature support guidance: https://developer.playcanvas.com/user-manual/assets/models/building/
- PlayCanvas physics (ammo.js): https://developer.playcanvas.com/user-manual/physics/physics-basics/
- Babylon loaders package (`@babylonjs/loaders`): https://www.npmjs.com/package/@babylonjs/loaders
- Babylon Havok package (`@babylonjs/havok`): https://www.npmjs.com/package/@babylonjs/havok
- Babylon engine repository (license/releases): https://github.com/BabylonJS/Babylon.js
- glTF registry/specification: https://registry.khronos.org/glTF/
- glTF as ISO/IEC 12113:2022: https://www.khronos.org/news/press/khronos-gltf-2.0-released-as-an-iso-iec-international-standard
- WebXR API status: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API
- Turborepo package/task graph: https://turborepo.com/repo/docs/core-concepts/package-and-task-graph
- Turborepo task configuration: https://turborepo.com/repo/docs/crafting-your-repository/configuring-tasks
- Turborepo boundaries: https://turborepo.com/docs/reference/boundaries
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Pixelmatch: https://www.npmjs.com/package/pixelmatch
- Zod: https://zod.dev/
- Ajv JSON Schema support: https://ajv.js.org/json-schema.html
- fast-check: https://fast-check.dev/
- Auth.js (home): https://authjs.dev/
- Auth.js OAuth provider configuration: https://authjs.dev/guides/configuring-oauth-providers
- Hocuspocus collaboration guide: https://tiptap.dev/docs/hocuspocus/guides/collaborative-editing
- Liveblocks Yjs API: https://liveblocks.io/docs/api-reference/liveblocks-yjs
- Rapier docs: https://rapier.rs/docs/
