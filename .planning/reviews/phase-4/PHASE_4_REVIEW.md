# Phase 4 Review
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)

## Findings

| ID | Severity | Location | Issue | Impact | Required action |
|---|---|---|---|---|---|
| F4-001 | S1 | Evidence: **Contract Diffs → ECSON** (`metadata.preferredEngine` via direct mutation), carry-forward CF-P3-04 | Core rule says all mutations must flow through PatchOps, but Phase 4 uses direct ECSON mutation for engine preference as an “exception pattern” without formalized guardrails. | Mutation-path inconsistency weakens determinism/undo guarantees and makes future bypasses easier. | Define and document a strict exception contract (allowed cases, API, audit logging), then enforce via lint/architecture checks; otherwise move engine preference persistence into PatchOps. |
| F4-002 | S2 | `packages/canonical-ir/tsconfig.json`; canonical-ir `EngineAdapter` export | Canonical IR package now requires `"DOM"` lib due to `HTMLCanvasElement` in shared adapter contract. This increases browser coupling in a core package. | Erodes package seam clarity (`canonical-ir` becoming environment-aware), raising long-term portability risk. | Refactor `EngineAdapter` canvas parameter to platform-agnostic type (`unknown`/generic) in `canonical-ir`; keep DOM types in adapter packages. |
| F4-003 | S2 | Carry-forward CF-P3-04 (no mechanical mutation-boundary enforcement) | Enforcement remains policy-only (`dispatchOp()` convention) rather than mechanically enforced. | Safety depends on developer discipline; direct mutation regressions can slip in silently. | Add mechanical enforcement in Phase 5 (e.g., `no-restricted-imports`, forbidden ECSON mutation APIs outside boundary modules, CI architectural rule checks). |
| F4-004 | S2 | CI evidence section (CF-P3-01 partial) | CI run URLs/artifacts were not attached; validation is local-only. | Independent reproducibility is reduced for gate confidence. | Attach GitHub Actions run links/artifacts (tests, typecheck, conformance, visual) before final acceptance or explicitly waive with approver sign-off. |
| F4-005 | S3 | `apps/editor/e2e/fixtures/tolerance-bands.ts`; visual regression policy note | Cross-engine visual comparison is advisory-only; required CI is per-engine baseline only. | Semantic parity risk across engines may accumulate undetected. | Keep advisory mode if intentional, but add trend thresholds/reporting to detect cross-engine drift over time. |

## Rubric Assessment

| Category | Score | Notes |
|---|---|---|
| 1. Contract Integrity | CONCERN | Mostly non-breaking additions, but mutation exception and DOM coupling in canonical-ir need tightening. |
| 2. Determinism and Safety | CONCERN | Delta pipeline and tests are good; mutation-boundary bypass and lack of mechanical enforcement are material risks. |
| 3. Test Depth | CONCERN | Strong test volume and seed coverage; still limited adversarial depth for boundary enforcement and contract misuse cases. |
| 4. Conformance Quality | PASS | Dual-adapter fixture conformance and tolerance-banded visual checks are implemented and passing. |
| 5. Performance Envelope | PASS | Adapter LoC budgets and runtime targets are reported as met; CI artifact gap noted separately. |
| 6. Modularity Boundaries | CONCERN | Package seam mostly respected, but canonical-ir DOM dependency is a boundary smell. |

## Preliminary Decision (PASS | PASS_WITH_CONDITIONS | FAIL)

**PASS_WITH_CONDITIONS**

Conditions to close:
1. Resolve/codify mutation exception path with mechanical enforcement plan committed.  
2. Remove or justify canonical-ir DOM dependency with approved architecture note.  
3. Attach CI run URLs/artifacts for independent verification (or formal waiver).