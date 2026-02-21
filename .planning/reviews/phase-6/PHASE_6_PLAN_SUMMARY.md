# Phase 6 Plan Summary: Review Gate: Core Platform

**Date:** 2026-02-22
**Plans:** 3 plans in 3 waves
**Type:** Expanded-scope review gate (Phases 4-5 cross-integration)

## Phase Goal

Validate that collaboration (Phase 5), dual adapters (Phase 4), and the editor form a stable platform before adding the game layer (Phase 7+). Expanded-scope review covering cross-phase integration, cumulative PASS_WITH_CONDITIONS debt from Phases 1-5, architecture drift, and carry-forward reconciliation.

**Success Criteria:**
1. Two concurrent users can collaboratively build a scene, play-test it, and save -- no data loss
2. Adapter conformance passes at 90%+ for both PlayCanvas and Babylon.js
3. Editor handles 100+ entities without FPS drop below baseline (200-entity target with 30 FPS floor)
4. All carry-forward actions from Phase 4-5 reviews resolved or explicitly re-scheduled
5. No unaddressed cumulative technical debt from PASS_WITH_CONDITIONS decisions across Phases 1-5

**Requirement IDs:** None (review phase)

## Plan Files

| Plan | File | Description |
|------|------|-------------|
| 06-01 | `.planning/phases/06-review-gate-core-platform/06-01-PLAN.md` | Resolve 3 carry-forward items: CF-P5-02 (avatar yaw fix), CF-P5-04 (collab-doc shape versioning), CF-P5-05 (server persistence unit tests) |
| 06-02 | `.planning/phases/06-review-gate-core-platform/06-02-PLAN.md` | Build 200-entity scene builder, 4-client headless CRDT stress tests, Playwright E2E (golden path, FPS, cross-engine, multi-user) |
| 06-03 | `.planning/phases/06-review-gate-core-platform/06-03-PLAN.md` | Pre-execution plan review (mandatory), evidence compilation, Codex expanded-scope deep-audit, architecture drift + cumulative debt assessment, gate decision, human verification |

## Key Source Files for Auditor

### Collaboration Server (Priority 1 -- deep-audit requested)
- `servers/collab/src/server.ts` (68 LoC) -- Hocuspocus server config, auth hook, disconnect handling
- `servers/collab/src/auth.ts` (95 LoC) -- JWT verification, project access control, color assignment
- `servers/collab/src/persistence.ts` (139 LoC) -- Y.Doc binary persistence, ECSON dual-write to Supabase

### Sync Bridge (Priority 2)
- `apps/editor/src/collaboration/sync-bridge.ts` (347 LoC) -- Bidirectional ECSON<->Y.Doc synchronization, origin tagging

### Adapter Packages (Priority 3)
- `packages/adapter-playcanvas/` -- Primary adapter (core: 818 LoC)
- `packages/adapter-babylon/` -- Validation adapter
- `packages/canonical-ir/` -- IR spec consumed by both adapters

### Architecture Boundary Enforcement
- ESLint `no-restricted-imports` rules (Phase 5) -- mechanical enforcement of adapter boundary
- `scripts/check-adapter-loc.sh` -- LoC budget enforcement

## Key Constraints and Decisions (from CONTEXT.md)

### Locked Decisions
- **4 concurrent users** in stress test (above SC1's "two users")
- **200 entities** in stress scene (above SC3's 100-entity target)
- **30 FPS minimum floor** for 200-entity 4-user collaboration
- **Cross-engine collab** validation (User A PlayCanvas, User B Babylon.js)
- **Adverse network conditions** simulation (latency injection + disconnection)
- **All 3 carry-forwards** resolved within Phase 6 (CF-P5-02, CF-P5-04, CF-P5-05)
- **Codex deep-audit** of collaboration server code (auth, persistence, sync, failure modes)
- **Architecture drift** explicitly verified against original contract definitions
- **Pragmatic gate** -- PASS_WITH_CONDITIONS acceptable for non-critical items

### Carry-Forward Items to Resolve
| CF ID | Description | Plan |
|-------|-------------|------|
| CF-P5-02 | Avatar yaw initialization resets to 0 instead of preserving camera orientation | 06-01 |
| CF-P5-04 | Collab-doc shape versioning/migration metadata | 06-01 |
| CF-P5-05 | Server-side unit tests for collab persistence decode/re-encode | 06-01 |

## Questions for Auditor

1. **Sync bridge field coverage:** Does `sync-bridge.ts` correctly synchronize ALL ECSON fields (entities, assets, wiring, environment, metadata) to Y.Doc? Are there edge cases where fields could be silently dropped during bidirectional sync?

2. **Persistence race conditions:** In `persistence.ts`, the dual-write pattern (Y.Doc binary + decoded ECSON) could have a race condition if the server crashes between writes. Is the current error handling adequate, or should this be wrapped in a transaction?

3. **Auth bypass risks:** Does `auth.ts` correctly prevent unauthorized access? Is the JWT verification robust against token replay or expired tokens?

4. **Carry-forward adequacy:** Is the minimal shape versioning approach in CF-P5-04 (single `_shapeVersion` field with one migration path) sufficient, or does the CRDT nature of Y.Doc require a more robust versioning strategy?

5. **Architecture drift:** Have Phases 4 (dual adapter) or 5 (collaboration) introduced any subtle violations of the contract-first architecture? Specifically: do adapters import only from `@riff3d/canonical-ir`? Are all ECSON mutations going through PatchOps (with the 3 documented exceptions)?
