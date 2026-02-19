---
phase: 01-contracts-testing-spine
plan: 01
subsystem: infra
tags: [pnpm, turborepo, typescript, vitest, eslint, monorepo, ci]

# Dependency graph
requires: []
provides:
  - "pnpm + Turborepo monorepo scaffold with 5 core packages and editor app"
  - "Strict TypeScript base config (noUncheckedIndexedAccess, exactOptionalPropertyTypes)"
  - "Vitest test infrastructure with passWithNoTests for all packages"
  - "ESLint flat config with typescript-eslint"
  - "GitHub Actions CI pipeline (typecheck, lint, test)"
  - "pnpm catalogs for shared dependency versions"
  - "Workspace dependency graph enforcing package boundaries"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, all-future-phases]

# Tech tracking
tech-stack:
  added: [pnpm@10.30.0, turbo@2.8.10, typescript@5.9.3, vitest@4.0.18, zod@3.25.76, nanoid@5.1.6, fast-check@4.5.3, "@fast-check/vitest@0.2.4", eslint@9.39.2, typescript-eslint@8.56.0]
  patterns: [pnpm-workspace-catalogs, turbo-task-pipeline, ts-project-references, vitest-per-package, eslint-flat-config]

key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - turbo.json
    - tsconfig.base.json
    - vitest.config.ts
    - eslint.config.mjs
    - .github/workflows/ci.yml
    - packages/ecson/package.json
    - packages/patchops/package.json
    - packages/canonical-ir/package.json
    - packages/fixtures/package.json
    - packages/conformance/package.json
    - apps/editor/package.json
    - packages/ecson/__tests__/smoke.test.ts
  modified:
    - .gitignore

key-decisions:
  - "Used pnpm catalogs for shared dependency versions (zod, nanoid, fast-check) instead of per-package version specifications"
  - "ESLint flat config (eslint.config.mjs) with typescript-eslint instead of deprecated .eslintrc format"
  - "Editor app uses eslint directly (not next lint) since Next.js 16 removed the lint subcommand"
  - "Source-based exports (./src/index.ts) for internal packages during development, no build step needed for cross-package imports"
  - "Excluded apps/editor from root ESLint config since it has its own Next.js-specific config"

patterns-established:
  - "Package scaffold pattern: package.json, tsconfig.json (extends base), vitest.config.ts, src/index.ts"
  - "Dependency direction enforcement: ecson (leaf) -> patchops/canonical-ir/fixtures -> conformance"
  - "pnpm catalogs for version alignment across monorepo"
  - "Turbo pipeline: build depends on ^build, test/typecheck depend on ^build, lint is independent"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 1 Plan 1: Monorepo Scaffold Summary

**pnpm 10 + Turborepo 2.8 monorepo with 5 core packages (ecson, patchops, canonical-ir, fixtures, conformance), strict TypeScript, Vitest, ESLint, and GitHub Actions CI**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T21:48:58Z
- **Completed:** 2026-02-19T21:53:14Z
- **Tasks:** 2
- **Files modified:** 43

## Accomplishments
- Scaffolded complete pnpm + Turborepo monorepo with correct package boundaries
- Configured strict TypeScript (noUncheckedIndexedAccess, exactOptionalPropertyTypes) as base config
- Established dependency direction: ecson (no internal deps) -> patchops/canonical-ir/fixtures -> conformance
- Created GitHub Actions CI pipeline running typecheck, lint, test on push/PR
- Smoke test in ecson proving end-to-end test pipeline works (2 tests passing)
- All 21 turbo tasks pass across 6 workspace packages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create monorepo scaffold with all packages and shared configuration** - `8c35dca` (feat)
2. **Task 2: Create GitHub Actions CI pipeline and validate end-to-end** - `f6d8b48` (feat)

## Files Created/Modified
- `package.json` - Root workspace config with turbo scripts, packageManager field
- `pnpm-workspace.yaml` - Workspace globs, esbuild build approval, shared catalogs (zod, nanoid, fast-check)
- `turbo.json` - Task pipeline with topological build ordering
- `tsconfig.base.json` - Shared strict TypeScript config for all packages
- `vitest.config.ts` - Root vitest config with workspace project discovery
- `eslint.config.mjs` - Root ESLint flat config with typescript-eslint
- `.gitignore` - Updated for monorepo (dist/, .turbo/, node_modules/)
- `.github/workflows/ci.yml` - GitHub Actions CI (typecheck, lint, test)
- `packages/ecson/` - ECSON package (zod, nanoid, no internal deps)
- `packages/patchops/` - PatchOps package (depends on ecson)
- `packages/canonical-ir/` - Canonical IR package (depends on ecson)
- `packages/fixtures/` - Fixtures package (depends on ecson)
- `packages/conformance/` - Conformance package (depends on canonical-ir, fixtures, patchops)
- `apps/editor/` - Next.js 16 editor app (moved from root)
- `packages/ecson/__tests__/smoke.test.ts` - Smoke test verifying VERSION export

## Decisions Made
- **pnpm catalogs over per-package versions:** Centralized version management in pnpm-workspace.yaml for zod, nanoid, fast-check ensures alignment across all packages
- **ESLint flat config:** Used the modern eslint.config.mjs format instead of deprecated .eslintrc since ESLint 9+ is the standard
- **Editor uses `eslint .` not `next lint`:** Next.js 16 removed the `lint` subcommand, so editor runs eslint directly with its own config
- **Source-based exports for dev:** Package exports point to `./src/index.ts` for TypeScript monorepo development (no build step needed for internal consumption)
- **Excluded editor from root ESLint:** Editor has its own Next.js-specific eslint config, root config covers only the packages

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed fast-check catalog version**
- **Found during:** Task 1 (pnpm install)
- **Issue:** Plan specified fast-check ^4.10.0 in catalog but latest available is 4.5.3
- **Fix:** Changed catalog version to ^4.5.3
- **Files modified:** pnpm-workspace.yaml
- **Verification:** pnpm install succeeds
- **Committed in:** 8c35dca (Task 1 commit)

**2. [Rule 1 - Bug] Fixed editor lint script for Next.js 16**
- **Found during:** Task 1 (turbo lint verification)
- **Issue:** Next.js 16 removed the `next lint` subcommand, causing lint failure
- **Fix:** Changed editor lint script from `next lint` to `eslint .`
- **Files modified:** apps/editor/package.json
- **Verification:** pnpm turbo lint passes for all 6 packages
- **Committed in:** 8c35dca (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correct operation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Monorepo scaffold is complete and verified
- All packages ready for schema implementation (packages/ecson/src/ is the starting point for Plan 01-02)
- Dependency boundaries enforced, CI pipeline active
- No blockers for subsequent plans

## Self-Check: PASSED

- All 30 files verified present on disk
- Commit 8c35dca (Task 1) verified in git log
- Commit f6d8b48 (Task 2) verified in git log

---
*Phase: 01-contracts-testing-spine*
*Completed: 2026-02-19*
