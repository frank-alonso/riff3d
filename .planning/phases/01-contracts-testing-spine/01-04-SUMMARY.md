---
phase: 01-contracts-testing-spine
plan: 04
subsystem: schemas
tags: [zod, canonical-ir, compiler, decompiler, round-trip, portable-subset, topological-sort]

# Dependency graph
requires:
  - phase: 01-02
    provides: "Complete ECSON Zod schema suite (SceneDocument, Entity, Transform, etc.)"
provides:
  - "Canonical IR Zod schemas (CanonicalScene, CanonicalNode, CanonicalComponent, CanonicalAsset, CanonicalWire, CanonicalEnvironment)"
  - "ECSON-to-IR compiler: compile() with topological sort and default baking"
  - "IR-to-ECSON decompiler: decompile() restoring hierarchy and optional fields"
  - "Portable subset v0 definition (9 component types, PBR material properties, light/camera types)"
  - "isPortableComponent() and isPortableProperty() query functions"
  - "Round-trip proof: ECSON -> IR -> ECSON preserves portable subset identically"
affects: [01-05, 01-06, 01-07, adapter-playcanvas, adapter-babylon, conformance]

# Tech tracking
tech-stack:
  added: []
  patterns: [canonical-ir-explicit-schemas, topological-sort-bfs, compile-decompile-round-trip, portable-subset-membership-checks, strict-object-no-sugar]

key-files:
  created:
    - packages/canonical-ir/src/types/canonical-scene.ts
    - packages/canonical-ir/src/types/canonical-node.ts
    - packages/canonical-ir/src/types/canonical-component.ts
    - packages/canonical-ir/src/types/canonical-asset.ts
    - packages/canonical-ir/src/types/canonical-wire.ts
    - packages/canonical-ir/src/types/canonical-environment.ts
    - packages/canonical-ir/src/types/index.ts
    - packages/canonical-ir/src/portable-subset.ts
    - packages/canonical-ir/src/compiler.ts
    - packages/canonical-ir/src/decompiler.ts
    - packages/canonical-ir/__tests__/types.test.ts
    - packages/canonical-ir/__tests__/compiler.test.ts
    - packages/canonical-ir/__tests__/decompiler.test.ts
    - packages/canonical-ir/__tests__/round-trip.test.ts
  modified:
    - packages/canonical-ir/src/index.ts

key-decisions:
  - "IR schemas use no defaults -- all fields required/explicit (unlike ECSON which has .default())"
  - "CanonicalComponent uses z.strictObject to prevent editor sugar fields from passing through"
  - "IR asset uri/data are nullable (not optional) -- explicit null vs missing is a meaningful distinction in IR"
  - "IR wire parameters are required (empty object) rather than optional -- no ambiguity in IR"
  - "Topological sort via BFS from root entity ensures parents always appear before children in nodes array"
  - "Component tuning stripped at component level in IR (lives on node.tuning), keeping components pure data"
  - "Game settings flattened to Record<string, unknown> in IR for engine-agnostic representation"

patterns-established:
  - "Explicit IR schemas: All Canonical IR types use required fields with no defaults -- the IR is fully resolved"
  - "Compile/decompile symmetry: compiler bakes defaults and normalizes optionals; decompiler restores optionals and applies ECSON schema defaults"
  - "Portable subset as ReadonlySet: Component types, property names defined as Set<string> for O(1) membership checks"
  - "Round-trip normalization: Comparison uses sorted JSON serialization to handle non-deterministic Record key ordering"
  - "BFS topological sort: Simple queue-based BFS from root produces valid topological ordering for tree structures"

requirements-completed: [CORE-05, CORE-06, CORE-07, PORT-02]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 1 Plan 4: Canonical IR Summary

