---
phase: 01-contracts-testing-spine
plan: 03
subsystem: patchops
tags: [zod, patchops, discriminated-union, inverse-ops, tdd, migration, validation]

# Dependency graph
requires:
  - phase: 01-02
    provides: "ECSON Zod schema suite (SceneDocument, Entity, ComponentInstance, AssetEntry, Transform)"
provides:
  - "16 PatchOp Zod schemas as discriminated union on 'type' field"
  - "applyOp/applyOps engine that mutates SceneDocument in place and returns inverse ops"
  - "Apply-inverse identity proven for all 16 op types"
  - "Pre-apply validation including circular reparent detection"
  - "Origin enum (user/ai/system/replay) with SafeModeConfig"
  - "PatchOp format versioning (CURRENT_PATCHOP_VERSION = 1)"
  - "migrateOp runner with empty v1 migration registry for future format upgrades"
  - "Path utilities (getByPath/setByPath) for dot-separated property access"
affects: [01-04, 01-05, 01-06, 01-07, all-future-phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [discriminated-union-ops, apply-inverse-identity, exhaustive-switch, tdd-red-green-refactor, batch-op-recursion, path-dot-notation]

key-files:
  created:
    - packages/patchops/src/origin.ts
    - packages/patchops/src/version.ts
    - packages/patchops/src/base.ts
    - packages/patchops/src/ops/create-entity.ts
    - packages/patchops/src/ops/delete-entity.ts
    - packages/patchops/src/ops/set-property.ts
    - packages/patchops/src/ops/add-child.ts
    - packages/patchops/src/ops/remove-child.ts
    - packages/patchops/src/ops/reparent.ts
    - packages/patchops/src/ops/add-component.ts
    - packages/patchops/src/ops/remove-component.ts
    - packages/patchops/src/ops/set-component-property.ts
    - packages/patchops/src/ops/add-asset.ts
    - packages/patchops/src/ops/remove-asset.ts
    - packages/patchops/src/ops/replace-asset-ref.ts
    - packages/patchops/src/ops/add-keyframe.ts
    - packages/patchops/src/ops/remove-keyframe.ts
    - packages/patchops/src/ops/set-keyframe-value.ts
    - packages/patchops/src/ops/batch-op.ts
    - packages/patchops/src/ops/index.ts
    - packages/patchops/src/schemas.ts
    - packages/patchops/src/engine.ts
    - packages/patchops/src/validation.ts
    - packages/patchops/src/migrations/migrate-op.ts
    - packages/patchops/__tests__/schemas.test.ts
    - packages/patchops/__tests__/engine.test.ts
    - packages/patchops/__tests__/inverse.test.ts
    - packages/patchops/__tests__/migrate-op.test.ts
  modified:
    - packages/patchops/src/index.ts

key-decisions:
  - "Used z.union instead of z.discriminatedUnion at top level because BatchOp's z.lazy() is incompatible with discriminatedUnion; inner 15 non-recursive types still use z.discriminatedUnion for efficiency"
  - "DeleteEntity inverse produces a BatchOp when the deleted entity had components, ensuring full state restoration including component data"
  - "Used JSON.parse/JSON.stringify for deep cloning instead of structuredClone because tsconfig targets ES2022 (structuredClone requires ES2023 or DOM lib)"
  - "Reparent circular detection walks ancestor chain from newParentId upward, rejecting if entityId is encountered"
  - "Keyframe ops operate on Animation component's tracks property using a convention-based track structure"

patterns-established:
  - "Apply-inverse identity: every PatchOp type must produce an inverse that restores the document to its pre-op state"
  - "Exhaustive switch: op type handlers use TypeScript never trick for compile-time exhaustiveness checking"
  - "Validate-then-mutate: validateOp runs before any mutation in applyOp, throwing on invalid ops"
  - "Inverse origin is always 'replay': inverse ops carry origin='replay' to distinguish from user-initiated ops"
  - "Batch inverse reversal: BatchOp inverse contains sub-inverses in reverse order for correct undo semantics"
  - "Path dot-notation: entity properties accessed via dot-separated paths (e.g., 'transform.position.x')"

requirements-completed: [CORE-01, CORE-02]

# Metrics
duration: 10min
completed: 2026-02-19
---

# Phase 1 Plan 3: PatchOps System Summary

**Complete PatchOps engine with 16 Zod-validated op types, apply/inverse cycle proven for all types, circular reparent detection, and migration infrastructure -- 69 tests passing**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-19T22:04:44Z
- **Completed:** 2026-02-19T22:15:39Z
- **Tasks:** 2
- **Files modified:** 30

## Accomplishments
- All 16 PatchOp types defined as Zod schemas with discriminated union on `type` field, each carrying id, timestamp, origin, and version
- Complete apply engine (applyOp/applyOps) that mutates SceneDocument in place and returns inverse operations for undo/redo
- Apply-inverse identity proven for every one of the 16 op types with dedicated tests
- Pre-apply validation including circular reparent detection (walks ancestor chain)
- BatchOp applies sub-ops atomically with recursive inverse generation in reverse order
- Origin policy (user/ai/system/replay) and format versioning with migrateOp runner ready for future upgrades
- 69 tests across 4 test files, all green; full monorepo typecheck/lint/test passing (21 turbo tasks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define PatchOp Zod schemas (all 16 types), origin policy, and format versioning** - `012e90c` (feat)
2. **Task 2: Implement PatchOps engine with apply/inverse, validation, and migration** - `4ff2d89` (feat)

## Files Created/Modified
- `packages/patchops/src/origin.ts` - Origin enum (user/ai/system/replay) and SafeModeConfig schema
- `packages/patchops/src/version.ts` - CURRENT_PATCHOP_VERSION constant (= 1)
- `packages/patchops/src/base.ts` - Shared PatchOpBase fields (id, timestamp, origin, version)
- `packages/patchops/src/ops/create-entity.ts` - CreateEntity op schema (entityId, name, parentId, transform, tags)
- `packages/patchops/src/ops/delete-entity.ts` - DeleteEntity op schema (entityId, previousState: Entity)
- `packages/patchops/src/ops/set-property.ts` - SetProperty op schema (entityId, path, value, previousValue)
- `packages/patchops/src/ops/add-child.ts` - AddChild op schema (parentId, childId, optional index)
- `packages/patchops/src/ops/remove-child.ts` - RemoveChild op schema (parentId, childId, previousIndex)
- `packages/patchops/src/ops/reparent.ts` - Reparent op schema (entityId, newParentId, oldParentId, indices)
- `packages/patchops/src/ops/add-component.ts` - AddComponent op schema (entityId, component)
- `packages/patchops/src/ops/remove-component.ts` - RemoveComponent op schema (entityId, componentType, previousComponent)
- `packages/patchops/src/ops/set-component-property.ts` - SetComponentProperty op schema
- `packages/patchops/src/ops/add-asset.ts` - AddAsset op schema (asset: AssetEntry)
- `packages/patchops/src/ops/remove-asset.ts` - RemoveAsset op schema (assetId, previousAsset)
- `packages/patchops/src/ops/replace-asset-ref.ts` - ReplaceAssetRef op schema
- `packages/patchops/src/ops/add-keyframe.ts` - AddKeyframe op schema (entityId, trackId, time, value)
- `packages/patchops/src/ops/remove-keyframe.ts` - RemoveKeyframe op schema
- `packages/patchops/src/ops/set-keyframe-value.ts` - SetKeyframeValue op schema
- `packages/patchops/src/ops/batch-op.ts` - BatchOp op schema with z.lazy() for recursive sub-ops
- `packages/patchops/src/ops/index.ts` - Barrel export of all 16 op schemas
- `packages/patchops/src/schemas.ts` - PatchOpSchema discriminated union (z.union with z.discriminatedUnion inner)
- `packages/patchops/src/engine.ts` - applyOp/applyOps with exhaustive switch, getByPath/setByPath utilities
- `packages/patchops/src/validation.ts` - validateOp with entity existence, circular reparent checks
- `packages/patchops/src/migrations/migrate-op.ts` - migrateOp runner with empty v1 MIGRATION_REGISTRY
- `packages/patchops/src/index.ts` - Updated barrel export with all schemas, engine, validation, migration
- `packages/patchops/__tests__/schemas.test.ts` - 27 schema validation tests (all types, origin, version)
- `packages/patchops/__tests__/engine.test.ts` - 19 engine apply tests (each type + BatchOp + applyOps)
- `packages/patchops/__tests__/inverse.test.ts` - 19 inverse identity tests (all 16 types + circular validation)
- `packages/patchops/__tests__/migrate-op.test.ts` - 4 migration runner tests (passthrough, warn, error, registry)

## Decisions Made
- **z.union for top-level PatchOpSchema**: BatchOp's z.lazy() reference creates a recursive type incompatible with z.discriminatedUnion. Used z.union at top level, with inner z.discriminatedUnion for the 15 non-recursive types (preserving discrimination efficiency for the common case).
- **DeleteEntity inverse as BatchOp**: When the deleted entity had components, the inverse needs to restore them. Since CreateEntity doesn't carry component data, the inverse is a BatchOp containing CreateEntity + AddComponent ops.
- **JSON clone instead of structuredClone**: The project targets ES2022 which doesn't include structuredClone. JSON.parse/JSON.stringify works correctly for all ECSON data types (no functions, no circular refs, no special objects).
- **Convention-based keyframe tracks**: Animation keyframes are stored in the Animation component's `tracks` property as `{ [trackId]: { keyframes: [{ time, value }] } }`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DeleteEntity inverse not restoring components**
- **Found during:** Task 2 (engine implementation)
- **Issue:** DeleteEntity's inverse was a simple CreateEntity op which doesn't carry component data, so entities with components lost their components on undo
- **Fix:** Changed inverse to produce a BatchOp (CreateEntity + AddComponent per component) when the deleted entity had components
- **Files modified:** packages/patchops/src/engine.ts
- **Verification:** DeleteEntity inverse identity test passes (entity with Light component restored)
- **Committed in:** 4ff2d89 (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed structuredClone not available in ES2022 tsconfig**
- **Found during:** Task 2 (typecheck verification)
- **Issue:** structuredClone is a DOM API / ES2023+ feature, not available with tsconfig lib: ["ES2022"]
- **Fix:** Added deepClone utility using JSON.parse/JSON.stringify
- **Files modified:** packages/patchops/src/engine.ts
- **Verification:** `pnpm --filter @riff3d/patchops typecheck` passes
- **Committed in:** 4ff2d89 (Task 2 commit)

**3. [Rule 3 - Blocking] Fixed validation.ts implicit any on entity lookup**
- **Found during:** Task 2 (typecheck verification)
- **Issue:** With noUncheckedIndexedAccess, the entity lookup in the circular reparent check had TS7022 (implicit any due to self-referencing initializer)
- **Fix:** Added explicit type annotation `{ parentId: string | null } | undefined`
- **Files modified:** packages/patchops/src/validation.ts
- **Verification:** `pnpm --filter @riff3d/patchops typecheck` passes
- **Committed in:** 4ff2d89 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All fixes necessary for correctness and TypeScript strict mode compliance. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full PatchOps API exported: `import { PatchOpSchema, applyOp, applyOps, validateOp, migrateOp } from '@riff3d/patchops'`
- All 16 op types available as individual schemas for type narrowing
- Apply-inverse identity proven -- safe for undo/redo implementation
- Circular reparent detection prevents invalid hierarchy mutations
- Migration infrastructure ready for future PatchOp format changes
- Ready for Canonical IR compilation (Plan 01-04), which reads the ECSON structures that PatchOps mutate
- No blockers for subsequent plans

## Self-Check: PASSED

- All 29 created files verified present on disk
- Commit 012e90c (Task 1) verified in git log
- Commit 4ff2d89 (Task 2) verified in git log

---
*Phase: 01-contracts-testing-spine*
*Completed: 2026-02-19*
