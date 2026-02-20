# Phase 3 Plan Review — 03-01
Date: 2026-02-20  
Auditor: Codex (gpt-5.3-codex)  
Plan: 03-01-PLAN.md

## Codebase Verification
Checked the referenced adapter and IR files directly.

What matched:
- Core adapter modules exist and consume Canonical IR types: `packages/adapter-playcanvas/src/scene-builder.ts:34`, `packages/adapter-playcanvas/src/environment.ts:19`, `packages/adapter-playcanvas/src/adapter.ts:96`.
- Editor interaction modules exist: `packages/adapter-playcanvas/src/gizmo-manager.ts:64`, `packages/adapter-playcanvas/src/selection-manager.ts:42`, `packages/adapter-playcanvas/src/camera-controller.ts:40`, `packages/adapter-playcanvas/src/grid.ts:45`, `packages/adapter-playcanvas/src/glb-loader.ts:157`.
- `passWithNoTests: true` is currently present (so removal target is valid): `packages/adapter-playcanvas/vitest.config.ts:6`.
- No adapter tests exist yet under `packages/adapter-playcanvas/__tests__`.

What did not match plan assumptions:
- **S2** `packages/canonical-ir/src/schemas.ts` does not exist (plan context references it): `.planning/phases/03-review-gate-foundation/03-01-PLAN.md:82`.
- **S1** Gizmo API names in plan are wrong. Actual public methods are `switchGizmo`, `attachToEntities`, `updateSnap`, `updateEntityMap`, `dispose`; no `setMode`, `attachToEntity`, `detach`: `packages/adapter-playcanvas/src/gizmo-manager.ts:238`, `packages/adapter-playcanvas/src/gizmo-manager.ts:274`.
- **S1** Planned Gizmo store mock shape is wrong. Actual interface requires `getState()` + `subscribe(...)`, not `getGizmoMode()` / `getSelectedEntityIds()`: `packages/adapter-playcanvas/src/gizmo-manager.ts:15`.
- **S1** CameraController test plan uses wrong signature (`initialize(canvas, cameraEntity)`), but implementation is `initialize()` with constructor injection: `packages/adapter-playcanvas/src/camera-controller.ts:74`, `packages/adapter-playcanvas/src/camera-controller.ts:84`.
- **S1** GLB loader plan mocks wrong API (`loadFromUrlAndFilename`); implementation uses `new pc.Asset(...)`, `app.assets.add(asset)`, `app.assets.load(asset)`: `packages/adapter-playcanvas/src/glb-loader.ts:162`, `packages/adapter-playcanvas/src/glb-loader.ts:207`.
- **S1** Verification command is likely incorrect for workspace targeting: `pnpm vitest run --filter @riff3d/adapter-playcanvas` in plan (`03-01-PLAN.md:156`) does not match package filtering conventions.
- **S1** DOM test assumption is incomplete: Vitest config does not set `environment: "jsdom"` and repo has no `jsdom`/`happy-dom` dependency declared; camera/selection tests rely on DOM APIs: `packages/adapter-playcanvas/vitest.config.ts:3`, `packages/adapter-playcanvas/src/selection-manager.ts:130`, `packages/adapter-playcanvas/src/camera-controller.ts:107`.

## Feasibility
Feasible overall, but not executable as written without correcting API assumptions and test environment setup. Current plan would likely fail on gizmo/camera/glb tests and on command verification.

## Completeness
Good module coverage intent (all 9 adapter modules). Gaps:
- Missing explicit handling for DOM test environment/dependency.
- Missing correction for actual GLB loader asset API.
- Missing mention that `destroySceneEntities` returns `void` (plan wording implies returned map).
- Mock spec is underpowered for actual math/event usage (Vec3/Quat methods and static vectors used heavily).

## Architecture Alignment
Mostly aligned:
- Test-only changes in adapter package.
- Canonical IR consumption focus is correct.
- No ECSON/PatchOps boundary violations introduced by plan intent.

Minor alignment issue:
- Context points to non-existent canonical schema path, which weakens contract-first traceability.

## Risk Assessment
Real risks in plan:
- **S1** False confidence from wrong verify command and incorrect API assumptions.
- **S1** DOM-dependent tests may fail in Node environment.
- **S1** Low-fidelity PlayCanvas mocks may not support required adapter math/event paths.

Missed risks:
- Mock must include methods/constants actually used by code (`Vec3.add/mulScalar/clone/lerp`, `Quat.transformVector`, `pc.Vec3.RIGHT/UP/FORWARD`, fog/projection/blend/cull constants).

## Correctness
Key correctness mismatches:
- Non-existent file reference: `packages/canonical-ir/src/schemas.ts`.
- Wrong method names/signatures for GizmoManager and CameraController.
- Wrong GLB loading API assumption.
- Potentially invalid package-targeted Vitest command.

Correct references:
- Adapter source paths listed in context are otherwise valid and present.

## Test Strategy
Strategy direction is strong (API-call assertions with PlayCanvas mocking), but execution details need fixes:
- Configure DOM test environment (`jsdom`) for camera/selection tests.
- Align tests to real APIs, not planned pseudo-APIs.
- Use workspace-correct test commands.
- Strengthen shared mock surface to match real method/property usage.

## Summary
- Key concerns:
  - **S1** Several planned tests target non-existent APIs (`gizmo`, `camera-controller`, `glb-loader` assumptions).
  - **S1** Test runtime setup for DOM is missing.
  - **S1** Verification command likely won’t run the intended package tests.
  - **S2** Broken context path to canonical IR schemas.

- Recommended adjustments:
  1. Update plan task text to actual APIs: `switchGizmo`, `attachToEntities`, `initialize()`, asset `add/load`.
  2. Add explicit DOM environment setup for relevant test files (and required dependency).
  3. Replace verify command with workspace filtering (`pnpm --filter @riff3d/adapter-playcanvas test`).
  4. Replace `packages/canonical-ir/src/schemas.ts` reference with existing canonical type exports (`packages/canonical-ir/src/types/index.ts` or specific schema files).
  5. Expand PlayCanvas mock contract to include all methods/constants exercised by adapter code paths.