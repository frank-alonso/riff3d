# Phase 2 Plan Review
Date: 2026-02-19  
Auditor: Codex (gpt-5.3-codex)

## Feasibility
- `S1` The plan is broadly feasible, but parts of the contract-impact section are out of sync with current code and will create rework if executed literally.
- `S1` “New op types needed — `Reparent`, `BatchOp` …” is already implemented and tested in `packages/patchops/src/schemas.ts:7`, `packages/patchops/src/schemas.ts:29`, `packages/patchops/src/schemas.ts:54`, `packages/patchops/src/engine.ts:560`, `packages/patchops/__tests__/engine.test.ts:229`, `packages/patchops/__tests__/engine.test.ts:496`, `packages/patchops/__tests__/inverse.test.ts:205`, `packages/patchops/__tests__/inverse.test.ts:495`.
- `S1` “ECSON document gains a `projects` wrapper” (plan summary `.../PHASE_2_PLAN_SUMMARY.md:60`) is not additive with current contracts. `SceneDocumentSchema` is the root document consumed directly by compiler and patchops (`packages/ecson/src/schemas/scene-document.ts:17`, `packages/canonical-ir/src/compiler.ts:40`, `packages/patchops/src/engine.ts:100`).
- `S2` Environment scope is mostly feasible, but “exposure” is not present in ECSON/IR today, so RNDR-05 can drift unless contracts are added first (`packages/ecson/src/schemas/environment.ts:33`, `packages/canonical-ir/src/types/canonical-environment.ts:37`).

## Completeness
- `S2` Requirement coverage in waves is good and traces to roadmap (`.planning/ROADMAP.md:78`), but the summary misses explicit acceptance tests per requirement (especially PROJ-03 auth/read-only enforcement, EDIT-10 mode restore, RNDR-04 GLB limitations).
- `S2` Carry-forward bundling in 02-05 is high-density risk: CF-01/02/03 plus undo/redo/copy-paste/save can hide regressions (`.planning/STATE.md:81`).
- `S3` Plan states component `editorHints` will be added, but Phase 1 already shipped them (`packages/ecson/src/registry/types.ts:72`, `.planning/phases/01-contracts-testing-spine/01-05-SUMMARY.md:14`).

## Architecture Alignment
- `S0` No blocker found against core pipeline direction.
- `S1` Adapter boundary strategy is correct if strictly enforced: adapter should only accept `CanonicalScene` and never import `@riff3d/ecson`/`@riff3d/patchops` (summary `.../PHASE_2_PLAN_SUMMARY.md:56`).
- `S2` Gizmo “optimistic local update + PatchOp on `transform:end`” is acceptable for Phase 2, but must be explicitly treated as transient view state; persisted state must update only via PatchOps.
- `S1` ECSON `projects` wrapper proposal conflicts with contract-first boundary. Keep project metadata in DB columns, keep ECSON payload as pure `SceneDocument`.

## Risk Assessment
- Real risks identified: Zustand bridge complexity, full recompile latency, extras API stability, RLS mistakes, GLB edge cases, phase scope.
- Missing risks:
- `S1` Contract drift risk from re-defining already-existing PatchOps/editorHints.
- `S1` Data-model coupling risk if persistence envelope is pushed into ECSON schema.
- `S2` Version skew risk: project docs say Zod 4, but workspace catalog pins `^3.25.0` (`pnpm-workspace.yaml:9`), which has already affected metadata design decisions.
- `S2` Security risk for PROJ-03: UI read-only is insufficient without server/RLS write denial checks.

## Alternative Approaches
- `S1` Keep ECSON unchanged; create `ProjectRecord` at app/backend layer with fields `{id, owner_id, name, ecson_jsonb, thumbnail_url, is_public, timestamps}`.
- `S2` Split Phase 2 into two delivery gates without changing roadmap labels:
1. `2A`: 02-01..02-05 (auth, adapter base, edit loop, undo/save, carry-forwards).
2. `2B`: 02-06..02-07 (assets/import/environment + play mode).
- `S2` For gizmos: keep local transform preview during drag, but apply a single `BatchOp`/grouped op on commit; hard-cancel restores from ECSON snapshot.

## Test Strategy
- `S1` Current strategy is not yet sufficient in summary form. Add explicit matrix:
1. Contract tests before implementation for any new schema fields (environment exposure, if added).
2. PatchOp tests for any new/extended ops: apply, inverse, replay determinism (existing standard in `packages/patchops/__tests__`).
3. Integration tests for pipeline: UI action -> PatchOp log -> ECSON -> compile -> adapter update.
4. Playwright golden path for all 5 success criteria (login/create/open/edit/undo/save/reload/play/stop).
5. RLS/security tests: unauthorized read/write, public-link read-only, owner-only mutations.
6. Performance assertions: compile+adapter update budget under target for 100-entity fixture.

## Summary
- Key concerns:
- `S1` Contract-impact section has incorrect “new” items (Reparent/BatchOp/editorHints already exist).
- `S1` Proposed ECSON `projects` wrapper conflicts with existing contract boundaries and likely causes broad breakage.
- `S2` Testing and risk controls need explicit acceptance criteria and security/perf gates, not just feature implementation.
- Recommended adjustments:
- Freeze Phase 1 contracts as baseline; only add truly missing schema fields via contract-first PRs.
- Keep persistence envelope out of ECSON; store `SceneDocument` directly as JSONB.
- Add explicit boundary lint/check: adapter package cannot import ecson/patchops.
- Split execution into 2A/2B gates and separate CF-01/02/03 validation from feature churn.
- Define and automate a requirement-to-test matrix before 02-02 execution.