# Phase 6: Review Gate: Core Platform - Research

**Researched:** 2026-02-22
**Domain:** Cross-phase integration review, stress testing, collaboration audit, architecture conformance
**Confidence:** HIGH

## Summary

Phase 6 is an expanded-scope review gate that validates the core platform (Phases 1-5) before the game layer (Phase 7+). Unlike standard delivery phases, Phase 6 produces no new features -- it validates, stress-tests, fixes carry-forwards, and obtains an independent gate decision. The research domain is the project's own codebase, its review protocol, and the testing infrastructure needed to run the locked-in stress test scenarios.

The project has established a clear review gate pattern through Phase 3 (the Foundation review gate). Phase 6 follows the same pattern but with expanded scope: 4-user concurrent collaboration stress testing, cross-engine collaboration validation, 200-entity scene performance measurement, carry-forward resolution, and a full golden path end-to-end walkthrough. The Codex independent reviewer must deep-audit the collaboration server code (314 LoC across 4 files in servers/collab/src/) -- this is manageable scope.

**Primary recommendation:** Structure Phase 6 as a sequence of plans: (1) carry-forward fixes (CF-P5-02, CF-P5-04, CF-P5-05), (2) stress test infrastructure + execution, (3) evidence compilation + architecture audit, (4) Codex review loop + gate decision. The carry-forward fixes are small, targeted changes that should be done first so the stress tests and review operate against the final codebase.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Stress Test Scenarios
- Test with 4 concurrent users editing the same scene simultaneously
- Target 200 entities in the stress test scene (above the 100-entity SC3 target, to build confidence)
- Simulate adverse network conditions: inject latency and disconnection to verify collab reconnection and conflict resolution
- Cross-engine collaboration must work: user A on PlayCanvas, user B on Babylon.js, editing the same scene via Yjs/ECSON layer

#### Carry-Forward Triage
- All 3 Phase 6 carry-forwards must be resolved before the gate passes:
  - CF-P5-02: Avatar yaw initialization (bug fix)
  - CF-P5-04: Collab-doc shape versioning/migration metadata (enhancement)
  - CF-P5-05: Server-side unit tests for collab persistence decode/re-encode (test coverage)
- Carry-forward fixes are implemented inside Phase 6 (within the review plan), not as a separate pre-phase step
- Phase 7+ carry-forwards left as-is -- no re-audit of their scheduling
- Prior PASS_WITH_CONDITIONS debt: only audit unresolved items, trust that resolved items are done

#### Review Scope Priorities
- All areas are equal priority -- collab reliability, adapter conformance, editor performance, and debt cleanup are weighted equally
- Include a full golden path end-to-end walkthrough: sign up, create project, edit, collaborate, switch engines, play-test, save
- Codex independent reviewer must deep-audit the collaboration server code (Hocuspocus, Y.Doc sync bridge, auth, persistence, sync logic, failure modes)
- Explicitly verify architecture still matches original contract definitions (ECSON, PatchOps, IR) -- do not assume prior gates caught all drift; collab and dual adapters may have introduced subtle drift

#### Pass/Fail Bar
- Pragmatic gate -- PASS_WITH_CONDITIONS is acceptable for non-critical items; must-haves fully met, nice-to-haves can be conditioned
- 90% adapter conformance threshold (SC2) is the right bar -- no increase needed
- Issues found during review that require code changes are fixed within Phase 6 (gate is not done until issues are resolved or explicitly conditioned)
- 30 FPS minimum floor for the 200-entity stress test during 4-user collaboration -- below 30 FPS means the editor feels broken

### Claude's Discretion
- Specific test scenario construction (which entities, component types, edit patterns)
- Network condition simulation method (artificial delays, WebSocket interruption approach)
- Evidence packet structure and Codex prompt crafting
- Order of operations within the review plan

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^4.0.18 | Unit/integration tests | Already used project-wide; stress tests are Vitest describe blocks |
| Playwright | ^1.58.2 | E2E multi-browser stress tests | Already configured in `apps/editor/playwright.config.ts` |
| Yjs | ^13.6 | CRDT stress test helpers | Already installed; `Y.encodeStateAsUpdate`/`Y.applyUpdate` for multi-client simulation |
| @hocuspocus/server | ^3.4.4 | Collab server under test | Already installed in `servers/collab` |
| Codex CLI | v0.104.0 | Independent reviewer | Already installed and configured via `scripts/codex-review.sh` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Playwright browser contexts | built-in | Multiple concurrent user simulation | 4-user stress test: 4 browser contexts in single test |
| Playwright route API | built-in | WebSocket interruption simulation | Network condition testing: `page.route()` to intercept/delay |
| performance.now() | built-in | FPS measurement in browser | 30 FPS floor measurement in 200-entity scene |

