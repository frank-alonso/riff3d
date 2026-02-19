# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** All meaningful edits flow through a deterministic operation pipeline (IQL -> PatchOps -> ECSON -> Canonical IR -> Adapters), ensuring portability, reproducibility, and safe AI-driven manipulation.
**Current focus:** Phase 1: Contracts & Testing Spine

## Current Position

Phase: 1 of 11 (Contracts & Testing Spine)
Plan: 6 of 7 in current phase
Status: Executing
Last activity: 2026-02-19 -- Completed 01-06 (Fixtures & Conformance)

Progress: [████████░░] 6/7 plans in phase

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 11.0 min
- Total execution time: 1.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6 | 66 min | 11.0 min |

**Recent Trend:**
- Last 5 plans: 01-02 (5 min), 01-03 (4 min), 01-04 (5 min), 01-05 (7 min), 01-06 (41 min)
- Trend: 01-06 was larger scope (3 tasks, 24 files, 63 tests)

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
- [01-06]: Builder flattens nested tree to ECSON flat entity map on build(), with SceneDocumentSchema.parse() validation
- [01-06]: Deterministic IDs via counter-based generators with seed prefix for test reproducibility
- [01-06]: Round-trip comparison uses portable subset extraction (strips tags, locked, metadata, component tuning)
- [01-06]: fast-check property tests use fixed seed=42 with 100 iterations for CI reproducibility
- [01-06]: Performance budgets use 2x CI margin (50/200/1000ms baselines for small/medium/large fixtures)

### Pending Todos

- [Phase 1 Review] Consult `.planning/research/FUTURE_ENGINE_CONSIDERATIONS.md` Section 10 during 01-07 review — verify IR conventions are formally documented (coordinate system, normal maps, physics units, roughness not inverted, 1:N entity-to-node mapping documented).
- [Phase 4] Consult `FUTURE_ENGINE_CONSIDERATIONS.md` when validating Babylon.js adapter — ensure no web-only assumptions baked into IR.
- [Phase 8] Consult `FUTURE_ENGINE_CONSIDERATIONS.md` Section 7 when designing ejection adapter interface — directory structures, no binary formats.
- [Phase 8] Re-evaluate `.planning/research/TEMPLATE_DESIGN_PLAYBOOK.md` — reconcile archetype specs with actual component registry, validate against built game runtime, update playtest process, finalize template backlog. Also review at Phase 7 (latency budgets) and Phase 10 (VR variants).

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 01-06-PLAN.md (Fixtures & Conformance)
Resume file: None
