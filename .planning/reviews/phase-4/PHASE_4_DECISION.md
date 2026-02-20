# Phase 4 Decision

**Date:** 2026-02-20
**Decision:** PASS_WITH_CONDITIONS
**Approvers:** Codex (gpt-5.3-codex, Auditor), Claude (Driver)

## Gate Result

Phase 4: Dual Adapter Validation passes with conditions.

- **S0 Blockers:** 0
- **S1 Findings:** 1 (F4-001, waived with owner/date/mitigation)
- **S2 Findings:** 3 (F4-002 resolved, F4-003 and F4-004 conditioned)
- **S3 Findings:** 1 (F4-005 resolved)

## Conditions

1. **Phase 5: Mechanical mutation-boundary enforcement (F4-001 + F4-003)**
   - Implement `no-restricted-imports` ESLint rule preventing direct ECSON mutation outside boundary modules
   - Add negative tests verifying enforcement
   - Align CLAUDE.md exception contract text with actual allowed bypass points (add engine preference setter to the approved exception list)
   - Owner: Claude | Due: Phase 5 delivery

2. **Phase 5: CI URL attachment (F4-004)**
   - Attach GitHub Actions run URLs/artifacts to evidence packets
   - Or provide formal approver waiver record
   - Owner: Claude | Due: Phase 5 delivery

## Waivers

| Finding | Severity | Waiver | Owner | Date | Mitigation |
|---------|----------|--------|-------|------|------------|
| F4-001 | S1 | Accepted | Claude | 2026-02-20 | Phase 5 mechanical enforcement + exception doc alignment |

## Carry-Forward Actions

| ID | Description | Target Phase | Owner |
|----|-------------|-------------|-------|
| CF-P4-01 | Mechanical mutation-boundary enforcement (no-restricted-imports + negative tests) | Phase 5 | Claude |
| CF-P4-02 | Align CLAUDE.md exception contract with actual bypass points (add engine preference) | Phase 5 | Claude |
| CF-P4-03 | Attach CI run URLs/artifacts to evidence packets | Phase 5 | Claude |
| CF-P4-04 | Cross-engine drift trend monitoring (when performance dashboard built) | Phase 7 | Claude |
| CF-P4-05 | Camera position/rotation not synced when swapping engines (default orientations differ) | Phase 5 | Claude |
| CF-P4-06 | Babylon-first load sometimes fails to render PlayCanvas on switch (race condition) | Phase 5 | Claude |
| CF-P4-07 | Browser resize sometimes causes scene to stop rendering (needs robust resize observer) | Phase 5 | Claude |

## Post-Gate Fix Attempts

After the gate decision, three fix commits were made to address CF-P4-05/06/07:
- `b8ee396` fix(04): add camera controls, selection, and camera state transfer for Babylon adapter
- `338b7a2` fix(04): align Babylon camera controls with PlayCanvas behavior
- `9b632b9` fix(04): rewrite Babylon camera to UniversalCamera fly mode + fix engine load race

These partially improved the issues but did not fully resolve them. The remaining work is carried forward to Phase 5 for proper planning and execution.

---
*Decision recorded: 2026-02-20*
*Decision amended: 2026-02-20 (added CF-P4-05/06/07 post-gate carry-forwards)*
*Gate: PASS_WITH_CONDITIONS*
