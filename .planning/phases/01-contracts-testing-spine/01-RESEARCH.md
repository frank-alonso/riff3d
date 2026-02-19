# Phase 1: Contracts & Testing Spine - Research

**Researched:** 2026-02-19
**Domain:** TypeScript contract-first schema design, monorepo tooling, property-based testing, deterministic document pipelines
**Confidence:** HIGH

## Summary

Phase 1 is a pure TypeScript phase with zero browser dependencies. It establishes the foundational contracts (PatchOps, ECSON, Canonical IR) as Zod schemas, builds a component registry with 15+ typed components, creates golden fixture projects with a builder API, proves round-trip determinism, and sets up CI. The technology stack is well-established and low-risk: Zod 4 for schema validation, Vitest 4 for testing, fast-check for property-based testing, pnpm + Turborepo for monorepo management, and nanoid for ID generation. The Rapier physics evaluation spike is already completed (documented in `.planning/research/RAPIER_SPIKE.md`).

The largest design challenge is not the tooling but the **schema design itself** -- defining the right abstractions for ECSON, Canonical IR, and the portable subset v0 so they support round-trip fidelity without over-specifying engine-specific details. The prototype research documents (FOUNDATION.md, 00-universal-schema-research, 01-canonical-layer-research) provide extensive prior art and concrete type definitions to build from. The key risk is schema design decisions that seem right for Phase 1 but create problems when adapters arrive in Phase 2/4 -- mitigated by the golden fixture conformance approach (schemas are tested against concrete scenarios, not just type-checked).

**Primary recommendation:** Start with the monorepo scaffold and CI pipeline, then build ECSON schemas bottom-up (Vec3 -> Transform -> ComponentInstance -> Entity -> SceneDocument), implement PatchOps as a discriminated union with Zod, compile ECSON to Canonical IR, and validate everything through golden fixtures and fast-check property tests. Do not attempt to design the "perfect" schema -- design for the golden fixture scenarios and let the 2-template promotion rule guide future expansion.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Balanced mix: core 3D basics (mesh, transform, light, camera, materials, animation) plus gameplay stubs (spawner, trigger, score zone, etc.) to prove the schema handles both
- Include audio components (AudioSource, AudioListener) in the initial 15+ palette -- schema only, no runtime yet
- Gameplay stub depth is Claude's discretion -- enough to prove the registry handles them, expanded in Phase 7
- Editor hints baked into schemas from day one (color pickers, sliders, dropdowns, enums) -- Phase 2 reads them directly to auto-generate inspectors
- Mix of product-realistic and capability-focused fixtures across the 5 clean + 1 adversarial
- Adversarial fixture complexity is Claude's discretion
- Both structural-only fixtures (for fast unit tests) and a couple with small test asset references (for integration validation)
- Builder API for all fixtures -- programmatic builders that output ECSON, easier to maintain as schemas evolve
- One hand-authored reference fixture maintained alongside as format documentation, with a test asserting the builder produces identical output
- PBR material depth in portable subset is Claude's discretion
- Unsupported portable features: warn and fallback -- adapter logs a warning but still renders with closest equivalent
- Engine tuning sections can both ADD engine-exclusive properties and OVERRIDE portable values
- Engine tuning properties hidden behind an "Advanced" / "Engine Settings" toggle in the editor UI (portable properties shown by default)
- AI ops are unrestricted by default -- same capabilities as user ops
- Opt-in "safe mode" restricts AI ops to a safe subset (can't delete root entities, can't modify locked objects, etc.)
- Safe mode is a project-level setting (default: off), overridable per session
- Origin categories (user/AI/system/replay) are color-coded in the operation log -- visually distinguishable
- AI op undo: user chooses between batch undo (revert entire AI action in one step) and granular undo (one op at a time)
- Old-format PatchOps auto-migrated on load with a logged warning -- ECSON document is the safety net

