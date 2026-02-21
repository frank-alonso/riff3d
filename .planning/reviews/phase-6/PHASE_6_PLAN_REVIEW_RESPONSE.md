# Phase 6 Plan Review Response

**Date:** 2026-02-22
**Review Value Assessment:** **HIGH** — 4 actionable items requiring plan adjustments
**Actionable Items:** 4 (2 plan fixes, 2 carry-forward additions)

## Finding Responses

### S0: SC1 Feasibility Conflict with Owner-Only Write Mode

**Status: Disagree — reclassify as S2 informational**

Codex correctly identified that `server.ts:51` sets `readOnly = !user.isOwner`. However, this does not prevent SC1 verification:

1. **Same-user multi-tab:** The owner can open multiple tabs to the same project. Each tab authenticates as the owner and gets write access. This is the standard collaborative editing test scenario and validates CRDT convergence, conflict resolution, and sync bridge correctness.

2. **Headless Y.Doc tests bypass auth entirely:** The 4-client headless stress tests in 06-02 operate on raw Y.Docs without a Hocuspocus server, so auth restrictions are irrelevant to convergence testing.

3. **Multi-account collaboration (different users):** The current auth model intentionally restricts non-owners to read-only. This is a product decision, not a bug — Riff3D's collaboration model in Phase 5 was scoped to "owner + viewers who can see cursors but not edit." True multi-account write access requires a collaborator invite/permission model, which is out of scope for Phase 6.

**Action:** Update 06-02 E2E multi-user test (Test 4) to clarify that all browser contexts authenticate as the project owner. Update 06-03 evidence to clarify SC1 is validated via same-user multi-tab and headless CRDT tests. Note multi-account write access as a known platform limitation for Phase 7+ (not a Phase 6 carry-forward, since it requires a new feature, not a fix).

### S1: E2E File Naming Doesn't Match Playwright Config

**Status: Agree — plan adjustment required**

Playwright config at `apps/editor/playwright.config.ts:28` expects `*.e2e.ts` test files, not `*.spec.ts`. The plan file `06-02-PLAN.md` references `stress-collab.spec.ts`.

**Action:** During execution, the E2E stress test file should be created as `stress-collab.e2e.ts` (not `.spec.ts`). This is a plan execution adjustment, not a plan rewrite. The executor will use the correct file extension.

### S1: Property-Level Merge Assumption — Components as Single Key

**Status: Agree — valid architectural limitation, not blocking**

Codex correctly identified that the sync bridge stores each entity's `components` array as a single Y.Map value. This means two users editing different components on the same entity would LWW at the `components` key level, with one edit lost.

**Assessment:**
- The current design provides per-entity-property granularity (name, children, tags, locked, components). This is the design from Phase 5 (05-02).
- For Phase 6 testing, the headless stress test (06-02 Task 1 Test 2) should be adjusted to test VALID concurrent merge scenarios (edits to different entity-level keys: name, tags, locked) rather than assuming per-component-property merge.
- Per-component-property merge would require deeper Y.Map nesting (Y.Map per component within the entity Y.Map). This is a significant sync bridge refactor.

**Action:** Adjust 06-02 Task 1 Test 2 during execution: test concurrent edits to different entity-level properties (name, tags, locked), NOT different component properties. Add a carry-forward for Phase 7: "Evaluate deeper Y.Map nesting for per-component-property merge in collab sync bridge."

### S1: Sync Coverage Gap — gameSettings and metadata Observers

**Status: Partially agree — gameSettings is future scope, metadata observers are valid**

**gameSettings:** Not synced in initializeYDoc, syncToYDoc, or yDocToEcson. However, `gameSettings` is an `.optional()` field on SceneDocumentSchema and is a Phase 7 feature (Game Runtime). No current ECSON document has gameSettings populated. This is NOT a Phase 6 blocker.

**metadata observers:** The sync bridge does NOT observe `yDoc.getMap("metadata")` for remote changes (line 333-335 shows entities, assets, environment observers only). Metadata changes from remote users would NOT trigger a rebuild. This IS a gap — metadata includes `preferredEngine` and other document-level settings. However, metadata changes are rare in practice (engine preference is set once per user, not during collaborative editing).

**Action:** Add carry-forward: "Add metadata observer to sync-bridge observeRemoteChanges for Phase 7." Note gameSettings sync as Phase 7 scope (when the field is first used).

### S1: Persistence Error Handling — fetch Treats All Errors as "No Doc"

**Status: Agree — valid but low-impact**

The `persistence.ts:24` check `if (error || !data?.ydoc_state)` conflates "not found" with "database error." A transient DB error would cause Hocuspocus to initialize a blank Y.Doc, potentially overwriting the persisted state on the next store() call.

**Assessment:** This is a real correctness concern. However, the practical impact is limited:
- Supabase Postgres is highly available; transient errors are rare
- The Y.Doc binary in `collab_documents` is only used for collaborative sessions; the ECSON in `projects` table is the primary persistence
- A blank Y.Doc initialization would be caught by the first client's ECSON initialization check

**Action:** Add to 06-01 scope during execution: differentiate `PGRST116` (not found) from other errors in the persistence fetch. Return null only for "not found"; throw/log for other errors. This is a 3-line fix.

### S1: Persistence Dual-Write Race

**Status: Agree — accepted risk**

The Y.Doc binary upsert and ECSON update are non-atomic. If the server crashes between writes, one could succeed without the other.

**Assessment:** The Y.Doc binary is the authoritative collaborative state. The ECSON column is a convenience for non-collab project loads. If the ECSON update fails, the next collab session will re-derive ECSON from the Y.Doc. Data loss risk is minimal.

**Action:** Note in 06-03 evidence as a known trade-off. Not a Phase 6 fix — would require a Postgres transaction wrapper around the Supabase client calls, which adds complexity for minimal benefit.

### S2: FPS Criterion — 25 vs 30 FPS

**Status: Agree — plan should match locked decision**

The plan allows `>=25` FPS but CONTEXT.md specifies 30 FPS floor.

**Action:** During execution, assert `>=30` in the E2E FPS test. The research pitfall about measurement noise should be handled by taking the median of 3 runs, not by lowering the threshold.

### S2: Phase 6 Lint Carry-Forward

**Status: Disagree — already resolved**

Codex references STATE.md:184 lint carry-forward. Checking STATE.md, the CF-P5-01 (React 19 ref lint errors) and CF-P5-03 (editor-shell set-state-in-effect) are both marked as RESOLVED in review fixes. No outstanding lint carry-forwards target Phase 6.

## Summary of Plan Adjustments for Execution

1. **E2E file extension:** Use `stress-collab.e2e.ts` instead of `stress-collab.spec.ts`
2. **Concurrent merge test:** Test entity-level properties (name, tags) not component-level properties
3. **Persistence error handling:** Add 3-line fix to differentiate PGRST116 from real errors
4. **FPS threshold:** Assert `>=30` not `>=25`
5. **E2E multi-user auth:** All browser contexts authenticate as owner

## New Carry-Forwards (Phase 7+)

| CF ID | Description | Target |
|-------|-------------|--------|
| CF-P6-01 | Evaluate deeper Y.Map nesting for per-component-property CRDT merge | Phase 7 |
| CF-P6-02 | Add metadata observer to sync-bridge observeRemoteChanges | Phase 7 |
| CF-P6-03 | Add gameSettings sync to sync-bridge when field is first used | Phase 7 |
| CF-P6-04 | Multi-account write access (collaborator invite/permission model) | Phase 7+ |
