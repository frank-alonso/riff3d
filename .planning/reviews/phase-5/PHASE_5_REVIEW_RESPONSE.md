# Phase 5 Review Response

**Date:** 2026-02-21
**Author:** Claude (Driver)
**Responding to:** PHASE_5_REVIEW.md (initial), PHASE_5_FINAL_REVIEW.md (re-review)

## Finding Resolutions — Round 2

### P5-001 (S0): Wiring field dropped during collab sync — FIXED (Round 1)

**Fix (commit e18f2ce):**
1. `initializeYDoc`: Added Y.Array("wiring") population
2. `syncToYDoc`: Added `syncWiring()` helper for full-sync mode
3. `yDocToEcson`: Reads from Y.Array("wiring")
4. `persistence.ts`: Reads Y.Array("wiring") and Y.Map("metadata")
5. `observeRemoteChanges`: Observes Y.Array("wiring")
6. `provider.tsx`: Includes Y.Array("wiring") in UndoManager scopes

### P5-002 (S1): Environment edits not synced — FIXED (Round 1)

**Fix (commit e18f2ce):**
- `syncToYDoc`: Added `entityId === "__environment__"` branch to sync environment Y.Map

### P5-003 (S1): Unvalidated Y.Doc → ECSON — FIXED (Round 2: fail-closed)

**Round 1 fix was fail-open.** Codex final review correctly identified this as insufficient.

**Round 2 fix (commit 08fa294):**
- `yDocToEcson` now returns `SceneDocument | null` (was `SceneDocument`)
- On `safeParse` failure: logs error AND returns `null` (fail-closed)
- Removed `raw as unknown as SceneDocument` fallback entirely
- Callers updated:
  - `provider.tsx:onSynced`: Guards `loadProject()` with null check, logs if initial Y.Doc fails validation
  - `observeRemoteChanges:scheduleRebuild`: Guards `onRemoteChange()` with null check, preserves last-known-good doc on failure

### P5-004 (S1): No collaboration tests — FIXED (Round 2: multi-client)

**Round 1 added 29 single-doc tests.** Codex final review requested multi-client and persistence tests.

**Round 2 fix (commit 08fa294):** Added 9 more tests in 3 new describe blocks:
1. **Two-Client Sync** (6 tests): Entity propagation A→B, concurrent edits to different entities, concurrent edits to same property (LWW), wiring propagation, environment propagation, reconnect/catch-up after offline edits
2. **Persistence Round-Trip** (2 tests): Y.Doc encode/decode preserves full document, edits persist through encode/decode
3. **Cross-Client Undo Isolation** (1 test): A's undo does not affect B's edits after sync

Two-client tests use `Y.encodeStateAsUpdate` / `Y.applyUpdate` for deterministic document sync without a Hocuspocus server.

### P5-005 (S2): Lint errors — FIXED (Round 1)

0 lint errors across all packages.

## Updated Evidence

| Metric | Original | Round 1 | Round 2 |
|--------|----------|---------|---------|
| Tests | 690 | 719 | **728** |
| Failures | 0 | 0 | **0** |
| Lint errors | 12 | 0 | **0** |
| Collab tests | 0 | 29 | **38** |
| Multi-client tests | 0 | 0 | **9** |

## Typecheck/Lint/Test Evidence

```
Typecheck: 13/13 packages pass (0 errors)
Lint: 8/8 packages pass (0 errors, 2 pre-existing warnings)
Tests: 728 passed, 0 failed, 10 skipped (nightly/benchmark)
```

## Re-review Readiness

All findings from both initial review and final review are resolved:
- P5-001: FIXED (wiring sync)
- P5-002: FIXED (environment sync)
- P5-003: FIXED + upgraded to fail-closed per final review
- P5-004: FIXED + multi-client/persistence tests per final review
- P5-005: FIXED (lint)

Ready for final gate decision.
