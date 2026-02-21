# Phase 6 Manual Walkthrough Checklist

## Executive Summary (Spot-Check, 2 minutes)

- [ ] Open editor, load a project -- scene renders in 3D viewport
- [ ] Move an entity -- gizmo works, undo reverts
- [ ] Switch to Babylon.js -- scene re-renders consistently
- [ ] Switch back to PlayCanvas -- scene intact
- [ ] Run `pnpm turbo test` -- all green (744 tests, 0 failures)

## Golden Path (Full Walkthrough, 15-20 minutes)

### Solo Editing

- [ ] Create new project from dashboard
- [ ] Add entity, edit transform, edit inspector property
- [ ] Undo/redo works across edit types
- [ ] Save and reload -- state persists
- [ ] Play-test -- runtime runs without page reload
- [ ] Stop play-test -- editor state preserved

### Engine Switching

- [ ] Switch to Babylon.js via engine switcher
- [ ] Scene renders with consistent entities
- [ ] Edit a property -- delta update works (no full rebuild flicker)
- [ ] Switch back to PlayCanvas -- no data loss

### Collaboration (requires collab server)

Prerequisites: Start collab server with `NEXT_PUBLIC_COLLAB_URL` set.

- [ ] Open two tabs to same project (NEXT_PUBLIC_COLLAB_URL set)
- [ ] Tab A creates entity -- Tab B sees it within 2 seconds
- [ ] Tab B renames entity -- Tab A sees rename
- [ ] Colored collaborator bar shows both users
- [ ] Tab A selects entity -- Tab B hierarchy shows colored border
- [ ] Tab A locks entity -- Tab B sees lock icon, inspector read-only
- [ ] Tab A unlocks -- Tab B can edit again
- [ ] Tab A toggles avatar mode -- Tab B sees capsule
- [ ] Tab A undoes -- only Tab A's change reverts, Tab B unaffected

### Performance

- [ ] Editor feels responsive with default scene
- [ ] No visible lag during property editing
- [ ] Engine switch completes in under 3 seconds

### Performance (200-Entity Scene, requires native GPU)

For the 200-entity FPS measurement that cannot be reliably automated in WSL2:

1. Load or create a project with 100+ entities (manually or via script)
2. Observe that the scene renders without visible stuttering
3. Open browser DevTools, check FPS via Performance tab or rAF counter
4. Verify FPS stays at or above 30 during editing

The headless stress tests (run via `pnpm turbo test`) verify the 200-entity scene compiles to valid Canonical IR and that 4-client CRDT convergence works on the full scene.

### Contracts

- [ ] Run `pnpm turbo test --filter @riff3d/conformance` -- all pass (112 tests)
  - PlayCanvas conformance: 17/17
  - Babylon conformance: 17/17
  - Round-trip: 10/10
  - Lossiness: 29/29
  - Replay: 3/3
  - Property tests: 4/4
  - Benchmarks: 32 pass + 6 skipped (environment-gated)
- [ ] Run `bash scripts/check-adapter-loc.sh` -- PASS
  - PlayCanvas core: 1319/1500
  - Babylon core: 1223/1500

## Review Artifacts Checklist

All artifacts should exist in `.planning/reviews/phase-6/`:

- [ ] `PHASE_6_PLAN_SUMMARY.md` -- Pre-execution plan summary index
- [ ] `PHASE_6_PLAN_REVIEW.md` -- Codex pre-execution plan review
- [ ] `PHASE_6_PLAN_REVIEW_RESPONSE.md` -- Claude response to plan review (HIGH value)
- [ ] `PHASE_6_EVIDENCE.md` -- Comprehensive evidence packet
- [ ] `PHASE_6_REVIEW.md` -- Codex post-execution deep-audit
- [ ] `PHASE_6_REVIEW_RESPONSE.md` -- Claude response with code fixes
- [ ] `PHASE_6_FINAL_REVIEW.md` -- Codex final review
- [ ] `PHASE_6_DECISION.md` -- Gate decision: PASS_WITH_CONDITIONS
- [ ] `PHASE_6_MANUAL_CHECKLIST.md` -- This document

## Test Suite Summary

```
Total tests: 744 passing, 0 failures, 10 skipped
Packages: 9 (ecson, patchops, canonical-ir, fixtures,
           adapter-playcanvas, adapter-babylon, conformance,
           editor, collab-server)
Lint: 0 errors, 2 warnings
Typecheck: all packages clean
```