### Claude's Discretion
- Gameplay component stub depth (how many properties defined now vs expanded in Phase 7)
- Adversarial fixture complexity level
- PBR material scope in portable subset (baseline vs extended glTF extensions)
- Exact component list beyond the required categories

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CORE-01 | PatchOps spec fully defined -- deterministic, serializable, ordered, scoped to stable IDs, validatable, invertible | Zod discriminated union pattern for op types; nanoid for stable IDs; prototype FOUNDATION.md defines minimum ops; fast-check for invariant verification |
| CORE-02 | Minimum PatchOps set implemented (16 op types) | Prototype universal schema research defines all 16 ops with concrete TypeScript interfaces; Zod v4 discriminated unions support composable member types |
| CORE-03 | ECSON schema defined with schema version, stable IDs, editor sugar that compiles down | Zod v4 schemas as source of truth; prototype 00-universal-schema-research provides complete SceneDocument/Entity/ComponentInstance types; JSON schema versioning patterns researched |
| CORE-04 | ECSON forward migrations implemented with versioning scaffold | Schema version field + migration registry pattern; forward-only migrations with up() functions keyed by version number |
| CORE-05 | Canonical IR spec defined -- minimal, normalized, explicit, round-trip safe for portable subset | Prototype 01-canonical-layer-research provides complete CanonicalScene/CanonicalNode/CanonicalComponent types; glTF-aligned design validated |
| CORE-06 | Canonical IR compiler (ECSON -> Canonical IR) implemented | 7-step compilation pipeline documented in prototype research (validate -> resolve entities -> resolve assets -> compile components -> compile event graph -> compile game rules -> output) |
| CORE-07 | Portable subset v0 defined and implemented | Prototype research section 4.1 maps universal concepts across PlayCanvas/Babylon/Godot/Unity; glTF PBR metallic-roughness as baseline material model |
| CORE-08 | Engine tuning/escape hatch schema defined | User decision: tuning can ADD and OVERRIDE portable values; per-engine sections (`tuning.playcanvas`, `tuning.babylon`); prototype research section 3 defines portability model |
| CORE-09 | Operation IDs + Entity IDs globally unique and stable | nanoid for both op and entity IDs; customAlphabet for URL-safe, compact IDs; IDs embedded in ECSON, never runtime-generated |
| CORE-10 | Component registry with schema-driven property definitions, types, defaults, editor hints | Prototype 00-universal-schema defines PropertySchema with types, constraints, editorHint; Zod v4 .meta() for editor hint metadata; user decision: 15+ components including audio |
| TEST-01 | 5-10 golden fixture projects | Builder API pattern; 5 clean + 1 adversarial; hand-authored reference with builder equivalence test; structural + asset-reference fixtures |
| TEST-02 | Round-trip tests (ECSON -> IR -> ECSON) | Vitest 4 with project-per-package; deterministic JSON comparison with sorted keys; portable subset identity property tested via fast-check |
| TEST-03 | PatchOps replay determinism tests | fast-check model-based testing for op sequences; seed-based reproducibility; snapshot comparison |
| TEST-05 | Performance budgets defined and enforced | Vitest benchmark API; compilation time budgets for fixture projects; memory ceiling via Node.js process metrics |
| PORT-02 | Portable subset round-trips consistently | Defined by intersection of glTF core + KHR_lights_punctual + baseline PBR; tested via golden fixtures |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | ^4.3 (via `zod@3.25+` dual-publish) | Schema validation, type inference, discriminated unions | TypeScript-first, static inference via `z.infer<>`, upgraded discriminatedUnion in v4, first-party JSON Schema export via `z.toJSONSchema()`, `.meta()` for editor hints |
| Vitest | ^4.0 | Unit testing, integration testing, benchmarks | Vite-native, monorepo `projects` support, built-in benchmark API, compatible with fast-check |
| @fast-check/vitest | latest | Property-based testing integration | First-class Vitest integration, controlled randomness with seed reproducibility, model-based testing for PatchOps state machines |
| fast-check | ^4.0 | Property-based testing arbitraries | Mature, TypeScript-native, custom arbitraries for ECSON/PatchOps generation, shrinking for minimal counterexamples |
| pnpm | ^9.5+ | Package manager with workspace support | Strict dependency isolation, workspace:* protocol, catalogs for version alignment, fastest install times |
| Turborepo | latest | Monorepo build orchestration | Task caching (30s builds -> 0.2s cached), dependency-aware pipeline, `^build` for topological ordering, Vercel-maintained |
| nanoid | ^5.0 | Unique ID generation | 21-char URL-safe IDs by default, customAlphabet for shorter IDs, ESM-native, cryptographically secure, 130 bytes |
| TypeScript | ^5.7 | Type system | Strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` for schema correctness |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| deep-equal | ^2.2 | Deep equality comparison | Round-trip test assertions, ECSON comparison after PatchOps replay |
| json-stable-stringify | ^1.1 | Deterministic JSON serialization | Canonical IR output for snapshot comparison, eliminating key-order nondeterminism |
| eslint | ^9.0 | Linting | CI pipeline, code quality enforcement |
| @changesets/cli | latest | Package versioning | Monorepo version management if publishing packages |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nanoid | uuid v4 | uuid is 36 chars, nanoid is 21 chars and URL-safe; nanoid wins for entity IDs that appear in URLs and logs |
| nanoid | cuid2 | cuid2 is collision-resistant and sortable; nanoid is smaller and faster; sortability not needed since ops carry timestamps |
| fast-check | @effect/schema generators | Effect Schema combines validation + generation; heavier dependency, less testing ecosystem integration |
| Vitest | Jest | Jest has slower startup, no native ESM, no Vite integration; Vitest is the standard for new TypeScript projects |
| Turborepo | Nx | Nx is more feature-rich but heavier; Turborepo's simplicity matches our needs; both support caching and task graphs |

**Installation:**
```bash
# Root workspace (devDependencies)
pnpm add -Dw turbo typescript eslint vitest @fast-check/vitest

# packages/ecson
pnpm add --filter @riff3d/ecson zod nanoid

# packages/patchops (depends on ecson)
pnpm add --filter @riff3d/patchops zod nanoid
pnpm add --filter @riff3d/patchops @riff3d/ecson --workspace

# packages/canonical-ir (depends on ecson)
pnpm add --filter @riff3d/canonical-ir zod
pnpm add --filter @riff3d/canonical-ir @riff3d/ecson --workspace

# packages/fixtures (depends on ecson)
pnpm add --filter @riff3d/fixtures @riff3d/ecson --workspace

# packages/conformance (depends on canonical-ir, fixtures)
pnpm add --filter @riff3d/conformance @riff3d/canonical-ir @riff3d/fixtures --workspace

