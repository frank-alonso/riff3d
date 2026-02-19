# Phase 1: Contracts & Testing Spine - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Define all core contracts (PatchOps, ECSON, Canonical IR), implement them with Zod validators, build golden fixtures with a builder API, prove round-trip determinism, establish CI pipeline, conformance harness, property-based tests, and complete a Rapier physics evaluation spike. No browser, no UI — pure TypeScript specs and tests.

</domain>

<decisions>
## Implementation Decisions

### Component palette
- Balanced mix: core 3D basics (mesh, transform, light, camera, materials, animation) plus gameplay stubs (spawner, trigger, score zone, etc.) to prove the schema handles both
- Include audio components (AudioSource, AudioListener) in the initial 15+ palette — schema only, no runtime yet
- Gameplay stub depth is Claude's discretion — enough to prove the registry handles them, expanded in Phase 7
- Editor hints baked into schemas from day one (color pickers, sliders, dropdowns, enums) — Phase 2 reads them directly to auto-generate inspectors

### Fixture scenarios
- Mix of product-realistic and capability-focused fixtures across the 5 clean + 1 adversarial
- Adversarial fixture complexity is Claude's discretion
- Both structural-only fixtures (for fast unit tests) and a couple with small test asset references (for integration validation)
- Builder API for all fixtures — programmatic builders that output ECSON, easier to maintain as schemas evolve
- One hand-authored reference fixture maintained alongside as format documentation, with a test asserting the builder produces identical output

### Portable vs engine-specific boundary
- PBR material depth in portable subset is Claude's discretion
- Unsupported portable features: warn and fallback — adapter logs a warning but still renders with closest equivalent
- Engine tuning sections can both ADD engine-exclusive properties and OVERRIDE portable values
- Engine tuning properties hidden behind an "Advanced" / "Engine Settings" toggle in the editor UI (portable properties shown by default)

### PatchOps origin policy
- AI ops are unrestricted by default — same capabilities as user ops
- Opt-in "safe mode" restricts AI ops to a safe subset (can't delete root entities, can't modify locked objects, etc.)
- Safe mode is a project-level setting (default: off), overridable per session
- Origin categories (user/AI/system/replay) are color-coded in the operation log — visually distinguishable
- AI op undo: user chooses between batch undo (revert entire AI action in one step) and granular undo (one op at a time)
- Old-format PatchOps auto-migrated on load with a logged warning — ECSON document is the safety net

### Claude's Discretion
- Gameplay component stub depth (how many properties defined now vs expanded in Phase 7)
- Adversarial fixture complexity level
- PBR material scope in portable subset (baseline vs extended glTF extensions)
- Exact component list beyond the required categories

</decisions>

<specifics>
## Specific Ideas

- Builder API should have a test that asserts its output matches the hand-authored reference fixture — proves the builder is correct and the reference stays in sync
- Safe mode for AI ops was inspired by wanting maximum power by default but giving cautious users an escape hatch
- Color-coded origins in the op log: distinct colors/icons per origin type so you can immediately see what came from AI vs user vs system

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-contracts-testing-spine*
*Context gathered: 2026-02-19*
