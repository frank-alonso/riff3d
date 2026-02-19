# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** All meaningful edits flow through a deterministic operation pipeline (IQL -> PatchOps -> ECSON -> Canonical IR -> Adapters), ensuring portability, reproducibility, and safe AI-driven manipulation.
**Current focus:** Phase 1: Contracts & Testing Spine

## Current Position

Phase: 1 of 11 (Contracts & Testing Spine)
Plan: 5 of 7 in current phase
Status: Executing
Last activity: 2026-02-19 -- Completed 01-05 (Component Registry)

Progress: [███████░░░] 5/7 plans in phase

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 5.0 min
- Total execution time: 0.42 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | 25 min | 5.0 min |

**Recent Trend:**
- Last 5 plans: 01-01 (4 min), 01-02 (5 min), 01-03 (4 min), 01-04 (5 min), 01-05 (7 min)
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Contracts-first build order (specs before any UI) per FOUNDATION.md
- [Roadmap]: PlayCanvas as primary adapter through Phase 1-2; Babylon.js as validation in Phase 4
- [Roadmap]: Review gates at Phase 3, 6, and 11 to validate foundation before building on it
- [Roadmap]: Yjs CRDTs for collaboration (not Colyseus) per research recommendation
- [01-01]: Used pnpm catalogs for shared dependency versions (zod, nanoid, fast-check)
- [01-01]: ESLint flat config with typescript-eslint (not deprecated .eslintrc)
- [01-01]: Editor uses `eslint .` directly since Next.js 16 removed `next lint` subcommand
- [01-01]: Source-based exports (./src/index.ts) for internal packages during development
- [01-02]: Engine tuning as z.record() for maximum flexibility (arbitrary per-engine properties)
- [01-02]: Rotation stored as Quaternion (x,y,z,w) not Euler angles
- [01-02]: Entity components stored as array to support multiple instances of same type
- [01-02]: Prefixed IDs (ast_, wir_) for readability and type disambiguation
- [01-03]: z.union for top-level PatchOpSchema (BatchOp's z.lazy incompatible with z.discriminatedUnion)
- [01-03]: DeleteEntity inverse produces BatchOp when entity had components for full state restoration
- [01-03]: JSON clone instead of structuredClone (ES2022 tsconfig lacks structuredClone)
- [01-03]: Circular reparent detection walks ancestor chain from newParentId upward
- [01-04]: IR schemas use no defaults -- all fields required/explicit (unlike ECSON which has .default())
- [01-04]: CanonicalComponent uses z.strictObject to prevent editor sugar fields
- [01-04]: IR asset uri/data are nullable (not optional) for explicitness
- [01-04]: BFS topological sort for nodes array ensures parents before children
- [01-04]: Game settings flattened to Record<string, unknown> in IR for engine-agnostic representation
- [01-05]: Editor hints as typed editorHints record on ComponentDefinition (Zod 3.25 lacks .meta())
- [01-05]: Registry backing store in _store.ts to avoid circular ES module initialization
- [01-05]: glTF allowlist v0: 3 portable (core, lights_punctual, materials_unlit), 2 non-portable
- [01-05]: KillZone damage defaults to Infinity for instant kill behavior

### Pending Todos

- [Phase 8] Re-evaluate `.planning/research/TEMPLATE_DESIGN_PLAYBOOK.md` — reconcile archetype specs with actual component registry, validate against built game runtime, update playtest process, finalize template backlog. Also review at Phase 7 (latency budgets) and Phase 10 (VR variants).

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 01-03-PLAN.md (PatchOps System) -- re-execution
Resume file: None
