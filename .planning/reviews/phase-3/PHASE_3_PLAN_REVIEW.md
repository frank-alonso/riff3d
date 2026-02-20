# Phase 3 Plan Review (Synthesis)
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)

## Dependency Coherence
- **S0** Wave sequencing is formally defined, but execution is not coherent because `03-03` has a blocker (core still imports camera controller) that can break build before downstream plans (`03-05`, `03-06`) run (`packages/adapter-playcanvas/src/adapter.ts:6`, `.planning/phases/03-review-gate-foundation/03-03-PLAN.md:1`).
- **S1** Hidden dependency: `03-05` test strategy assumes shared adapter mock infra from `03-01`, but `03-05` only declares dependency on `03-03` (`.planning/phases/03-review-gate-foundation/03-05-PLAN.md:1`, `.planning/phases/03-review-gate-foundation/03-01-PLAN.md:1`).
- **S1** Review-gate plan (`03-07`) depends on outputs not guaranteed by plan execution: missing `03-01..03-06` summary artifacts and missing LoC script path in current tree (`.planning/phases/03-review-gate-foundation/03-07-PLAN.md:59`, `scripts/check-adapter-loc.sh`).
- **S1** `03-04` claims mocked tests run in standard `pnpm test`, but current workspace wiring excludes editor tests, so dependency from implementation to evidence is weak (`apps/editor/package.json:6`, `vitest.config.ts:5`).

## Contract Consistency
- **S1** Adapter boundary contract is inconsistent across plans: `03-03` moves `camera-controller` to editor-tools while adapter core currently consumes it; this violates planned core/editor-tools separation unless refactored (`packages/adapter-playcanvas/src/adapter.ts:6`, `.planning/phases/03-review-gate-foundation/03-03-PLAN.md:90`).
- **S1** Auth contract mismatch across testing plans: `03-06` assumes password login, app supports OAuth/magic link flows (`.planning/phases/03-review-gate-foundation/03-06-PLAN.md:160`, `apps/editor/src/app/(auth)/login/page.tsx:30`).
- **S2** Schema contract references drift: `03-02` points to non-existent ECSON schema path (`@packages/ecson/src/schemas.ts`) and monorepo-wide claim does not match scoped file list (`.planning/phases/03-review-gate-foundation/03-02-PLAN.md:1`).
- **S2** Performance budget contract is split/unstable: `03-05` introduces `packages/conformance/src/budgets.ts`, while existing source of truth is `packages/conformance/src/benchmarks.ts`; `03-07` evidence references `budgets.ts` directly (`packages/conformance/src/benchmarks.ts:17`, `.planning/phases/03-review-gate-foundation/03-07-PLAN.md:113`).
- **S2** Drag-drop payload assumptions diverge: existing drag payload is asset id, but drag-preview plan implies different shape and omits spawn-position contract update (`apps/editor/src/lib/asset-manager.ts:264`, `.planning/phases/03-review-gate-foundation/03-05-PLAN.md:75`).

## Scope Risk
- **S1** Phase scope is high for one gate: 4 carry-forwards + adapter package split + new drag-preview UX + tiered perf system + Playwright E2E + visual baseline + expanded audit.
- **S1** Cross-plan planning quality signals scope overload: repeated stale paths, invalid Vitest commands (`--filter`), missing artifacts/scripts across `03-01/04/05/07`.
- **S2** Wave 3 couples two high-uncertainty plans (`03-05`, `03-06`) onto unresolved wave-2 adapter split details, increasing rework probability.

## Requirement Coverage
- **S1** Success Criterion 1 (golden fixtures load/edit/save/compile/render) lacks a reliable path: `03-06` fixture names and loading route do not match repository reality (`packages/fixtures/src/builders/index.ts:5`, `.planning/phases/03-review-gate-foundation/03-06-PLAN.md:242`).
- **S1** Success Criterion 5 (all CF resolved) is at risk:
  - CF-P2-02: default CI-path test inclusion unresolved (`03-04`).
  - CF-P2-03: monorepo-wide migration claim not fully scoped (`03-02`).
  - CF-P2-04: structural split can fail without adapter refactor (`03-03`).
- **S2** Success Criterion 4 (performance budgets met for all fixtures) is only partially covered: no concrete runtime fixture measurement harness for local-only FPS/load/memory, and decompilation coverage may regress (`packages/conformance/__tests__/benchmarks.test.ts:64`, `.planning/phases/03-review-gate-foundation/03-05-PLAN.md:188`).
- **S2** Success Criterion 6 (no architecture drift) has weak baseline definition because `FOUNDATION.md` reference is missing (`.planning/phases/03-review-gate-foundation/03-07-PLAN.md:132`).

## Integration Risk
- **S0** Core handoff risk: `03-03` output contract is not internally consistent (core importing editor-tools candidate), which threatens `03-05` drag-preview export and `03-06` adapter instrumentation.
- **S1** UI integration seam is underdefined: current drop handling is in `editor-shell`, while `03-05` wires viewport-level drag handling, risking double-handlers/divergent behavior (`apps/editor/src/components/editor/shell/editor-shell.tsx:139`, `apps/editor/src/components/editor/viewport/viewport-canvas.tsx:41`).
- **S1** E2E stabilization seam is underdefined: `__sceneReady` event contract lacks sticky-ready semantics; visual tests can race (`packages/adapter-playcanvas/src/adapter.ts:96`, `.planning/phases/03-review-gate-foundation/03-06-PLAN.md:252`).
- **S2** Security test seam split: `03-04` integration auth/env conventions differ from app conventions and from `03-06` helper direction, increasing setup and flake risk (`apps/editor/.env.local.example:3`, `apps/editor/src/lib/supabase/client.ts:5`).
- **S2** Review-gate handoff is brittle: `03-07` assumes prerequisite summaries/scripts without preflight gating.

## Summary
- Key cross-plan concerns:
- **S0:** `03-03` adapter split contract can break downstream plans unless camera-controller ownership is resolved.
- **S1:** Multiple hidden/missing dependencies (`03-05` on `03-01`; `03-07` on missing summaries/script; `03-04` not wired into default test path).
- **S1:** Contract mismatches (auth flow, schema paths, budget source) undermine cross-plan consistency.
- **S1:** Requirement coverage for fixture-based E2E and carry-forward closure is currently not provable end-to-end.
- Recommended adjustments:
- Re-baseline dependencies: require `03-03` preflight pass (build/typecheck/import boundary) before starting `03-05/03-06`; add explicit `03-05 -> 03-01` dependency.
- Add a cross-plan “contracts lockfile” section in each plan: auth mode, fixture names/routes, budget source file, adapter export surface.
- Normalize test command strategy repo-wide (remove `vitest --filter` usage; define workspace-valid commands once and reuse).
- Add preflight checks in `03-07` for required artifacts/scripts and fail fast if missing.
- Narrow scope for Phase 3 gate if needed: prioritize CF-P2 closure + E2E smoke reliability; keep visual baseline and advanced budget tiers explicitly non-gating.