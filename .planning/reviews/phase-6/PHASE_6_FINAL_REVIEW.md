# Phase 6 Final Review
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)

## Final Findings Status
- Resolved:
  - `P6-AUD-001` (S1) resolved. `fetch()` now distinguishes `PGRST116` vs other DB errors and throws on non-not-found errors in `servers/collab/src/persistence.ts:24`. New error-path test exists in `servers/collab/__tests__/persistence.test.ts:336`.
  - `P6-AUD-004` (S2) resolved. `docsConverged()` now compares canonicalized full ECSON payload (entities/assets/wiring/environment/metadata) in `apps/editor/__tests__/stress-test-helpers.ts:292`.
- Open with conditions:
  - `P6-AUD-003` (S2) still open. `preferredEngine` is still written into ECSON metadata in `apps/editor/src/stores/slices/engine-slice.ts:74`, but `syncToYDoc` does not sync metadata (`apps/editor/src/collaboration/sync-bridge.ts:130`) and `observeRemoteChanges` still does not observe metadata (`apps/editor/src/collaboration/sync-bridge.ts:321`).
  - `P6-AUD-005` (S3) still open. Test still says “returns null for empty Y.Doc” but asserts only `toBeDefined()` in `apps/editor/__tests__/collaboration.test.ts:453`.
- Open blockers:
  - `P6-AUD-002` (S1) unresolved. Threshold fix (`>=30`) is present at `apps/editor/e2e/stress-collab.spec.ts:251`, but workload proof is still invalid:
    - No 200-entity build/load actually occurs.
    - It reads `window.__riff3dStore` at `apps/editor/e2e/stress-collab.spec.ts:224`, but no definition exists in repo.
    - Fallback path explicitly allows default scene (`apps/editor/e2e/stress-collab.spec.ts:226`).
    - Therefore SC3 evidence still does not demonstrate FPS on required workload.

## Final Decision (PASS | PASS_WITH_CONDITIONS | FAIL)

**FAIL**

Reason: unresolved S1 (`P6-AUD-002`) keeps Phase 6 below gate threshold. Also, metadata sync finding remains open and Claude’s rebuttal is partially inaccurate (metadata is not synced in `syncToYDoc` full-sync path).

## Required Follow-ups
1. Fix `P6-AUD-002` by loading/building a deterministic 200-entity scene in the E2E FPS test (no silent fallback), then attach native GPU run artifact showing median `>=30 FPS`.
2. Resolve `P6-AUD-003` via one of:
   - Add metadata sync + metadata observer path, or
   - Make metadata explicitly local-only and remove shared preference mutation from ECSON.
3. Clean up `P6-AUD-005` by aligning assertion/name/comment to explicit contract behavior (`null` vs valid parsed doc).