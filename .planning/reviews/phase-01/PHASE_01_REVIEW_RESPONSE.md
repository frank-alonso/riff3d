# Phase 01 Review Response

Date: 2026-02-19
Owner: Claude (Driver)

## Responses to Findings

### F-01 (S2): Property test stochastic depth

- **Agree/Disagree:** Agree -- fixed seed with 100 runs is deliberately conservative for Phase 1 CI stability
- **Action taken:** Scheduled as a carry-forward action. A nightly/local test configuration with rotating seeds and 1000+ runs will be added in Phase 2 (when CI pipeline is expanded for editor integration tests). The current fixed-seed approach intentionally prioritizes CI reproducibility in early phases. Failure seed capture is a good addition.
- **Evidence:** Decision documented in 01-06-SUMMARY.md: "Fixed seed property tests: seed=42 with 100 numRuns ensures CI reproducibility. Random seeds can be used locally for discovery."
- **Resolution timeline:** Phase 2 CI expansion (02-01 or 02-08 review)

### F-02 (S2): Lossiness contract tests for round-trip stripped fields

- **Agree/Disagree:** Agree -- this is a legitimate gap. While the portable subset boundary is well-documented (01-04-SUMMARY.md), there is no explicit test asserting exactly which fields are stripped and which must be preserved.
- **Action taken:** Scheduled as a carry-forward action for Phase 2. A lossiness contract test will enumerate: { tags, locked, metadata, componentTuning } as expected-stripped, and assert that all other ECSON fields survive round-trip.
- **Evidence:** The portable subset is formally defined in `packages/canonical-ir/src/portable-subset.ts`. The stripping behavior is in `packages/conformance/src/round-trip.ts`.
- **Resolution timeline:** Phase 2 or Phase 3 review gate

### F-03 (S2): Mutation-bypass enforcement

- **Agree/Disagree:** Partially agree -- the architecture rule "all mutations through PatchOps" is enforced by convention and test coverage, not by static analysis. However, in Phase 1 there is no runtime context where direct mutation bypass is possible (there is no editor UI, no adapter, no runtime). The packages only expose `applyOp`/`applyOps` as the mutation API. Direct mutation of a SceneDocument is possible in test code by design (tests need to set up state).
- **Action taken:** Scheduled as a carry-forward action for Phase 2. When the editor shell is built (02-01), we will add:
  1. A lint rule or restricted export preventing direct entity record mutation from editor code
  2. A negative integration test verifying that the PatchOps audit trail captures all mutations
- **Evidence:** The current API surface (`@riff3d/patchops` exports `applyOp`, `applyOps`) is already the only documented way to mutate an ECSON document. The ECSON package does not export mutation utilities.
- **Resolution timeline:** Phase 2 (editor shell has actual mutation paths to guard)

### F-04 (S3): Uncovered glTF extensions

- **Agree/Disagree:** Agree -- `KHR_texture_transform` and `KHR_physics_rigid_bodies` have no fixture coverage
- **Action taken:** Both extensions are marked as non-portable in the allowlist v0. They are explicitly not in the portable subset and have no adapter support yet. Per the plan, fixture coverage for non-portable extensions is deferred until the extensions are promoted to portable status (which requires the 2-template rule: 2+ independent templates must need the capability).
- **Evidence:** `packages/ecson/src/registry/gltf-allowlist.ts` marks both as `portable: false` with `fixturesCovering: []`.
- **Resolution timeline:** Phase 7 (physics) for KHR_physics_rigid_bodies, Phase 4 or later for KHR_texture_transform

### F-05 (S3): Unused eslint-disable directive

- **Agree/Disagree:** Agree -- this is a minor hygiene issue
- **Action taken:** Will be removed as part of the next code change to `packages/patchops/src/engine.ts`. Not worth a standalone commit for a single lint warning.
- **Resolution timeline:** Next patchops modification (Phase 2)

## Remaining Risks

1. **IR Convention Documentation** -- Right-handed Y-up, quaternion ordering, physics units, normal map convention, and 1:N entity-node mapping are not formally documented in code comments (identified in evidence packet). Carry-forward to Phase 2/3 review gate.
2. **No visual conformance** -- Phase 1 has no rendering, so visual conformance tests are N/A. These begin in Phase 2 with the PlayCanvas adapter.

## Summary of Carry-Forward Actions

| ID | Finding | Target Phase | Severity |
|----|---------|-------------|----------|
| CF-01 | Nightly property tests with rotating seeds | Phase 2 | S2 |
| CF-02 | Lossiness contract tests for stripped fields | Phase 2 | S2 |
| CF-03 | Mutation-bypass enforcement (lint rule + negative test) | Phase 2 | S2 |
| CF-04 | Non-portable glTF extension fixture coverage | Phase 4/7 | S3 |
| CF-05 | Remove unused eslint-disable directive | Phase 2 | S3 |
| CF-06 | IR convention documentation in source code | Phase 2/3 | S3 |
