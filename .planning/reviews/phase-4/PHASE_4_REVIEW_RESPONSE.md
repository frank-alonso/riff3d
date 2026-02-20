# Phase 4 Review Response

**Date:** 2026-02-20
**Owner:** Claude (Driver)

## Review Value Assessment

Score: MEDIUM
Actionable: 3 of 5 findings led to documented carry-forward actions or architecture notes
Notes: The review correctly identified the recurring mutation-boundary enforcement gap (CF-P3-04) and the DOM coupling concern. These are genuine risks that need resolution. The CI URL gap is environmental rather than architectural.

## Responses to Findings

### F4-001 (S1) — Mutation exception path lacks formalized guardrails

**Agree — condition accepted with mitigation plan.**

The direct mutation for `metadata.preferredEngine` follows the same pattern approved in Phase 2 for `loadProject()` and playtest `stop()` (Approved Exception #1 in CLAUDE.md). However, the auditor is correct that each new exception case weakens the rule if guardrails are not formalized.

**Action taken:**
- The exception is already documented in CLAUDE.md (Approved Architectural Exception #1), which explicitly lists the allowed cases and their rationale.
- Engine preference persistence was added as a system-level mutation matching this exception pattern (not a user edit, undo stack not applicable).

**Phase 5 commitment:**
- Add mechanical enforcement via `no-restricted-imports` ESLint rule that prevents direct ECSON document mutation outside the approved boundary modules (`dispatchOp`, `loadProject`, playtest `stop`, engine preference setter).
- Add negative tests that verify direct mutation attempts are caught.
- This resolves both F4-001 and CF-P3-04 together.

**Waiver request:** Accept as PASS_WITH_CONDITIONS with the Phase 5 mechanical enforcement commitment. The existing documentation + centralized `dispatchOp()` entry point provides adequate protection for the scope of Phase 4.

### F4-002 (S2) — canonical-ir DOM dependency

**Agree — accepted with architecture note.**

The `EngineAdapter` interface in canonical-ir references `HTMLCanvasElement` for its `initialize(canvas)` parameter. This was flagged in the pre-execution review (S0 finding #2) and the response proposed using `unknown` to keep canonical-ir DOM-free.

**What actually happened:** During 04-01 execution, the DOM lib was added to canonical-ir's tsconfig because `HTMLCanvasElement` provides type safety at the interface boundary (adapters receive a properly-typed canvas, not `unknown`). The decision was documented in the 04-01 SUMMARY.

**Architecture justification:** canonical-ir's purpose is to define the contract between the compilation layer and engine adapters. Engine adapters are inherently browser-bound (they render to a canvas element). The `EngineAdapter` interface is consumed exclusively by adapter packages and the editor viewport, both of which require DOM. Adding DOM to canonical-ir's tsconfig does not change its runtime behavior or bundle — it only affects type resolution.

**Phase 5 action:** If this becomes a problem for non-browser consumers of canonical-ir (e.g., a Node.js server compiling IR), extract `EngineAdapter` to a separate `@riff3d/adapter-types` package. For now, no non-browser consumer exists.

### F4-003 (S2) — Mechanical mutation-boundary enforcement deferred

**Agree — addressed together with F4-001.**

This is the same carry-forward item CF-P3-04 from Phase 3. The Phase 5 commitment includes:
1. `no-restricted-imports` ESLint rule blocking direct ECSON mutation outside boundary modules
2. Negative tests verifying the enforcement
3. CI check ensuring the rule is not disabled

### F4-004 (S2) — CI run URLs not attached

**Agree — environmental limitation, not architectural gap.**

The `gh` CLI is not available in this execution environment (WSL2 without GitHub CLI installed). All test evidence was verified locally using the identical commands that CI runs (`pnpm turbo run test lint typecheck`).

**Waiver request:** Accept with waiver. The test output is provided verbatim in the evidence packet. CI URLs will be attached when the `gh` CLI becomes available or when the human verifier confirms CI status during the Task 2 checkpoint. Carry CF-P3-01 to Phase 5.

### F4-005 (S3) — Cross-engine visual comparison advisory-only

**Agree in spirit, no action needed now.**

Cross-engine visual comparison is intentionally advisory because engines render differently by design (different AA algorithms, different tone mapping, different shadow implementations). Requiring pixel-level cross-engine parity would create false failures.

The per-engine baselines provide the real CI value: each engine should produce consistent output across code changes. Cross-engine comparison is useful for development-time validation but should not block CI.

**Phase 7 action:** When FPS/memory automated tracking is added (CF-P3-05), include cross-engine drift trending as part of the monitoring dashboard. This addresses the auditor's concern about undetected drift accumulation.

## Remaining Risks

1. **Mutation-boundary enforcement** — Mitigated by Phase 5 commitment (ESLint rule + negative tests)
2. **DOM coupling in canonical-ir** — Acceptable for current scope; monitor for Phase 5+ if non-browser consumers emerge
3. **CI URL gap** — Environmental; test evidence provided locally

---
*Response by: Claude (Driver)*
*Date: 2026-02-20*
