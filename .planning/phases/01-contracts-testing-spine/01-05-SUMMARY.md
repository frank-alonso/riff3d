---
phase: 01-contracts-testing-spine
plan: 05
subsystem: schemas
tags: [zod, ecson, component-registry, editor-hints, gltf-allowlist, pbr-materials, gameplay-stubs]

# Dependency graph
requires:
  - phase: 01-02
    provides: "ECSON Zod schema suite with Vec3, ComponentInstance, and all core types"
provides:
  - "Component registry with 17 typed component definitions (9 core 3D + 8 gameplay stubs)"
  - "Registry API: getComponentDef, validateComponentProperties, listComponents, listComponentsByCategory"
  - "Editor hints per property for auto-generating inspector panels in Phase 2"
  - "glTF Extension Allowlist v0 with portable/non-portable categorization"
  - "ComponentDefinition interface with type, category, schema, editorHints, events, actions"
affects: [01-06, 01-07, phase-02, phase-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [component-registry-pattern, editor-hints-as-metadata, side-effect-registration, gltf-allowlist]

key-files:
  created:
    - packages/ecson/src/registry/types.ts
    - packages/ecson/src/registry/_store.ts
    - packages/ecson/src/registry/registry.ts
    - packages/ecson/src/registry/index.ts
    - packages/ecson/src/registry/gltf-allowlist.ts
    - packages/ecson/src/registry/components/mesh-renderer.ts
    - packages/ecson/src/registry/components/light.ts
    - packages/ecson/src/registry/components/camera.ts
    - packages/ecson/src/registry/components/rigid-body.ts
    - packages/ecson/src/registry/components/collider.ts
    - packages/ecson/src/registry/components/audio-source.ts
    - packages/ecson/src/registry/components/audio-listener.ts
    - packages/ecson/src/registry/components/animation.ts
    - packages/ecson/src/registry/components/material.ts
    - packages/ecson/src/registry/components/score-zone.ts
    - packages/ecson/src/registry/components/kill-zone.ts
    - packages/ecson/src/registry/components/spawner.ts
    - packages/ecson/src/registry/components/trigger-zone.ts
    - packages/ecson/src/registry/components/checkpoint.ts
    - packages/ecson/src/registry/components/moving-platform.ts
    - packages/ecson/src/registry/components/path-follower.ts
    - packages/ecson/src/registry/components/timer.ts
    - packages/ecson/src/registry/components/index.ts
    - packages/ecson/__tests__/registry.test.ts
    - packages/ecson/__tests__/gltf-allowlist.test.ts
  modified:
    - packages/ecson/src/index.ts

key-decisions:
  - "Editor hints stored as editorHints record on ComponentDefinition rather than Zod .meta() -- Zod 3.25 lacks .meta(), so hints are a separate typed Record<string, EditorHint> per component"
  - "Registry backing store separated into _store.ts module to avoid circular initialization (components import registerComponent from registry, registry imports components for side-effect registration)"
  - "KillZone damage defaults to Infinity for instant kill behavior"
  - "glTF allowlist uses 5 entries: 3 portable (core, lights_punctual, materials_unlit) and 2 non-portable (texture_transform, physics_rigid_bodies)"

patterns-established:
  - "Component registration via side-effect imports: each component file calls registerComponent() at module scope"
  - "Editor hints as typed metadata: EditorHint interface with editorHint type, label, min/max/step/assetType"
  - "Gameplay stubs with events/actions: all gameplay components declare events they emit and actions they receive for wiring"
  - "Singleton flag on ComponentDefinition: controls whether an entity can have multiple instances of a component type"

requirements-completed: [CORE-10]

# Metrics
duration: 7min
completed: 2026-02-19
---

# Phase 1 Plan 5: Component Registry Summary

**17-component registry with Zod-validated schemas, typed editor hints, events/actions, and glTF extension allowlist v0 -- 159 tests passing**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-19T22:05:02Z
- **Completed:** 2026-02-19T22:11:44Z
- **Tasks:** 2
- **Files modified:** 26

## Accomplishments
- Component registry with 17 typed definitions: 9 core 3D (MeshRenderer, Light, Camera, RigidBody, Collider, AudioSource, AudioListener, Animation, Material) + 7 gameplay stubs + 1 logic (Timer)
- Every component has Zod schema with defaults, typed editor hints, singleton flag, category, and description
- Material component covers full PBR portable subset (baseColor, metallic, roughness, emissive, opacity, alphaMode, doubleSided, 5 texture slots)
- glTF Extension Allowlist v0 with 3 portable and 2 non-portable entries, plus lookup/filter API
- Registry API: getComponentDef, validateComponentProperties, listComponents, listComponentsByCategory
- 159 tests across 6 test files, all green; ecson typecheck and lint passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement registry infrastructure and 9 core 3D component definitions** - `3050467` (feat)
2. **Task 2: Add 8 gameplay stub components and publish glTF extension allowlist v0** - `71ae98e` (feat)

## Files Created/Modified
- `packages/ecson/src/registry/types.ts` - ComponentDefinition, EditorHint, ComponentEvent, ComponentAction interfaces
- `packages/ecson/src/registry/_store.ts` - Registry backing Map (separated to avoid circular init)
- `packages/ecson/src/registry/registry.ts` - Registry API (register, get, validate, list, filter)
- `packages/ecson/src/registry/index.ts` - Barrel export for registry module
- `packages/ecson/src/registry/gltf-allowlist.ts` - glTF extension allowlist v0 with portable subset
- `packages/ecson/src/registry/components/mesh-renderer.ts` - MeshRenderer (rendering, singleton)
- `packages/ecson/src/registry/components/light.ts` - Light (rendering, singleton)
- `packages/ecson/src/registry/components/camera.ts` - Camera (rendering, singleton)
- `packages/ecson/src/registry/components/rigid-body.ts` - RigidBody (physics, singleton)
- `packages/ecson/src/registry/components/collider.ts` - Collider (physics, multi-instance)
- `packages/ecson/src/registry/components/audio-source.ts` - AudioSource (audio, multi-instance)
- `packages/ecson/src/registry/components/audio-listener.ts` - AudioListener (audio, singleton)
- `packages/ecson/src/registry/components/animation.ts` - Animation (rendering, multi-instance)
- `packages/ecson/src/registry/components/material.ts` - Material (rendering, multi-instance, full PBR)
- `packages/ecson/src/registry/components/score-zone.ts` - ScoreZone (gameplay)
- `packages/ecson/src/registry/components/kill-zone.ts` - KillZone (gameplay)
- `packages/ecson/src/registry/components/spawner.ts` - Spawner (gameplay)
- `packages/ecson/src/registry/components/trigger-zone.ts` - TriggerZone (gameplay)
- `packages/ecson/src/registry/components/checkpoint.ts` - Checkpoint (gameplay)
- `packages/ecson/src/registry/components/moving-platform.ts` - MovingPlatform (gameplay)
- `packages/ecson/src/registry/components/path-follower.ts` - PathFollower (gameplay)
- `packages/ecson/src/registry/components/timer.ts` - Timer (logic)
- `packages/ecson/src/registry/components/index.ts` - Side-effect imports for all 17 components
- `packages/ecson/src/index.ts` - Updated barrel export with registry and glTF allowlist
- `packages/ecson/__tests__/registry.test.ts` - 87 registry tests (infrastructure, validation, defaults, hints, singleton, events)
- `packages/ecson/__tests__/gltf-allowlist.test.ts` - 12 glTF allowlist tests

## Decisions Made
- **Editor hints as typed record**: Zod 3.25 (installed via `^3.25.0` catalog) does not have the `.meta()` API that the plan referenced. Instead, editor hints are stored as a `Record<string, EditorHint>` on each `ComponentDefinition`, which is actually more practical -- type-safe, easily retrievable by property name, and no string parsing needed.
- **Separate _store.ts module**: ES module imports are hoisted, so the circular dependency between `registry.ts` (exports `registerComponent`) and component files (call `registerComponent`) caused a TDZ error. Extracting the backing Map into `_store.ts` breaks the cycle cleanly.
- **KillZone damage = Infinity**: Default damage of Infinity represents instant kill. Zod handles Infinity numbers correctly.
- **glTF allowlist entries**: 3 portable (core_gltf_2.0, KHR_lights_punctual, KHR_materials_unlit) and 2 non-portable (KHR_texture_transform deferred, KHR_physics_rigid_bodies inspiration-only).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Separated registry backing store to break circular initialization**
- **Found during:** Task 1 (registry infrastructure)
- **Issue:** ES module import hoisting caused `componentRegistry` Map to be accessed before initialization when component files imported `registerComponent` from `registry.ts` and `registry.ts` imported `components/index.ts`
- **Fix:** Extracted the Map into `_store.ts` (no circular imports) and imported it into `registry.ts`
- **Files modified:** packages/ecson/src/registry/_store.ts (new), packages/ecson/src/registry/registry.ts
- **Verification:** All tests pass, no TDZ errors
- **Committed in:** 3050467 (Task 1 commit)

**2. [Rule 3 - Blocking] Used editorHints record instead of Zod .meta()**
- **Found during:** Task 1 (component definitions)
- **Issue:** Zod 3.25 does not have the `.meta()` method referenced in the plan. The `.meta()` API is a Zod v4 feature.
- **Fix:** Defined `EditorHint` interface and `editorHints: Record<string, EditorHint>` on `ComponentDefinition` for typed, easily retrievable editor metadata per property.
- **Files modified:** packages/ecson/src/registry/types.ts, all component definition files
- **Verification:** All editor hint tests pass, hints are accessible by property name
- **Committed in:** 3050467 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary for the module to function. The editorHints approach is actually superior to `.meta()` since it provides typed, property-keyed access without string parsing. No scope creep.

## Issues Encountered
- Pre-existing test failure in `@riff3d/patchops` (engine.test.ts import error) -- unrelated to this plan's changes, likely from an in-progress plan 01-03/01-04. Ecson package passes all checks independently.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Component registry is fully exported from `@riff3d/ecson`: `import { getComponentDef, validateComponentProperties, listComponents } from '@riff3d/ecson'`
- Phase 2 can auto-generate inspector panels by iterating `listComponents()` and reading `editorHints` per property
- Gameplay stubs are expandable in Phase 7 -- schemas can add properties without breaking existing data (Zod defaults handle forward compatibility)
- glTF allowlist informs adapter work -- adapters know which extensions to support for portable subset
- No blockers for subsequent plans

## Self-Check: PASSED

- All 26 files verified present on disk
- Commit 3050467 (Task 1) verified in git log
- Commit 71ae98e (Task 2) verified in git log

---
*Phase: 01-contracts-testing-spine*
*Completed: 2026-02-19*
