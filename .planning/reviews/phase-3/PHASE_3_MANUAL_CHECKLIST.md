# Phase 3 Manual Walkthrough Checklist

## Executive Summary (Spot-Check)
Quick 2-minute verification for when time is short:
- [ ] Run `pnpm turbo test` -- all green (538 pass, 0 fail)
- [ ] Run `bash scripts/check-adapter-loc.sh` -- PASS (898/1500)
- [ ] Open editor, load a project -- scene renders in viewport
- [ ] Move an entity -- gizmo works, undo reverts

## Full Walkthrough (10-15 minutes)

### Contracts
- [ ] Run `pnpm turbo test --filter @riff3d/conformance` -- 78 pass, 6 skipped
- [ ] Run `pnpm turbo test --filter @riff3d/patchops` -- 80 pass, 4 skipped
- [ ] Run `pnpm turbo test --filter @riff3d/ecson` -- 159 pass
- [ ] Run `pnpm turbo test --filter @riff3d/canonical-ir` -- 46 pass
- [ ] Run `pnpm turbo test --filter @riff3d/adapter-playcanvas` -- 134 pass
- [ ] Run `bash scripts/check-adapter-loc.sh` -- PASS, under 1500 LoC

### Editor Pipeline
- [ ] Create new project from dashboard
- [ ] Add entity via hierarchy panel
- [ ] Edit transform via gizmo
- [ ] Edit property via inspector
- [ ] Verify PatchOps appear in operation log
- [ ] Undo/redo works
- [ ] Save, close, reopen -- state preserved

### Adapter
- [ ] Scene renders with PBR materials
- [ ] Camera controls work (orbit, fly)
- [ ] Selection highlight visible
- [ ] Grid renders at ground plane

### Drag Preview (new in Phase 3)
- [ ] Drag asset from browser to viewport -- ghost appears
- [ ] Ghost follows cursor
- [ ] Drop creates entity at ghost position
- [ ] Drag leave removes ghost

### Performance
- [ ] Scene loads in under 1 second
- [ ] Editor feels responsive (no visible lag)

### Review Artifacts
- [ ] `.planning/reviews/phase-3/PHASE_3_EVIDENCE.md` exists with all 6 criteria
- [ ] `.planning/reviews/phase-3/PHASE_3_REVIEW.md` exists (Codex audit)
- [ ] `.planning/reviews/phase-3/PHASE_3_REVIEW_RESPONSE.md` exists (Claude response)
- [ ] `.planning/reviews/phase-3/PHASE_3_FINAL_REVIEW.md` exists (Codex final)
- [ ] `.planning/reviews/phase-3/PHASE_3_DECISION.md` exists with gate ruling
- [ ] Gate decision is PASS_WITH_CONDITIONS
- [ ] All carry-forward items have clear targets (Phase 4/7)
