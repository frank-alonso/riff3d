# Phase 3: Review Gate: Foundation - Research

**Researched:** 2026-02-20
**Domain:** Testing infrastructure, adapter refactoring, performance budgeting, visual regression, drag-preview UX, expanded-scope review
**Confidence:** HIGH

## Summary

Phase 3 is an expanded-scope review gate with significant implementation work: resolving four carry-forward items from Phase 2 (CF-P2-01 through CF-P2-04), adding a drag-preview ghost feature, establishing performance budgets, and conducting the Codex-driven review. The research covers six domains: (1) adapter unit testing strategies for PlayCanvas code that depends on WebGL, (2) adapter package splitting via TypeScript subpath exports, (3) RLS policy integration testing approaches for Supabase, (4) performance budget numbers and measurement methodology, (5) Playwright visual regression testing for WebGL canvases, and (6) drag-preview ghost implementation using PlayCanvas raycasting.

The key technical challenge is testing the PlayCanvas adapter without a WebGL context. The adapter's core modules (scene-builder, component-mappers, environment) call `new pc.Entity()`, `entity.addComponent()`, and `new pc.StandardMaterial()` -- all of which need PlayCanvas constructors that work without a running Application. The recommended approach is Vitest module mocking (`vi.mock`) to create lightweight fakes for `pc.Entity`, `pc.Application`, and related classes, testing that the adapter correctly maps Canonical IR nodes to PlayCanvas API calls without requiring a GPU. For editor interaction modules (gizmo-manager, selection-manager), the same mock approach works since they primarily wire events and call PlayCanvas APIs.

**Primary recommendation:** Split Phase 3 into 5-6 implementation plans (adapter tests, RLS tests, test fixture migration, adapter split + LoC enforcement, drag-preview ghost, performance budgets + visual testing beta) followed by a final review gate plan that runs the Codex expanded-scope audit.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Resolve ALL four carry-forward items (CF-P2-01 through CF-P2-04) in Phase 3 -- none deferred
- CF-P2-01: Full adapter unit test coverage -- core scene builder AND all editor interaction modules (gizmo manager, selection manager, camera controller, grid, GLB loader)
- CF-P2-02: Both test layers -- mocked policy tests for fast local/CI runs, plus real Supabase integration tests as a separate `test:integration` suite
- CF-P2-03: Migrate test document construction to SceneDocumentSchema.parse()
- CF-P2-04: Split adapter into core/editor-tools subpath exports with CI LoC budget enforcement
- Include drag-preview ghost feature (translucent entity follows cursor during asset drag, raycasting against scene geometry with ground plane fallback, snap to surface normals)
- Tiered thresholds: Excellent / Pass / Fail for all metrics where it makes sense
- Excellent tier = WebXR-ready benchmark (72+ FPS target, forward-looking for Phase 10 VR)
- Both per-scene budget (isolates adapter efficiency per golden fixture) AND total editor footprint cap
- Primary integration test strategy: fixture-driven testing (golden fixtures test contracts, round-trips, adapter rendering)
- Secondary: single golden-path E2E smoke test (create -> edit -> save -> reload -> verify)
- E2E runs locally (pre-push script or manual `pnpm test:e2e`) -- cloud CI for browser tests deferred to v2
- Visual baseline testing as beta, non-blocking: Playwright screenshot comparison of golden fixtures rendered in PlayCanvas
  - Opt-in test suite (`pnpm test:visual`), does NOT gate Phase 3 pass/fail
  - Uses Playwright `toHaveScreenshot()` with configurable thresholds
  - Baselines committed to repo initially
  - Requires `__sceneReady` signal in adapter for reliable screenshot timing
- Split into implementation plans first (carry-forwards, tests, drag ghost), then review gate plan
- Codex expanded-scope review with extra scrutiny on PatchOps integrity, adapter boundary, cumulative debt
- Human review: full manual walkthrough checklist with executive summary spot-check

### Claude's Discretion
- Specific performance budget numbers (FPS, load time, memory) within the tiered framework
- Which metrics get three tiers vs simple pass/fail
- Plan count and breakdown for implementation work
- Triage of Codex findings (fix vs defer based on severity and compounding risk)
- Visual baseline threshold values and screenshot timing strategy

