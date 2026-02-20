# Phase 2 Review
Date: 2026-02-19  
Auditor: Codex (gpt-5.3-codex)

## Findings

**P2-F01**  
Severity: **S1 (High)**  
Location: `packages/patchops/src/validation.ts:44`, `packages/patchops/src/engine.ts:252`  
Issue: `SetProperty` with `entityId="__environment__"` is accepted without path constraint and is applied against full document root.  
Impact: Any caller can mutate non-environment document fields (`entities`, `schemaVersion`, etc.) through a path-based side door, bypassing intended PatchOp invariants.  
Required action: Restrict `__environment__` operations to `path.startsWith("environment.")`; add validation + negative tests for forbidden root paths.

**P2-F02**  
Severity: **S1 (High)**  
Location: `apps/editor/src/components/editor/shell/top-bar.tsx:165`, `apps/editor/src/hooks/use-keyboard-shortcuts.ts:63`, `apps/editor/src/components/editor/hierarchy/tree-context-menu.tsx:173`, `apps/editor/src/components/editor/inspector/component-inspector.tsx:89`  
Issue: “View Only” appears to be UI labeling only; edit dispatch paths are still active for non-owners.  
Impact: Public-link non-owners can perform local edits and trigger save attempts; this is not true read-only editor behavior (even if RLS blocks persistence).  
Required action: Enforce read-only mode in client mutation entry points (shortcuts, gizmos, inspector, hierarchy, asset spawn, playtest-affecting edits) and gate `dispatchOp` centrally with owner/read-only state.

**P2-F03**  
Severity: **S1 (High)**  
Location: `packages/adapter-playcanvas/src` (measured `2443` LoC total)  
Issue: Adapter exceeds stated `<1500` LoC budget.  
Impact: Violates declared architecture constraint; increases maintenance and regression risk in boundary-sensitive package.  
Required action: Split adapter into smaller focused modules/packages (render core, interaction tools, import pipeline) and enforce budget in CI.

**P2-F04**  
Severity: **S2 (Medium)**  
Location: `apps/editor/src/stores/slices/playtest-slice.ts:127`  
Issue: Playtest stop restores `ecsonDoc` directly via store set, bypassing PatchOps.  
Impact: Breaks strict “all mutations through PatchOps” invariant and creates an untracked mutation path.  
Required action: Represent restore as explicit PatchOp sequence (or formalize/waive this exception in architecture rules and tests).

**P2-F05**  
Severity: **S2 (Medium)**  
Location: `packages/adapter-playcanvas/vitest.config.ts:6`, repository-wide test inventory (no Playwright/e2e files)  
Issue: No adapter tests (`passWithNoTests: true`) and no automated visual conformance suite.  
Impact: Rendering/interaction correctness and tolerance claims are weakly substantiated.  
Required action: Add adapter unit/integration tests and visual regression tests with explicit tolerances; remove `passWithNoTests` for adapter package.

**P2-F06**  
Severity: **S2 (Medium)**  
Location: `apps/editor/supabase/migration-001-projects.sql:16`, test inventory (no RLS policy tests found)  
Issue: RLS policies exist, but no automated RLS security verification tests were found despite plan response calling for them.  
Impact: Security posture depends on manual validation; regressions may ship unnoticed.  
Required action: Add explicit policy tests (owner write allowed, non-owner write denied, public read-only allowed).

**P2-F07**  
Severity: **S3 (Low)**  
Location: `packages/patchops/__tests__/engine.test.ts:36`, `packages/patchops/__tests__/inverse.test.ts:35`  
Issue: PatchOps tests use `fog.type: "none"` test docs, which diverges from current ECSON fog enum schema.  
Impact: Test fixtures can drift from contract reality and hide schema-level breakage.  
Required action: Build test docs via schema parser/factories to keep fixtures contract-valid.

## Rubric Assessment

1. **Contract Integrity**: **CONCERN**  
   - Major contracts mostly stable, but `__environment__` path behavior introduces ungoverned mutation surface.

2. **Determinism and Safety**: **FAIL**  
   - Unconstrained root-path mutation route and non-PatchOp mutation path in playtest restore violate strict safety intent.

3. **Test Depth**: **CONCERN**  
   - Strong PatchOps/conformance core tests exist, but adapter/runtime and security coverage are materially thin.

4. **Conformance Quality**: **FAIL**  
   - Semantic checks exist; visual conformance/tolerance automation is missing.

5. **Performance Envelope**: **PASS**  
   - Existing conformance/perf checks are present; full-rebuild limitation is documented as deferred.

6. **Modularity Boundaries**: **FAIL**  
   - Import boundary appears respected, but adapter LoC budget breach is a direct architecture miss.

## Preliminary Decision (PASS | PASS_WITH_CONDITIONS | FAIL)

**FAIL**