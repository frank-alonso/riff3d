# Phase 3: Review Gate: Foundation - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate that contracts (Phase 1) and closed-loop editor (Phase 2) are sound before building collaboration and the second adapter on top. This is an expanded-scope review gate that also assesses cross-phase integration, cumulative debt from PASS_WITH_CONDITIONS decisions, architecture drift, and carry-forward reconciliation. Phase 3 also resolves all Phase 2 carry-forward items and adds the drag-preview ghost feature.

</domain>

<decisions>
## Implementation Decisions

### Carry-forward resolution
- Resolve ALL four carry-forward items (CF-P2-01 through CF-P2-04) in Phase 3 -- none deferred
- CF-P2-01: Full adapter unit test coverage -- core scene builder AND all editor interaction modules (gizmo manager, selection manager, camera controller, grid, GLB loader)
- CF-P2-02: Both test layers -- mocked policy tests for fast local/CI runs, plus real Supabase integration tests as a separate `test:integration` suite
- CF-P2-03: Migrate test document construction to SceneDocumentSchema.parse()
- CF-P2-04: Split adapter into core/editor-tools subpath exports with CI LoC budget enforcement
- Include drag-preview ghost feature (translucent entity follows cursor during asset drag, raycasting against scene geometry with ground plane fallback, snap to surface normals)

### Performance budgets
- Tiered thresholds: Excellent / Pass / Fail for all metrics where it makes sense
- Excellent tier = WebXR-ready benchmark (72+ FPS target, forward-looking for Phase 10 VR)
- Claude determines specific numbers per metric, but Excellent must correspond to VR-friendly performance
- Both per-scene budget (isolates adapter efficiency per golden fixture) AND total editor footprint cap
- Claude decides which metrics get full three tiers vs simple pass/fail based on measurability

### Integration test strategy
- Primary: fixture-driven testing (golden fixtures test contracts, round-trips, adapter rendering)
- Secondary: single golden-path E2E smoke test (create -> edit -> save -> reload -> verify)
- E2E runs locally (pre-push script or manual `pnpm test:e2e`) -- cloud CI for browser tests deferred to v2
- Visual baseline testing as beta, non-blocking: Playwright screenshot comparison of golden fixtures rendered in PlayCanvas
  - Opt-in test suite (`pnpm test:visual`), does NOT gate Phase 3 pass/fail
  - Promote to required in Phase 4 if it proves reliable (dual-adapter visual comparison is the killer use case)
  - Uses Playwright `toHaveScreenshot()` with configurable thresholds (subtle vs drastic change detection)
  - Baselines committed to repo initially; revisit storage if folder exceeds 10MB (git-lfs or separate repo)
  - Requires `__sceneReady` signal in adapter for reliable screenshot timing

### Plan structure
- Split into implementation plans first (carry-forwards, tests, drag ghost), then review gate plan
- Implementation work has its own plans; review is a separate final plan
- Clean separation: build -> test -> review

### Review process
- Codex expanded-scope review with extra scrutiny on three areas:
  1. PatchOps integrity -- verify ALL edits flow through PatchOps (the architectural non-negotiable)
  2. Adapter boundary -- verify adapters only read Canonical IR, never touch ECSON or PatchOps
  3. Cumulative debt -- assess whether PASS_WITH_CONDITIONS from Phase 1-2 created compounding issues
- Fix appetite: Claude triages by severity -- block on anything that could compound, defer cosmetic issues
- Human review: full manual walkthrough checklist provided, with an executive summary spot-check at the top (use the depth that time allows)

### Claude's Discretion
- Specific performance budget numbers (FPS, load time, memory) within the tiered framework
- Which metrics get three tiers vs simple pass/fail
- Plan count and breakdown for implementation work
- Triage of Codex findings (fix vs defer based on severity and compounding risk)
- Visual baseline threshold values and screenshot timing strategy

</decisions>

<specifics>
## Specific Ideas

- "I want to push the limits but keep it realistic" -- tiered budgets let us strive for Excellent while accepting Pass
- WebXR-ready as the Excellent benchmark -- if desktop editing hits 72 FPS, Phase 10 VR has headroom
- "Beta version of visual testing as long as it does not affect or block our progress" -- non-blocking, opt-in approach
- Cloud CI costs are a concern on free tier -- all browser/E2E tests run locally for now, note cloud CI as a v2 need
- "Can you provide the manual walkthrough with an executive summary" -- tiered review depth matching available time

</specifics>

<deferred>
## Deferred Ideas

- Cloud CI for E2E and visual regression tests -- v2 (requires paid CI tier for headless browser runners)
- Visual baseline storage migration to git-lfs or separate repo -- revisit if snapshot folder exceeds 10MB

</deferred>

---

*Phase: 03-review-gate-foundation*
*Context gathered: 2026-02-20*
