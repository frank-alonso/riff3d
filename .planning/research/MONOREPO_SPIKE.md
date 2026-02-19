# Monorepo Scaffold Spike — Completed

> Spike conducted in `~/monorepo-spike` (isolated from riff3d repo).
> Full findings: `~/monorepo-spike/FINDINGS.md`
> All pipelines passing: build, test, typecheck across 6 packages.

## Decision

**Use pnpm 10 + Turborepo 2.8 + TypeScript 5.9 + Vitest 4.0** with the configuration patterns below.

## Gotchas (Apply During Plan 01-01 Execution)

### 1. `packageManager` field required
Turbo 2.8 refuses to resolve workspaces without it. Add to root `package.json`:
```json
"packageManager": "pnpm@10.30.0"
```

### 2. pnpm 10 blocks build scripts by default
Vitest depends on esbuild which needs a postinstall. Add to `pnpm-workspace.yaml`:
```yaml
onlyBuiltDependencies:
  - esbuild
```

### 3. Vitest `passWithNoTests` required
Vitest exits code 1 with no test files. Every `vitest.config.ts` needs:
```ts
test: { passWithNoTests: true }
```

### 4. Turbo auto-scopes to cwd package
Running `pnpm turbo test` from inside `packages/ecson/` only runs ecson tests. Always run turbo from monorepo root.

### 5. Browser-targeting packages need `lib: ["DOM"]`
Base tsconfig uses `lib: ["ES2022"]` (correct for pure TS packages). The editor app needs `"DOM"` added in its own tsconfig.

## Validated Version Matrix

| Package | Installed Version | Notes |
|---------|-------------------|-------|
| pnpm | 10.30.0 | Research assumed ^9 — pnpm 10 has stricter peer deps and build script approval |
| turbo | 2.8.10 | Matches ^2 expectation |
| typescript | 5.9.3 | Matches ^5.9 expectation |
| vitest | 4.0.18 | Matches ^4.0 expectation |
| zod | 4.3.6 | Matches ^4.3 expectation |

### Other Verified Versions (not installed in spike)

| Package | Latest Stable | Expected | Match? |
|---------|---------------|----------|--------|
| yjs | 13.6.29 | ^13.6 | YES |
| y-websocket | **3.0.0** | ^2.0 | NO — major bump. Stay on ^2.0 for now, evaluate v3 before Phase 5 |
| y-indexeddb | 9.0.12 | ^9.0 | YES |
| @dimforge/rapier3d-compat | 0.19.3 | ~0.19 | YES |

## Validated Configuration Patterns

### pnpm-workspace.yaml
```yaml
packages:
  - "apps/*"
  - "packages/*"

onlyBuiltDependencies:
  - esbuild
```

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

### tsconfig.base.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

### Per-package package.json pattern
```json
{
  "name": "@riff3d/<name>",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "scripts": {
    "build": "tsc --build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@riff3d/ecson": "workspace:*"
  }
}
```

### Per-package tsconfig pattern
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"],
  "references": [{ "path": "../ecson" }]
}
```

## Dependency Graph (Validated — all cross-package imports work)

```
ecson (no internal deps, depends on zod)
  ↑
patchops (depends on ecson)
canonical-ir (depends on ecson)
fixtures (depends on ecson)
  ↑
conformance (depends on canonical-ir, fixtures)
editor app (depends on ecson, patchops)
```