# Testing in each package
pnpm add -Dw vitest @fast-check/vitest fast-check
```

## Architecture Patterns

### Recommended Project Structure
```
riff3d/
├── apps/
│   └── editor/                    # Next.js editor (Phase 2, placeholder now)
│       ├── package.json
│       └── ...
├── packages/
│   ├── ecson/                     # Foundation package, zero internal deps
│   │   ├── src/
│   │   │   ├── schemas/           # Zod schemas (SceneDocument, Entity, etc.)
│   │   │   │   ├── vec3.ts
│   │   │   │   ├── transform.ts
│   │   │   │   ├── component-instance.ts
│   │   │   │   ├── entity.ts
│   │   │   │   ├── asset.ts
│   │   │   │   ├── wiring.ts
│   │   │   │   ├── environment.ts
│   │   │   │   ├── scene-document.ts
│   │   │   │   └── index.ts
│   │   │   ├── registry/          # Component registry + definitions
│   │   │   │   ├── registry.ts
│   │   │   │   ├── components/    # One file per component type
│   │   │   │   │   ├── mesh-renderer.ts
│   │   │   │   │   ├── light.ts
│   │   │   │   │   ├── camera.ts
│   │   │   │   │   ├── rigid-body.ts
│   │   │   │   │   ├── collider.ts
│   │   │   │   │   ├── audio-source.ts
│   │   │   │   │   ├── audio-listener.ts
│   │   │   │   │   ├── animation.ts
│   │   │   │   │   ├── spawner.ts
│   │   │   │   │   ├── trigger-zone.ts
│   │   │   │   │   ├── score-zone.ts
│   │   │   │   │   ├── kill-zone.ts
│   │   │   │   │   ├── checkpoint.ts
│   │   │   │   │   ├── moving-platform.ts
│   │   │   │   │   └── path-follower.ts
│   │   │   │   └── index.ts
│   │   │   ├── migrations/        # Forward migration functions
│   │   │   │   ├── migrate.ts     # Migration runner
│   │   │   │   └── versions/      # Per-version migration files
│   │   │   ├── ids.ts             # nanoid configuration
│   │   │   └── index.ts           # Public API barrel
│   │   ├── __tests__/
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── patchops/                  # Depends on ecson
│   │   ├── src/
│   │   │   ├── ops/               # One file per op type
│   │   │   │   ├── create-entity.ts
│   │   │   │   ├── delete-entity.ts
│   │   │   │   ├── set-property.ts
│   │   │   │   ├── add-child.ts
│   │   │   │   ├── remove-child.ts
│   │   │   │   ├── reparent.ts
│   │   │   │   ├── add-component.ts
│   │   │   │   ├── remove-component.ts
│   │   │   │   ├── set-component-property.ts
│   │   │   │   ├── add-asset.ts
│   │   │   │   ├── remove-asset.ts
│   │   │   │   ├── replace-asset-ref.ts
│   │   │   │   ├── add-keyframe.ts
│   │   │   │   ├── remove-keyframe.ts
│   │   │   │   ├── set-keyframe-value.ts
│   │   │   │   └── batch-op.ts
│   │   │   ├── engine.ts          # applyOp, applyOps, generateInverse
│   │   │   ├── schemas.ts         # Zod schemas for all ops (discriminated union)
│   │   │   ├── origin.ts          # Origin categories + safe mode
│   │   │   ├── version.ts         # Format version field
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── canonical-ir/              # Depends on ecson
│   │   ├── src/
│   │   │   ├── types/             # IR type definitions
│   │   │   ├── compiler.ts        # ECSON -> Canonical IR
│   │   │   ├── decompiler.ts      # Canonical IR -> ECSON (for round-trip)
│   │   │   ├── portable-subset.ts # Portable subset v0 definition
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── fixtures/                  # Depends on ecson
│   │   ├── src/
│   │   │   ├── builders/          # Programmatic fixture builders
│   │   │   │   ├── builder.ts     # Base builder API
│   │   │   │   ├── transforms-parenting.ts
│   │   │   │   ├── materials-lights.ts
│   │   │   │   ├── animation.ts
│   │   │   │   ├── events-triggers.ts
│   │   │   │   ├── character-stub.ts
│   │   │   │   └── adversarial.ts
│   │   │   ├── reference/         # Hand-authored reference fixture
│   │   │   │   └── transforms-parenting.json
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── conformance/               # Depends on canonical-ir, fixtures
│       ├── src/
│       │   ├── harness.ts         # Test runner infrastructure
│       │   ├── round-trip.ts      # ECSON -> IR -> ECSON tests
│       │   ├── replay.ts          # PatchOps replay determinism
│       │   ├── benchmarks.ts      # Performance budget enforcement
│       │   └── index.ts
│       ├── __tests__/
│       ├── vitest.config.ts
│       ├── tsconfig.json
│       └── package.json
├── turbo.json                     # Turborepo task configuration
├── pnpm-workspace.yaml            # Workspace definition
├── vitest.config.ts               # Root Vitest config (projects discovery)
├── tsconfig.base.json             # Shared TypeScript config
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI pipeline
├── package.json                   # Root package.json
└── .planning/                     # Planning documents
```

### Pattern 1: Zod Schemas as Source of Truth with Type Inference
**What:** Define all data types as Zod schemas first, derive TypeScript types with `z.infer<>`.
**When to use:** Every data type in the system -- ECSON documents, PatchOps, Canonical IR nodes, component definitions.
**Example:**
```typescript
// Source: Zod v4 docs (https://zod.dev/v4)
import { z } from 'zod';