### Alternatives Considered

No new libraries needed. All stress testing is achievable with existing Playwright (E2E multi-user), Vitest (unit-level multi-client Y.Doc), and the browser's built-in performance APIs.

## Architecture Patterns

### Review Gate Plan Structure (Established in Phase 3)

Phase 3 established the review gate pattern. Phase 6 follows it with expanded scope:

```
Phase 6 Plans:
06-01: Carry-forward fixes (CF-P5-02, CF-P5-04, CF-P5-05)
06-02: Stress test infrastructure + 200-entity scene builder + multi-client collab tests
06-03: Evidence compilation, architecture audit, golden path walkthrough, Codex review loop, gate decision
```

The Phase 3 gate (03-07) combined evidence compilation, Codex review, and gate decision into a single plan. Phase 6 should follow the same approach but with the added complexity of stress test execution preceding the evidence compilation.

### Stress Test Architecture

**Headless multi-client Y.Doc tests (Vitest):** For deterministic 4-client sync verification, use the established `Y.encodeStateAsUpdate`/`Y.applyUpdate` pattern from the existing collaboration test suite. This tests CRDT correctness without network overhead.

```typescript
// Pattern from existing collaboration.test.ts
function syncDocs(docA: Y.Doc, docB: Y.Doc): void {
  const stateA = Y.encodeStateAsUpdate(docA);
  const stateB = Y.encodeStateAsUpdate(docB);
  Y.applyUpdate(docB, stateA);
  Y.applyUpdate(docA, stateB);
}
```

Extend to 4 clients:
```typescript
function syncAll(docs: Y.Doc[]): void {
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      syncDocs(docs[i], docs[j]);
    }
  }
}
```

**Playwright multi-context E2E tests:** For live 4-user browser tests, Playwright creates multiple browser contexts within a single test. Each context is an independent session (own cookies, storage, WebSocket connections).

```typescript
// Pattern: 4 concurrent users via browser contexts
const browser = await chromium.launch();
const contexts = await Promise.all(
  Array.from({ length: 4 }, () => browser.newContext())
);
const pages = await Promise.all(
  contexts.map(ctx => ctx.newPage())
);
// Each page authenticates as a different user and connects to the same project
```

**200-entity scene generation:** Build a test scene programmatically using the existing `SceneDocumentSchema.parse()` pattern. The scene should include diverse component types:

- 50 mesh entities with transform + mesh-renderer + material
- 30 light entities (mix of directional, point, spot)
- 20 camera entities
- 50 empty group entities with deep nesting (for hierarchy stress)
- 50 entities with multiple components each (transform + mesh-renderer + material + event wiring)

This exercises the full entity pipeline and exceeds the 100-entity SC3 target by 2x.

### Network Condition Simulation

Two approaches for simulating adverse network conditions:

**Approach 1: Playwright CDP (Chrome DevTools Protocol) emulation**
```typescript
// Inject latency via CDP
const cdpSession = await page.context().newCDPSession(page);
await cdpSession.send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 500,       // 500ms latency
  downloadThroughput: 100 * 1024, // 100 KB/s
  uploadThroughput: 50 * 1024,    // 50 KB/s
});
```

**Approach 2: WebSocket route interception**
```typescript
// Simulate disconnection by blocking WebSocket frames
await page.route('**/ws/**', route => route.abort());
// Wait, then restore
await page.unrouteAll();
```

**Recommendation:** Use CDP network emulation for latency injection (more realistic), and WebSocket route abort for disconnection simulation (cleaner control). CDP emulation requires Chromium -- this is acceptable since the Playwright config already uses `browserName: "chromium"`.

### FPS Measurement Pattern

