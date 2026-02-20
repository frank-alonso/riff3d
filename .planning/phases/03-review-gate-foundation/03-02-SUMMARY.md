---
phase: 03-review-gate-foundation
plan: 02
subsystem: testing
tags: [zod, ecson, schema-validation, patchops, test-migration]

# Dependency graph
requires:
  - phase: 01-contracts-testing-spine
    provides: ECSON schemas (SceneDocumentSchema, EntitySchema) with Zod validation and defaults
  - phase: 02-closed-loop-editor
    provides: Carry-forward CF-P2-03 identifying raw test document construction as schema drift risk
provides:
  - Schema-validated test document construction across all patchops test files
  - Elimination of invalid test data (fog type "none" bug) caught by Zod validation
affects: [patchops, conformance, canonical-ir]

# Tech tracking
tech-stack:
  added: []
  patterns: ["SceneDocumentSchema.parse() for test document construction", "EntitySchema.parse() for inline entity creation in tests", "CURRENT_SCHEMA_VERSION constant instead of hardcoded version numbers", "Zod defaults for optional entity/environment fields"]

key-files:
  created: []
  modified:
    - packages/patchops/__tests__/engine.test.ts
    - packages/patchops/__tests__/inverse.test.ts

key-decisions:
  - "Inline entity construction in patchops tests uses EntitySchema.parse() with minimal required fields, letting Zod defaults handle children, components, tags, transform, visible, locked"
  - "Environment settings omitted from createTestDoc() to use schema defaults instead of manually specifying invalid values"

patterns-established:
  - "All test document construction uses SceneDocumentSchema.parse() -- no raw object literals with SceneDocument type"
  - "Entity construction in tests uses EntitySchema.parse() with only id, name, parentId required"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 3 Plan 2: Migrate Test Documents to SceneDocumentSchema.parse() Summary

**Migrated patchops test document construction from raw object literals to Zod-validated SceneDocumentSchema.parse(), fixing invalid fog type "none" bug and eliminating schema drift risk across 42 test cases**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T07:06:35Z
- **Completed:** 2026-02-20T07:09:58Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Migrated `createTestDoc()` in both patchops test files from raw object literals to `SceneDocumentSchema.parse()` with `CURRENT_SCHEMA_VERSION`
- Fixed invalid `fog: { type: "none" }` that was silently accepted by TypeScript but would fail Zod validation (FogTypeEnum only allows "linear", "exponential", "exponential2")
- Migrated all 15+ inline entity constructions to `EntitySchema.parse()` with Zod defaults for optional fields
- Verified all 400+ tests across the entire monorepo still pass -- zero regressions
- CF-P2-03 carry-forward fully resolved

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit and migrate all test files to SceneDocumentSchema.parse()** - `49f8bb0` (fix)

## Files Created/Modified
- `packages/patchops/__tests__/engine.test.ts` - Migrated createTestDoc() and 8 inline entity constructions to schema-validated construction
- `packages/patchops/__tests__/inverse.test.ts` - Migrated createTestDoc() and 12 inline entity constructions to schema-validated construction

## Decisions Made
- Inline entity construction uses `EntitySchema.parse()` with only required fields (id, name, parentId), letting Zod defaults handle children, components, tags, transform, visible, locked. This reduces boilerplate from ~12 lines per entity to ~4 lines.
- Environment settings omitted from `createTestDoc()` entirely -- Zod defaults provide valid fog (enabled: false, type: "linear"), skybox (type: "color"), ambient light, and gravity. This eliminates the possibility of specifying invalid enum values.
- Other test files (canonical-ir, conformance, fixtures) were already compliant -- they use `createEmptyDocument()`, `SceneDocumentSchema.parse()`, and fixture builders that internally validate via Zod. No changes needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid fog type "none" in test documents**
- **Found during:** Task 1 (Audit)
- **Issue:** Both patchops test files used `fog: { type: "none" }` which is not a valid FogTypeEnum value. The enum only allows "linear", "exponential", "exponential2". This was silently accepted by TypeScript type assertions but would fail Zod validation.
- **Fix:** Removed manual environment specification entirely, letting `SceneDocumentSchema.parse()` apply Zod defaults (fog enabled: false, type: "linear").
- **Files modified:** packages/patchops/__tests__/engine.test.ts, packages/patchops/__tests__/inverse.test.ts
- **Verification:** All 42 patchops engine/inverse tests pass with schema-validated documents
- **Committed in:** 49f8bb0

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fog bug fix was exactly the kind of issue CF-P2-03 was designed to catch. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All test files across the monorepo now use schema-validated document construction
- CF-P2-03 is fully resolved -- no remaining raw ECSON document construction in test files
- Pre-existing adapter-playcanvas typecheck issue (TS6059 rootDir config) is unrelated and tracked separately

## Self-Check: PASSED

- [x] packages/patchops/__tests__/engine.test.ts - FOUND
- [x] packages/patchops/__tests__/inverse.test.ts - FOUND
- [x] 03-02-SUMMARY.md - FOUND
- [x] Commit 49f8bb0 - FOUND

---
*Phase: 03-review-gate-foundation*
*Completed: 2026-02-20*
