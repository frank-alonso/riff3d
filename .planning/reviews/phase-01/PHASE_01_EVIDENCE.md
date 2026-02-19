# Phase 1 Evidence

Date: 2026-02-19
Owner: Claude (Driver)
Phase: 01 - Contracts & Testing Spine

## Scope

- **Planned:** Define all core contracts (PatchOps, ECSON, Canonical IR), build golden fixtures (including adversarial), prove round-trip determinism, CI pipeline, fast-check property tests, conformance harness, Rapier evaluation spike
- **Completed:** All planned goals achieved. 6 execution plans (01-01 through 01-06) completed across 5 packages, plus 01-07 (this review).
- **Requirement IDs:** CORE-01 through CORE-10, TEST-01, TEST-02, TEST-03, TEST-05, PORT-02

## Contract Diffs

This is Phase 1 (contracts defined from scratch). No pre-existing contracts to diff against.

- **PatchOps:** 16 op types defined with Zod schemas, discriminated union, origin enum (user/ai/system/replay), format versioning (v1), migration runner
- **ECSON:** 11 schemas (Vec3 through SceneDocument), nanoid IDs, migration infrastructure, helpers
- **Canonical IR:** 6 schema types (CanonicalScene, CanonicalNode, CanonicalComponent, CanonicalAsset, CanonicalWire, CanonicalEnvironment), strict objects, compiler/decompiler
- **Registry:** 17 component definitions (9 core 3D + 8 gameplay stubs) with typed schemas, editor hints, glTF extension allowlist v0
- **Breaking changes:** N/A (first version)

## Tests

### Full Test Suite Results

```
pnpm turbo typecheck lint test
Tasks:    21 successful, 21 total
```

### Per-Package Test Counts

| Package | Test Files | Tests | Status |
|---------|-----------|-------|--------|
| @riff3d/ecson | 6 | 159 | PASS |
| @riff3d/patchops | 4 | 69 | PASS |
| @riff3d/canonical-ir | 4 | 46 | PASS |
| @riff3d/fixtures | 2 | 28 | PASS |
| @riff3d/conformance | 4 | 35 | PASS |
| **Total** | **20** | **337** | **ALL PASS** |

### Test Breakdown by Category

- **Unit tests:** Schema validation (159 ecson + 27 patchops schemas + 24 IR types), engine tests (19 patchops apply + 19 inverse), compiler/decompiler (9+5), registry (87), gltf allowlist (12), ids (11), migrations (17)
- **Integration tests:** Round-trip (10 conformance + 8 canonical-ir), replay (3), builder validation (26), reference equivalence (2)
- **Property-based (fast-check):** 4 properties x 100 iterations each = 400 property test executions (seed=42 for CI reproducibility)
  - Apply-inverse identity
  - Replay determinism
  - Batch equivalence
  - Structural integrity (Zod validates after any op sequence)
- **Performance benchmarks:** 18 benchmark tests (7 compilation + 7 decompilation + 2 op application + 2 budget validation)

### Golden Fixture Coverage

7 golden fixtures (6 clean + 1 adversarial):
1. `transforms-parenting` - 3-level hierarchy with varied transforms
2. `materials-lights` - Shared materials, 3 light types, PBR properties
3. `animation` - Animation component with clips and keyframes
4. `events-triggers` - Event wiring, 3-step chain, gameplay components
5. `character-stub` - Character with physics, checkpoints, platforms
6. `timeline-stub` - Multi-track timeline with 3 entities
7. `adversarial` - 7-level deep hierarchy, unicode names, shared materials, event wire chains, max components, engine tuning, deeply nested properties

### Conformance Output

```
@riff3d/conformance test:
  round-trip.test.ts     (10 tests) 30ms
  replay.test.ts         (3 tests)  12ms
  benchmarks.test.ts     (18 tests) 24ms
  property-tests.test.ts (4 tests)  107ms
  Test Files: 4 passed (4)
  Tests:      35 passed (35)
```

