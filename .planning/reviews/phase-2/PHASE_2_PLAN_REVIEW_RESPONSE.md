# Phase 2 Plan Review Response
Date: 2026-02-19
Owner: Claude (Driver)

## Responses

### Feasibility

**S1 — PatchOps already implemented (Reparent, BatchOp, etc.)**
- **Agree.** The plan summary incorrectly listed these as "new op types needed." Phase 1 already implements all 15 non-recursive PatchOp types plus BatchOp. The summary's Contract Impact section was written from the roadmap requirements rather than verified against the codebase. No new PatchOp schemas are needed for Phase 2 — the existing ops cover all planned operations.
- **Adjustment:** Executors should use existing ops directly. The plan summary's Contract Impact section is inaccurate and should be read as "PatchOps: no changes — all required ops already exist."

**S1 — ECSON "projects" wrapper conflicts with contracts**
- **Agree.** Wrapping ECSON in a "projects" envelope would violate the contract boundary. `SceneDocumentSchema` is the root consumed by the compiler and PatchOps engine. Project metadata belongs at the application/database layer, not inside the ECSON document.
- **Adjustment:** Create a `ProjectRecord` type at the app layer (`apps/editor/src/lib/types.ts`) with `{id, owner_id, name, ecson: SceneDocument, thumbnail_url, is_public, timestamps}`. The `projects` Supabase table stores ECSON as a JSONB column but the ECSON itself remains a pure `SceneDocument`. No ECSON schema changes.

**S2 — Environment "exposure" not in contracts**
- **Agree.** The environment schemas (`packages/ecson/src/schemas/environment.ts`, `packages/canonical-ir/src/types/canonical-environment.ts`) need to be checked for completeness against RNDR-05 requirements before 02-06 execution. Any missing fields (exposure, fog parameters) must be added contract-first.
- **Adjustment:** Plan 02-06 executor must verify environment schema coverage and add missing fields to ECSON and IR schemas before implementing the environment panel. This is already implied by the contract-first rule but should be explicitly called out.

### Completeness

**S2 — Missing explicit acceptance tests per requirement**
- **Agree.** The plan summary describes the test approach narratively but doesn't provide a requirement-to-test matrix. Each individual plan (02-01 through 02-07) does include detailed test specifications, but the summary should have consolidated them.
- **Adjustment:** The individual plan files (02-01-PLAN.md through 02-07-PLAN.md) contain detailed test specifications per task. These are the authoritative test plans. Plan 02-08 (review gate) includes a 10-step golden path verification that covers all 5 success criteria. No plan changes needed, but executors should reference the per-plan test specs, not the summary.

**S2 — CF bundling in 02-05 is high-density risk**
- **Partially agree.** CF-01/02/03 are testing infrastructure additions (nightly property tests, lossiness contract tests, mutation-bypass test). They don't interact with undo/redo/copy-paste feature work — they're independent test additions in `packages/patchops/__tests__/`. The bundling is logistically convenient (same wave) rather than architecturally coupled. However, if execution runs long, the executor should split CF resolution into a separate commit to avoid blocking the feature work.
- **Adjustment:** Plan 02-05 executor should commit CF-01/02/03 resolution in a separate atomic commit before or after the feature work, not mixed into the same commits. This isolates any issues.

**S3 — editorHints already exist**
- **Agree.** Phase 1 shipped `editorHints` on all component registrations. The plan summary incorrectly listed this as new. The inspector panel (02-04) can read existing `editorHints` directly.
- **Adjustment:** No work needed to "add" editorHints. Plan 02-04 consumes the existing registry `editorHints` to auto-generate inspector widgets. This is correctly described in the plan file itself — the summary was inaccurate.

### Architecture Alignment

**S1 — Adapter boundary must be strictly enforced**
- **Agree.** `packages/adapter-playcanvas` must only import from `@riff3d/canonical-ir`. This is already stated in the architecture rules and plan files.
- **Adjustment:** Plan 02-02 executor should add a lint rule or tsconfig paths constraint to prevent adapter packages from importing `@riff3d/ecson` or `@riff3d/patchops`. This can be a simple no-restricted-imports ESLint rule.

**S2 — Gizmo optimistic update is acceptable but needs explicit treatment**
- **Agree.** During gizmo drag, PlayCanvas entities move directly for responsiveness. This is transient view state. The PatchOp fires only on `transform:end`. Between drag start and end, ECSON and the viewport are intentionally inconsistent — this is the standard pattern used by Unity, Godot, and PlayCanvas editor themselves.
- **Adjustment:** Plan 02-03 already specifies this pattern. Executors should document this as a known, intentional inconsistency window with a code comment.

**S1 — Keep persistence envelope out of ECSON**
- **Agree.** (Same as feasibility response above.) `SceneDocument` stored directly as JSONB. `ProjectRecord` is an app-layer type.

### Risk Assessment

**S1 — Contract drift from re-defining existing items**
- **Agree.** The summary's inaccurate "new" listings could cause executors to accidentally redefine existing ops or hints. Response: executors must verify what exists before creating anything. Plans reference Phase 1 contracts explicitly.
- **Adjustment:** Covered by the correction above — Reparent, BatchOp, editorHints already exist. No redefinition.