Measure FPS from within the browser context using `requestAnimationFrame` timing:

```typescript
// Inject FPS counter into the page
const fps = await page.evaluate(() => {
  return new Promise<number>((resolve) => {
    let frames = 0;
    const start = performance.now();
    function count() {
      frames++;
      if (performance.now() - start >= 3000) { // 3-second sample
        resolve(frames / ((performance.now() - start) / 1000));
      } else {
        requestAnimationFrame(count);
      }
    }
    requestAnimationFrame(count);
  });
});
// Assert: fps >= 30
```

### Cross-Engine Collaboration Test

The cross-engine collab test validates that the ECSON/Yjs layer is truly engine-agnostic at the collaboration level:

1. User A opens project on PlayCanvas (default engine)
2. User B opens same project, switches to Babylon.js
3. User A creates/edits entities
4. Verify User B sees the edits rendered in Babylon.js
5. User B edits entities
6. Verify User A sees the edits rendered in PlayCanvas

This works because collaboration operates at the ECSON/Y.Doc level, not the adapter level. Both adapters consume the same Canonical IR compiled from the same ECSON document. The test validates this architectural boundary holds under real-time collaboration.

### Golden Path End-to-End Walkthrough

The golden path walkthrough exercises the full user journey as a narrative:

1. Sign up (anonymous or magic link)
2. Create a new project from dashboard
3. Add entities (cubes, lights, camera)
4. Edit transforms via gizmos, properties via inspector
5. Invite a collaborator (second browser context)
6. Both users edit simultaneously -- verify sync
7. Switch one user to Babylon.js engine -- verify scene consistency
8. Play-test the scene -- verify runtime mode
9. Stop play-test -- verify editor state preserved
10. Save and reload -- verify persistence

This covers SC1 (collaborative build + play-test + save) and exercises SC2 (adapter conformance) and SC3 (editor performance) implicitly.

### Anti-Patterns to Avoid

- **Testing collab via mocked WebSockets only:** The existing Vitest collaboration tests use headless Y.Docs, which is correct for CRDT correctness but does not test the actual Hocuspocus server. Phase 6 stress tests must include at least some tests against a live server.
- **Running all 4-user tests as E2E only:** E2E tests are slow. Use Vitest headless 4-client tests for correctness, Playwright for visual/behavioral verification.
- **Measuring FPS during CI:** FPS measurement requires a GPU and real rendering. FPS tests should be local-only (like existing conformance FPS benchmarks), not CI-blocking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-client CRDT sync simulation | Custom WebSocket relay | Y.encodeStateAsUpdate/Y.applyUpdate | Established pattern in collaboration.test.ts; deterministic, no server needed |
| Browser-level multi-user simulation | Multiple browser processes | Playwright browser contexts | Lightweight, same-process, isolated sessions with shared browser instance |
| Network condition simulation | Custom proxy server | Playwright CDP Network.emulateNetworkConditions | Built-in, well-tested, Chromium-native |
| FPS measurement | Custom frame counter library | requestAnimationFrame + performance.now() | Browser-native, no dependencies |
| Evidence packet format | New template | Existing PHASE_REVIEW_PROTOCOL.md template | Established format from Phases 1-5, auditor expects it |
| Codex review orchestration | Manual prompts | scripts/codex-review.sh | Automated context injection, output routing, architecture context |

## Common Pitfalls

### Pitfall 1: Stress Test Flakiness Due to Timing
**What goes wrong:** Multi-user E2E tests with WebSocket sync are inherently timing-sensitive. Tests pass locally but fail in CI due to different CPU speeds, network latency, or browser startup times.
**Why it happens:** WebSocket sync has variable latency; 4 concurrent browser contexts share CPU.
**How to avoid:** Use generous timeouts (10s+ for sync assertions), retry flaky assertions with `expect.poll()` in Playwright, and keep E2E stress tests local-only (not CI-blocking).
**Warning signs:** Tests that pass 90% of the time; tests with hardcoded `waitForTimeout()`.