### Deferred Ideas (OUT OF SCOPE)
- Cloud CI for E2E and visual regression tests -- v2 (requires paid CI tier for headless browser runners)
- Visual baseline storage migration to git-lfs or separate repo -- revisit if snapshot folder exceeds 10MB
</user_constraints>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^4.0 | Unit/integration testing + mocking | Already used across all packages; `vi.mock` supports class mocking |
| Playwright | ^1.58 | E2E smoke test + visual regression | Listed in project tech stack; `toHaveScreenshot()` built-in |
| PlayCanvas | ~2.16 | 3D engine (adapter target) | Primary adapter engine |
| Zod | ^3.25 | Schema validation | `SceneDocumentSchema.parse()` for CF-P2-03 |
| Supabase JS | ^2.97 | Database client for RLS tests | Already used in editor app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @playwright/test | ^1.58 | Playwright test runner | E2E and visual tests only |
| pixelmatch | (built into Playwright) | Screenshot diff engine | Used by `toHaveScreenshot()` under the hood |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest mocking for PlayCanvas | jsdom + canvas polyfill | Heavier setup, still no real WebGL, fragile |
| Playwright for visual | Storybook Chromatic | SaaS cost, overkill for single-adapter visual validation |
| pgTAP for RLS tests | Supabase JS client tests | pgTAP requires local Supabase CLI; JS client tests are more portable but less precise |

**Installation:**
```bash
pnpm add -D @playwright/test --filter @riff3d/editor
npx playwright install chromium
```

## Architecture Patterns

### Pattern 1: Adapter Unit Testing via Module Mocking

**What:** Mock the `playcanvas` module entirely in Vitest to test adapter logic without WebGL/GPU. Each PlayCanvas class (Entity, Application, StandardMaterial, etc.) is replaced with a lightweight fake that records calls.

**When to use:** All adapter unit tests -- both core (scene-builder, component-mappers, environment) and editor tools (gizmo-manager, selection-manager, camera-controller, grid, glb-loader).

**Confidence:** HIGH -- Verified via Vitest docs on class mocking.

**Example:**
```typescript
// Source: Vitest docs - Mocking Classes
// https://github.com/vitest-dev/vitest/blob/main/docs/guide/mocking/classes.md

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CanonicalScene } from "@riff3d/canonical-ir";

// Mock the entire playcanvas module
vi.mock("playcanvas", () => {
  // Fake Entity class that records method calls
  const Entity = vi.fn(function (this: Record<string, unknown>, name?: string) {
    this.name = name ?? "";
    this.enabled = true;
    this.children = [];
    this.parent = null;
  });
  Entity.prototype.setLocalPosition = vi.fn();
  Entity.prototype.setLocalRotation = vi.fn();
  Entity.prototype.setLocalScale = vi.fn();
  Entity.prototype.addChild = vi.fn();
  Entity.prototype.addComponent = vi.fn();
  Entity.prototype.destroy = vi.fn();

  const Application = vi.fn();
  Application.prototype.root = new Entity("Root");
  Application.prototype.root.addChild = vi.fn();

  const StandardMaterial = vi.fn();
  StandardMaterial.prototype.update = vi.fn();

  return {
    Entity,
    Application,
    StandardMaterial,
    Color: vi.fn().mockImplementation((r, g, b) => ({ r, g, b })),
    Vec3: vi.fn().mockImplementation((x, y, z) => ({ x, y, z })),
    Quat: vi.fn().mockImplementation((x, y, z, w) => ({ x, y, z, w })),
    // ... other constants/enums as needed
    FILLMODE_NONE: "FILLMODE_NONE",
    RESOLUTION_AUTO: "RESOLUTION_AUTO",
  };
});

import { buildScene } from "../src/scene-builder";

describe("buildScene", () => {
  it("creates entities for each IR node with correct transforms", () => {
    const mockApp = new (await import("playcanvas")).Application();
    const scene: CanonicalScene = {
      nodes: [{
        id: "node_001",
        name: "TestCube",
        parentId: null,
        visible: true,
        transform: {
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        components: [],
      }],
      environment: { /* ... */ },
      assets: [],
      gameSettings: {},
    };

    const result = buildScene(mockApp, scene);
    expect(result.entityMap.size).toBe(1);
    // Verify PlayCanvas API was called correctly
  });
});
```

**Key testing areas for each module:**

