# Roadmap Final Review: Riff3D

**Date:** 2026-02-19  
**Inputs reviewed:** `.planning/ROADMAP.md`, `.planning/ROADMAP_REVIEW.md`, `.planning/ROADMAP_REVIEW_RESPONSE.md`

## Executive Summary

The roadmap is strong and executable. The key refinement is to treat modularity as an **internal capability-pack architecture** in v1 (not a public plugin marketplace), so advanced systems like IK, character stack, and alternate editor surfaces can be developed in parallel without destabilizing the core contracts.

You do not need to shrink v1 scope if you keep strict contract boundaries and stronger anti-drift testing gates.

## Converged Positions

1. Keep contract-first execution (PatchOps -> ECSON -> Canonical IR -> adapters) as the non-negotiable spine.
2. Keep conformance split into semantic + visual tolerance; do not require pixel-identical cross-engine output.
3. Add conformance harness MVP and adversarial fixture work explicitly to Phase 1.
4. Keep collaboration backend decision as an ADR during collaboration planning (not a separate roadmap phase).
5. Keep marketplace out of v1 scope.
6. Treat VR as optional expansion track if schedule pressure appears.
7. Keep AI authoring as core product identity unless explicitly deprioritized by product strategy.

## Modularity Strategy (What To Add)

## Principle

Build **internal plugin seams** now, public plugin ecosystem later.

This gives you:
- Parallel feature work (IK, character, runtime behaviors, editor modes).
- Safer iteration (capabilities isolated behind interfaces).
- Swap-ready UX layers (simple editor vs advanced editor).

## Capability-Pack Model

Define each major subsystem as a versioned package with a manifest and strict interface:

- `@riff3d/cap-ik`
- `@riff3d/cap-character`
- `@riff3d/cap-runtime-behaviors`
- `@riff3d/cap-template-party`
- `@riff3d/ui-surface-simple`
- `@riff3d/ui-surface-pro`

Each capability pack exposes:
- `manifest` (name, version, required contracts, feature flags)
- `register()` hooks (components, verbs, inspectors, runtime handlers)
- `conformance tests` (must pass to be enabled)

Each pack is forbidden from direct state mutation and must emit PatchOps or validated payloads.

## Stable Extension Seams To Create Early

1. Component registry provider seam.
2. Inspector field renderer seam (schema-driven).
3. Verb/command registry seam.
4. Runtime behavior handler seam.
5. Import/export codec seam.
6. Editor surface seam (basic/pro modes over same command bus).

## Editor Surface Swappability

Implement one shared `CommandBus + SelectionState + PatchOps Dispatcher` core, then mount UI surfaces on top:

- `Simple surface`: opinionated workflows, minimal controls.
- `Pro surface`: full hierarchy, inspector depth, advanced tooling.

Both surfaces call the same commands and produce the same operation logs.  
This preserves portability and avoids UI-specific state divergence.

## Parallel Execution Design

Use contracts as synchronization boundaries and run feature teams in parallel after Phase 1 contract freeze.

## Suggested workstreams

1. Contracts and invariants.
2. Fixtures and conformance harness.
3. Adapter-PlayCanvas.
4. Adapter-Babylon.
5. Editor core + command bus.
6. Capability packs (IK, character, behaviors).
7. Collaboration backbone.

## Guardrails

1. No pack may depend on adapter internals.
2. No adapter-specific field enters portable schema without dual-adapter evidence.
3. Every pack change must include fixture delta + conformance result.
4. Capability pack versions are pinned per app release.

## GSD Loop Hardening (Beyond Golden Fixtures)

Golden fixtures are necessary but not sufficient. Add these to prevent drift:

## 1) Property-based invariant suite (required)

Run fast-check on every PatchOps-affecting change:
- Apply/inverse identity.
- Replay determinism.
- Batch equivalence.
- Structural integrity (no cycles/orphans/dangling refs).

## 2) Differential adapter testing

For the same Canonical IR input:
- Compare semantic outputs (entity/component/property graph) exactly.
- Compare visual outputs by tolerance thresholds.

## 3) Adversarial corpus + regression lock

Keep a dedicated adversarial fixture set:
- Deep hierarchies.
- Reparent storms.
- Interleaved create/delete/reparent/property edits.
- Shared asset/material fanout.
- Mixed tuning blocks.

Run this corpus in CI and nightly.

## 4) Contract drift checks

Add CI checks that fail on ungoverned contract change:
- ECSON schema diff check.
- Canonical IR schema diff check.
- PatchOps payload/version compatibility check.

Require migration notes for breaking changes.

## 5) Replay archive tests

Persist real operation logs from development sessions (sanitized) and replay them nightly against latest code.  
This catches drift that synthetic tests miss.

## 6) Performance regression gates

Benchmark every PR against baseline envelopes:
- Op apply latency.
- Replay throughput.
- ECSON validate/serialize.
- IR compile.
- Adapter incremental update latency.

Fail or warn by threshold policy.

## 7) Mutation testing on critical invariants

Run mutation tests on PatchOps/invariants module periodically to ensure tests are actually capable of catching faults.

## 8) “Definition of Done” upgrade for every plan

A plan is complete only if:
1. Contract updated (if needed).
2. Tests added/updated (unit + invariant/property where relevant).
3. Fixture added/updated.
4. Conformance checks pass.
5. Performance budget unchanged or approved.
6. Migration notes recorded (if contract touched).
7. CI green end-to-end.

## Recommended Roadmap Adjustments

1. Add Phase 1 explicit deliverables:
- Conformance harness MVP.
- PatchOps origin policy.
- PatchOps format versioning.
- Adversarial fixture set.
- Property-based invariant test suite.
- CI from day one.

2. Add a “Capability Pack Foundation” objective to Phases 1-2:
- Internal modular seams only.
- No public marketplace/plugin runtime yet.

3. Add “Editor Surface Swappability” to Phase 2 success criteria:
- Same commands and op logs across simple/pro surfaces.

4. Add “Capability Pack Conformance” to Phase 6 review gate:
- Every enabled pack passes contract + fixture conformance.

## Concrete Requirement Additions (Suggested)

- `MOD-01`: Capability-pack manifest and registration interfaces.
- `MOD-02`: Component/verb/inspector extension seams with PatchOps-only mutation policy.
- `MOD-03`: Dual editor surfaces (simple/pro) over shared command bus.
- `MOD-04`: Capability pack version pinning and compatibility checks.
- `TEST-06`: Property-based PatchOps invariant suite.
- `TEST-07`: Contract drift CI checks (schema/op compatibility).
- `TEST-08`: Replay archive nightly regression suite.
- `TEST-09`: Capability-pack conformance tests.

## Immediate Next Actions

1. Update `ROADMAP.md` and `REQUIREMENTS.md` with `MOD-*` and `TEST-06..09`.
2. Create `CAPABILITY_PACKS.md` with registration interfaces and boundaries.
3. Add CI jobs for invariant, drift, replay, and benchmark gates.
4. Define the first adversarial fixture and expected semantic assertions.
5. Decide AI/VR launch posture explicitly (AI-in-v1 yes/no, VR-in-v1 yes/no) so planning gates are unambiguous.

---

This final review keeps your ambitious scope while making parallel development safer and making drift/stability failures harder to slip through.