### Pitfall 2: FPS Measurement Variance
**What goes wrong:** FPS measurements vary significantly between runs, making the 30 FPS floor unreliable as an automated gate.
**Why it happens:** GPU context sharing, browser warm-up, garbage collection pauses.
**How to avoid:** Sample over 3+ seconds, take the median of 3 runs, use a generous threshold (assert >= 25 FPS if floor is 30 FPS to allow for measurement noise). Document variance.
**Warning signs:** FPS oscillating between 20 and 50 across runs.

### Pitfall 3: Carry-Forward Fix Scope Creep
**What goes wrong:** CF-P5-04 (collab-doc shape versioning) expands into a full migration framework that delays the gate.
**Why it happens:** Versioning is a deep topic; easy to over-engineer.
**How to avoid:** Implement the minimal viable versioning: a numeric `shapeVersion` field in the Y.Doc meta map, checked on load, with a single migration path from version 0 (implicit) to version 1 (current). No multi-version chain needed yet.
**Warning signs:** Discussion of JSON Schema for Y.Doc shapes, migration registries, backward compatibility chains.

### Pitfall 4: Codex Review Scope Overload
**What goes wrong:** The Codex review prompt tries to cover everything (all 5 phases, all code, all carry-forwards) and produces a shallow review.
**Why it happens:** Phase 6 expanded scope is broad; trying to audit everything in one pass.
**How to avoid:** Structure the Codex prompt with prioritized focus areas: (1) collaboration server deep-audit (servers/collab/), (2) sync bridge correctness (sync-bridge.ts), (3) architecture boundary verification (adapter imports), (4) cumulative debt triage. Let Codex go deep on the collab server rather than shallow on everything.
**Warning signs:** Codex review that lists many S3 findings but misses critical sync bridge issues.

### Pitfall 5: Conflating "Review" with "New Feature Development"
**What goes wrong:** Phase 6 stress test infrastructure becomes a new testing framework that takes weeks.
**Why it happens:** Building "proper" E2E multi-user testing infrastructure is a large project.
**How to avoid:** The stress tests are one-time verification scripts, not permanent CI tests. Write them as standalone test files that can be run manually. Only the carry-forward fixes and the server-side unit tests (CF-P5-05) become permanent additions.
**Warning signs:** Creating new npm scripts, CI workflow changes, test infrastructure packages.

## Code Examples

### CF-P5-02: Avatar Yaw Initialization Fix

The bug: avatar-controller.ts initializes yaw to 0 instead of reading current camera orientation.

```typescript
// Current (broken): avatar-controller.ts line ~136
// yaw starts at 0 regardless of camera orientation

// Fix pattern: read current camera yaw on avatar mode entry
export function createAvatarController(
  camera: { getEulerAngles(): { x: number; y: number; z: number } },
  // ...
): AvatarController {
  // Initialize yaw from current camera orientation
  const euler = camera.getEulerAngles();
  let yaw = euler.y; // Preserve camera yaw
  // ...
}
```

### CF-P5-04: Collab-Doc Shape Versioning (Minimal)

```typescript
// In sync-bridge.ts initializeYDoc:
const COLLAB_SHAPE_VERSION = 1;

export function initializeYDoc(yDoc: Y.Doc, ecson: SceneDocument): void {
  const yMeta = yDoc.getMap("meta");
  yMeta.set("_shapeVersion", COLLAB_SHAPE_VERSION);
  // ... existing initialization
}

// On load, check version:
export function yDocToEcson(yDoc: Y.Doc): SceneDocument | null {
  const yMeta = yDoc.getMap("meta");
  const version = (yMeta.get("_shapeVersion") as number) ?? 0;
  if (version < COLLAB_SHAPE_VERSION) {
    migrateCollabShape(yDoc, version, COLLAB_SHAPE_VERSION);
  }
  // ... existing reconstruction
}
```

### CF-P5-05: Server-Side Persistence Unit Tests

```typescript
// servers/collab/__tests__/persistence.test.ts
import { describe, it, expect } from "vitest";
import * as Y from "yjs";

describe("Persistence decode/re-encode", () => {
  it("round-trips Y.Doc through encode/decode preserving all fields", () => {
    const doc = new Y.Doc();
    // Initialize with known ECSON structure
    const yMeta = doc.getMap("meta");
    yMeta.set("id", "proj-test");
    yMeta.set("name", "Test");
    // ... populate entities, assets, wiring, environment, metadata

    const state = Y.encodeStateAsUpdate(doc);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, state);

    // Verify all fields survive
    expect(restored.getMap("meta").get("id")).toBe("proj-test");
    // ... assert wiring, environment, metadata
  });

  it("syncEcsonToProject produces valid ECSON from Y.Doc state", () => {
    // Test the decode path used in persistence.ts store()
    // ... assert the reconstructed ECSON passes SceneDocumentSchema.safeParse()
  });
});
```