| Module | LoC | Key Test Targets |
|--------|-----|-----------------|
| scene-builder.ts | 124 | Node-to-entity mapping, BFS parent ordering, transform application, visibility |
| component-mappers/* | 363 | MeshRenderer shapes, Light types/colors, Camera projection, Material PBR properties |
| environment.ts | 82 | Skybox color, fog params, ambient light, gravity |
| adapter.ts | 266 | Initialize/dispose lifecycle, loadScene/rebuildScene, play mode toggle, entity map management |
| gizmo-manager.ts | 372 | Gizmo mode switching, drag start/end PatchOp dispatch, entity attachment |
| selection-manager.ts | 483 | Click picking, shift-click toggle, box select, entity map updates |
| camera-controller.ts | 337 | Fly/orbit mode switching, input handling |
| grid.ts | 148 | Grid line creation, size updates, dispose cleanup |
| glb-loader.ts | 210 | Hierarchy walking, material extraction, entity conversion |

### Pattern 2: TypeScript Subpath Exports for Adapter Split (CF-P2-04)

**What:** Use `package.json` `exports` field to create two entry points: `@riff3d/adapter-playcanvas` (core) and `@riff3d/adapter-playcanvas/editor-tools` (interaction modules).

**When to use:** CF-P2-04 carry-forward resolution. Also sets the pattern for the Babylon.js adapter in Phase 4.

**Confidence:** HIGH -- TypeScript 5+ with `moduleResolution: "bundler"` fully supports subpath exports.

**Example:**
```jsonc
// package.json exports field
{
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    },
    "./editor-tools": {
      "types": "./src/editor-tools/index.ts",
      "import": "./src/editor-tools/index.ts"
    }
  }
}
```

**File reorganization:**
```
packages/adapter-playcanvas/src/
├── index.ts                  # Core exports only (adapter, scene-builder, mappers, environment)
├── adapter.ts                # PlayCanvasAdapter class
├── scene-builder.ts          # buildScene, destroySceneEntities
├── environment.ts            # applyEnvironment, getSkyboxColor
├── types.ts                  # EngineAdapter interface
├── component-mappers/
│   ├── index.ts
│   ├── camera.ts
│   ├── light.ts
│   ├── material.ts
│   └── mesh-renderer.ts
└── editor-tools/
    ├── index.ts              # Editor tools exports
    ├── gizmo-manager.ts
    ├── selection-manager.ts
    ├── camera-controller.ts
    ├── grid.ts
    └── glb-loader.ts
```

**CI LoC budget enforcement:**
```bash
# Script to count core adapter LoC and fail if over budget
CORE_LOC=$(wc -l packages/adapter-playcanvas/src/adapter.ts \
  packages/adapter-playcanvas/src/scene-builder.ts \
  packages/adapter-playcanvas/src/environment.ts \
  packages/adapter-playcanvas/src/types.ts \
  packages/adapter-playcanvas/src/index.ts \
  packages/adapter-playcanvas/src/component-mappers/*.ts \
  | tail -1 | awk '{print $1}')
if [ "$CORE_LOC" -gt 1500 ]; then
  echo "FAIL: Adapter core is ${CORE_LOC} LoC (budget: 1500)"
  exit 1
fi
```

This can be added as a Turbo task or CI step.

### Pattern 3: RLS Policy Testing (CF-P2-02)

**What:** Two test layers as required by locked decisions -- (a) mocked policy tests that verify SQL logic without a running Supabase instance, and (b) real integration tests against a live Supabase project.

**When to use:** CF-P2-02 resolution. Both layers are required per locked decisions.

**Confidence:** MEDIUM -- Mocked policy tests need custom SQL evaluation or role-switching approach; integration tests straightforward with `@supabase/supabase-js`.

**Layer 1: Mocked policy tests (fast, runs in CI)**

Approach: Use Vitest with SQL template assertions. These tests verify the RLS policy SQL logic patterns rather than executing actual queries. They test that the migration file contains the expected policy definitions and that the policy logic is structurally correct.

```typescript
// Verify policy structure by reading the migration SQL
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const migrationSql = readFileSync(
  "apps/editor/supabase/migration-001-projects.sql",
  "utf8"
);

describe("RLS policies (structural)", () => {
  it("enables RLS on projects table", () => {
    expect(migrationSql).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("has owner read policy using auth.uid()", () => {
    expect(migrationSql).toMatch(/FOR SELECT.*USING.*auth\.uid\(\)\s*=\s*owner_id/s);
  });

  it("has owner insert policy with auth.uid() check", () => {
    expect(migrationSql).toMatch(/FOR INSERT.*WITH CHECK.*auth\.uid\(\)\s*=\s*owner_id/s);
  });

  it("has public read policy using is_public", () => {
    expect(migrationSql).toMatch(/FOR SELECT.*USING.*is_public\s*=\s*true/s);
  });

  it("has no policy granting non-owner UPDATE", () => {
    // Only one UPDATE policy should exist, and it must check owner_id
    const updatePolicies = migrationSql.match(/FOR UPDATE/g);
    expect(updatePolicies?.length).toBe(1);
    expect(migrationSql).toMatch(/FOR UPDATE.*USING.*auth\.uid\(\)\s*=\s*owner_id/s);
  });
});
```

**Layer 2: Integration tests against live Supabase (runs separately via `pnpm test:integration`)**

```typescript
// Uses @supabase/supabase-js with different auth contexts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

describe("RLS integration", () => {
  it("owner can read own project", async () => {
    // Sign in as owner, query project, expect success
  });

  it("non-owner cannot update another's project", async () => {
    // Sign in as non-owner, attempt update, expect 0 rows affected
  });

  it("anonymous can read public project", async () => {
    // No auth, query public project, expect success
  });
});
```

### Pattern 4: Drag-Preview Ghost Entity

**What:** When dragging an asset from the asset browser to the viewport, a translucent entity follows the cursor using raycasting against scene geometry with ground plane fallback and surface normal snapping.

**When to use:** New feature for Phase 3 (from pending todos).

**Confidence:** HIGH -- PlayCanvas raycasting API is well-documented; ghost entity is standard editor pattern.

**Implementation approach:**

1. **HTML5 drag events** already set `dataTransfer` with `ASSET_DRAG_MIME` in `asset-card.tsx`.
2. **Viewport `onDragOver`** handler converts mouse screen coordinates to a 3D ray using `camera.screenToWorld()`.
3. **Raycast** against scene geometry using PlayCanvas physics raycasting (`app.systems.rigidbody.raycastFirst`). If no physics bodies exist, fall back to mathematical ground plane intersection (Y=0 plane).
4. **Ghost entity** is created on drag enter, updated on drag over, destroyed on drag leave. Uses `opacity: 0.5` on material and `entity.enabled` toggle.
5. **Surface normal snap**: When raycasting hits geometry, align ghost entity's up vector with the hit normal (useful for placing objects on walls/slopes).
6. **Drop**: Replace ghost with real entity via CreateEntity + AddComponent PatchOps at the ghost's final position.

**PlayCanvas raycasting API (from Context7):**
```typescript
// Screen to world ray
const nearPoint = camera.camera.screenToWorld(screenX, screenY, camera.camera.nearClip);
const farPoint = camera.camera.screenToWorld(screenX, screenY, camera.camera.farClip);

// Physics raycast
const result = app.systems.rigidbody.raycastFirst(nearPoint, farPoint);
if (result) {
  ghostEntity.setPosition(result.point.x, result.point.y, result.point.z);
  // Optional: align to surface normal
}

// Ground plane fallback (Y=0 mathematical intersection)
const direction = new pc.Vec3().sub2(farPoint, nearPoint).normalize();
if (direction.y !== 0) {
  const t = -nearPoint.y / direction.y;
  const groundPoint = new pc.Vec3(
    nearPoint.x + direction.x * t,
    0,
    nearPoint.z + direction.z * t
  );
  ghostEntity.setPosition(groundPoint.x, groundPoint.y, groundPoint.z);
}
```

**Note on physics availability:** Phase 2 does not include physics (Rapier integration is Phase 7). The ground plane fallback will be the primary raycasting method until then. A simpler camera-based approach (project mouse onto Y=0 plane) is sufficient for Phase 3. Physics-based raycasting against arbitrary geometry can be added when Rapier is integrated.

### Pattern 5: Visual Regression Testing (Beta)

**What:** Playwright screenshots of golden fixtures rendered in PlayCanvas, compared against baselines.

**When to use:** Non-blocking beta test suite (`pnpm test:visual`). Does NOT gate Phase 3 pass/fail.

**Confidence:** MEDIUM -- WebGL screenshot determinism across environments is a known challenge. Anti-aliasing, driver differences, and GPU vendor variations can cause flaky tests. Mitigated by generous thresholds and single-environment baselines.

**Playwright configuration:**
```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3000",
    browserName: "chromium",
    // Force consistent viewport for screenshots
    viewport: { width: 1280, height: 720 },
    // Disable animations for deterministic screenshots
    screenshot: "off",
  },
  // Visual tests project
  projects: [
    {
      name: "visual",
      testMatch: /.*\.visual\.ts/,
    },
    {
      name: "e2e",
      testMatch: /.*\.e2e\.ts/,
    },
  ],
  expect: {
    toHaveScreenshot: {
      // Generous threshold for WebGL content
      maxDiffPixelRatio: 0.02, // 2% pixel difference allowed
      threshold: 0.3, // Color difference threshold (0=strict, 1=lax)
    },
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

**`__sceneReady` signal for reliable screenshot timing:**

The adapter must emit a signal when the scene is fully rendered so Playwright knows when to capture. Approach: dispatch a custom DOM event from the viewport component after `loadScene()` completes and one frame has been rendered.

```typescript
// In adapter.ts or viewport-canvas.tsx
// After loadScene completes:
requestAnimationFrame(() => {
  window.dispatchEvent(new CustomEvent("__sceneReady"));
});

// In Playwright test:
await page.waitForEvent("__sceneReady");
// or use evaluate:
await page.evaluate(() => {
  return new Promise<void>((resolve) => {
    window.addEventListener("__sceneReady", () => resolve(), { once: true });
  });
});
```

**Screenshot thresholds (Claude's discretion recommendation):**

| Threshold | Value | Use Case |
|-----------|-------|----------|
| `maxDiffPixelRatio` | 0.02 (2%) | Catches layout/geometry changes, tolerates anti-aliasing |
| `threshold` (color) | 0.3 | Tolerates minor color shifts from GPU/driver differences |

These are intentionally generous for beta. Tighten in Phase 4 when dual-adapter comparison is the primary use case.

### Anti-Patterns to Avoid

- **Testing PlayCanvas with real WebGL in unit tests:** Requires GPU, headless Chrome, and is slow and flaky. Use Vitest mocking instead for unit tests. Save real rendering tests for Playwright visual regression.
- **Tight visual regression thresholds on WebGL:** GPU driver differences, anti-aliasing modes, and window manager rendering cause pixel-level differences. Start generous, tighten iteratively.
- **Inlining RLS test fixtures with hardcoded UUIDs:** Use the Supabase client library to create/clean up test data. Hardcoded IDs break when the database is reset.
- **Running E2E tests in CI on free tier:** Headless Chrome requires non-trivial CI resources. Run locally per locked decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Screenshot diffing | Custom pixel comparison | Playwright `toHaveScreenshot()` | Uses pixelmatch, handles retries, generates diff images, battle-tested |
| TypeScript subpath exports | Custom import rewriting | `package.json` `exports` field | Native Node.js + TypeScript 5+ support, no build step |
| LoC counting | Custom AST parser | `wc -l` + shell script | Simple, deterministic, no dependencies |
| Policy SQL verification | Custom SQL parser | Regex matching on migration file | Migration SQL is stable, structured, not dynamically generated |

**Key insight:** Phase 3 implementation work is primarily about reorganization (adapter split), test coverage (adapter tests, RLS tests, fixture migration), and infrastructure (Playwright setup, performance budgets). There are no new libraries to evaluate -- the stack is established from Phases 1-2.

## Common Pitfalls

### Pitfall 1: PlayCanvas Mock Fidelity
**What goes wrong:** Mocks don't accurately represent PlayCanvas behavior (e.g., `addComponent` returns component data, `destroy` cleans up references). Tests pass but miss real bugs.
**Why it happens:** PlayCanvas has complex internal state management with side effects on component addition.
**How to avoid:** Focus mock assertions on "was the right API called with the right arguments?" rather than simulating PlayCanvas internals. Integration correctness is validated by Playwright visual tests and the E2E smoke test.
**Warning signs:** Tests that assert on mock return values rather than on how the adapter calls the mocks.

### Pitfall 2: WebGL Screenshot Non-Determinism
**What goes wrong:** Visual regression tests fail inconsistently because WebGL rendering varies by GPU, driver, and compositor.
**Why it happens:** Anti-aliasing, floating-point precision, and GPU scheduling are not pixel-deterministic across environments.
**How to avoid:** Use generous thresholds (2% maxDiffPixelRatio), generate baselines on the same machine that runs tests, and make the test suite non-blocking (beta status).
**Warning signs:** Tests that pass locally but fail on another developer's machine.

### Pitfall 3: Supabase RLS Test Isolation
**What goes wrong:** Integration tests create data but don't clean up, causing test pollution or auth state leaking between tests.
**Why it happens:** Supabase auth state persists in the client. Test-created rows stay in the database.
**How to avoid:** Use `beforeEach`/`afterEach` to create/delete test users and test data. Use unique project names with test prefixes. Consider a separate Supabase project for integration tests.
**Warning signs:** Tests that pass individually but fail when run in sequence.

### Pitfall 4: Adapter Split Breaking Imports
**What goes wrong:** Moving files from `src/` to `src/editor-tools/` breaks existing imports in `apps/editor`.
**Why it happens:** The editor imports directly from `@riff3d/adapter-playcanvas` which re-exports everything from `src/index.ts`.
**How to avoid:** Update `src/index.ts` (main export) to NOT re-export editor tools. Create `src/editor-tools/index.ts` with the moved exports. Update all editor app imports to use `@riff3d/adapter-playcanvas/editor-tools`.
**Warning signs:** TypeScript errors in `apps/editor` after the split. Run `pnpm typecheck` across the entire monorepo to catch all broken imports.

### Pitfall 5: Performance Budget Flakiness in CI
**What goes wrong:** FPS and timing measurements vary widely depending on CI runner load, leading to flaky performance tests.
**Why it happens:** CI environments have shared resources and no GPU. FPS measurements are meaningless without a GPU.
**How to avoid:** Runtime performance budgets (FPS, memory, load time) are measured locally only. CI-measurable budgets (compilation time, PatchOp application time) use the existing 2x margin approach. Clearly separate "CI-enforceable" from "local-only" performance metrics.
**Warning signs:** FPS-based tests added to the CI pipeline.

## Performance Budget Recommendations (Claude's Discretion)

### Tiered Budget Structure

**Three tiers for measurable metrics:**

| Metric | Excellent (WebXR-Ready) | Pass | Fail |
|--------|------------------------|------|------|
| FPS (editing idle, ~20 entities) | >= 72 | >= 45 | < 30 |
| FPS (editing idle, ~100 entities) | >= 60 | >= 30 | < 20 |
| Scene load time (golden fixture, small) | < 100ms | < 500ms | >= 1000ms |
| Scene load time (golden fixture, adversarial) | < 300ms | < 1000ms | >= 3000ms |
| Editor total memory (heap) | < 100MB | < 200MB | >= 400MB |
| IR compilation time (small fixture) | < 25ms | < 50ms | >= 100ms |
| IR compilation time (large fixture) | < 250ms | < 1000ms | >= 2000ms |

**Simple pass/fail for less variable metrics:**

| Metric | Pass | Fail |
|--------|------|------|
| PatchOp single apply | < 1ms | >= 5ms |
| PatchOp batch of 100 | < 50ms | >= 200ms |
| Scene rebuild (full, ~20 entities) | < 100ms | >= 500ms |
| ECSON round-trip loss (portable subset) | 0% | > 0% |

**Rationale for numbers:**
- **72 FPS Excellent** matches Quest 2/3 native refresh rate (72 Hz) -- the WebXR target for Phase 10. If the desktop editor hits 72 FPS at 20 entities, there's headroom for VR overhead.
- **45 FPS Pass** is industry-standard for smooth desktop editing. Below 30 FPS is noticeably laggy for mouse-driven interaction.
- **100 entities at 60 FPS Excellent** is ambitious but realistic for PlayCanvas with simple geometry. The Phase 6 gate requires 100+ entities during collaboration.
- **Memory < 100MB Excellent** leaves headroom for collaboration (Yjs state) and the second adapter.
- **IR compilation budgets** refine the existing Phase 1 budgets with a three-tier structure.

**Measurement approach:**
- FPS: Measured via `requestAnimationFrame` timing in the viewport component. Not CI-enforceable.
- Scene load time: `performance.now()` around `adapter.loadScene()` call. Can run in Playwright.
- Memory: `performance.memory.usedJSHeapSize` in Chrome. Playwright can measure this.
- IR compilation: Existing conformance benchmarks (already in CI).
- PatchOp timing: Existing conformance benchmarks (already in CI).

### Per-Scene vs Total Budgets

**Per-scene budget:** Each golden fixture is measured independently. This isolates adapter efficiency from editor overhead.

**Total editor footprint cap:** Measured with the full editor running (all panels, viewport, store). This catches memory leaks, excessive re-renders, and store bloat.

Both measured via Playwright navigating to the editor with a specific fixture loaded.

## Code Examples

### Scene-Ready Signal for Visual Testing
```typescript
// Source: Custom pattern for adapter visual testing
// Added to PlayCanvasAdapter.loadScene()

loadScene(scene: CanonicalScene): void {
  if (!this.app) return;
  this.currentScene = scene;
  const result = buildScene(this.app, scene);
  this.entityMap = result.entityMap;
  applyEnvironment(this.app, scene.environment);
  if (this.editorCamera?.camera) {
    this.editorCamera.camera.clearColor = getSkyboxColor(scene.environment);
  }

  // Signal that the scene is ready for screenshot capture
  // Wait one frame for rendering to complete
  this.app.once("frameend", () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("__sceneReady"));
    }
  });
}
```

### Test Doc Migration (CF-P2-03)
```typescript
// Before (raw object, can drift from schema):
function createTestDoc(): SceneDocument {
  return {
    id: "doc_001",
    name: "Test Scene",
    schemaVersion: 1,
    rootEntityId: "root_001",
    entities: { /* ... */ },
    environment: {
      fog: { type: "none" }, // BUG: "none" is not in FogTypeEnum
    },
  };
}