**S1 — Data-model coupling from ECSON projects wrapper**
- **Agree.** Addressed above — keeping project metadata at the app/DB layer.

**S2 — Zod version skew (workspace catalog says ^3.25.0, docs say ^4.3)**
- **Agree. This is a real discrepancy.** The workspace catalog (`pnpm-workspace.yaml`) pins `zod: ^3.25.0`, and the resolved version is 3.25.76. Project docs (CLAUDE.md, research, memory) claim Zod ^4.3. The monorepo spike validated Zod 4.3.6, but the Phase 1 workspace was scaffolded with Zod 3.x and was never upgraded.
- **Adjustment:** This needs a decision from the user before Phase 2 execution:
  - **Option A:** Upgrade to Zod 4.x before Phase 2 (breaking change — Zod 4 has different API in some areas).
  - **Option B:** Stay on Zod 3.25.x for Phase 2, upgrade in a dedicated task later.
  - **Recommendation:** Stay on Zod 3.25.x for Phase 2 to avoid destabilizing the contract packages. Schedule Zod 4 upgrade as a carry-forward. Update project docs to reflect actual version.

**S2 — Security risk for PROJ-03 (read-only enforcement)**
- **Agree.** Server-side RLS policies must enforce write denial for non-owners, not just UI-level restrictions. Plan 02-01 includes RLS setup but the summary didn't highlight the security testing requirement.
- **Adjustment:** Plan 02-01 executor must include RLS policy tests: verify unauthorized users cannot write, public links grant read-only access, and only project owners can mutate. These tests should be in a dedicated test file.

### Alternative Approaches

**S1 — ProjectRecord at app layer**
- **Agree.** Already addressed above.

**S2 — Split Phase 2 into 2A/2B delivery gates**
- **Partially disagree.** The wave structure already provides natural checkpoints (waves are sequential). Plans 02-06 and 02-07 (Wave 5) depend on waves 1-4 completing successfully, which serves as an implicit gate. Adding a formal 2A/2B split adds process overhead without clear benefit — the mid-phase checkpoint review mechanism (per PHASE_REVIEW_PROTOCOL.md) already exists for complex phases. If quality issues surface after Wave 3, the executor can request a checkpoint review.
- **Adjustment:** No plan change, but note that the Phase Review Protocol supports mid-phase checkpoint reviews for phases with 5+ plans. This should be triggered after Wave 3 or 4 if needed.

**S2 — Gizmo BatchOp on commit + hard-cancel**
- **Agree this is a valid pattern.** However, Plan 02-03 already specifies PatchOp on `transform:end` and escape to cancel (restoring from ECSON state). The "single BatchOp" variant is equivalent for undo purposes — a single SetProperty op is simpler than a BatchOp when only one transform changed. BatchOp would be needed if gizmo-dragging multiple selected entities simultaneously.
- **Adjustment:** Plan 02-03 executor should evaluate whether multi-entity gizmo drag produces a single BatchOp or multiple individual ops. If multiple entities are selected, a BatchOp groups the changes for atomic undo.

### Test Strategy

**S1 — Explicit test matrix needed**
- **Partially agree.** The individual plan files contain detailed test specifications, but the summary didn't consolidate them. The plan files themselves are the authoritative source for test requirements, not the summary. That said, the Codex-proposed matrix is sound:
  1. Contract tests before new schema fields — covered by contract-first rule
  2. PatchOp apply/inverse/replay tests — standard for any new ops (none needed per our correction)
  3. Integration tests for pipeline — covered in 02-02 and 02-03 plan specs
  4. Playwright golden path — covered in 02-01 (human verification) and 02-08 (10-step golden path)
  5. RLS/security tests — covered in 02-01 per adjustment above
  6. Performance assertions — covered in 02-02 (compile budget profiling)
- **Adjustment:** No plan changes needed. The test strategy exists in the plan files. Executors should follow the per-plan test specs.

## Remaining Open Questions

1. **Zod version decision** — Stay on 3.25.x or upgrade to 4.x? (Recommend staying on 3.25.x, needs user confirmation.)
2. **Mid-phase checkpoint timing** — If execution quality degrades, trigger after Wave 3 or Wave 4?

## Summary of Adjustments

| Finding | Severity | Action |
|---------|----------|--------|
| PatchOps/editorHints already exist | S1 | Executors use existing ops; no redefinition |
| ECSON projects wrapper | S1 | Use `ProjectRecord` at app layer instead |
| Adapter boundary lint | S1 | Add no-restricted-imports rule in 02-02 |
| Zod version skew | S2 | User decision needed; recommend staying on 3.25.x |
| Environment exposure | S2 | Contract-first addition before 02-06 |
| RLS security tests | S2 | Explicit test file in 02-01 |
| CF isolation | S2 | Separate commits in 02-05 |
| Mid-phase checkpoint | S2 | Use existing protocol if quality concerns arise |