// Schema IS the spec
const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

// Type derived from schema -- single source of truth
type Vec3 = z.infer<typeof Vec3Schema>;

// Component property with editor hints via .meta()
const IntensitySchema = z.number()
  .min(0)
  .max(10)
  .default(1)
  .meta({
    editorHint: 'slider',
    label: 'Intensity',
    step: 0.1,
  });
```

### Pattern 2: PatchOps as Discriminated Union
**What:** All PatchOps share a common `type` discriminator field, enabling exhaustive pattern matching and Zod validation.
**When to use:** Defining the PatchOps schema, the apply engine, and inverse generation.
**Example:**
```typescript
// Source: Zod v4 upgraded discriminatedUnion (https://zod.dev/v4)
import { z } from 'zod';

const PatchOpBase = {
  id: z.string(),                  // nanoid operation ID
  timestamp: z.number(),
  origin: z.enum(['user', 'ai', 'system', 'replay']),
  version: z.number().default(1),  // format version
};

const CreateEntityOp = z.object({
  ...PatchOpBase,
  type: z.literal('CreateEntity'),
  payload: z.object({
    entityId: z.string(),
    name: z.string(),
    parentId: z.string().nullable(),
    // ... entity fields
  }),
});

const SetPropertyOp = z.object({
  ...PatchOpBase,
  type: z.literal('SetProperty'),
  payload: z.object({
    entityId: z.string(),
    path: z.string(),         // dot-separated property path
    value: z.unknown(),
    previousValue: z.unknown().optional(), // for inverse
  }),
});

// Full discriminated union
const PatchOpSchema = z.discriminatedUnion('type', [
  CreateEntityOp,
  // DeleteEntityOp,
  SetPropertyOp,
  // ... all 16 op types
]);

type PatchOp = z.infer<typeof PatchOpSchema>;
```

### Pattern 3: Component Registry with Schema-Driven Definitions
**What:** Each component type is registered with a Zod schema that defines its properties, defaults, constraints, and editor hints.
**When to use:** Defining the 15+ component types that form the component palette.
**Example:**
```typescript
import { z } from 'zod';

interface ComponentDefinition<T extends z.ZodType> {
  type: string;
  category: 'rendering' | 'physics' | 'gameplay' | 'audio' | 'logic' | 'settings';
  description: string;
  singleton: boolean;
  schema: T;
  events?: { name: string; label: string }[];
  actions?: { name: string; label: string }[];
}

// Example: Light component definition
const LightPropertiesSchema = z.object({
  lightType: z.enum(['directional', 'point', 'spot', 'hemisphere'])
    .default('point')
    .meta({ editorHint: 'dropdown', label: 'Type' }),
  color: z.string()
    .default('#ffffff')
    .meta({ editorHint: 'color', label: 'Color' }),
  intensity: z.number()
    .min(0).max(100).default(1)
    .meta({ editorHint: 'slider', label: 'Intensity', step: 0.1 }),
  range: z.number()
    .min(0).default(10)
    .meta({ editorHint: 'slider', label: 'Range' }),
  castShadows: z.boolean()
    .default(false)
    .meta({ editorHint: 'checkbox', label: 'Cast Shadows' }),
});

const LightComponent: ComponentDefinition<typeof LightPropertiesSchema> = {
  type: 'Light',
  category: 'rendering',
  description: 'Illuminates the scene',
  singleton: true,
  schema: LightPropertiesSchema,
};

// Registry map
const componentRegistry = new Map<string, ComponentDefinition<z.ZodType>>();
componentRegistry.set('Light', LightComponent);
```

### Pattern 4: Builder API for Golden Fixtures
**What:** Fluent API that programmatically constructs ECSON SceneDocuments, producing valid fixtures without hand-writing JSON.
**When to use:** All golden fixture creation; builder output is the canonical fixture.
**Example:**
```typescript
class SceneBuilder {
  private doc: SceneDocument;

  static create(name: string): SceneBuilder { /* ... */ }

  addEntity(name: string, opts?: Partial<Entity>): EntityBuilder { /* ... */ }
  addAsset(type: AssetType, data: AssetData): string { /* returns asset ID */ }
  setEnvironment(env: Partial<EnvironmentSettings>): this { /* ... */ }
  setGameSettings(settings: Partial<GameSettings>): this { /* ... */ }
  addWire(wire: Omit<EventWire, 'id'>): this { /* ... */ }
  build(): SceneDocument { /* validate with Zod, return */ }
}

class EntityBuilder {
  addComponent(type: string, properties?: Record<string, unknown>): this { /* ... */ }
  addChild(name: string, opts?: Partial<Entity>): EntityBuilder { /* ... */ }
  setTransform(transform: Partial<Transform>): this { /* ... */ }
  setTags(tags: string[]): this { /* ... */ }
}

// Usage in fixture:
const fixture = SceneBuilder.create('Transforms & Parenting')
  .addEntity('Root', { tags: ['root'] })
    .setTransform({ position: { x: 0, y: 0, z: 0 } })
    .addChild('Child A')
      .setTransform({ position: { x: 1, y: 0, z: 0 } })
      .addComponent('MeshRenderer', { primitive: 'box' })
    .addChild('Child B')
      .setTransform({ position: { x: -1, y: 2, z: 0 } })
      .addComponent('MeshRenderer', { primitive: 'sphere' })
  .build();