### 200-Entity Scene Builder

```typescript
// Test helper for stress tests
function build200EntityScene(): SceneDocument {
  const entities: Record<string, unknown> = {};
  const rootChildren: string[] = [];

  // 50 mesh entities
  for (let i = 0; i < 50; i++) {
    const id = `mesh-${i}`;
    rootChildren.push(id);
    entities[id] = {
      id,
      name: `Mesh ${i}`,
      parentId: "root",
      children: [],
      components: [
        { type: "Transform", properties: { position: [i, 0, 0] } },
        { type: "MeshRenderer", properties: { meshType: "box" } },
        { type: "Material", properties: { color: "#ff0000" } },
      ],
      tags: [],
      locked: false,
    };
  }

  // 30 lights, 20 cameras, 50 groups, 50 multi-component entities
  // ... (similar pattern)

  entities["root"] = {
    id: "root",
    name: "Root",
    parentId: null,
    children: rootChildren,
    components: [],
    tags: [],
    locked: false,
  };

  return SceneDocumentSchema.parse({
    id: "stress-test",
    name: "Stress Test 200",
    schemaVersion: 1,
    rootEntityId: "root",
    entities,
    assets: {},
    wiring: [],
    environment: {},
    metadata: { preferredEngine: "playcanvas" },
  });
}
```

### 4-Client Vitest Stress Test

```typescript
describe("4-Client Stress Test", () => {
  it("4 clients editing 200-entity scene converge to consistent state", () => {
    const scene = build200EntityScene();
    const docs = Array.from({ length: 4 }, () => new Y.Doc());

    // Client 0 initializes, sync to all
    initializeYDoc(docs[0], scene);
    for (let i = 1; i < 4; i++) {
      syncDocs(docs[0], docs[i]);
    }

    // Each client edits different entities concurrently
    for (let client = 0; client < 4; client++) {
      docs[client].transact(() => {
        const yEntities = docs[client].getMap("entities");
        for (let i = client * 50; i < (client + 1) * 50; i++) {
          const yEntity = yEntities.get(`mesh-${i}`) as Y.Map<unknown>;
          if (yEntity) yEntity.set("name", `Client${client}-edit-${i}`);
        }
      }, `client-${client}`);
    }

    // Sync all pairs
    syncAll(docs);

    // All 4 docs should converge
    for (let i = 1; i < 4; i++) {
      const a = yDocToEcson(docs[0]);
      const b = yDocToEcson(docs[i]);
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(Object.keys(a!.entities)).toHaveLength(
        Object.keys(b!.entities).length
      );
    }
  });
});
```

## State of the Art

| Old Approach (Phase 3) | Current Approach (Phase 6) | When Changed | Impact |
|------------------------|---------------------------|--------------|--------|
| 2-client headless Y.Doc tests | 4-client headless + Playwright E2E | Phase 6 | Exercises concurrency at scale the review gate demands |
| Single-engine conformance | Cross-engine collab verification | Phase 6 | Validates ECSON layer is engine-agnostic under collaboration |
| 100-entity performance target | 200-entity target with 30 FPS floor | Phase 6 context decision | Higher confidence bar before game layer |
| FPS as non-CI metric | FPS measured but still local-only | Unchanged | CF-P3-05 defers automated FPS to Phase 7 |

## Carry-Forward Inventory

### Phase 6 Target (MUST resolve)

| CF ID | Description | Severity | Current State | Fix Complexity |
|-------|-------------|----------|---------------|----------------|
| CF-P5-02 | Avatar yaw initialization resets to 0 | Bug | Known, documented in 05-VERIFICATION.md | Low -- read euler.y from camera on mode entry |
| CF-P5-04 | Collab-doc shape versioning metadata | Enhancement | Codex recommendation from Phase 5 final review | Low-Medium -- add _shapeVersion to meta, check on load |
| CF-P5-05 | Server-side persistence unit tests | Test coverage | No tests exist for servers/collab/ | Medium -- new test file, mock Supabase, test encode/decode |