**Canonical IR Zod schemas with ECSON compiler/decompiler pair, portable subset v0 definition, and round-trip proof across 8 document structures -- 46 tests passing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T22:04:48Z
- **Completed:** 2026-02-19T22:10:03Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- All 6 Canonical IR Zod schemas implemented: CanonicalScene, CanonicalNode, CanonicalComponent, CanonicalAsset, CanonicalWire, CanonicalEnvironment -- minimal, normalized, explicit (no defaults)
- compile() function transforms ECSON SceneDocument into CanonicalScene with BFS topological sort, default baking, and nodeIndex for O(1) lookup
- decompile() function restores CanonicalScene back to valid SceneDocument, handling optional/nullable field transformations
- Portable subset v0 formally defined: 9 component types, PBR material properties, 3 light types, 2 camera types, per-component property sets
- Round-trip proven for 8 different document structures: empty, single entity, nested hierarchy, components, tuning, assets+wiring, custom environment, game settings
- 46 tests across 4 test files, all green; full monorepo pipeline passing (21 turbo tasks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define Canonical IR types, portable subset v0, and write test contracts** - `dfca9ca` (feat)
2. **Task 2: Implement compiler, decompiler, and prove round-trip** - `a064d4f` (feat)

## Files Created/Modified
- `packages/canonical-ir/src/types/canonical-scene.ts` - Root CanonicalScene schema with nodes array, nodeIndex, environment, gameSettings
- `packages/canonical-ir/src/types/canonical-node.ts` - CanonicalNode with explicit transform (no defaults), components, optional tuning
- `packages/canonical-ir/src/types/canonical-component.ts` - Pure data component (strictObject: type + properties only)
- `packages/canonical-ir/src/types/canonical-asset.ts` - Normalized asset (nullable uri/data instead of optional)
- `packages/canonical-ir/src/types/canonical-wire.ts` - Event wire with required parameters (empty object, not undefined)
- `packages/canonical-ir/src/types/canonical-environment.ts` - Fully explicit environment (skybox, fog, ambient light, gravity)
- `packages/canonical-ir/src/types/index.ts` - Barrel export for all IR types
- `packages/canonical-ir/src/portable-subset.ts` - Portable subset v0 definition with membership check functions
- `packages/canonical-ir/src/compiler.ts` - ECSON -> IR compiler with topological sort and default baking
- `packages/canonical-ir/src/decompiler.ts` - IR -> ECSON decompiler restoring optional fields and hierarchy
- `packages/canonical-ir/src/index.ts` - Updated barrel export with types, portable subset, compile, decompile
- `packages/canonical-ir/__tests__/types.test.ts` - 24 type validation tests (schemas, portable subset, membership checks)
- `packages/canonical-ir/__tests__/compiler.test.ts` - 9 compiler tests (hierarchy, components, assets, wires, environment, tuning, validation)
- `packages/canonical-ir/__tests__/decompiler.test.ts` - 5 decompiler tests (hierarchy restoration, components, assets, wires, environment)
- `packages/canonical-ir/__tests__/round-trip.test.ts` - 8 round-trip tests proving portable subset identity across document structures

## Decisions Made
- **IR schemas have no defaults:** Unlike ECSON schemas which use `.default()`, all IR fields are required/explicit. The compiler bakes ECSON defaults into explicit values during compilation.
- **strictObject for CanonicalComponent:** Uses `z.strictObject()` instead of `z.object()` to actively reject unknown fields (editor sugar, metadata). This enforces the "pure data" constraint at parse time.
- **Nullable vs optional in IR:** IR uses `nullable()` (value can be null) instead of `optional()` (value can be absent). This eliminates ambiguity: every field is always present in IR.
- **Parameters always required on wires:** IR wires always have a `parameters` field (empty object if none). The compiler normalizes undefined parameters to `{}`.
- **BFS topological sort:** Simple queue-based BFS from root entity. Sufficient for tree structures (scene graphs are trees). Would need Kahn's algorithm if DAGs were supported.
- **Component tuning stripped in IR:** ECSON ComponentInstance can carry per-component tuning. In IR, this is elevated to node-level tuning, keeping components as pure `{ type, properties }`.
- **Game settings as Record in IR:** Flattened from typed ECSON GameSettings to `Record<string, unknown>` for engine-agnostic representation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Canonical IR types exportable: `import { CanonicalScene, compile, decompile, isPortableComponent } from '@riff3d/canonical-ir'`
- Compiler and decompiler proven correct with 8 round-trip scenarios
- Portable subset v0 boundary defined and query-able at runtime
- Ready for conformance test harness (Plan 01-06) to use compile/decompile for adapter testing
- Ready for adapter packages (Phase 2/4) to consume CanonicalScene for rendering
- No blockers for subsequent plans

## Self-Check: PASSED

- All 15 files verified present on disk
- Commit dfca9ca (Task 1) verified in git log
- Commit a064d4f (Task 2) verified in git log
