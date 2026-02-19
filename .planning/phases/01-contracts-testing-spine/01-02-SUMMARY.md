---
phase: 01-contracts-testing-spine
plan: 02
subsystem: schemas
tags: [zod, ecson, nanoid, migration, scene-document, entity, transform]

# Dependency graph
requires:
  - phase: 01-01
    provides: "pnpm + Turborepo monorepo scaffold with ecson package"
provides:
  - "Complete ECSON Zod schema suite (11 schemas: Vec3 through SceneDocument)"
  - "TypeScript types derived via z.infer<> for all ECSON types"
  - "nanoid-based ID generators for entities (16-char), ops (21-char), assets (ast_ prefix), wires (wir_ prefix)"
  - "Forward migration infrastructure with version-keyed up() functions"
  - "Helper utilities: createEmptyDocument(), createEntity()"
  - "CURRENT_SCHEMA_VERSION = 1 constant"
affects: [01-03, 01-04, 01-05, 01-06, 01-07, all-future-phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [zod-schema-first-types, nanoid-prefixed-ids, forward-migration-runner, bottom-up-schema-composition]

key-files:
  created:
    - packages/ecson/src/schemas/vec3.ts
    - packages/ecson/src/schemas/quaternion.ts
    - packages/ecson/src/schemas/transform.ts
    - packages/ecson/src/schemas/engine-tuning.ts
    - packages/ecson/src/schemas/component-instance.ts
    - packages/ecson/src/schemas/entity.ts
    - packages/ecson/src/schemas/asset.ts
    - packages/ecson/src/schemas/wiring.ts
    - packages/ecson/src/schemas/environment.ts
    - packages/ecson/src/schemas/game-settings.ts
    - packages/ecson/src/schemas/scene-document.ts
    - packages/ecson/src/schemas/index.ts
    - packages/ecson/src/ids.ts
    - packages/ecson/src/helpers.ts
    - packages/ecson/src/migrations/migrate.ts
    - packages/ecson/src/migrations/versions/.gitkeep
    - packages/ecson/__tests__/schemas.test.ts
    - packages/ecson/__tests__/ids.test.ts
    - packages/ecson/__tests__/migrations.test.ts
  modified:
    - packages/ecson/src/index.ts

key-decisions:
  - "Used Zod z.record() for engine tuning rather than a typed union, allowing arbitrary per-engine properties as the escape hatch"
  - "Rotation stored as Quaternion (x,y,z,w) rather than Euler angles, matching plan specification for engine-agnostic representation"
  - "Entity components stored as array (not Record<string, ComponentInstance>) to support multiple instances of the same component type"
  - "Asset IDs prefixed with 'ast_' and wire IDs with 'wir_' for readability and type disambiguation in logs/debugging"
  - "Migration runner uses unknown input/output types for intermediate migration steps, with final Zod parse for validation"

patterns-established:
  - "Schema-first types: All types derived via z.infer<typeof Schema> -- no manual interfaces"
  - "Bottom-up schema composition: primitives (Vec3, Quaternion) compose into Transform, which composes into Entity, which composes into SceneDocument"
  - "Prefixed ID generation: domain-specific prefixes (ast_, wir_) for non-entity IDs"
  - "Forward migration pattern: migrations array with version/description/up, applied in order with final Zod validation"
  - "Helper factory pattern: createEmptyDocument() and createEntity() produce valid parsed objects with sensible defaults"

requirements-completed: [CORE-03, CORE-04, CORE-08, CORE-09]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 1 Plan 2: ECSON Schema Summary

**Complete ECSON Zod schema suite (Vec3 through SceneDocument) with nanoid ID generators, forward migration runner, and factory helpers -- 60 tests passing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T21:56:06Z
- **Completed:** 2026-02-19T22:01:17Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- All 11 ECSON Zod schemas implemented bottom-up: Vec3, Quaternion, Transform, EngineTuning, ComponentInstance, Entity, AssetEntry, EventWire, EnvironmentSettings, GameSettings, SceneDocument
- TypeScript types derived exclusively from Zod via z.infer<> -- zero manual interfaces
- nanoid-based ID generators with domain-specific prefixes (entity 16-char, op 21-char, asset ast_ prefix, wire wir_ prefix)
- Forward migration infrastructure ready for future schema evolution
- Helper utilities for creating empty documents and entities with sensible defaults
- 60 tests across 4 test files, all green; full monorepo typecheck/lint/test passing (21 turbo tasks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement core ECSON schemas (Vec3 through SceneDocument)** - `57457bf` (feat)
2. **Task 2: Implement ID generation, migration infrastructure, and helper utilities** - `d86fc94` (feat)

## Files Created/Modified
- `packages/ecson/src/schemas/vec3.ts` - Vec3 schema with x/y/z number defaults
- `packages/ecson/src/schemas/quaternion.ts` - Quaternion schema with identity default (w=1)
- `packages/ecson/src/schemas/transform.ts` - Transform composing Vec3 position, Quaternion rotation, Vec3 scale
- `packages/ecson/src/schemas/engine-tuning.ts` - Engine tuning escape hatch (Record<string, Record<string, unknown>>)
- `packages/ecson/src/schemas/component-instance.ts` - Component instance with type, properties, optional tuning
- `packages/ecson/src/schemas/entity.ts` - Entity with ID, name, parentId, children, components, tags, transform, tuning
- `packages/ecson/src/schemas/asset.ts` - Asset entry with type enum, optional uri/data, metadata
- `packages/ecson/src/schemas/wiring.ts` - EventWire for WHEN-DO connections between entities
- `packages/ecson/src/schemas/environment.ts` - Environment settings (skybox, fog, ambient light, gravity)
- `packages/ecson/src/schemas/game-settings.ts` - Game settings (maxPlayers, roundDuration, respawn)
- `packages/ecson/src/schemas/scene-document.ts` - Root SceneDocument with entities, assets, wiring, environment
- `packages/ecson/src/schemas/index.ts` - Barrel export of all schemas and inferred types
- `packages/ecson/src/ids.ts` - nanoid-based ID generators (entity, op, asset, wire)
- `packages/ecson/src/helpers.ts` - createEmptyDocument() and createEntity() factory utilities
- `packages/ecson/src/migrations/migrate.ts` - Forward migration runner with Zod validation
- `packages/ecson/src/migrations/versions/.gitkeep` - Placeholder for future migration files
- `packages/ecson/src/index.ts` - Updated barrel export with schemas, IDs, migrations, helpers
- `packages/ecson/__tests__/schemas.test.ts` - 30 schema tests (parsing, defaults, errors, type inference)
- `packages/ecson/__tests__/ids.test.ts` - 11 ID generation tests (format, collisions)
- `packages/ecson/__tests__/migrations.test.ts` - 17 migration and helper tests

## Decisions Made
- **Engine tuning as z.record**: Used `z.record(z.string(), z.record(z.string(), z.unknown()))` for maximum flexibility -- any engine name with any properties
- **Quaternion rotation**: Stored rotation as Quaternion (x,y,z,w) matching plan specification, avoiding gimbal lock issues with Euler angles
- **Components as array**: Entity components stored as `ComponentInstance[]` rather than `Record<string, ComponentInstance>` to allow multiple instances of the same component type (e.g., multiple colliders)
- **Prefixed IDs**: Asset IDs start with `ast_`, wire IDs with `wir_` for human readability and type disambiguation
- **Migration runner types**: Uses `unknown` for intermediate migration steps since documents may be in non-conforming intermediate states during migration

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed console.warn type error in migration runner**
- **Found during:** Task 2 (typecheck verification)
- **Issue:** `console.warn()` call in migrate.ts caused TS2584 because tsconfig uses `"lib": ["ES2022"]` without DOM types, and `console` is not defined in ES2022 lib
- **Fix:** Added `declare var console: { warn(...args: unknown[]): void }` at module scope
- **Files modified:** packages/ecson/src/migrations/migrate.ts
- **Verification:** `pnpm --filter @riff3d/ecson typecheck` passes
- **Committed in:** d86fc94 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal -- standard TypeScript lib configuration issue. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All ECSON types are exported and importable: `import { SceneDocument, Entity, Transform, createEmptyDocument, generateEntityId } from '@riff3d/ecson'`
- Migration infrastructure is in place for future schema evolution (add migrations to `migrations` array)
- Schema foundation ready for PatchOps (Plan 01-03) to define operations that mutate ECSON documents
- Component property validation can be added in Plan 01-05 (component registry)
- No blockers for subsequent plans

## Self-Check: PASSED

- All 20 files verified present on disk
- Commit 57457bf (Task 1) verified in git log
- Commit d86fc94 (Task 2) verified in git log

---
*Phase: 01-contracts-testing-spine*
*Completed: 2026-02-19*