```

### Pattern 5: fast-check Property Tests for PatchOps Invariants
**What:** Define properties that must hold for ALL possible PatchOp sequences, not just hand-picked examples.
**When to use:** PatchOps apply-inverse identity, replay determinism, batch equivalence, structural integrity.
**Example:**
```typescript
// Source: fast-check docs (https://fast-check.dev/docs/introduction)
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';

// Custom arbitrary for generating valid PatchOps
const patchOpArb = fc.oneof(
  createEntityOpArb,
  setPropertyOpArb,
  addComponentOpArb,
  // ... all op types
);

// Property: Apply op then its inverse returns to original state
test.prop([fc.array(patchOpArb, { minLength: 1, maxLength: 20 })])(
  'apply-inverse identity',
  ([ops]) => {
    const original = createEmptyDocument();
    let doc = structuredClone(original);

    const inverses: PatchOp[] = [];
    for (const op of ops) {
      const inverse = applyOp(doc, op);
      if (inverse) inverses.push(inverse);
    }

    // Apply inverses in reverse order
    for (const inv of inverses.reverse()) {
      applyOp(doc, inv);
    }

    expect(doc).toStrictEqual(original);
  }
);

// Property: Replay determinism
test.prop([fc.array(patchOpArb, { minLength: 1, maxLength: 50 })])(
  'replay determinism',
  ([ops]) => {
    const doc1 = createEmptyDocument();
    const doc2 = createEmptyDocument();

    for (const op of ops) {
      applyOp(doc1, op);
    }
    for (const op of ops) {
      applyOp(doc2, op);
    }

    expect(doc1).toStrictEqual(doc2);
  }
);
```

### Pattern 6: Turborepo Task Pipeline
**What:** Define task dependencies so builds run in correct topological order with caching.
**When to use:** CI pipeline and local development.
**Example:**
```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    }
  }
}
```

### Anti-Patterns to Avoid
- **Circular package dependencies:** Package dependency direction MUST be `ecson -> patchops -> canonical-ir -> adapters -> editor`. Never import from a downstream package.
- **`any` types in schemas:** Every Zod schema field must have explicit types. Use `z.unknown()` with runtime refinement if the type is truly dynamic, not `z.any()`.
- **Implicit defaults:** Canonical IR must be explicit -- no property should have an "assumed" default. If a default exists, it is baked into the value during compilation.
- **Array-index-based references:** All references between entities, assets, and components use string IDs, never array indices. This is critical for deterministic PatchOps.
- **Direct ECSON mutation:** All mutations go through PatchOps. Never `doc.entities[id].name = 'foo'` -- always `applyOp(doc, { type: 'SetProperty', ... })`.
- **Engine-specific types in ECSON/IR:** Never use PlayCanvas/Babylon.js type names (e.g., `pc.LIGHTTYPE_SPOT`). Use engine-agnostic equivalents (`spot`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique IDs | Custom UUID/counter | nanoid with customAlphabet | Collision resistance, URL safety, compact size, proven algorithm |
| Schema validation | Custom validators | Zod v4 schemas | Static type inference, composable, extensible with `.refine()`, `.meta()` for editor hints |
| Property testing | Manual edge-case lists | fast-check arbitraries | Automatic shrinking, seed reproducibility, model-based testing for state machines |
| JSON deterministic serialization | Custom key sorting | json-stable-stringify | Handles nested objects, arrays, special values correctly |
| Deep equality | Custom recursive compare | deep-equal (or Vitest built-in) | Edge cases with dates, regexes, symbols, circular refs |
| Monorepo caching | Custom build cache | Turborepo | Content-hash caching, remote cache support, task graph visualization |
| Monorepo dependency resolution | Manual script ordering | pnpm workspace:* + Turborepo `^build` | Topological sort, version locking, strict isolation |

**Key insight:** Phase 1 is about defining contracts, not building infrastructure. Every tool in this list is a solved problem. Spend design energy on the schemas themselves -- the ECSON structure, the PatchOps semantics, the portable subset boundary -- not on reinventing validation or testing.

## Common Pitfalls

### Pitfall 1: Schema-Type Divergence
**What goes wrong:** Zod schemas and TypeScript types drift apart, causing runtime validation to pass but type-checker to reject (or vice versa).
**Why it happens:** Defining types manually alongside schemas instead of using `z.infer<>`.
**How to avoid:** NEVER write `interface Entity { ... }` and `const EntitySchema = z.object({ ... })` separately. Always: `const EntitySchema = z.object({ ... }); type Entity = z.infer<typeof EntitySchema>;`.
**Warning signs:** `as unknown as Entity` casts, TypeScript errors on validated data.

### Pitfall 2: Non-Deterministic JSON Comparison
**What goes wrong:** Round-trip tests fail intermittently because JSON key ordering is not guaranteed.
**Why it happens:** `JSON.stringify` does not guarantee key order. Different code paths may produce `{a:1, b:2}` vs `{b:2, a:1}`.
**How to avoid:** Use json-stable-stringify for all snapshot comparisons, or normalize ECSON documents before comparison (sort entity keys, sort component keys).
**Warning signs:** Tests that pass locally but fail in CI, tests that fail on first run but pass on retry.

### Pitfall 3: PatchOps Inverse Correctness for Non-Trivial Ops
**What goes wrong:** Inverse of `Reparent` or `BatchOp` doesn't fully restore state because it only reverses the primary operation, not side effects.
**Why it happens:** Reparenting changes parentId AND sibling order. Batch ops may have internal dependencies. The inverse must capture the FULL previous state, not just the primary field.
**How to avoid:** Store complete "before" snapshot in the inverse payload. For BatchOp, generate inverse batch with ops in reverse order. Test every op type with fast-check apply-inverse identity.
**Warning signs:** Undo works for simple edits but breaks for reparent or batch operations.

### Pitfall 4: Circular References in Scene Graph Validation
**What goes wrong:** A reparent PatchOp creates a cycle (A is parent of B, B is parent of A), corrupting the scene graph.
**Why it happens:** Reparent validation doesn't check the full ancestor chain.
**How to avoid:** Before applying Reparent, walk up from the new parent to root and verify the target entity is not an ancestor. Add this as a Zod `.refine()` on the SceneDocument or as a pre-apply validation in the PatchOps engine.
**Warning signs:** Infinite loops during tree traversal, stack overflows in IR compilation.

### Pitfall 5: Over-Specifying the Portable Subset
**What goes wrong:** The portable subset includes too many features, making round-trip tests brittle and adapter implementation burdensome.
**Why it happens:** Trying to be comprehensive rather than minimal. Including features that only one engine supports well.
**How to avoid:** Start with the intersection of what ALL target engines support natively. Follow the 2-template promotion rule: a feature enters the portable subset only when 2+ templates need it. For Phase 1, the portable subset should cover: transforms, parenting, mesh references, baseline PBR (metallic-roughness), directional/point/spot lights, perspective/ortho cameras, basic animation (transform keyframes), and a minimal event model.
**Warning signs:** Adapter LoC exceeding 1500, frequent "not supported" warnings, round-trip tests requiring engine-specific exceptions.

### Pitfall 6: Monorepo Dependency Leaks
**What goes wrong:** Package A accidentally imports from Package B's internals, creating an undeclared dependency that Turborepo cannot track.
**Why it happens:** TypeScript path aliases or barrel exports that expose internal modules.
**How to avoid:** Each package exports ONLY through its `src/index.ts` barrel. Use `exports` field in package.json to restrict entry points. Consider adding eslint-plugin-import rules to catch cross-boundary imports.
**Warning signs:** Build succeeds with Turborepo cache but fails on clean build. Tests pass when run from root but fail when run from individual package.

### Pitfall 7: fast-check Generating Invalid ECSON States
**What goes wrong:** Property tests generate PatchOp sequences that are individually valid but collectively produce an invalid ECSON state (e.g., referencing deleted entities).
**Why it happens:** Arbitraries generate ops independently without considering current document state.
**How to avoid:** Use fast-check's model-based testing (fc.commands) where each command's `canShrinkWithout` and `check` methods verify the op is applicable to the current model state. The model tracks which entities exist, what components they have, etc.
**Warning signs:** Property tests always failing with "entity not found" errors, shrinking producing nonsensical op sequences.

## Code Examples

### Vitest Configuration for a Monorepo Package
```typescript
// packages/ecson/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.d.ts'],
    },
  },
});
```

### Root Vitest Projects Configuration
```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
```

### GitHub Actions CI Pipeline
```yaml
# .github/workflows/ci.yml
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
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo typecheck lint test
```

### Package.json with Workspace Dependencies
```json
// packages/patchops/package.json
{
  "name": "@riff3d/patchops",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    }
  },
  "dependencies": {
    "@riff3d/ecson": "workspace:*",
    "zod": "^3.25.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "vitest": "^4.0.0",
    "@fast-check/vitest": "*",
    "fast-check": "^4.0.0",
    "typescript": "^5.7.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  }
}
```

### nanoid Configuration for Entity/Operation IDs
```typescript
// packages/ecson/src/ids.ts
import { nanoid, customAlphabet } from 'nanoid';

