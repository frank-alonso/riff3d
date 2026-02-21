# Phase 5 Review
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)

## Findings

| ID | Severity | Location | Issue | Impact | Required action |
|---|---|---|---|---|---|
| P5-001 | S0 | `apps/editor/src/collaboration/sync-bridge.ts:212`, `apps/editor/src/collaboration/sync-bridge.ts:40`, `servers/collab/src/persistence.ts:104` | Collaboration round-trip drops ECSON `wiring` entirely (`yDocToEcson` hardcodes `wiring: []`; initialization/persistence omit wiring). | Event wiring data loss after collaborative sync/persist; violates contract integrity and can silently break scene behavior. | Add `wiring` to Y.Doc schema and both sync directions; add migration/version tag for collab doc shape; add round-trip tests proving wiring preservation. |
| P5-002 | S1 | `apps/editor/src/components/editor/inspector/widgets/environment-panel.tsx:34`, `apps/editor/src/stores/slices/scene-slice.ts:216`, `apps/editor/src/collaboration/sync-bridge.ts:97` | Environment edits use `entityId: "__environment__"`, but sync path treats this as an entity sync and never writes `yEnvironment`. | Remote collaborators can miss/lose environment updates; conflict resolution incomplete for shared scene state. | Special-case environment ops in `onAfterDispatch`/`syncToYDoc` to sync `yEnvironment` (and tests for remote propagation). |
| P5-003 | S1 | `apps/editor/src/collaboration/sync-bridge.ts:215`, `apps/editor/src/collaboration/provider.tsx:115` | Reconstructed remote doc is cast to `SceneDocument` via `as unknown as` and loaded without explicit schema validation/migration gate at the sync boundary. | Malformed/hostile Y.Doc state can crash runtime or bypass expected migration path. | Validate/migrate reconstructed docs before `loadProject` (fail closed + telemetry). |
| P5-004 | S1 | `servers/collab/package.json:6`, `apps/editor/package.json:13`, `apps/editor/src/collaboration/*` | New collaboration core/server shipped with effectively no targeted automated tests (no collab server test script, no collaboration unit/integration tests in editor test suite). | Key invariants (multi-user conflict, lock propagation, undo isolation) are unproven and regressions likely. | Add deterministic two-client tests (headless Y.Doc/Hocuspocus) for sync, locking, undo isolation, reconnect, and persistence round-trip. |
| P5-005 | S2 | `apps/editor/src/collaboration/provider.tsx:246`, `apps/editor/src/collaboration/hooks/use-awareness.ts:126`, `apps/editor/src/collaboration/hooks/use-entity-locks.ts:46`, `apps/editor/src/components/editor/shell/editor-shell.tsx:151` | Lint gate not clean in editor collaboration paths. Independent run (`pnpm --filter @riff3d/editor lint` on 2026-02-21) reports 12 errors + 3 warnings, including React refs/set-state-in-effect errors. | CI quality gate risk and unstable React 19 behavior patterns in hot collaboration paths. | Fix lint errors before sign-off or formally waive with expiration + owner/date. |

## Rubric Assessment

| Category | Score | Notes |
|---|---|---|
| Contract Integrity | **FAIL** | Proven ungoverned drift/data loss for `wiring` across collab sync/persistence. |
| Determinism and Safety | **CONCERN** | PatchOps flow is mostly preserved, but environment sync gap and unvalidated Y.Doc reconstruction weaken safety. |
| Test Depth | **FAIL** | Collaboration-specific property/adversarial/multi-user automated coverage is missing. |
| Conformance Quality | **CONCERN** | Existing conformance passes, but new collaboration semantics are not covered by semantic/visual conformance assertions. |
| Performance Envelope | **CONCERN** | Throttles/debounces are present, but no measured multi-user latency/bandwidth/CPU evidence in packet. |
| Modularity Boundaries | **PASS** | Package seams and adapter restrictions are materially enforced (`no-restricted-imports`), no obvious boundary breach found. |

## Preliminary Decision (PASS | PASS_WITH_CONDITIONS | FAIL)

**FAIL**

Blocking basis: `P5-001` (S0 contract/data-loss defect).  
Minimum re-review conditions: fix `P5-001` and `P5-002`, add targeted collaboration tests (`P5-004`), then re-run lint/tests and resubmit evidence.