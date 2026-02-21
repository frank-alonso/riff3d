# Phase 6: Review Gate: Core Platform - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate that collaboration (Phase 5), dual adapters (Phase 4), and the editor form a stable platform before adding the game layer. This is an expanded-scope review gate covering cross-phase integration across Phases 4-5, cumulative debt from all prior PASS_WITH_CONDITIONS decisions, architecture drift, and carry-forward reconciliation. Fixes discovered during the review are implemented within Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Stress Test Scenarios
- Test with 4 concurrent users editing the same scene simultaneously
- Target 200 entities in the stress test scene (above the 100-entity SC3 target, to build confidence)
- Simulate adverse network conditions: inject latency and disconnection to verify collab reconnection and conflict resolution
- Cross-engine collaboration must work: user A on PlayCanvas, user B on Babylon.js, editing the same scene via Yjs/ECSON layer

### Carry-Forward Triage
- All 3 Phase 6 carry-forwards must be resolved before the gate passes:
  - CF-P5-02: Avatar yaw initialization (bug fix)
  - CF-P5-04: Collab-doc shape versioning/migration metadata (enhancement)
  - CF-P5-05: Server-side unit tests for collab persistence decode/re-encode (test coverage)
- Carry-forward fixes are implemented inside Phase 6 (within the review plan), not as a separate pre-phase step
- Phase 7+ carry-forwards left as-is — no re-audit of their scheduling
- Prior PASS_WITH_CONDITIONS debt: only audit unresolved items, trust that resolved items are done

### Review Scope Priorities
- All areas are equal priority — collab reliability, adapter conformance, editor performance, and debt cleanup are weighted equally
- Include a full golden path end-to-end walkthrough: sign up, create project, edit, collaborate, switch engines, play-test, save
- Codex independent reviewer must deep-audit the collaboration server code (Hocuspocus, Y.Doc sync bridge, auth, persistence, sync logic, failure modes)
- Explicitly verify architecture still matches original contract definitions (ECSON, PatchOps, IR) — do not assume prior gates caught all drift; collab and dual adapters may have introduced subtle drift

### Pass/Fail Bar
- Pragmatic gate — PASS_WITH_CONDITIONS is acceptable for non-critical items; must-haves fully met, nice-to-haves can be conditioned
- 90% adapter conformance threshold (SC2) is the right bar — no increase needed
- Issues found during review that require code changes are fixed within Phase 6 (gate isn't done until issues are resolved or explicitly conditioned)
- 30 FPS minimum floor for the 200-entity stress test during 4-user collaboration — below 30 FPS means the editor feels broken

### Claude's Discretion
- Specific test scenario construction (which entities, component types, edit patterns)
- Network condition simulation method (artificial delays, WebSocket interruption approach)
- Evidence packet structure and Codex prompt crafting
- Order of operations within the review plan

</decisions>

<specifics>
## Specific Ideas

- The golden path walkthrough should exercise the full user journey as a narrative, not just isolated success criteria checks
- Cross-engine collab test validates that the ECSON/Yjs layer is truly engine-agnostic at the collaboration level — this is architecturally important
- The 200-entity target with 30 FPS floor gives a concrete, measurable performance gate

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-review-gate-core-platform*
*Context gathered: 2026-02-22*