// Entity IDs: 16 chars, URL-safe, no ambiguous chars
const entityAlphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const generateEntityId = customAlphabet(entityAlphabet, 16);

// Operation IDs: 21 chars (default nanoid), max collision resistance
const generateOpId = () => nanoid();

// Asset IDs: prefixed for readability
const generateAssetId = () => `ast_${customAlphabet(entityAlphabet, 12)()}`;

export { generateEntityId, generateOpId, generateAssetId };
```

### ECSON Schema Version and Migration
```typescript
// packages/ecson/src/schemas/scene-document.ts
import { z } from 'zod';

export const CURRENT_SCHEMA_VERSION = 1;

export const SceneDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  schemaVersion: z.number().int().min(1),
  entities: z.record(z.string(), EntitySchema),
  assets: z.record(z.string(), AssetEntrySchema),
  wiring: z.array(EventWireSchema),
  environment: EnvironmentSettingsSchema,
  gameSettings: GameSettingsSchema.optional(),
  metadata: z.record(z.string(), z.unknown()),
});

// packages/ecson/src/migrations/migrate.ts
type Migration = {
  version: number;
  up: (doc: unknown) => unknown;
};

const migrations: Migration[] = [
  // { version: 2, up: (doc) => { /* add new field */ return doc; } },
];

