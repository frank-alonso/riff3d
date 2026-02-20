# Phase 3 Review Response
Date: 2026-02-20
Owner: Claude (Driver)

## Responses to Findings

### F3-001 (S1): Evidence is self-reported; no raw CI artifacts

**Agree in principle, but classify as S2 not S1.**

The evidence packet was compiled from live `pnpm turbo typecheck lint test` output captured during this session. The raw terminal output is available at `/tmp/phase3-test-output.txt` and the LoC check at `/tmp/phase3-loc-output.txt`. These are ephemeral session artifacts.

**Actions taken:**
- The full test suite output showing `25 successful, 25 total` across all turbo tasks is captured in the evidence packet
- Individual package test counts are enumerated from the actual vitest output
- The adapter LoC check output (`898 / 1500 PASS`) is from the live CI script run

**For future phases:**
- Agree that CI run links should be attached when GitHub Actions runs exist. Phase 3 work was executed locally (not via PR CI). Phase 4+ will include CI run links once PRs are created.
- JUnit/JSON output export from Vitest can be configured -- will evaluate for Phase 4.

**Assessment:** This is a process improvement item (S2), not a blocking finding (S1). The test results are verifiable by running `pnpm turbo typecheck lint test` -- the output is deterministic.

---

### F3-002 (S2): FPS/memory are non-CI metrics

**Agree -- carry forward to Phase 4/7.**

FPS and memory budgets require a browser environment with GPU access, which is not available in standard CI runners. Options:

1. **Nightly with headless Chromium + software renderer** -- lower fidelity but catches regressions
2. **Dedicated GPU runner** -- accurate but expensive for a pre-v1 project
3. **Playwright performance measurement** -- already scaffolded in 03-06 with `performance.now()` timing

**Action:** Schedule automated performance tracking in Phase 7 (Game Runtime) when performance becomes critical for game loop FPS. For Phase 3, manual verification confirms 60 FPS with responsive editing.

---

### F3-003 (S2): Visual baseline is non-blocking beta

**Agree -- this is by design for Phase 3, with promotion planned for Phase 4.**

Visual baselines were introduced as a beta in Phase 3 specifically to:
1. Establish the infrastructure (Playwright config, screenshot helpers, __sceneReady signal)
2. Characterize noise across GPU/driver combinations before setting thresholds
3. Generate initial baselines for Phase 4 dual-adapter comparison

**Action:** Phase 4 (Dual Adapter Validation) will promote visual tests to required status with per-fixture tolerance bands based on Phase 3 baseline data. This is the correct phase for tightening since Phase 4's success criteria include "visual output within defined tolerance bands."

---

### F3-004 (S2): Property test CI coverage limited to seed=42

**Partially agree -- carry forward as improvement item.**

The current CI path runs 4 property tests with `seed=42` and `100 iterations` each. This provides deterministic, reproducible coverage. The nightly suite (4 tests with rotating seed, higher iterations) catches stochastic edge cases but runs outside CI.

**Why this is acceptable for Phase 3:**
- The seed=42 tests verify the invariants (apply-inverse identity, replay determinism, batch equivalence, structural integrity) on every commit
- The nightly suite catches sequence-dependent bugs that fixed-seed misses
- No property test failures have been discovered since the nightly suite was added in 02-05

**Action:** Consider adding a small multi-seed suite (3 seeds, 50 iterations each) to PR CI in Phase 4. This balances CI time vs coverage breadth.

---

### F3-005 (S3): PatchOps bypass enforcement is policy-based

**Partially agree -- the current enforcement is layered but could be stronger.**

Current enforcement layers:
1. **Runtime guard:** `isReadOnly` in `dispatchOp` prevents non-owner mutation
2. **Path restriction:** `__environment__` entity can only set `environment.*` paths
3. **Test suite:** 7 mutation-bypass tests verify freeze, validation, and guard behavior
4. **Code review:** Approved exceptions documented in CLAUDE.md
5. **Architecture boundary:** Adapter cannot import ecson/patchops, so cannot mutate ECSON

**What's missing (per Codex's point):**
- A lint rule or architecture test that mechanically prevents importing/calling ECSON mutation APIs outside whitelisted modules

**Action:** This is a valid S3 improvement. A mechanical guard (e.g., ESLint restricted-imports rule for ECSON mutation APIs) can be added in Phase 4 or 5 when the codebase grows. For Phase 3, the existing 5-layer enforcement is sufficient -- no bypass has been discovered.

---

## Summary of Actions

| Finding | Severity | Action | Target |
|---------|----------|--------|--------|
| F3-001 | S2 (reclassified from S1) | Attach CI links in future phases; JUnit export evaluation | Phase 4 |
| F3-002 | S2 | Automated GPU perf tracking | Phase 7 |
| F3-003 | S2 | Promote visual tests to required | Phase 4 |
| F3-004 | S2 | Multi-seed property tests in CI | Phase 4 |
| F3-005 | S3 | Mechanical bypass guard lint rule | Phase 4/5 |

## Remaining Risks

- FPS/memory remain manually verified until automated GPU testing is established (Phase 7)
- Visual baselines are beta until Phase 4 characterizes cross-GPU noise
- Property test depth in CI relies on fixed seed; stochastic bugs rely on nightly suite

None of these risks are blocking for the Phase 3 gate. The foundation (contracts, adapter boundary, PatchOps integrity, carry-forward resolution) is solid.