### Phase 7+ (Leave as-is per CONTEXT.md)

| CF ID | Description | Target |
|-------|-------------|--------|
| CF-P3-05 | Automate FPS/memory trend checks | Phase 7 |
| CF-P4-04 | Cross-engine drift trend monitoring | Phase 7 |
| CF-04 | Non-portable glTF extension fixture coverage | Phase 4/7 |

### Cumulative PASS_WITH_CONDITIONS Debt Audit

| Phase | Decision | Findings | Status |
|-------|----------|----------|--------|
| Phase 1 | PASS_WITH_CONDITIONS | 4 S2 + 1 S3 | All resolved in Phase 2/3 |
| Phase 2 | PASS_WITH_CONDITIONS | 2 S1 fixed, 2 waived, 5 CFs | All resolved in Phase 3 |
| Phase 3 | PASS_WITH_CONDITIONS | 5 S2/S3 CFs | 4 resolved in Phase 4/5; CF-P3-05 targets Phase 7 |
| Phase 4 | PASS_WITH_CONDITIONS | 1 S1 waived, 7 CFs | 6 resolved in Phase 5; CF-P4-04 targets Phase 7 |
| Phase 5 | PASS | 0 open findings | 2 follow-up recommendations = CF-P5-04, CF-P5-05 |

**Assessment:** No unresolved cumulative debt except the 3 Phase 6 carry-forwards and the Phase 7-targeted items. The cumulative debt is well-managed.

## Evidence Packet Structure (Recommendation)

The Phase 6 evidence packet should follow the established PHASE_REVIEW_PROTOCOL.md template with these expanded-scope additions:

### Standard Sections
1. Scope (planned vs completed)
2. Contract Diffs (expect none -- Phase 6 is review/fix only)
3. Test Evidence (existing suite + new stress tests + carry-forward fix tests)
4. Performance Evidence (200-entity FPS measurements, adapter LoC budgets)
5. Risk Register
6. Decision Requests

### Expanded-Scope Sections (Required for Review Gates)
7. Cross-Phase Integration (Phases 4-5 work together end-to-end)
8. Cumulative Debt Assessment (all PASS_WITH_CONDITIONS from Phases 1-5)
9. Architecture Drift (verify FOUNDATION.md contract alignment)
10. Carry-Forward Reconciliation (CF-P5-02, CF-P5-04, CF-P5-05 resolution)

### Phase 6-Specific Additions
11. Stress Test Results (4-client, 200-entity, network conditions, cross-engine)
12. Golden Path Walkthrough Results
13. Collab Server Audit Focus Areas for Codex

## Codex Review Strategy (Recommendation)

### Prompt Structure

The Codex deep-audit prompt should be structured with prioritized focus areas:

1. **Collaboration Server Deep-Audit (Priority 1)**
   - `servers/collab/src/server.ts` (68 LoC) -- server config, auth hook, disconnect handling
   - `servers/collab/src/auth.ts` (95 LoC) -- JWT verification, project access, color assignment
   - `servers/collab/src/persistence.ts` (139 LoC) -- Y.Doc binary persistence, ECSON dual-write
   - Focus: auth bypass risks, persistence data loss, error handling gaps, race conditions

2. **Sync Bridge Correctness (Priority 2)**
   - `apps/editor/src/collaboration/sync-bridge.ts` (347 LoC) -- bidirectional ECSON<->Y.Doc
   - Focus: field coverage (wiring, environment, metadata all synced), origin tagging, fail-closed validation

3. **Architecture Boundary Verification (Priority 3)**
   - Verify all adapter imports come from `@riff3d/canonical-ir` only
   - Verify `no-restricted-imports` ESLint rules still active and correct
   - Check for any new PatchOps bypass paths introduced in Phase 4/5

4. **Cumulative Debt Triage (Priority 4)**
   - Review all PASS_WITH_CONDITIONS decisions from Phases 1-5
   - Verify resolved items are actually resolved
   - Flag any compounding patterns

