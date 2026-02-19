# Rapier 3D Physics Spike — Completed

> Spike conducted in `~/rapier-spike` (isolated from riff3d repo).
> Full findings: `~/rapier-spike/FINDINGS.md`
> Test suite: 57 tests, all passing.

## Decision

**Use `@dimforge/rapier3d-compat` v0.19.x** as the web runtime physics adapter.

## Key Facts

- Package: `@dimforge/rapier3d-compat` (not the base package — compat inlines WASM for bundler support)
- Async `init()` required before any API use
- `world.step()` must be called before scene queries (broadphase is lazy)
- All WASM objects require explicit `.free()` — no GC
- Vectors/quaternions are plain `{x,y,z}` / `{x,y,z,w}` objects — zero conversion overhead

## Performance (gaming PC — expect 3-5x slower on mid-range, 5-10x on mobile)

| Scenario | Time |
|----------|------|
| 1000 bodies, single step | ~0.3ms |
| 5000 bodies, single step | ~1.3ms |
| 60 steps x 1000 bodies | ~28ms |
| 1000 raycasts, 500-body scene | ~1.9ms |

## Architecture Implications

- Rapier is a **web runtime adapter only** — not an export dependency
- Rendering adapters (PlayCanvas/Babylon) never touch physics — they read transforms from Canonical IR
- Physics contracts (Zod schemas) must stay engine-agnostic — model universal concepts (body types, primitive shapes, material properties) that map to PhysX, Havok, Bullet, etc.
- Export to Unity/Unreal uses their native physics engines against the same ECSON contracts

## Contract Surface (for Zod schema design)

Body types: `dynamic | fixed | kinematicPosition | kinematicVelocity`

Collider shapes: `ball | cuboid | capsule | cylinder | convexHull | trimesh | heightfield`

Material properties: `density`, `friction`, `restitution`, `isSensor`, `collisionGroups`

Body properties: `mass`, `gravityScale`, `linearDamping`, `angularDamping`, `ccdEnabled`, axis locking

## Gotchas to Document

1. `-compat` package required for Vite/bundler environments
2. Async init must complete during app bootstrap, not lazily
3. Broadphase not built until first `world.step()` — scene queries fail without it
4. WASM memory management: tie `.free()` to entity deletion via PatchOps
5. Collision groups use packed 32-bit format: `(membership << 16) | filter`
