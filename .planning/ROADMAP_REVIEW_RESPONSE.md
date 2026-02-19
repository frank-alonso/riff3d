# Roadmap Review Response

**Date:** 2026-02-19
**Responding to:** `.planning/ROADMAP_REVIEW.md`
**Reviewed inputs:** All `.planning/` docs, all `.planning/research/` docs, CLAUDE.md, prototype rebuild research, current engine source analysis, web research on current library versions and deployment patterns.
**Goal:** Converge on a shared understanding of risks, corrections, and roadmap adjustments so we can lock the roadmap and begin Phase 1 execution with GSD (tests + golden fixtures from the start).

---

## Where the Review Is Correct

The review is strong. These points are accepted without reservation:

1. **Collaboration deployment mismatch is real.** Vercel does not support persistent WebSocket connections. This must be decided before Phase 5, not during it. (I have additional findings below on deployment options the review didn't cover.)

2. **Independent undo requires explicit Yjs transaction-origin design.** Agreed -- `UndoManager` with `trackedOrigins` must be encoded in every PatchOps mutation path. The PatchOps origin policy doc suggestion is correct and should be a Phase 1 deliverable (origin categories: `user:{userId}`, `ai:{agentId}`, `system:migration`, `system:replay`).

3. **Split conformance into semantic vs visual.** This is the right framing. Semantic conformance (entity graph, property state, event dispatch) should be exact. Visual conformance needs tolerance bands. Physics conformance needs empirical measurement, not estimation.

4. **v1 scope width is high.** The "v1 Core GA" gate after Phase 8 with AI/VR as expansion is a pragmatic call. (I have a nuanced position on this below.)

5. **glTF extension allowlist is needed.** Agreed -- publish a strict allowlist in Phase 1 with fixture coverage per extension.

6. **Golden fixtures that are too simple.** The call for "nasty fixtures" (deep hierarchies, reparent chains, animation clips, tuning overrides, conflict cases) is correct. The Phase 1 fixture set should include at least one deliberately adversarial fixture.

7. **Conformance harness as Phase 1 deliverable.** Agree -- the conformance harness infrastructure (round-trip tests, replay determinism, performance budgets) should be a named Phase 1 deliverable, not deferred to Phase 4.

8. **OSS recommendations are solid.** Zod, fast-check, Vitest snapshots, Playwright screenshots, pixelmatch, Auth.js/Supabase Auth -- all correct choices for their respective concerns.

---

## Where the Review Needs Correction or Additional Context

### 1. PlayCanvas Version and Physics Engine Status

The research docs reference PlayCanvas ~2.17. **The latest stable PlayCanvas engine version is v2.16.0** (promoted as default Editor V2 version on February 9, 2026). There is no 2.17 release yet -- the local clone has a beta tag (`2.17.0-beta.0`), which is not released.

More critically: **PlayCanvas still uses ammo.js as its only officially integrated physics engine.** Ammo.js is a WASM port of C++ Bullet physics. The PlayCanvas team has acknowledged community requests to support alternative physics engines (Rapier, Jolt) but has no timeline. Their modular engine architecture (v2.x) could facilitate third-party integration on a per-project basis.

**Impact on roadmap:** Physics portability is even harder than the review assumed. The divergence isn't just ammo.js vs Havok behavior differences -- it's also that ammo.js is aging and poorly maintained while Havok (Babylon's default in v8.0) is a modern AAA physics engine. The behavioral gap may widen over time.

### 2. Rapier.js Deserves Serious Evaluation as Canonical Physics

The review mentions Rapier briefly but doesn't advocate for it strongly enough. Current state:

- **Rapier 3D (npm: @dimforge/rapier3d):** v0.19.3 as of November 2025. Rust core v0.32.
- **2-5x faster** than 2024 versions thanks to SIMD-accelerated BVH, persistent islands, reduced contact manifolds.
- **Fully standalone:** Works with any renderer or no renderer. Pure physics simulation.
- **Capabilities:** Rigid bodies, colliders (cuboids, spheres, capsules, convex/trimesh/heightfield/voxels), joints, character controllers, raycasting, CCD, sensors/triggers.
- **WASM:** Runs in browser and Node.js. SIMD variant available.

**Why this matters for Riff3D:** Instead of abstracting over two different physics engines (ammo.js for PlayCanvas, Havok for Babylon.js) with all the behavioral divergence that implies, Rapier could serve as the **canonical physics simulation layer** for game logic invariants. Both adapters would use Rapier for physics simulation, while engine-native physics (ammo.js, Havok) would be available via the tuning escape hatch for engine-specific optimization.

This transforms the physics portability problem from "make two different engines produce similar results" to "use one engine for canonical behavior, optionally override per-adapter for performance."

**Recommendation:** Add a Rapier evaluation spike to Phase 1. The spike should:
1. Implement the "bouncing ball" and "character on platforms" fixtures using Rapier standalone.
2. Measure whether Rapier simulation results are deterministic across runs (required for replay).
3. Assess WASM bundle size impact.
4. Determine if Rapier can serve as the canonical physics layer with adapter-native physics as tuning overrides.

### 3. Collaboration Backend Options Are Broader Than Presented

The review correctly identifies the deployment mismatch but limits options to self-hosted y-websocket vs managed Liveblocks. The landscape has evolved:

| Option | Type | WebSocket? | Persistence | Auth | Scaling | Cost |
|--------|------|-----------|-------------|------|---------|------|
| **Hocuspocus** (v3.4.4) | Self-hosted y-websocket++ | Yes (Node.js) | SQLite/Postgres/Redis/S3/custom | onAuthenticate hook | Redis adapter for horizontal | Self-hosted |
| **PartyKit** (now Cloudflare) | Managed serverless | Durable Objects (WebSocket-compatible) | Built-in | Customizable | Global edge | Cloudflare pricing |
| **Y-Sweet** (Jamsocket) | Self-hosted or managed | Yes | S3-compatible storage | Client tokens | Session-based horizontal | Free tier available |
| **Liveblocks** | Managed SaaS | Abstracted | Managed | Built-in | Managed | SaaS pricing |
| **Raw y-websocket** | Self-hosted | Yes (Node.js) | LevelDB or custom | Manual | Manual | Self-hosted |

**My recommendation:** Hocuspocus as the default, with PartyKit as the serverless alternative.

Hocuspocus is the clear winner for a project that needs auth, persistence, and scaling hooks. It's production-ready (v3.4.4, 2.1k stars, Tiptap-maintained), MIT-licensed, and adds exactly the production concerns (auth, persistence, scaling, lifecycle hooks) that raw y-websocket lacks. It wraps the same Yjs protocol, so migration cost is near zero.

PartyKit (now part of Cloudflare) is the right choice if serverless deployment is preferred. It runs on Durable Objects with first-class `y-partykit` support.

**This decision does NOT need a Phase 0.5.** It's a deployment topology ADR that should be written during Phase 5 planning (GSD discuss-phase will surface this naturally). The PatchOps/ECSON/IR contracts don't depend on which collaboration backend is chosen -- that's the entire point of the layered architecture.

### 4. Babylon.js Version Correction

The research references ~8.52. **The latest major release is Babylon.js 8.0** (March 27, 2025) with patch version 8.51.2 as of February 15, 2026. Key note: Babylon.js 8.0 shipped with **full Havok physics integration** (WASM, character controller, ragdoll) and **native WGSL shader support** (no conversion layer, engine ~2x smaller when targeting WebGPU).

This reinforces the physics divergence concern -- Babylon's Havok integration is now deep and mature, while PlayCanvas's ammo.js is stagnant.

---

## Where I Disagree with the Review

### 1. "Phase 0.5: Runtime Topology & Collaboration ADRs" Is Unnecessary Overhead

The review suggests adding an explicit Phase 0.5 before Phase 2 completion for ADRs on collaboration topology, determinism, and physics portability.

**I disagree.** GSD's discuss-phase and research-phase workflows already handle this naturally. When we run `/gsd:plan-phase` for Phase 1, the discussion phase will surface exactly these questions and produce research before planning begins. Adding a formal phase for ADRs creates bureaucratic overhead without adding value.

Instead:
- **Collaboration topology ADR:** Write during Phase 5 planning. The contract layer doesn't depend on it.
- **Determinism/conformance definition:** This IS Phase 1 work. Defining what "deterministic" means for PatchOps and what "conformant" means for adapters is a Phase 1 deliverable, not a pre-phase ADR.
- **Physics portability strategy:** The Rapier evaluation spike belongs in Phase 1 (it informs the Canonical IR physics component design).

### 2. "Internal Plugin Foundation in Phase 1-2" Is Premature

The review recommends adding internal plugin architecture (component registration, inspector renderers, importers) to Phase 1-2 scope.

**I partially disagree.** The monorepo package structure already IS the plugin architecture. `@riff3d/ecson`, `@riff3d/patchops`, `@riff3d/canonical-ir`, `@riff3d/adapter-playcanvas`, etc. are packages with explicit interfaces and dependency boundaries. This is the right level of modularity for v1.

What the review calls "extension points" -- component registry providers, inspector field renderers, importer adapters -- are just well-designed interfaces within those packages. You don't need a formal "Plugin API v0" to have clean interfaces. You need clean interfaces because that's how you write good code.

**What I agree with:** The component registry must be designed as a registry (not hardcoded) from Phase 1. Inspector forms must be generated from schemas (not hand-coded). These are architecture requirements, not plugin requirements.

**What I don't agree with:** Writing a Plugin API v0 ADR, building compatibility tests for plugin API changes, or defining trust tiers in Phase 1-2. This is optimization for a problem that doesn't exist yet. The 2-template rule applies to APIs too -- build the plugin system when two independent use cases need it.

### 3. "v1 Core GA After Phase 8" Framing

The review suggests treating Phases 9-10 (AI Authoring + VR) as "v1.x expansion" unless a strong business reason requires launch-day inclusion.

**I agree with the spirit but disagree with the label.** Here's why:

AI Authoring (Phase 9) is not an expansion -- it's a **core differentiator**. IQL + MCP is what makes Riff3D fundamentally different from PlayCanvas, Spline, or any other web 3D editor. It's what enables "describe your game and watch it build." Deferring it to post-launch removes the product's most unique value proposition.

VR (Phase 10), on the other hand, IS clearly expansion material. WebXR adds significant complexity (device matrix, comfort settings, asymmetric play) with a narrow initial audience.

**Recommended adjustment:**
- **v1 Core GA gate after Phase 9** (includes AI Authoring). AI is core to the product identity.
- **Phase 10 (VR) as v1.1 expansion.** Ship v1 without VR. Add VR when the platform has users.
- The Review Gate at Phase 11 still covers the full surface for anyone who wants VR at launch.

---

## What the Review Missed

### 1. Property-Based Testing Is Critical for PatchOps Invariants

The review mentions fast-check briefly but doesn't emphasize HOW it should be used. For PatchOps, property-based testing is not optional -- it's the primary test strategy.

**PatchOps invariants that must hold for ANY operation sequence:**

```
// Invariant 1: Apply-Inverse Identity
forAll(arbitraryPatchOp, arbitraryECSSON, (op, doc) => {
  const [result, inverse] = applyOp(doc, op);
  const [original, _] = applyOp(result, inverse);
  expect(original).toEqual(doc);
});

// Invariant 2: Replay Determinism
forAll(arbitraryOpSequence, (ops) => {
  const result1 = replay(emptyDoc, ops);
  const result2 = replay(emptyDoc, ops);
  expect(result1).toEqual(result2);
});

// Invariant 3: Batch Equivalence
forAll(arbitraryOpSequence, (ops) => {
  const sequential = ops.reduce((doc, op) => applyOp(doc, op)[0], emptyDoc);
  const batched = applyOp(emptyDoc, batchOp(ops))[0];
  expect(sequential).toEqual(batched);
});

// Invariant 4: Structural Integrity
forAll(arbitraryOpSequence, (ops) => {
  const result = replay(emptyDoc, ops);
  expect(validateECSSON(result).success).toBe(true);
  // No orphaned children, no circular parents, no dangling asset refs
});
```

fast-check (v4.5.3, actively maintained, clear leader in JS property-based testing) generates thousands of random operation sequences and verifies these invariants hold. This catches edge cases that hand-written tests miss -- malformed sequences, empty batches, double-deletes, reparent cycles.

**This should be a GSD plan requirement:** Every Phase 1 plan that touches PatchOps must include fast-check property tests for the above invariants.

### 2. PatchOps Versioning (Not Just ECSON Versioning)

The review correctly identifies ECSON schema evolution as a concern but misses PatchOps versioning. The operation log stores PatchOps over time. If the PatchOp format changes (new op types, modified payloads), old ops in the log become unreadable.

**Requirements:**
- PatchOps must have a format version field.
- Op log replay must handle version mismatches (either by migrating ops or by upgrading ops on read).
- Golden fixtures must include versioned op logs, not just versioned ECSON documents.

This is a Phase 1 concern -- the PatchOps spec must include versioning from day one.

### 3. GSD Workflow Integration for Test-First Development

The review doesn't address how we'll actually execute this roadmap. With GSD, every phase follows: discuss -> research -> plan -> execute -> verify. Here's how to integrate tests and golden fixtures into this loop:

**Phase 1 GSD Execution Strategy:**

1. **discuss-phase:** Surface assumptions, identify unknowns, define acceptance criteria per plan.
2. **research-phase:** Look up latest library versions (npm view), validate patterns against engine source.
3. **plan-phase:** Each plan includes:
   - **Contract specs** (Zod schemas, TypeScript types)
   - **Golden fixture requirements** (which fixtures this plan must produce or update)
   - **Test requirements** (property-based tests, round-trip tests, snapshot tests)
   - **Success criteria** (measurable, automatable)
4. **execute-phase:** Implementation follows test-first:
   - Write Zod schema -> Write test -> Implement -> Verify fixture
   - Every plan produces a fixture update or a new fixture
   - fast-check property tests run in CI for every PatchOps change
5. **verify-work:** Conversational UAT against success criteria + CI green.

**Golden Fixture as Acceptance Gate:**

Each Phase 1 plan should produce or update specific golden fixtures:

| Plan | Fixtures Produced/Updated |
|------|--------------------------|
| 01-01: Monorepo scaffold | Fixture directory structure, empty fixture template |
| 01-02: ECSON schema | `01-transforms-parenting.ecson.json`, `02-materials-lights.ecson.json` |
| 01-03: PatchOps engine | Op log files for each fixture (apply + inverse sequences) |
| 01-04: Canonical IR compiler | IR snapshot for each fixture (ECSON -> IR output) |
| 01-05: Component registry | `03-animation-stub.ecson.json`, `04-events-triggers.ecson.json` |
| 01-06: Golden fixtures + tests | `05-character-stub.ecson.json`, adversarial fixture, all tests green |

### 4. Performance Budget Specificity

The review mentions performance budgets but doesn't define them. Phase 1 should lock these numbers:

| Metric | Budget | Measured How |
|--------|--------|--------------|
| ECSON parse + validate (100 entities) | < 50ms | Vitest benchmark |
| PatchOp apply (single op) | < 1ms | Vitest benchmark |
| PatchOp replay (1000 ops) | < 500ms | Vitest benchmark |
| ECSON -> Canonical IR compile (100 entities) | < 100ms | Vitest benchmark |
| Canonical IR -> Adapter load (100 entities) | < 200ms | Playwright timing |
| Adapter incremental update (single property) | < 5ms | Playwright timing |
| Golden fixture round-trip (ECSON -> IR -> ECSON) | < 150ms | Vitest benchmark |
| ECSON serialize to JSON (100 entities) | < 20ms | Vitest benchmark |

These go into `packages/conformance/` as automated benchmarks. Phase 1 establishes the infrastructure; Phase 2 measures against real adapter implementations.

### 5. The "Adversarial Fixture" Gap

The review mentions "nasty fixtures" but doesn't specify what makes a fixture adversarial. Phase 1 should include at least one fixture that exercises:

- Deep hierarchy (10+ levels of nesting)
- Reparent chain (entity moved through 5+ parents in op sequence)
- Shared material referenced by 10+ entities
- Event wire from a deeply nested entity to a root entity
- Entity with 5+ components (stress component registry)
- Tuning sections for both PlayCanvas and Babylon (adapter must ignore irrelevant tuning)
- An op log that includes creates, deletes, reparents, and property edits interleaved

This fixture is what catches the edge cases that clean fixtures miss.

### 6. CI Pipeline Must Exist from Plan 01-01

The review mentions "CI checks before feature build-out" but puts it after the monorepo skeleton. CI should be the FIRST thing in the monorepo -- not an afterthought.

Plan 01-01 (monorepo scaffold) should produce:
- pnpm workspace configuration
- Turborepo task configuration
- Vitest setup per package
- GitHub Actions (or equivalent) running:
  - `turbo test` (all packages)
  - `turbo lint` (all packages)
  - `turbo typecheck` (all packages)
- Package dependency boundary enforcement (Turborepo boundaries)

Every subsequent plan adds tests to this CI pipeline. There is never a moment where code exists without tests running.

---

## Concrete Roadmap Adjustments (Proposed)

Based on the above analysis, here are the specific changes I'd make to the roadmap:

### Phase 1 Adjustments

Add to Phase 1 deliverables:
1. **Conformance harness MVP** (round-trip tests, replay determinism, performance benchmarks) -- moved from being an implicit Phase 4 concern to an explicit Phase 1 deliverable.
2. **PatchOps origin policy** (user/AI/system/replay categories) -- required for future collaboration and undo.
3. **PatchOps format versioning** -- version field in every op, migration strategy documented.
4. **Rapier.js evaluation spike** -- determine if Rapier can serve as canonical physics layer.
5. **Adversarial golden fixture** -- at least one fixture designed to break naive implementations.
6. **fast-check property tests** for all PatchOps invariants (apply-inverse, replay determinism, batch equivalence, structural integrity).
7. **CI pipeline** from day one (GitHub Actions + Turborepo).
8. **glTF extension allowlist v0** -- strict list of supported extensions with fixture coverage.

### Phase 1 Plan Reordering

The current plan list is mostly right but should be resequenced:

```
01-01: Monorepo scaffold, CI pipeline, and package structure
01-02: ECSON schema, Zod validators, versioning, and migration infrastructure
01-03: PatchOps spec, engine, inverse generation, and format versioning
01-04: Canonical IR spec, compiler, and portable subset v0
01-05: Component registry (15+ types) with typed schemas and editor hints
01-06: Golden fixtures (5 clean + 1 adversarial), conformance harness, fast-check property tests
```

This is the same plans, but 01-01 now explicitly includes CI, and 01-06 now explicitly includes the adversarial fixture and property-based tests.

### Phase 5 Adjustment

Rename and scope the collaboration backend decision:
- The Hocuspocus vs PartyKit vs Y-Sweet vs raw y-websocket decision is made during Phase 5 planning (GSD discuss-phase), not in a separate Phase 0.5.
- Add Hocuspocus as the recommended default (production-ready, batteries-included, MIT, self-hostable).

### Phase 9-10 Adjustment

- Move "v1 Core GA" gate to **after Phase 9** (AI Authoring is a core differentiator, not expansion).
- Phase 10 (VR) becomes explicitly labeled as "v1.1 Expansion" in the roadmap.
- Phase 11 Review Gate covers the full surface regardless.

### Remove the Suggested "Phase 0.5"

GSD's discuss-phase and research-phase workflows handle ADR generation naturally during phase planning. A separate phase for writing ADRs is bureaucratic overhead that slows down getting to code.

---

## On the Parallel Workstream Proposal

The review's parallel workstream proposal is architecturally sound:

1. Contracts & Invariants
2. Fixture & Conformance Harness
3. PlayCanvas Adapter
4. Babylon Adapter
5. Editor Shell
6. Collaboration Backbone
7. Runtime Behaviors

**However, this parallelism is premature for Phase 1.** Phase 1 is pure contracts -- no adapters, no editor shell, no collaboration. The parallelism activates in Phase 2+ when the contracts are frozen and workstreams can diverge.

Within Phase 1, the natural parallelism is:
- Plans 01-02 (ECSON) and 01-03 (PatchOps) have minimal dependencies and can overlap.
- Plan 01-04 (Canonical IR) depends on ECSON being defined.
- Plan 01-05 (Component registry) depends on ECSON schema types.
- Plan 01-06 (Fixtures + tests) depends on everything above.

GSD's wave-based execution in `/gsd:execute-phase` handles this automatically.

**The dependency rules for safe parallelism are correct and should be adopted:**
- Freeze v0 contract package versions before adapters start.
- All workstreams consume fixtures from one shared fixture package.
- No adapter-specific fields enter portable schema without conformance evidence from both adapters.
- Every feature PR must include: contract impact note, fixture changes, and conformance result.

---

## On the Plugin Architecture ADR Recommendation

The review recommends a Plugin API v0 ADR with:
- Plugin manifest format
- Capability declarations
- API versioning
- Dependency constraints
- Trust tiers (core/first-party/third-party)
- Conformance tests per plugin capability

**This is v2+ work being proposed for v1.** The 2-template rule applies to APIs too: build the plugin system when two independent external consumers need it, not before.

What Phase 1-2 SHOULD have (and already does by design):
- Clean package interfaces (the monorepo structure)
- Component registry as a registry pattern (not hardcoded)
- Schema-driven inspector generation (not hand-coded forms)
- Adapter interface as a formal TypeScript interface (already specified)

These are good engineering practices, not plugin architecture. Calling them "plugins" adds conceptual overhead without adding capability.

---

## Summary of Agreements and Disagreements

| Review Point | My Position | Action |
|---|---|---|
| Collaboration deployment mismatch | **Agree** -- add Hocuspocus as recommended default | ADR during Phase 5 planning |
| Independent undo requires transaction-origin design | **Agree** -- PatchOps origin policy in Phase 1 | Add to Phase 1 deliverables |
| Split conformance: semantic vs visual | **Agree** | Define in Phase 1 conformance harness |
| Physics portability sinkhole | **Agree, and it's worse than stated** -- ammo.js vs Havok gap is growing | Add Rapier evaluation spike to Phase 1 |
| v1 scope width | **Partially agree** -- AI is core, VR is expansion | Move GA gate after Phase 9, VR as v1.1 |
| glTF extension allowlist | **Agree** | Add to Phase 1 deliverables |
| Extensibility deferred too late | **Partially disagree** -- monorepo IS the modularity; plugin API v0 is premature | Clean interfaces yes, Plugin API ADR no |
| Phase 0.5 for ADRs | **Disagree** -- GSD handles this naturally | No new phase; fold into existing planning |
| Conformance harness as Phase 1 deliverable | **Agree** | Already in adjusted plan |
| Adapter incremental update earlier | **Agree** -- but this is Phase 2, not Phase 1 | Note for Phase 2 planning |
| Plugin foundation sprint | **Disagree** -- premature for v1 | Defer to v2+ |
| Parallel workstream proposal | **Agree with the model, not the timing** | Activates Phase 2+, not Phase 1 |

---

## Open Questions for Convergence

Before locking the roadmap, these questions should be resolved:

1. **Rapier as canonical physics:** Should we commit to Rapier as the canonical physics simulation layer in the Canonical IR, with engine-native physics (ammo.js, Havok) available only via tuning? Or should we maintain the current approach of abstracting over engine-native physics? The evaluation spike will inform this, but the architectural direction should be agreed on upfront.

2. **AI Authoring as v1 core vs expansion:** Is IQL + MCP a launch requirement, or can it ship post-launch? My position: it's core. The review's position: it's expansion. This affects where the GA gate sits.

3. **Collaboration backend timing:** Should the collaboration backend ADR happen during Phase 1 planning (so the ECSON Yjs binding design is informed by the backend choice) or during Phase 5 planning (so the contracts stay backend-agnostic)? My position: Phase 5. The Yjs document model is the same regardless of backend.

4. **PlayCanvas version targeting:** Should we target PlayCanvas v2.16 (latest stable) or wait for a potential v2.17 with physics engine improvements? My position: target v2.16 now, upgrade when available. The adapter abstracts this anyway.

---

## Recommended Implementation Loop with GSD

For each phase, the implementation loop should be:

```
1. /gsd:discuss-phase    -- Surface assumptions, unknowns, acceptance criteria
2. /gsd:plan-phase       -- Create PLAN.md with test requirements per plan
3. /gsd:execute-phase    -- Wave-based execution with atomic commits
4. /gsd:verify-work      -- Conversational UAT against success criteria
5. /gsd:complete-milestone or continue to next phase
```

**Per-plan execution discipline:**
1. Write the contract (Zod schema or TypeScript interface) first.
2. Write the test (fast-check property test, Vitest unit test, or fixture assertion) second.
3. Implement the code third.
4. Update or create golden fixtures fourth.
5. Verify CI is green before marking plan complete.

**Golden fixtures are the immune system.** Every plan either produces a new fixture, updates an existing fixture, or adds tests against existing fixtures. There is never a plan that doesn't touch the fixtures or conformance package.

---

## Sources

### Verified via web research (2026-02-19)
- PlayCanvas Engine v2.16.0: [GitHub Releases](https://github.com/playcanvas/engine/releases), [Forum announcement](https://forum.playcanvas.com/t/engine-v2-16-0/41825)
- PlayCanvas physics (ammo.js only): [Physics Basics](https://developer.playcanvas.com/user-manual/physics/physics-basics/), [Alternatives doc](https://developer.playcanvas.com/user-manual/physics/ammo-alternatives/)
- Babylon.js 8.0 (Havok physics): [Windows Dev Blog](https://blogs.windows.com/windowsdeveloper/2025/03/27/announcing-babylon-js-8-0/), latest patch 8.51.2
- Rapier.js v0.19.3 (@dimforge/rapier3d): [npm](https://www.npmjs.com/package/@dimforge/rapier3d), [Dimforge 2025 Review](https://dimforge.com/blog/2026/01/09/the-year-2025-in-dimforge/)
- Hocuspocus v3.4.4: [GitHub](https://github.com/ueberdosis/hocuspocus), [npm](https://www.npmjs.com/package/@hocuspocus/server)
- PartyKit (Cloudflare): [y-partykit docs](https://docs.partykit.io/reference/y-partykit-api/), [Acquisition blog](https://blog.cloudflare.com/cloudflare-acquires-partykit/)
- Y-Sweet (Jamsocket): [Product page](https://jamsocket.com/y-sweet)
- fast-check v4.5.3: [npm](https://www.npmjs.com/package/fast-check), [GitHub](https://github.com/dubzzz/fast-check)
- Liveblocks Yjs: [Docs](https://liveblocks.io/docs/api-reference/liveblocks-yjs)

### From project documentation
- `.planning/ROADMAP.md` -- 11-phase roadmap with 69 requirements
- `.planning/ROADMAP_REVIEW.md` -- The review being responded to
- `.planning/PROJECT.md` -- Project charter and constraints
- `.planning/REQUIREMENTS.md` -- Full requirements traceability
- `.planning/research/SUMMARY.md` -- Research executive summary
- `.planning/research/ARCHITECTURE.md` -- System architecture and data flow
- `.planning/research/STACK.md` -- Technology rationale and comparison
- `.planning/research/PITFALLS.md` -- 7 critical pitfalls and prevention
- `.planning/research/FEATURES.md` -- Feature landscape and competitive analysis
- `CLAUDE.md` -- Project development guide

---
*Response written: 2026-02-19*
*Ready for convergence review*
