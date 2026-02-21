# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** All meaningful edits flow through a deterministic operation pipeline (IQL -> PatchOps -> ECSON -> Canonical IR -> Adapters), ensuring portability, reproducibility, and safe AI-driven manipulation.
**Current focus:** Phase 5: Collaboration

## Current Position

Phase: 5 of 11 (Collaboration)
Plan: 0 of 5 in current phase
Status: Ready to plan Phase 5
Last activity: 2026-02-20 -- Phase 4 complete (PASS_WITH_CONDITIONS)

Progress: [##########] 5/5 plans in Phase 4 (complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 27
- Average duration: 9.1 min
- Total execution time: 4.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 7 | 74 min | 10.6 min |
| 02 | 8 | 100 min | 12.5 min |
| 03 | 7 | 54 min | 7.7 min |
| 04 | 5 | 28 min | 5.6 min |

**Recent Trend:**
- Last 5 plans: 04-01 (10 min), 04-02 (6 min), 04-03 (5 min), 04-04 (7 min), 04-05 (review gate)
- Trend: Phase 4 fastest phase yet; Babylon adapter and conformance testing completed efficiently

*Updated after each plan completion*
| Phase 03 P01 | 8 | 2 tasks | 11 files |
| Phase 03 P05 | 7 | 2 tasks | 7 files |
| Phase 03 P06 | 4 | 2 tasks | 9 files |
| Phase 03 P07 | 25 | 2 tasks | 6 files |
| Phase 04 P01 | 10 | 2 tasks | 24 files |
| Phase 04 P02 | 6 | 2 tasks | 12 files |
| Phase 04 P03 | 5 | 2 tasks | 12 files |
| Phase 04 P04 | 7 | 2 tasks | 16 files |
| Phase 04 P05 | review | 1 task | 6 files |

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
- [01-07]: PASS_WITH_CONDITIONS -- Phase 1 passes with 4 S2 + 1 S3 findings, no S0/S1 blockers
- [01-07]: Carry-forward items CF-01 through CF-06 targeting Phase 2/3 for resolution
- [01-07]: F-04 (non-portable glTF extensions) resolved inline via explicit de-scope per 2-template rule
- [02-01]: Email magic link as primary auth (social providers still available but secondary)
- [02-01]: react-resizable-panels v4 API: Group/Panel/Separator instead of PanelGroup
- [02-01]: Stripped .js extensions from 123 imports across all packages for Turbopack compatibility
- [02-01]: Zustand vanilla store with subscribeWithSelector middleware, slice-based composition
- [02-01]: Supabase SSR auth pattern: createBrowserClient for client, createServerClient for server, getUser() not getSession()
- [02-02]: DOM-based camera controller instead of PlayCanvas extras (simpler than InputFrame translation layer)
- [02-02]: Full scene rebuild on ECSON change (not incremental delta -- deferred for performance)
- [02-02]: Direct ECSON construction for default scene (not PatchOps -- simpler for initial creation)
- [02-02]: useSyncExternalStore for server-to-client project data transfer (React 19 lint compliance)
- [02-02]: Script tag for ECSON transfer from server layout to client page
- [02-03]: Minimal store interface types (GizmoStoreApi, SelectionStoreApi) on adapter side to avoid circular dependency
- [02-03]: Emissive color tint for selection highlight (simpler than outline shader)
- [02-03]: Immediate-mode drawLine for grid (not mesh entity -- avoids selection picking)
- [02-03]: CSS-based selection rectangle overlay (not canvas-drawn -- avoids WebGL state conflicts)
- [02-04]: Zod schema introspection via _def property instead of direct zod import in editor
- [02-04]: Quaternion-to-Euler conversion for rotation display (stored as quaternion, shown as degrees)
- [02-04]: Debounced PatchOp dispatch (300ms) for keyboard inputs, immediate for slider/checkbox/color/dropdown
- [02-05]: MAX_UNDO_DEPTH=200 to cap memory growth on long editing sessions
- [02-05]: Custom event (riff3d:manual-save) for Ctrl+S to decouple keyboard shortcuts from auto-save hook
- [02-05]: Tuning field IS preserved through IR round-trip (compiler/decompiler carry it), correcting plan assumption
- [02-05]: Internal clipboard buffer as fallback when navigator.clipboard API fails
- [02-05]: BatchOp for paste/duplicate operations so undo reverts entire operation atomically
- [02-06]: Custom DOM event bridge (riff3d:request-app) for GLB import to access PlayCanvas app instance
- [02-06]: __environment__ virtual entity ID for document-level SetProperty PatchOps (ambient, fog, sky)
- [02-06]: Local object URL for GLB loading in Phase 2 (Supabase Storage upload deferred to collaboration)
- [02-06]: Environment panel shown in inspector when no entity selected (common editor UX pattern)
- [02-07]: Discard-all on Stop -- keep runtime changes deferred to future enhancement
- [02-07]: useState for peek state (not refs) -- React 19 strict ref-during-render rules prevent ref-based approach
- [02-07]: Adapter setPlayMode controls only timeScale -- grid/gizmo/selection toggling at viewport level
- [02-08]: PASS_WITH_CONDITIONS gate decision -- 2 S1 fixed (environment path, read-only), 2 waivers (adapter LoC, playtest exception), 5 carry-forwards
- [02-08]: __environment__ path restricted to environment.* only (prevents root document mutation via side door)
- [02-08]: Centralized isReadOnly guard in dispatchOp -- non-owners cannot mutate ECSON
- [02-08]: System-level state replacement (loadProject, playtest stop) formally excluded from PatchOps rule per approved exception
- [02-08]: Adapter LoC budget applies to core module only (818 LoC); editor interaction modules tracked separately
- [03-02]: Inline entity construction in tests uses EntitySchema.parse() with minimal required fields, Zod defaults handle optional fields
- [03-02]: Environment settings omitted from test documents -- Zod defaults prevent invalid enum values like fog type "none"
- [03-04]: Regex-based structural tests on migration SQL for fast CI feedback without Supabase dependency
- [03-04]: describe.skipIf pattern for integration tests -- skip when env vars missing, no test failures in CI
- [03-04]: Service role client for test cleanup ensures no stale test data accumulates
- [Phase 03]: [03-01]: globalThis stubs for DOM APIs (HTMLCanvasElement, window, document) instead of jsdom for adapter tests
- [Phase 03]: __sceneReady signal in loadScene only (rebuildScene delegates to loadScene, avoiding double-fire)
- [Phase 03]: Visual E2E tests non-blocking beta with generous thresholds (2% pixel, 0.3 color) for GPU variance
- [03-05]: Editor-layer MIME parsing preserves dependency boundary -- DragPreviewManager accepts clean asset IDs, not ASSET_DRAG_MIME
- [03-05]: SetProperty PatchOp appended to BatchOp for drop position (avoids modifying starter asset createOps contract)
- [03-05]: Decompilation budgets added to tiered structure (Codex review S2 -- prevent existing coverage regression)
- [03-07]: PASS_WITH_CONDITIONS gate decision -- 0 S0/S1, 4 S2, 1 S3 carry-forwards to Phase 4/7
- [03-07]: F3-001 reclassified from S1 to S2 (evidence verifiable via deterministic test output)
- [03-07]: Visual baselines remain non-blocking beta until Phase 4 characterizes cross-GPU noise
- [03-07]: FPS/memory automated tracking deferred to Phase 7 (game loop FPS critical there)
- [Phase 04]: [04-01]: DOM lib added to canonical-ir tsconfig for HTMLCanvasElement in shared EngineAdapter interface
- [Phase 04]: [04-01]: twoSidedLighting is private in Babylon 8.52; backFaceCulling=false is sufficient for double-sided
- [Phase 04]: [04-01]: Explicit per-module vi.mock() for Babylon sub-modules (vitest hoisting limitation)
- [Phase 04]: [04-01]: applyDelta stubs fall back to full rebuild on both adapters (04-02 implements)
- [Phase 04]: [04-02]: ComponentType:propertyPath encoding in IRDelta property string avoids patchops dependency in canonical-ir
- [Phase 04]: [04-02]: computeDelta accepts PatchOpLike shape (type + payload) to keep canonical-ir independent of patchops
- [Phase 04]: [04-02]: Viewport subscriber wiring deferred to 04-03 (lastDelta stored in scene-slice, 04-03 wires to adapter)
- [Phase 04]: [04-03]: Engine preference persisted as metadata.preferredEngine (system-level mutation, matching loadProject exception pattern)
- [Phase 04]: [04-03]: Delta-aware canonicalScene subscriber routes lastDelta to applyDelta() vs rebuildScene() (completing 04-02 end-to-end wiring)
- [Phase 04]: [04-03]: Dynamic import for Babylon adapter keeps initial bundle minimal (only loads @babylonjs/core on switch)
- [Phase 04]: [04-03]: PlayCanvas-only editor tools (gizmos, selection, grid, drag preview) when Babylon active; Babylon editor tools deferred Phase 5+
- [Phase 04]: [04-04]: Conformance package needs playcanvas + @babylonjs/core as devDependencies for vi.mock cross-package resolution in pnpm
- [Phase 04]: [04-04]: Per-fixture tolerance bands replace Phase 3 generic beta thresholds; visual regression promoted to required CI
- [Phase 04]: [04-04]: Spot light inner cone tolerance (0.15 color delta) explicitly documented as acceptable Babylon approximation difference
- [Phase 04]: [04-04]: Cross-engine visual comparison is advisory only (not CI blocking); per-engine baselines are required
- [Phase 04]: [04-04]: Multi-seed property tests use seeds 42, 123, 456 x 50 iterations for CI-reproducible coverage

### Pending Todos

- ~~[Phase 2 - CF-01] Add rotating-seed/high-run nightly property test suite with failure seed capture~~ DONE in 02-05
- ~~[Phase 2 - CF-02] Add lossiness contract tests enumerating expected-stripped fields and asserting all others preserved~~ DONE in 02-05
- ~~[Phase 2 - CF-03] Add lint rule or restricted API boundary + negative test for mutation-bypass enforcement~~ DONE in 02-05
- ~~[Phase 2 - CF-05] Remove unused eslint-disable directive at patchops/src/engine.ts:518~~ DONE in 02-01
- ~~[Phase 2/3 - CF-06] Document IR conventions in source code (coordinate system, normal maps, physics units, roughness, 1:N entity-to-node)~~ DONE in 02-02 (JSDoc in scene-builder.ts, adapter.ts)
- ~~[Phase 3 - CF-P2-01] Add adapter unit tests for core scene builder and component mappers; remove passWithNoTests~~ DONE in 03-01
- ~~[Phase 3 - CF-P2-02] Add RLS policy integration tests (owner write, non-owner denied, public read-only)~~ DONE in 03-04
- ~~[Phase 3 - CF-P2-03] Migrate test document construction to use SceneDocumentSchema.parse() for contract validity~~ DONE in 03-02
- ~~[Phase 3 - CF-P2-04] Split adapter into core/editor-tools subpath exports; add CI LoC budget enforcement~~ DONE in 03-03
- ~~[Phase 3/4] Drag-preview ghost placement: when dragging an asset from the asset browser into the viewport, render a translucent ghost entity that follows the cursor using raycasting against scene geometry (ground plane fallback). Snap to surface normals, show placement position preview. Replace ghost with real entity on drop. Common editor convention (Unity placement ghost, Unreal drag proxy).~~ DONE in 03-05
- [Phase 4 - CF-P3-01] Attach CI run URLs + exported test artifacts to evidence packets (partial — carried forward as CF-P4-03)
- ~~[Phase 4 - CF-P3-02] Promote visual regression to required nightly/CI with per-fixture tolerance bands~~ DONE in 04-04
- ~~[Phase 4 - CF-P3-03] Add small multi-seed property suite (3 seeds x 50 iterations) to PR CI~~ DONE in 04-04
- [Phase 4/5 - CF-P3-04] Add mechanical mutation-boundary enforcement (no-restricted-imports or architecture guard) (carried forward as CF-P4-01)
- [Phase 7 - CF-P3-05] Automate FPS/memory trend checks with explicit regression thresholds
- [Phase 4] Fix infinite loading skeleton when navigating to editor from dashboard (direct URL works; dashboard->editor route triggers forever loading state)
- [Phase 4] Wire drag-preview ghost to quick asset panel (bottom toolbar) — currently only works from left sidebar asset browser
- [Phase 4] Add PatchOps operation log viewer UI (operations flow through PatchOps but no visible log in editor yet)
- [Phase 4] Investigate scene load time — passable but noticeably slow on first load
- [Phase 4/7 - CF-04] Add fixture coverage for non-portable glTF extensions when promoted to portable status
- [Phase 4] Consult `FUTURE_ENGINE_CONSIDERATIONS.md` when validating Babylon.js adapter -- ensure no web-only assumptions baked into IR.
- [Phase 8] Consult `FUTURE_ENGINE_CONSIDERATIONS.md` Section 7 when designing ejection adapter interface -- directory structures, no binary formats.
- [Phase 8] Re-evaluate `.planning/research/TEMPLATE_DESIGN_PLAYBOOK.md` -- reconcile archetype specs with actual component registry, validate against built game runtime, update playtest process, finalize template backlog. Also review at Phase 7 (latency budgets) and Phase 10 (VR variants).
- [Phase 5 - CF-P4-01] Mechanical mutation-boundary enforcement (no-restricted-imports + negative tests) — from Codex review F4-001/F4-003
- [Phase 5 - CF-P4-02] Align CLAUDE.md exception contract with actual bypass points (add engine preference setter) — from Codex review F4-001
- [Phase 5 - CF-P4-03] Attach CI run URLs/artifacts to evidence packets — from Codex review F4-004
- [Phase 7 - CF-P4-04] Cross-engine drift trend monitoring (when performance dashboard built) — from Codex review
- [Phase 5 - CF-P4-05] Camera position/rotation not synced when swapping engines — PlayCanvas defaults camera aiming downward on load, Babylon aims upward. Need to transfer camera state (position + rotation) correctly during engine switch so the viewpoint is preserved.
- [Phase 5 - CF-P4-06] Babylon-first load sometimes fails to render PlayCanvas on switch — when the editor loads with Babylon as the selected engine, switching to PlayCanvas sometimes results in a blank viewport (PlayCanvas engine loads per dev console but scene not visible). Loading with PlayCanvas first and then switching works reliably. Likely a race condition in adapter initialization order.
- [Phase 5 - CF-P4-07] Browser resize sometimes causes scene to stop rendering — resizing the browser window (e.g. opening dev console) can cause both engines to stop rendering. Partially fixed but still reproducible. Needs a robust canvas resize observer solution.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-20
Stopped at: Phase 5 context gathered
Resume file: .planning/phases/05-collaboration/05-CONTEXT.md
Next: Plan Phase 5 (Collaboration)