export function migrateDocument(doc: unknown): z.infer<typeof SceneDocumentSchema> {
  let current = doc as { schemaVersion: number };

  for (const migration of migrations) {
    if (current.schemaVersion < migration.version) {
      current = migration.up(current) as { schemaVersion: number };
      current.schemaVersion = migration.version;
      console.warn(`Migrated ECSON document from v${migration.version - 1} to v${migration.version}`);
    }
  }

  return SceneDocumentSchema.parse(current);
}
```

## Component Palette Recommendation (Claude's Discretion)

Based on the user's decision for a balanced mix of core 3D + gameplay stubs + audio, and with 15+ types required:

### Core 3D Components (9 types)
1. **MeshRenderer** -- primitive shapes + asset mesh references, cast/receive shadows
2. **Light** -- directional, point, spot, hemisphere; color, intensity, range, shadows
3. **Camera** -- perspective/orthographic; FOV, near/far, clear color, priority
4. **RigidBody** -- static/dynamic/kinematic; mass, friction, restitution, damping, gravity scale
5. **Collider** -- box/sphere/capsule/cylinder/cone/mesh; offset, isTrigger
6. **AudioSource** -- asset reference, autoPlay, loop, volume, pitch, spatial settings
7. **AudioListener** -- (singleton per scene) active flag only, marks which entity "hears" audio
8. **Animation** -- clip references, default clip, speed, loop; state graph deferred to Phase 7
9. **Material** -- component-level material override (references asset); PBR properties inline as fallback

### Gameplay Stub Components (8 types)
10. **ScoreZone** -- points value, team filter, repeatable flag, cooldown
11. **KillZone** -- instant kill on enter, respawn behavior reference
12. **Spawner** -- entity template reference, spawn interval, max active count
13. **TriggerZone** -- generic trigger with configurable onEnter/onExit events
14. **Checkpoint** -- order index, respawn offset
15. **MovingPlatform** -- axis, distance, speed, easing, pause duration
16. **PathFollower** -- waypoint entity references, speed, loop mode
17. **Timer** -- duration, auto-start, loop, events (onStart, onTick, onComplete)

This gives **17 component types**, exceeding the 15+ requirement. Gameplay stubs define only the properties needed to prove the schema handles them; full runtime behavior is Phase 7.

## PBR Material Scope Recommendation (Claude's Discretion)

**Recommendation: glTF core metallic-roughness as baseline, with one commonly-used extension.**

### Portable Subset v0 Material Properties
- baseColor (RGBA) -- maps to albedo in all engines
- metallic (0-1)
- roughness (0-1)
- emissive (RGB) + emissiveIntensity
- opacity / alphaMode (opaque, mask, blend) + alphaCutoff
- doubleSided
- Texture slots: baseColor, normal, metallicRoughness, emissive, occlusion

This aligns exactly with the glTF 2.0 core PBR metallic-roughness model, which is universally supported by PlayCanvas, Babylon.js, Godot, and Unity. No KHR material extensions (anisotropy, clearcoat, transmission, IOR, specular) in v0 -- they can be added via the 2-template promotion rule when templates need them.

## Adversarial Fixture Recommendation (Claude's Discretion)

**Recommendation: Moderately complex, targeting real bugs, not just depth.**

The adversarial fixture should exercise:
1. **Deep hierarchy** (6+ levels of nesting) with a reparent chain that moves entities between branches
2. **Shared materials** (3+ entities referencing the same material asset; modify the material and verify all references update)
3. **Cross-entity event wires** (entity A's event triggers action on entity B, which triggers entity C -- a 3-step chain)
4. **Interleaved op log** (create entity A, create entity B, add component to A, reparent B under A, modify A's component, delete B -- tests that ops referencing deleted entities are handled)
5. **Circular reparent attempt** (try to parent A under its own descendant -- must be rejected)
6. **Empty entities** (entities with no components, to verify they survive round-trip)
7. **Maximum-length property paths** (deeply nested component properties)
8. **Unicode entity names** (emoji, CJK, RTL characters)

This exercises the most likely real-world bugs without being artificially complex.

## glTF Extension Allowlist v0

Based on research, the initial allowlist for the portable subset:

| Extension | Status | Purpose | Phase 1 Coverage |
|-----------|--------|---------|-----------------|
| Core glTF 2.0 | Ratified | Meshes, materials (metallic-roughness), animations, nodes | Full fixture coverage |
| KHR_lights_punctual | Ratified | Directional, point, spot lights | Fixture: materials-lights |
| KHR_materials_unlit | Ratified | Unlit materials | Fixture: materials-lights (one unlit entity) |
| KHR_texture_transform | Ratified | UV offset/scale/rotation | Schema defined, fixture deferred |
| KHR_physics_rigid_bodies | Draft | Rigid body physics | Schema inspired by, not dependent on (still draft status) |
| KHR_collision_shapes | Draft | Collision shapes | Schema inspired by, not dependent on (still draft status) |

**Approach:** The ECSON/IR schemas are INSPIRED BY glTF extension conventions (naming, structure) but do not DEPEND on them being ratified. If/when they become ratified, the existing schemas should align with minimal changes because we followed their design patterns.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3 `.merge()` for schema extension | Zod v4 `.extend()` or destructuring spread | Zod 4 (mid-2025) | Better TypeScript compilation performance; `.merge()` deprecated |
| Vitest `workspace` file | Vitest `projects` in root config | Vitest 3.2+ / 4.0 | Simpler configuration, inline project definitions |
| pnpm manual version alignment | pnpm catalogs (v9.5+) | pnpm 9.5 (2024) | Define dependency versions once, reuse across workspace |
| jest for testing | vitest | 2023-2025 shift | Native ESM, Vite integration, faster startup, built-in benchmarks |
| JSON Schema for validation | Zod schemas with z.infer | 2022-2025 | Single source of truth for types AND validation |
| uuid v4 for IDs | nanoid | 2020+ | Shorter (21 vs 36 chars), URL-safe, smaller bundle |

**Deprecated/outdated:**
- **Zod v3 `.merge()`**: Use `.extend()` or spread `{ ...BaseSchema.shape, ...ExtSchema.shape }` instead
- **Vitest `vitest.workspace.js`**: Use `projects` in `vitest.config.ts` instead
- **glTF KHR_materials_pbrSpecularGlossiness**: Archived; metallic-roughness is the standard PBR model

## Open Questions

1. **ECSON flat entity map vs nested tree**
   - What we know: The prototype research (00-universal-schema) strongly recommends flat `Record<string, Entity>` with `parentId` references, matching both PlayCanvas and Babylon.js internal formats. This is better for random access, granular deltas, and reparenting.
   - What's unclear: Whether the builder API should expose a nested fluent API (for ergonomics) that internally produces a flat map (for storage). Both approaches are viable.
   - Recommendation: Builder API uses nested fluent API for authoring ergonomics, but `build()` produces a flat entity map. The ECSON format itself is flat.

2. **Canonical IR: arrays vs records for nodes**
   - What we know: Prototype 01-canonical-layer-research uses `nodes: CanonicalNode[]` (flat array, topologically sorted) with `nodeIndex: Record<string, number>` for O(1) lookup. ECSON uses `Record<string, Entity>`.
   - What's unclear: Whether the IR should match ECSON's record format for simpler round-trip, or use the array format for adapter consumption. The decompiler (IR -> ECSON) needs to handle the conversion.
   - Recommendation: Keep IR as topologically sorted array (adapters consume it in order), ECSON as record. The compiler/decompiler handles conversion.

3. **Engine tuning schema: where to place it**
   - What we know: User decided tuning can ADD and OVERRIDE portable values. Tuning is per-engine (`tuning.playcanvas`, `tuning.babylon`).
   - What's unclear: Should tuning live at the entity level, component level, or asset level? Probably all three for different use cases.
   - Recommendation: Tuning sections at both the entity level (for entity-wide engine settings) and the component level (for property overrides). Asset-level tuning deferred until Phase 4 when adapters provide concrete examples.

4. **PatchOp format version: scope and migration**
   - What we know: User decided ops have a format version field and old-format ops auto-migrate on load.
   - What's unclear: Does the version field live on each individual op, or on the op log as a whole? Individual ops are more resilient (can mix versions), but op-log-level is simpler.
   - Recommendation: Version field on each individual op. This supports gradual migration and mixed-version op logs (e.g., replaying old ops in a new version).

## Sources

### Primary (HIGH confidence)
- Zod v4 official docs (https://zod.dev/v4) -- discriminated unions, `.meta()`, `.extend()`, `z.infer<>`, JSON Schema export
- fast-check official docs (https://fast-check.dev/) -- model-based testing, custom arbitraries, Vitest integration
- Vitest docs (https://vitest.dev/) -- workspace/projects configuration, monorepo support
- Turborepo docs (https://turborepo.com/) -- task pipeline, pnpm workspace, caching
- nanoid README (https://github.com/ai/nanoid) -- customAlphabet, ESM import, size/collision analysis
- Riff3D prototype FOUNDATION.md -- authoritative contract definitions
- Riff3D prototype 00-universal-schema-research -- SceneDocument, Entity, Component types
- Riff3D prototype 01-canonical-layer-research -- CanonicalScene, CanonicalNode, compilation pipeline
- Riff3D Rapier spike findings (`.planning/research/RAPIER_SPIKE.md`) -- physics contract surface

### Secondary (MEDIUM confidence)
- glTF 2.0 specification (https://www.khronos.org/gltf/) -- PBR metallic-roughness model, extension registry
- KHR_physics_rigid_bodies PR #2424 (https://github.com/KhronosGroup/glTF/pull/2424) -- physics schema inspiration (draft status)
- pnpm catalogs documentation (https://pnpm.io/catalogs) -- version alignment pattern
- @fast-check/vitest npm package (https://www.npmjs.com/package/@fast-check/vitest) -- integration API

### Tertiary (LOW confidence)
- KHR_interactivity specification (draft, still approaching finalization) -- behavior graph model for future reference
- OMI group extensions (https://github.com/omigroup/gltf-extensions) -- spawn point, physics body patterns for future alignment

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries are established, well-documented, and version-verified via Context7 and official docs
- Architecture: HIGH -- Monorepo structure, schema patterns, and testing approaches are well-established in the TypeScript ecosystem; prototype research provides concrete type definitions
- Pitfalls: HIGH -- Identified from direct prototype experience, fast-check documentation, and Zod migration guides
- Component palette: MEDIUM -- The 17-component list is a recommendation based on prototype analysis; exact gameplay stub properties will be refined during implementation
- glTF alignment: MEDIUM -- glTF core is stable but physics/interactivity extensions are still in draft; our schemas are inspired by but not dependent on them

**Research date:** 2026-02-19
**Valid until:** 2026-04-19 (60 days -- stack is stable, no fast-moving dependencies)