## Performance

### Benchmark Results

All benchmarks pass within 2x CI margin budgets:

| Budget Category | Baseline | CI Budget (2x) | Status |
|----------------|----------|-----------------|--------|
| Compilation (small) | 50ms | 100ms | PASS |
| Compilation (medium) | 200ms | 400ms | PASS |
| Compilation (large) | 1000ms | 2000ms | PASS |
| Decompilation (small) | 50ms | 100ms | PASS |
| Decompilation (medium) | 200ms | 400ms | PASS |
| Decompilation (large) | 1000ms | 2000ms | PASS |
| 100 PatchOps batch | defined | 2x | PASS |

### Regressions

None. This is Phase 1 -- baselines are established, no prior data to regress against.

## Success Criteria Evidence

### Criterion 1: Round-trip ECSON -> IR -> ECSON preserves portable subset

**Status: PASS**

**Evidence:**
- File: `packages/conformance/__tests__/round-trip.test.ts`
- All 7 golden fixtures pass round-trip test: `testRoundTrip(doc)` compiles to IR via `compile()`, decompiles back via `decompile()`, and compares portable subset
- Portable subset comparison strips tags, locked, metadata, component tuning (fields IR doesn't carry)
- Additional coverage in `packages/canonical-ir/__tests__/round-trip.test.ts` (8 tests)

```
round-trip.test.ts (10 tests) -- ALL PASS
  transforms-parenting: ECSON -> IR -> ECSON preserves portable subset
  materials-lights: ECSON -> IR -> ECSON preserves portable subset
  animation: ECSON -> IR -> ECSON preserves portable subset
  events-triggers: ECSON -> IR -> ECSON preserves portable subset
  character-stub: ECSON -> IR -> ECSON preserves portable subset
  timeline-stub: ECSON -> IR -> ECSON preserves portable subset
  adversarial: ECSON -> IR -> ECSON preserves portable subset
  adversarial fixture survives round-trip (empty entities, unicode names, deep hierarchy)
  engine tuning is preserved through round-trip
  all 7 fixtures pass the conformance suite
```

### Criterion 2: PatchOps replay determinism

**Status: PASS**

**Evidence:**
- File: `packages/conformance/__tests__/replay.test.ts`
- Tests: "transforms-parenting fixture: ops applied twice produce identical results", "adversarial fixture: ops applied twice produce identical results", "interleaved ops: create, modify, delete, create again"
- File: `packages/conformance/__tests__/property-tests.test.ts`
- Property: "replaying same ops on fresh docs produces identical results" (100 iterations, seed=42)

```
replay.test.ts (3 tests) -- ALL PASS
property-tests.test.ts: "replaying same ops on fresh docs produces identical results" -- PASS (100 runs)
```

### Criterion 3: Every PatchOp type has documented inverse, apply+inverse = identity

**Status: PASS**

**Evidence:**
- File: `packages/patchops/__tests__/inverse.test.ts` -- 19 tests covering all 16 op types
- File: `packages/conformance/__tests__/property-tests.test.ts` -- "applying ops then their inverses returns to original state" (100 iterations, seed=42)
- All 16 op types: CreateEntity, DeleteEntity, SetProperty, AddChild, RemoveChild, Reparent, AddComponent, RemoveComponent, SetComponentProperty, AddAsset, RemoveAsset, ReplaceAssetRef, AddKeyframe, RemoveKeyframe, SetKeyframeValue, BatchOp

```
inverse.test.ts (19 tests) -- ALL PASS
property-tests.test.ts: "applying ops then their inverses returns to original state" -- PASS (100 runs)
```

### Criterion 4: Component registry with 15+ typed components, schemas, defaults, editor hints

**Status: PASS**

**Evidence:**
- File: `packages/ecson/src/registry/components/index.ts` -- 17 components registered (9 core 3D + 8 gameplay stubs)
- Core 3D: MeshRenderer, Light, Camera, RigidBody, Collider, AudioSource, AudioListener, Animation, Material
- Gameplay stubs: ScoreZone, KillZone, Spawner, TriggerZone, Checkpoint, MovingPlatform, PathFollower, Timer
- File: `packages/ecson/__tests__/registry.test.ts` -- 87 tests verifying schemas, defaults, editor hints, categories, events/actions

```
registry.test.ts (87 tests) -- ALL PASS
17 components > 15 minimum requirement
```

### Criterion 5: Monorepo package structure with correct dependency boundaries

**Status: PASS**

**Evidence:**
- 5 packages: ecson, patchops, canonical-ir, fixtures, conformance
- 1 app: editor
- File: `turbo.json` -- task pipeline with `^build` dependency ordering
- File: `pnpm-workspace.yaml` -- workspace configuration with catalogs
- Dependency direction enforced: ecson -> patchops -> canonical-ir -> fixtures -> conformance
- All 21 turbo tasks (typecheck/lint/test per package + builds) succeed without cross-boundary violations

```
Packages: ecson, patchops, canonical-ir, fixtures, conformance, editor
turbo.json enforces build order via "dependsOn": ["^build"]
pnpm turbo typecheck lint test: 21 tasks successful
```

### Criterion 6: CI pipeline runs typecheck, lint, test on every push

**Status: PASS**

**Evidence:**
- File: `.github/workflows/ci.yml`
- Triggers: push to main, pull_request to main
- Steps: checkout, pnpm setup, Node 22 setup, `pnpm install --frozen-lockfile`, `pnpm turbo typecheck lint test`
- Uses `pnpm/action-setup@v4` and `actions/setup-node@v4`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo typecheck lint test
```

### Criterion 7: fast-check property tests verify PatchOps invariants

**Status: PASS**

**Evidence:**
- File: `packages/conformance/__tests__/property-tests.test.ts`
- 4 properties tested with seed=42, numRuns=100:
  1. Apply-inverse identity: "applying ops then their inverses returns to original state"
  2. Replay determinism: "replaying same ops on fresh docs produces identical results"
  3. Batch equivalence: "applying ops individually equals applying them as a BatchOp"
  4. Structural integrity: "after any valid op sequence, the document is still valid per Zod"
- Model-based op generation tracks which entities exist for valid op sequences

```
property-tests.test.ts (4 tests) -- ALL PASS
FC_PARAMS = { seed: 42, numRuns: 100 }
```

### Criterion 8: PatchOps include origin categories and format version

**Status: PASS**

**Evidence:**
- File: `packages/patchops/src/origin.ts` -- `OriginSchema = z.enum(["user", "ai", "system", "replay"])` with SafeModeConfig
- File: `packages/patchops/src/version.ts` -- `CURRENT_PATCHOP_VERSION = 1`
- File: `packages/patchops/src/base.ts` -- BasePatchOpSchema includes `origin: OriginSchema` and `version: z.number().int().min(1)`
- File: `packages/patchops/__tests__/schemas.test.ts` -- 27 schema tests validate origin and version fields

```typescript
// origin.ts
export const OriginSchema = z.enum(["user", "ai", "system", "replay"]);

// version.ts
export const CURRENT_PATCHOP_VERSION = 1;

// base.ts includes both in every PatchOp schema
```

### Criterion 9: Adversarial golden fixture with deep hierarchies, reparent chains, shared materials, cross-entity event wires, interleaved op logs

**Status: PASS**

**Evidence:**
- File: `packages/fixtures/src/builders/adversarial.ts`
- Features exercised:
  - 7-level deep hierarchy with varied branch widths
  - 3 entities sharing the same material asset (SharedMaterial pattern)
  - 3-step cross-entity event wire chain (TriggerA.onEnter -> TimerB.start -> SpawnerC.spawn -> TriggerA.reset)
  - Empty entities at various levels (must survive round-trip)
  - Unicode entity names: emoji, CJK, RTL text
  - Entity with maximum component count (9 component types on one entity)
  - Engine tuning sections on selected entities (playcanvas + babylon)
  - Deeply nested component properties
  - Non-default game settings (maxPlayers: 16, roundDuration: 300, etc.)
  - Non-default environment (HDRI skybox, exponential fog, custom gravity)
- Interleaved op logs tested in: `packages/conformance/__tests__/replay.test.ts` "interleaved ops: create, modify, delete, create again"

### Criterion 10: Conformance harness MVP with round-trip, replay, benchmarks

**Status: PASS**

**Evidence:**
- File: `packages/conformance/src/harness.ts` -- `runConformanceSuite()` function
- File: `packages/conformance/src/round-trip.ts` -- `testRoundTrip()` with portable subset extraction and sorted-key normalization
- File: `packages/conformance/src/replay.ts` -- `testReplayDeterminism()` and `generateOpsForFixture()`
- File: `packages/conformance/src/benchmarks.ts` -- `benchmarkCompilation()`, `benchmarkDecompilation()`, `benchmarkOpApplication()` with `PERFORMANCE_BUDGETS`
- 35 total conformance tests: 10 round-trip + 3 replay + 18 benchmarks + 4 property tests

### Criterion 11: glTF extension allowlist v0 with fixture coverage

**Status: PASS**

**Evidence:**
- File: `packages/ecson/src/registry/gltf-allowlist.ts`
- 5 extensions defined:
  - `core_gltf_2.0` (portable, covered by: all fixtures)
  - `KHR_lights_punctual` (portable, covered by: materials-lights)
  - `KHR_materials_unlit` (portable, covered by: materials-lights)
  - `KHR_texture_transform` (non-portable, no fixture coverage yet)
  - `KHR_physics_rigid_bodies` (non-portable, no fixture coverage yet)
- 3 portable extensions, 2 non-portable
- File: `packages/ecson/__tests__/gltf-allowlist.test.ts` -- 12 tests

```
gltf-allowlist.test.ts (12 tests) -- ALL PASS
```

### Criterion 12: Rapier.js evaluation spike completed with findings documented

**Status: PASS**

**Evidence:**
- Spike conducted in `/home/frank/rapier-spike/` (isolated from riff3d repo)
- Full findings: `/home/frank/rapier-spike/FINDINGS.md` (57 tests, all passing)
- Summary documented: `.planning/research/RAPIER_SPIKE.md`
- Decision: Use `@dimforge/rapier3d-compat` v0.19.x as web runtime physics adapter
- Key findings: async init(), explicit `.free()`, broadphase lazy until first `world.step()`, plain `{x,y,z}` objects for vectors (zero conversion overhead)
- Performance benchmarks: 1000 bodies single step ~0.3ms, 5000 bodies ~1.3ms

## Risks and Deferrals

### IR Convention Documentation (from FUTURE_ENGINE_CONSIDERATIONS.md)

The following IR conventions are implied but not formally documented in source code comments:
- Right-handed, Y-up coordinate system
- Quaternion (x,y,z,w) ordering
- Physics units (meters for distance, kg for mass)
- Roughness (not smoothness/gloss)
- Normal map convention (OpenGL Y+)
- 1:N entity-to-node mapping documented in adapter contract

**Severity:** S3 Low -- conventions are followed correctly in the implementation, but should be formally documented as code comments and/or conformance tests. This is a carry-forward action for Phase 2 or Phase 3 review gate.

### Lint Warning in PatchOps

One non-blocking lint warning in `packages/patchops/src/engine.ts:518` -- unused eslint-disable directive. Does not affect functionality.

## Decisions Requested

None. All Phase 1 decisions were made during execution and documented in individual plan summaries and STATE.md.
