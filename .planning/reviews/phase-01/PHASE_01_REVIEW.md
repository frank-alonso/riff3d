# Phase 01 Review
Date: 2026-02-19  
Auditor: Codex (gpt-5.3-codex)

## Findings

| ID | Severity | Location | Issue | Impact | Required action |
|---|---|---|---|---|---|
| F-01 | S2 | `packages/conformance/__tests__/property-tests.test.ts` | Property tests use fixed seed (`42`) and `numRuns=100` only. | Good CI reproducibility, but limited stochastic coverage can miss rare inverse/replay edge cases. | Keep fixed-seed CI, add rotating-seed/nightly suite with higher runs (e.g., 1k+) and failure seed capture. |
| F-02 | S2 | `packages/conformance/src/round-trip.ts`, `packages/conformance/__tests__/round-trip.test.ts` | Round-trip compares a “portable subset” and explicitly strips fields. | Potential ungoverned drift in stripped fields (e.g., metadata/tuning) can ship unnoticed. | Add explicit lossiness contract tests listing expected dropped fields and asserting all other fields are preserved. |
| F-03 | S2 | `.github/workflows/ci.yml`, `packages/patchops/*`, `packages/ecson/*` | Evidence shows strong behavior tests, but no explicit enforcement artifact proving “no direct ECSON mutation bypass.” | Rule 1 is partially validated by convention/tests, not mechanically guarded. | Add static guardrails: lint rule or restricted exports/API boundary, plus one negative test/check for direct mutation attempts. |
| F-04 | S3 | `packages/ecson/src/registry/gltf-allowlist.ts`, `packages/ecson/__tests__/gltf-allowlist.test.ts` | Two allowlisted extensions have no fixture coverage yet. | Coverage gap in extension behavior may hide regressions when adapters consume these fields. | Add at least one fixture per uncovered extension or mark as explicitly unsupported until covered. |
| F-05 | S3 | `packages/patchops/src/engine.ts:518` | Unused eslint-disable directive remains. | Low risk; indicates hygiene drift in a core package. | Remove directive and enforce clean lint baseline. |

## Rubric Assessment

1. **Contract Integrity:** **CONCERN**  
   Versioning/migrations exist, but portable-subset comparison leaves some drift risk unguarded.

2. **Determinism and Safety:** **CONCERN**  
   Determinism evidence is good; hard enforcement against direct mutation bypass is not clearly demonstrated.

3. **Test Depth:** **CONCERN**  
   Strong breadth (337 tests, property tests, adversarial fixture), but randomized depth and extension fixture coverage are light.

4. **Conformance Quality:** **CONCERN**  
   Semantic conformance is strong; no visual-tolerance evidence in this packet.

5. **Performance Envelope:** **PASS**  
   Benchmarks and CI budgets are defined and passing for Phase 1 baseline establishment.

6. **Modularity Boundaries:** **PASS**  
   Package layering and pipeline tasks appear respected for scoped Phase 1 packages.

## Preliminary Decision (PASS | PASS_WITH_CONDITIONS | FAIL)

**PASS_WITH_CONDITIONS**

Conditions to close before unconditional pass:
1. Add mutation-bypass enforcement artifact (static/lint/API boundary).
2. Increase property-test stochastic depth (nightly/high-run varied seeds).
3. Add explicit lossiness contract tests for round-trip stripped fields.
4. Cover currently uncovered glTF allowlist extensions with fixtures/tests (or de-scope explicitly).