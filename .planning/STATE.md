# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** All meaningful edits flow through a deterministic operation pipeline (IQL -> PatchOps -> ECSON -> Canonical IR -> Adapters), ensuring portability, reproducibility, and safe AI-driven manipulation.
**Current focus:** Phase 3: Review Gate -- Foundation

## Current Position

Phase: 3 of 11 (Review Gate: Foundation)
Plan: 6 of 7 in current phase
Status: Executing Phase 3
Last activity: 2026-02-20 -- Completed 03-06 (E2E and visual regression testing)

Progress: [########--] 5/7 plans in phase

## Performance Metrics

**Velocity:**
- Total plans completed: 18
- Average duration: 10.2 min
- Total execution time: 3.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 7 | 74 min | 10.6 min |
| 02 | 8 | 100 min | 12.5 min |
| 03 | 3 | 10 min | 3.3 min |

**Recent Trend:**
- Last 5 plans: 02-07 (5 min), 02-08 (23 min), 03-01 (4 min), 03-02 (3 min), 03-04 (3 min)
- Trend: Phase 3 review gate plans are fast -- focused remediation tasks

*Updated after each plan completion*
| Phase 03 P01 | 8 | 2 tasks | 11 files |
| Phase 03 P06 | 4 | 2 tasks | 9 files |

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

### Pending Todos

- ~~[Phase 2 - CF-01] Add rotating-seed/high-run nightly property test suite with failure seed capture~~ DONE in 02-05
- ~~[Phase 2 - CF-02] Add lossiness contract tests enumerating expected-stripped fields and asserting all others preserved~~ DONE in 02-05
- ~~[Phase 2 - CF-03] Add lint rule or restricted API boundary + negative test for mutation-bypass enforcement~~ DONE in 02-05
- ~~[Phase 2 - CF-05] Remove unused eslint-disable directive at patchops/src/engine.ts:518~~ DONE in 02-01
- ~~[Phase 2/3 - CF-06] Document IR conventions in source code (coordinate system, normal maps, physics units, roughness, 1:N entity-to-node)~~ DONE in 02-02 (JSDoc in scene-builder.ts, adapter.ts)
- ~~[Phase 3 - CF-P2-01] Add adapter unit tests for core scene builder and component mappers; remove passWithNoTests~~ DONE in 03-01
- ~~[Phase 3 - CF-P2-02] Add RLS policy integration tests (owner write, non-owner denied, public read-only)~~ DONE in 03-04
- ~~[Phase 3 - CF-P2-03] Migrate test document construction to use SceneDocumentSchema.parse() for contract validity~~ DONE in 03-02
- [Phase 3 - CF-P2-04] Split adapter into core/editor-tools subpath exports; add CI LoC budget enforcement
- [Phase 3/4] Drag-preview ghost placement: when dragging an asset from the asset browser into the viewport, render a translucent ghost entity that follows the cursor using raycasting against scene geometry (ground plane fallback). Snap to surface normals, show placement position preview. Replace ghost with real entity on drop. Common editor convention (Unity placement ghost, Unreal drag proxy).
- [Phase 4/7 - CF-04] Add fixture coverage for non-portable glTF extensions when promoted to portable status
- [Phase 4] Consult `FUTURE_ENGINE_CONSIDERATIONS.md` when validating Babylon.js adapter -- ensure no web-only assumptions baked into IR.
- [Phase 8] Consult `FUTURE_ENGINE_CONSIDERATIONS.md` Section 7 when designing ejection adapter interface -- directory structures, no binary formats.
- [Phase 8] Re-evaluate `.planning/research/TEMPLATE_DESIGN_PLAYBOOK.md` -- reconcile archetype specs with actual component registry, validate against built game runtime, update playtest process, finalize template backlog. Also review at Phase 7 (latency budgets) and Phase 10 (VR variants).

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 03-06-PLAN.md
Resume file: .planning/phases/03-review-gate-foundation/03-06-SUMMARY.md
Next: Execute remaining Phase 3 plans (03-07)
