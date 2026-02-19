# Roadmap Review: Final Response

**Date:** 2026-02-19
**Responding to:** `.planning/ROADMAP_REVIEW_RESPONSE.md` (which responded to `.planning/ROADMAP_REVIEW.md`)
**Method:** Independent verification of all technical claims via web research (npm registries, official docs, release notes, community forums, pricing pages), cross-referenced against all `.planning/` docs, `.planning/research/` docs, `CLAUDE.md`, and prototype rebuild research.
**Goal:** Lock the roadmap with verified facts, clear recommendations, and no unvetted assumptions.

---

## Verification of Technical Claims

All major claims in the Review Response were independently verified. Results:

### Version Numbers

| Item | Claimed (Response) | Verified | Verdict |
|------|-------------------|----------|---------|
| PlayCanvas | v2.16.0 latest stable, no v2.17 | v2.16.1 is latest (Feb 4, 2026). No v2.17 exists. | **Confirmed.** Project docs say ~2.17 -- must correct to ~2.16. |
| Babylon.js | 8.0 major, patch 8.51.2 | babylonjs (UMD): 8.51.2. @babylonjs/core (ES6): 8.50.5. | **Confirmed.** Project docs say ~8.52 -- must correct to ~8.51. |
| Rapier.js | v0.19.3 | v0.19.3 confirmed for main packages. **Critical finding: deterministic variant at v0.18.2** (lags behind). | **Partially confirmed.** Version correct but deterministic build lag was not mentioned. |
| Hocuspocus | v3.4.4 | v3.4.4 confirmed (published late Jan 2026). MIT license. Actively maintained. | **Confirmed.** |
| fast-check | v4.5.3 | v4.5.3 confirmed. | **Confirmed.** |
| Zod | ^4.3 | v4.3.6 confirmed. v4.4.0 canary in progress. | **Confirmed.** |
| y-websocket | -- | v3.0.0 (Dec 2024). Server split into separate `y-websocket-server` package. | **New finding.** v3 is client-only; server is a separate package now. |

### Rapier.js Deep Dive

The Response advocates Rapier as a canonical physics layer. Research confirms the technical case is strong but reveals nuances:

**Confirmed strengths:**
- Fully standalone, zero rendering dependencies -- ideal for Riff3D's adapter architecture
- Complete feature set: rigid bodies, colliders (box/sphere/capsule/cylinder/convex/trimesh/heightfield), joints, character controllers (with slope handling and step climbing), raycasting, shape-casting, CCD, sensors/triggers
- WASM SIMD variant available (`@dimforge/rapier3d-simd`) for Chrome 91+, Firefox 89+, Edge 91+, Safari 16.4+
- Bundle size: ~500-600KB gzipped (smaller than ammo.js at ~900KB-1.3MB gzipped)
- Actively maintained (Dimforge's 2025 review confirms ongoing development; 2026 goals include GPU physics and robotics improvements)

**Critical caveat the Response missed:**
- The `@dimforge/rapier3d-deterministic` package is at **v0.18.2**, not v0.19.3. This is a full minor version behind.
- The deterministic build is less optimized (avoids platform-dependent float optimizations)
- Known issue (Feb 2025): certain methods like `collider.setRotationWrtParent` can break determinism
- Standard (non-deterministic) build IS locally deterministic (same machine, same build = same results)
- Cross-platform determinism (different browsers/OSes producing identical results) requires the deterministic variant

**Implication for Riff3D:** For the v1 use case (single-user or small-group editing with play-test), local determinism from the standard build is sufficient. Cross-platform determinism only matters for networked physics replay, which is a Phase 7+ concern. The evaluation spike can use the standard v0.19.3 build.

**PlayCanvas physics status confirmed:** ammo.js remains the only officially integrated physics engine. Community discussions (Sep 2024 forum thread) show desire for alternatives but no official timeline. ammo.js is aging with known bugs (memory leaks with mesh colliders, objects falling through colliders). This strengthens the case for Rapier as an independent physics layer above the adapters.

### Collaboration Backend Deep Dive

The Response recommends Hocuspocus as the default. Research confirms this is a sound recommendation with caveats:

| Option | Maturity | Self-Hostable | Auth | Persistence | Scaling | Key Gotcha |
|--------|----------|--------------|------|-------------|---------|------------|
| **Hocuspocus v3.4.4** | Production (v3) | Yes (MIT) | Hook-based | Extension-based (Postgres, SQLite, etc.) | Redis pub/sub (distributes connections, does NOT reduce CPU) | Multiplexed WebSocket is **incompatible** with standard y-websocket providers |
| **PartyKit/Cloudflare** | Pre-1.0 (v0.0.x) | Cloudflare only | Via party logic | Durable Object storage | Per-document Durable Objects (global edge) | Maintenance cadence slowing post-acquisition (last publish ~5-9 months ago) |
| **Y-Sweet v0.8.2** | Pre-1.0 | Yes (MIT, Rust) | Token model | S3-compatible (automatic) | Session backend (per-doc process) | Pre-1.0, self-hosting requires process orchestration |
| **y-websocket v3.0.0** | Reference impl | Yes | None | None | None (single process) | Yjs docs explicitly say "not for production" |
| **Liveblocks v3.13.0** | Production (v3) | No | Managed | Managed | Managed | MAU pricing can spike; vendor lock-in; not self-hostable |

**Vercel WebSocket status confirmed:** Still no native persistent WebSocket support. Rivet Actors (Oct 2025) provide a workaround via tunneling, but the most common pattern is deploying the WebSocket server on separate infrastructure (Railway, Fly.io, VPS, etc.).

**Additional finding the Response missed:** Hocuspocus v2+ uses multiplexed WebSockets (multiple documents over a single connection). This is a breaking change from v1 and means **you cannot mix Hocuspocus clients with standard y-websocket providers**. Choosing Hocuspocus is a commitment to its client library. Not a dealbreaker -- just needs to be a conscious decision.

**Recommendation stands:** Hocuspocus as the leading candidate for Phase 5, with the multiplexing caveat documented. The contract layer (PatchOps/ECSON/IR) is genuinely backend-agnostic, so this decision can safely wait.

---

## Assessment of Each Review Response Position

### Agreements (Review Response positions that hold up)

**1. No Phase 0.5** -- Correct. GSD's discuss-phase and research-phase workflows produce ADR-equivalent output during phase planning. A formal ADR phase adds bureaucratic overhead without value. The collaboration topology ADR belongs in Phase 5 planning. The determinism/conformance definition IS Phase 1 work. The physics portability strategy is informed by the Rapier spike in Phase 1.

**2. No Plugin API v0** -- Correct. The monorepo package structure (`@riff3d/ecson`, `@riff3d/patchops`, `@riff3d/canonical-ir`, etc.) IS the modularity. Clean interfaces in the component registry (registry pattern, not hardcoded) and schema-driven inspector forms (generated from Zod schemas, not hand-coded) are good engineering practices, not plugin architecture. The 2-template rule applies to APIs too -- build the plugin system when two independent external consumers need it.

**3. PatchOps origin policy in Phase 1** -- Correct. Origin categories (`user:{userId}`, `ai:{agentId}`, `system:migration`, `system:replay`) are a small addition that prevents the need to retrofit all mutation paths when collaboration arrives in Phase 5. Yjs `UndoManager` with `trackedOrigins` requires this classification.

**4. PatchOps format versioning** -- Correct, and a genuine miss by the original Review. The operation log stores PatchOps over time. Without a format version field, old ops become unreadable if the format changes. Version field on every op from day one.

**5. fast-check property tests as primary PatchOps test strategy** -- Correct. The four invariants (apply-inverse identity, replay determinism, batch equivalence, structural integrity) are exactly right. fast-check v4.5.3 is confirmed current and actively maintained. This should be a Phase 1 plan requirement, not optional.

**6. CI pipeline from Plan 01-01** -- Correct. GitHub Actions + Turborepo running `turbo test`, `turbo lint`, `turbo typecheck` from the first commit. Every subsequent plan adds tests to this pipeline.

**7. Adversarial golden fixture** -- Correct. The specific criteria (deep hierarchy, reparent chains, shared materials, cross-entity event wires, multi-component entities, dual tuning sections, interleaved op logs) are exactly what catches bugs that clean fixtures miss.

**8. Conformance harness as Phase 1 deliverable** -- Correct. Round-trip tests, replay determinism, and performance benchmark infrastructure belong in Phase 1, not deferred to Phase 4.

**9. glTF extension allowlist** -- Correct. Strict allowlist of supported extensions with fixture coverage per extension. Prevents surprises when users import GLBs with unsupported extensions.

**10. Performance budget specifics** -- The numbers are reasonable starting points. Phase 1 establishes the infrastructure; real adapter numbers come in Phase 2.

**11. Parallel workstream model for Phase 2+** -- Correct model, correct timing. Phase 1 is pure contracts with natural internal parallelism (ECSON and PatchOps can overlap). The 7-workstream model activates when contracts are frozen. GSD's wave-based execution handles intra-phase parallelism automatically.

**12. Collaboration backend decision timing** -- Correct. Phase 5 planning, not Phase 1. The Yjs document model is the same regardless of backend. The PatchOps/ECSON/IR contracts don't depend on which collaboration backend is chosen.

### Partial Agreements (positions that need refinement)

**1. Rapier as canonical physics layer** -- The technical case is strong and the architectural fit with Riff3D's adapter model is excellent. However, the Response overstates readiness by not mentioning the deterministic variant version lag (v0.18.2 vs v0.19.3).

**Refined position:** Include the Rapier evaluation spike in Phase 1. The spike should:
1. Implement "bouncing ball" and "character on platforms" using standard Rapier v0.19.3
2. Verify local determinism (replay on same machine produces identical results)
3. Measure WASM bundle size impact in the monorepo
4. Assess whether the v0.18.2 deterministic build has the features needed for canonical physics (if cross-platform determinism proves important)

Do NOT commit to Rapier as THE canonical physics layer before the spike results are in. The spike informs the decision; it doesn't pre-determine it.

**2. v1 Core GA after Phase 9 (AI Authoring)** -- The Response makes a compelling argument that IQL + MCP is Riff3D's strongest differentiator. Without it, Riff3D competes as "yet another web 3D editor" against Spline, PlayCanvas Editor, etc. With it, Riff3D is the only platform where AI can safely author 3D scenes through a verified pipeline.

**Refined position:** Phase 8 completion = shippable product. Phase 9 (AI) is pursued immediately after and included in v1 launch if it's ready. IQL is architecturally clean (compiles to PatchOps, never touches ECSON directly) and should layer on quickly given a solid foundation. But don't delay a solid Phase 8 product waiting for Phase 9 if it's not ready. Phase 10 (VR) is clearly v1.1 expansion -- the Response is right there.

### Disagreements (positions that need correction)

None. After independent verification, no position in the Review Response is factually wrong. The refinements above are nuance additions, not corrections.

---

## Concrete Changes to Apply

### Version Corrections (all docs)

| Document | Change |
|----------|--------|
| CLAUDE.md | PlayCanvas ~2.17 -> ~2.16, Babylon.js ~8.52 -> ~8.51 |
| .planning/research/SUMMARY.md | PlayCanvas ~2.17 -> ~2.16, Babylon.js ~8.52 -> ~8.51 |
| MEMORY.md | PlayCanvas ~2.17 -> ~2.16, Babylon.js ~8.52 -> ~8.51 |

### Phase 1 Enrichment

Add to Phase 1 deliverables (in ROADMAP.md success criteria and plan descriptions):
1. Conformance harness MVP (round-trip tests, replay determinism, performance benchmarks)
2. PatchOps origin policy (`user:{userId}`, `ai:{agentId}`, `system:migration`, `system:replay`)
3. PatchOps format versioning (version field on every op, migration strategy documented)
4. fast-check property tests for all PatchOps invariants
5. CI pipeline from Plan 01-01 (GitHub Actions + Turborepo)
6. Adversarial golden fixture (deep hierarchy, reparent chains, shared materials, etc.)
7. glTF extension allowlist v0
8. Rapier evaluation spike (lightweight, not a commitment)

### Phase 1 Plan Description Updates

```
01-01: Monorepo scaffold, CI pipeline, and package structure
01-02: ECSON schema, Zod validators, versioning, and migration infrastructure
01-03: PatchOps spec, engine, inverse generation, origin policy, and format versioning
01-04: Canonical IR spec, compiler, and portable subset v0
01-05: Component registry (15+ types) with typed schemas, editor hints, and glTF extension allowlist
01-06: Golden fixtures (5 clean + 1 adversarial), conformance harness, fast-check property tests, and Rapier evaluation spike
```

### Phase 10 Label

Mark Phase 10 (VR & Asymmetric Play) as "v1.1 Expansion" in the roadmap.

### GA Gate Flexibility

Add a note after Phase 8 indicating it is the natural "shippable" checkpoint. Phase 9 (AI) is a strong candidate for v1 inclusion but does not hard-gate launch.

### Collaboration Backend Note

Add Hocuspocus as recommended default for Phase 5 planning, with the multiplexing compatibility caveat documented.

---

## Open Questions Resolved

From the Review Response's "Open Questions for Convergence":

**1. Rapier as canonical physics:** Evaluate first, commit second. Spike in Phase 1; decision after spike results.

**2. AI Authoring as v1 core vs expansion:** Pragmatic flexibility. Phase 8 = shippable. Phase 9 included if ready. Not a hard gate.

**3. Collaboration backend timing:** Phase 5 planning. The Yjs document model is backend-agnostic. Hocuspocus is the leading candidate.

**4. PlayCanvas version targeting:** Target v2.16 now. Upgrade when v2.17 is available. The adapter abstracts this.

---

## GSD Execution Discipline (Adopted)

For Phase 1 and all subsequent phases:

1. Write contract (Zod schema / TypeScript interface) first
2. Write test (fast-check property test / Vitest unit test / fixture assertion) second
3. Implement code third
4. Update or create golden fixtures fourth
5. Verify CI green before marking plan complete

Every plan either produces a new fixture, updates an existing one, or adds tests against existing ones. No plan completes without touching the fixtures or conformance package. Golden fixtures are the immune system.

---

## Sources

### Verified via independent web research (2026-02-19)

**Engine versions:**
- PlayCanvas v2.16.1: [npm](https://www.npmjs.com/package/playcanvas), [GitHub Releases](https://github.com/playcanvas/engine/releases), [Forum: v2.16.0](https://forum.playcanvas.com/t/engine-v2-16-0/41825)
- PlayCanvas physics (ammo.js only): [Alternatives doc](https://developer.playcanvas.com/user-manual/physics/ammo-alternatives/), [Forum: Changing default physics](https://forum.playcanvas.com/t/changing-default-physics-engine/37806)
- Babylon.js 8.0: [babylonjs npm 8.51.2](https://www.npmjs.com/package/babylonjs), [@babylonjs/core npm 8.50.5](https://www.npmjs.com/package/@babylonjs/core), [8.0 announcement](https://babylonjs.medium.com/introducing-babylon-js-8-0-77644b31e2f9), [WGSL docs](https://doc.babylonjs.com/setup/support/webGPU/webGPUWGSL/)

**Physics:**
- Rapier.js v0.19.3: [npm](https://www.npmjs.com/package/@dimforge/rapier3d), [Deterministic v0.18.2](https://www.npmjs.com/package/@dimforge/rapier3d-deterministic), [Determinism docs](https://rapier.rs/docs/user_guides/javascript/determinism/), [Character controller](https://rapier.rs/docs/user_guides/javascript/character_controller_setup/), [Scene queries](https://rapier.rs/docs/user_guides/javascript/scene_queries/), [Dimforge 2025 review](https://dimforge.com/blog/2025/01/09/the-year-2025-in-dimforge/), [GitHub issue #797](https://github.com/dimforge/rapier/issues/797)

**Collaboration:**
- Hocuspocus v3.4.4: [npm](https://www.npmjs.com/package/@hocuspocus/server), [GitHub](https://github.com/ueberdosis/hocuspocus), [Overview](https://tiptap.dev/docs/hocuspocus/getting-started/overview), [Scalability](https://tiptap.dev/docs/hocuspocus/guides/scalability), [Redis extension](https://tiptap.dev/docs/hocuspocus/server/extensions/redis)
- PartyKit/Cloudflare: [Acquisition blog](https://blog.cloudflare.com/cloudflare-acquires-partykit/), [y-partykit npm v0.0.33](https://www.npmjs.com/package/y-partykit), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- Y-Sweet v0.8.2: [Product page](https://jamsocket.com/y-sweet), [GitHub](https://github.com/jamsocket/y-sweet), [npm](https://www.npmjs.com/package/@y-sweet/sdk)
- y-websocket v3.0.0: [npm](https://www.npmjs.com/package/y-websocket), [GitHub releases](https://github.com/yjs/y-websocket/releases), [y-websocket-server](https://github.com/yjs/y-websocket-server)
- Liveblocks Yjs v3.13.0: [npm](https://www.npmjs.com/package/@liveblocks/yjs), [Pricing](https://liveblocks.io/pricing)
- Vercel WebSocket status: [KB article](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections), [Rivet on Vercel](https://www.rivet.dev/blog/2025-10-20-how-we-built-websocket-servers-for-vercel-functions/)

**Libraries:**
- fast-check v4.5.3: [npm](https://www.npmjs.com/package/fast-check)
- Zod v4.3.6: [npm](https://www.npmjs.com/package/zod), [v4 release notes](https://zod.dev/v4)

### From project documentation
- `.planning/ROADMAP.md` -- 11-phase roadmap with 69 requirements
- `.planning/ROADMAP_REVIEW.md` -- Original review
- `.planning/ROADMAP_REVIEW_RESPONSE.md` -- Response being evaluated
- `.planning/PROJECT.md` -- Project charter and constraints
- `.planning/REQUIREMENTS.md` -- Full requirements traceability
- `.planning/research/SUMMARY.md` -- Research executive summary
- `.planning/research/ARCHITECTURE.md` -- System architecture and data flow
- `.planning/research/PITFALLS.md` -- 7 critical pitfalls and prevention
- `CLAUDE.md` -- Project development guide

---
*Final review response written: 2026-02-19*
*Roadmap changes ready to apply*