// After (schema-validated, defaults applied correctly):
import { SceneDocumentSchema, CURRENT_SCHEMA_VERSION } from "@riff3d/ecson";

function createTestDoc(): SceneDocument {
  return SceneDocumentSchema.parse({
    id: "doc_001",
    name: "Test Scene",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rootEntityId: "root_001",
    entities: {
      root_001: {
        id: "root_001",
        name: "Root",
        parentId: null,
        children: [],
        components: [],
        tags: [],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
      },
    },
    // environment, assets, wiring, metadata all get schema defaults
  });
}
```

### LoC Budget CI Script
```bash
#!/usr/bin/env bash
# scripts/check-adapter-loc.sh
set -euo pipefail

BUDGET=1500
CORE_FILES=(
  packages/adapter-playcanvas/src/adapter.ts
  packages/adapter-playcanvas/src/scene-builder.ts
  packages/adapter-playcanvas/src/environment.ts
  packages/adapter-playcanvas/src/types.ts
  packages/adapter-playcanvas/src/index.ts
)

# Include all component mapper files
for f in packages/adapter-playcanvas/src/component-mappers/*.ts; do
  CORE_FILES+=("$f")
done

TOTAL=$(wc -l "${CORE_FILES[@]}" | tail -1 | awk '{print $1}')

echo "Adapter core LoC: $TOTAL / $BUDGET"

if [ "$TOTAL" -gt "$BUDGET" ]; then
  echo "FAIL: Core adapter exceeds LoC budget ($TOTAL > $BUDGET)"
  exit 1
else
  echo "PASS: Core adapter within LoC budget"
fi
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `passWithNoTests: true` in adapter | Full adapter unit test coverage via mocks | Phase 3 (now) | Removes rendering correctness gap |
| Single adapter export | Subpath exports (core + editor-tools) | Phase 3 (now) | Enables LoC budget enforcement |
| Raw test doc construction | `SceneDocumentSchema.parse()` | Phase 3 (now) | Prevents schema drift in tests |
| Manual RLS verification | Automated policy tests (mocked + integration) | Phase 3 (now) | Catches RLS regressions |
| No visual regression | Playwright screenshot beta | Phase 3 (now) | Foundation for Phase 4 dual-adapter comparison |

**Deprecated/outdated:**
- `fog: { type: "none" }` in test docs: Replaced by `fog: { enabled: false }` with `FogSchema.default({})` defaults. The `FogTypeEnum` only includes `"linear"`, `"exponential"`, `"exponential2"`.

## Open Questions

1. **Ground plane raycasting without physics**
   - What we know: Phase 2 has no Rapier/ammo.js physics. PlayCanvas `app.systems.rigidbody.raycastFirst` requires physics components on scene entities.
   - What's unclear: Whether the mathematical Y=0 plane intersection is sufficient for all drag-preview use cases, or if we need a physics-less scene query.
   - Recommendation: Use mathematical ground plane intersection (Y=0) as the primary raycasting method. No physics engine dependency in Phase 3. Physics-based raycasting will be natural to add in Phase 7 when Rapier is integrated.

2. **Playwright browser installation in CI**
   - What we know: E2E and visual tests run locally only (locked decision). CI only runs headless Vitest tests.
   - What's unclear: Whether `npx playwright install chromium` should be a devDependency postinstall or a manual setup step.
   - Recommendation: Add `@playwright/test` as a devDependency on the editor app and document `npx playwright install chromium` as a one-time setup step. Do NOT add it to postinstall (would slow down every `pnpm install`).

3. **Supabase integration test environment**
   - What we know: Integration tests need a live Supabase instance with the projects table and RLS policies.
   - What's unclear: Whether to use the production Supabase project with test prefix data, or a separate test project.
   - Recommendation: Use the existing Supabase project with a dedicated test user and `test_` prefixed project names. Clean up after each test run. Document the test setup in a `TESTING.md`. A dedicated test project would be better but adds infra complexity.

## Recommended Plan Structure

Based on the research, the following plan breakdown is recommended (Claude's discretion):

| Plan | Title | Focus | Complexity |
|------|-------|-------|------------|
| 03-01 | Adapter unit tests + remove passWithNoTests | CF-P2-01: Mock PlayCanvas, test all adapter modules | High (largest test surface) |
| 03-02 | Test fixture migration + schema validation | CF-P2-03: Migrate createTestDoc to SceneDocumentSchema.parse() across all test files | Low-Medium |
| 03-03 | Adapter split + CI LoC enforcement | CF-P2-04: Subpath exports, file moves, import updates, CI script | Medium |
| 03-04 | RLS policy tests (mocked + integration) | CF-P2-02: Both test layers for Supabase RLS policies | Medium |
| 03-05 | Drag-preview ghost + performance budgets | New feature + tiered budgets + Playwright setup | High (new feature + infrastructure) |
| 03-06 | E2E smoke test + visual baseline beta | Golden-path E2E, Playwright visual screenshots | Medium |
| 03-07 | Review gate: expanded-scope Codex audit | Evidence packet, Codex review loop, manual checklist | Medium (review process) |

This gives 7 plans: 6 implementation + 1 review gate. Plans 03-01 through 03-04 resolve carry-forwards. Plan 03-05 adds the new feature and performance infrastructure. Plan 03-06 adds E2E and visual testing. Plan 03-07 runs the expanded-scope review.

Alternative: Merge 03-02 and 03-04 into a single "test infrastructure cleanup" plan (would give 6 plans). However, they touch different areas (test files vs adapter structure) so keeping them separate is cleaner.

## Sources

### Primary (HIGH confidence)
- Vitest docs: Class mocking with `vi.mock` -- https://github.com/vitest-dev/vitest/blob/main/docs/guide/mocking/classes.md
- Playwright docs: `toHaveScreenshot()` API -- https://playwright.dev/docs/test-snapshots
- Playwright docs: `maxDiffPixelRatio`, `threshold` options -- https://playwright.dev/docs/api/class-pageassertions
- PlayCanvas engine docs: Entity, CameraComponent, raycasting -- Context7 `/playcanvas/engine`
- TypeScript docs: Module resolution with `exports` -- https://www.typescriptlang.org/docs/handbook/modules/reference.html
- Supabase docs: RLS testing with pgTAP -- https://supabase.com/docs/guides/database/testing

### Secondary (MEDIUM confidence)
- Guide to package.json exports field -- https://hirok.io/posts/package-json-exports
- Headless Chrome testing WebGL using Playwright -- https://www.createit.com/blog/headless-chrome-testing-webgl-using-playwright/
- Supabase test helpers for pgTAP and RLS -- https://github.com/usebasejump/supabase-test-helpers
- End-to-end testing for web games with Playwright -- https://barthpaleologue.github.io/Blog/posts/webgl-webgpu-playwright-setup/

### Tertiary (LOW confidence)
- WebXR profiling metrics (Wonderland Engine) -- https://wonderlandengine.com/news/profiling-webxr-applications/
- VR performance targets (72 FPS Quest baseline) -- Training data, verified against WebXR device requirements

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already in project, no new libraries needed
- Architecture (adapter split, test patterns): HIGH -- TypeScript subpath exports are well-documented and verified; Vitest mocking patterns are standard
- Pitfalls (WebGL screenshots, CI performance): MEDIUM -- WebGL screenshot determinism is a known challenge; mitigated by non-blocking beta status
- Performance budgets: MEDIUM -- specific numbers based on industry baselines and project requirements; will need tuning based on actual measurements
- Drag-preview ghost: HIGH -- PlayCanvas raycasting API well-documented; ground plane fallback is simple math

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable domain, no fast-moving dependencies)