### Using codex-review.sh

```bash
# Pre-execution plan review (mandatory for review gates)
./scripts/codex-review.sh plan-review 6

# Post-execution evidence review
./scripts/codex-review.sh post-review 6

# Final gate decision
./scripts/codex-review.sh final-review 6
```

## Open Questions

1. **Live Hocuspocus stress test feasibility**
   - What we know: Playwright can create 4 browser contexts. The collab server listens on localhost:1234. Each context needs its own Supabase auth session.
   - What's unclear: Can we create 4 authenticated sessions against a local Supabase instance for testing? Anonymous sign-in simplifies this but may not exercise the full auth path.
   - Recommendation: Use anonymous Supabase sign-ins for the 4-user E2E stress test. Auth correctness is separately verified by the existing auth.ts code review + potential unit tests.

2. **WebSocket interruption via Playwright route()**
   - What we know: Playwright `page.route()` can intercept HTTP requests. WebSocket interception support varies.
   - What's unclear: Whether `page.route()` reliably intercepts WebSocket upgrade requests in Playwright 1.58.
   - Recommendation: Use CDP `Network.emulateNetworkConditions` with `offline: true` for disconnection simulation rather than route-based WebSocket interception. This is more reliable.

3. **FPS measurement during collaboration**
   - What we know: FPS must be >= 30 during 4-user collab on 200-entity scene. FPS is measured via requestAnimationFrame.
   - What's unclear: Whether the WSL2 environment provides stable GPU rendering for FPS measurement.
   - Recommendation: Document FPS measurements with environment notes. If WSL2 GPU is unstable, run on native Windows or note as a known measurement constraint.

## Sources

### Primary (HIGH confidence)
- `.planning/PHASE_REVIEW_PROTOCOL.md` -- Review protocol, evidence packet format, severity model, gate decision rules
- `.planning/reviews/phase-3/PHASE_3_EVIDENCE.md` -- Phase 3 review gate evidence pattern (the template for Phase 6)
- `.planning/phases/03-review-gate-foundation/03-07-PLAN.md` -- Phase 3 review gate plan structure
- `.planning/reviews/phase-5/PHASE_5_FINAL_REVIEW.md` -- Phase 5 gate decision (PASS) with follow-up recommendations
- `.planning/reviews/phase-5/PHASE_5_EVIDENCE.md` -- Phase 5 evidence with carry-forward resolution table
- `.planning/reviews/phase-4/PHASE_4_DECISION.md` -- Phase 4 gate decision with carry-forward inventory
- `.planning/STATE.md` -- Current project state, carry-forward inventory, accumulated decisions
- `servers/collab/src/` -- Collaboration server source (314 LoC total) for audit scoping
- `apps/editor/__tests__/collaboration.test.ts` -- Existing 38-test collaboration suite for pattern reference
- `apps/editor/src/collaboration/` -- Collaboration client code (1397 LoC total)

### Secondary (MEDIUM confidence)
- [Playwright Browser Contexts](https://playwright.dev/docs/browser-contexts) -- Multi-context isolation for concurrent user testing
- [Playwright Network](https://playwright.dev/docs/network) -- Network interception and CDP emulation
- [CRDT Benchmarks](https://github.com/dmonad/crdt-benchmarks) -- Yjs performance measurement patterns
- [Hocuspocus Persistence](https://tiptap.dev/docs/hocuspocus/guides/persistence) -- Hocuspocus persistence hooks

### Tertiary (LOW confidence -- needs validation)
- WebSocket route interception reliability in Playwright 1.58 -- limited documentation found
- WSL2 GPU rendering stability for FPS measurement -- environment-specific

## Metadata

**Confidence breakdown:**
- Carry-forward fixes: HIGH -- all 3 items are well-documented with clear scope
- Stress test approach: HIGH -- builds on established patterns (headless Y.Doc + Playwright contexts)
- Review protocol: HIGH -- directly follows Phase 3 established pattern
- FPS measurement reliability: MEDIUM -- environment-dependent (WSL2 GPU)
- Network simulation approach: MEDIUM -- CDP emulation is well-documented but WebSocket specifics less so

**Research date:** 2026-02-22
**Valid until:** N/A (review gate -- specific to current codebase state)
