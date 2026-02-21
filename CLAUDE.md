# Riff3D - Claude Code Project Guide

## What This Project Is

Riff3D is a web-based 3D engine/editor foundation with a **contract-first, operation-driven architecture**. All meaningful edits flow through: **IQL → PatchOps → ECSON → Canonical IR → Adapters**.

## Architecture Rules (Non-Negotiable)

1. **All mutations flow through PatchOps** — no hidden state mutations in UI or tools. Ever. See Approved Exceptions below.
2. **Contracts before implementation** — specs (Zod schemas, type definitions) must exist before code that uses them.
3. **Adapters read Canonical IR only** — adapters never touch ECSON or PatchOps directly.
4. **2-template promotion rule** — core spec expands only when 2+ independent templates need a capability.
5. **Editor is React; viewport is engine-native** — PlayCanvas/Babylon.js run in raw `<canvas>`, NOT React components. Communication via Zustand store.
6. **Package dependency direction** — `ecson → patchops → canonical-ir → adapters → editor`. No circular deps. Adapters depend on contracts, not UI.
7. **Adapter LoC budget** — each adapter's *core* module (IR consumption, scene builder, component mappers, environment) should stay under 1500 LoC. Editor interaction modules (gizmo manager, selection manager, camera controller, grid, import loaders) are co-located in the adapter package but tracked separately. Exceeding the core budget signals abstraction leak.

### Approved Architectural Exceptions

1. **System-level state replacement bypasses PatchOps** (Approved: Phase 2, 2026-02-20; updated Phase 5, 2026-02-20)
   - **Scope:** `loadProject()`, playtest `stop()` restore, and `switchEngine()` engine preference setter (`metadata.preferredEngine`).
   - **Rationale:** These are system-level state management operations, not user edits. `loadProject()` replaces the entire ECSON document from the database. Playtest `stop()` restores a pre-play snapshot. `switchEngine()` persists the user's engine preference as metadata -- not a scene edit, not undoable. The undo stack is reset/restored in load/playtest operations, so PatchOp tracking is not applicable.
   - **Constraint:** Only `loadProject()`, playtest `stop()`, and `switchEngine()` may bypass PatchOps. All other ECSON mutations must go through `dispatchOp()`.
   - **Bypass points in code:** `scene-slice.ts:loadProject()`, `playtest-slice.ts:stop()`, `engine-slice.ts:switchEngine()`.
   - **Precedent:** Unity, Godot, and Unreal editors all bypass their undo systems for play mode snapshot/restore.

2. **Adapter package LoC budget applies to core module only** (Approved: Phase 2, 2026-02-20)
   - **Scope:** `packages/adapter-playcanvas` contains both core adapter code (818 LoC) and editor interaction tools (1625 LoC). The 1500 LoC budget applies to the core module.
   - **Rationale:** Editor interaction modules (gizmo-manager, selection-manager, camera-controller, grid, glb-loader) need direct PlayCanvas type imports and are co-located for practical dependency reasons. They do not consume IR or violate the adapter boundary.
   - **Phase 3 action:** Split into subpath exports (`@riff3d/adapter-playcanvas` core, `@riff3d/adapter-playcanvas/editor-tools`). Add CI enforcement for core budget.

## Technology Stack

- **Framework**: Next.js 16 + React 19 + TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 4
- **3D Engines**: PlayCanvas ~2.16 (primary), Babylon.js ~8.51 (validation)
- **State**: Zustand ^5.0 (editor↔viewport bridge)
- **Validation**: Zod ^4.3 (schemas ARE the contracts)
- **Collaboration**: Yjs ^13.6 + y-websocket (CRDT-based, offline-first)
- **Backend**: Supabase (auth, Postgres, storage)
- **Testing**: Vitest ^4.0 (unit/integration), Playwright ^1.58 (E2E/visual)
- **Monorepo**: pnpm + Turborepo

## Key File Paths

### Planning & Documentation
- `.planning/PROJECT.md` — project vision, requirements, constraints, key decisions
- `.planning/ROADMAP.md` — 11-phase delivery roadmap (69 v1 requirements)
- `.planning/REQUIREMENTS.md` — full v1 (69) and v2+ (40+) requirements with traceability
- `.planning/STATE.md` — current project state, velocity metrics, session continuity
- `.planning/ROADMAP_REVIEW.md` — critical risks and mitigations
- `.planning/config.json` — GSD workflow configuration
- `.planning/research/` — stack, architecture, features, pitfalls research

### Prototype Reference (Read-Only)
- `/home/frank/riff3d-prototype/.planning/rebuild-research/FOUNDATION.md` — authoritative contract definitions
- `/home/frank/riff3d-prototype/.planning/rebuild-research/00-universal-schema-research.md` — ECSON design rationale
- `/home/frank/riff3d-prototype/.planning/rebuild-research/01-canonical-layer-research.md` — IR design
- `/home/frank/riff3d-prototype/.planning/rebuild-research/02-iql-research.md` — IQL language design
- `/home/frank/riff3d-prototype/.planning/rebuild-research/03-spatial-validation-research.md` — physics validation

### Engine References (Read-Only, for adapter research)
- `/home/frank/playcanvas-engine/` — PlayCanvas engine source (ECS, SceneParser)
- `/home/frank/playcanvas-editor/` — PlayCanvas editor source (Observer, collaboration)
- `/home/frank/babylonjs/` — Babylon.js engine source (Node, Behavior, Scene)
- `/home/frank/babylon-editor/` — Babylon.js editor source (undo/redo patterns)

### Target Monorepo Structure (Phase 1 will create)
```
riff3d/
├── apps/editor/           # Next.js editor app
├── packages/ecson/        # ECSON schema, Zod validators (foundation, no internal deps)
├── packages/patchops/     # PatchOps engine (depends on ecson)
├── packages/canonical-ir/ # IR spec + compiler (depends on ecson)
├── packages/iql/          # IQL parser + compiler (depends on patchops, ecson)
├── packages/adapter-playcanvas/  # PlayCanvas adapter (depends on canonical-ir)
├── packages/adapter-babylon/     # Babylon.js adapter (depends on canonical-ir)
├── packages/fixtures/     # Golden test projects (depends on ecson)
├── packages/conformance/  # Test harness (depends on canonical-ir, fixtures)
└── servers/collab/        # y-websocket server
```

## Coding Conventions

- **TypeScript strict mode** — no `any`, no implicit returns, no unchecked index access
- **Zod schemas are the source of truth** — derive TypeScript types from Zod with `z.infer<>`
- **PatchOps are discriminated unions** — every op has a `type` field, typed payload, and inverse
- **Entity IDs use nanoid** — globally unique, URL-safe, stable across sessions
- **Tests are non-negotiable** — every PatchOp needs: apply test, inverse test, replay determinism test
- **Adapter LoC budget** — each adapter should stay under 1500 LoC; exceeding signals abstraction leak
- **Golden fixtures drive conformance** — 5-10 canonical projects covering transforms, materials, lights, animation, events

## Common Patterns

### PatchOp Application
```typescript
// All edits go through PatchOps — never mutate ECSON directly
const op = createPatchOp('SetProperty', { entityId, path, value });
const inverse = applyOp(ecsonDoc, op); // Returns the inverse op for undo
```

### Adapter Interface
```typescript
// Adapters consume Canonical IR, not ECSON
interface EngineAdapter {
  initialize(canvas: HTMLCanvasElement): void;
  loadScene(ir: CanonicalIR): void;
  applyDelta(delta: IRDelta): void; // Incremental updates, not full rebuild
  dispose(): void;
}
```

## What To Avoid

- **React-Three-Fiber** — couples 3D to React, breaks engine-agnosticism
- **Three.js directly** — no ECS, no physics, no serialization; would rebuild PlayCanvas poorly
- **Colyseus for editor** — designed for game rooms, not document editing
- **Redux** — too much boilerplate for high-frequency PatchOp application
- **Socket.io** — use y-websocket (Yjs handles collaboration semantics)
- **Direct state mutation** — everything through PatchOps

## Current Status

Phase 1 of 11: Contracts & Testing Spine — ready to plan.
See `.planning/STATE.md` for current position and `.planning/ROADMAP.md` for full plan.

## Skills Installed

- **vercel-react-best-practices** — 57 rules for React/Next.js perf optimization (waterfalls, bundle size, SSR, re-renders). Auto-activates when writing/reviewing React code.
- **vercel-composition-patterns** — React composition and component architecture patterns from Vercel Engineering.
- **web-design-guidelines** — Web design best practices for production-grade UIs.

## Project Agents (`.claude/agents/`)

Custom agents for Riff3D's architecture. **Review and update at each Review Gate phase (3, 6, 11).**

- **contract-validator** — validates PatchOps/ECSON/IR specs for consistency, inverse correctness, dependency boundaries
- **adapter-reviewer** — reviews adapter code for conformance patterns, LoC budget, architectural boundaries
- **test-writer** — generates golden fixture tests, PatchOps invariant tests, round-trip tests

## Independent Reviewer (Codex CLI)

Codex CLI (`codex`) is installed and configured as the independent auditor per `PHASE_REVIEW_PROTOCOL.md`.

**Script:** `scripts/codex-review.sh`

```bash
# Pre-execution: review phase plan (requires PLAN_SUMMARY)
./scripts/codex-review.sh plan-review <N>                   # improved single-pass
./scripts/codex-review.sh plan-review <N> --plan XX-YY      # single plan
./scripts/codex-review.sh plan-review <N> --chunked         # per-plan + synthesis (5+ plans)
./scripts/codex-review.sh plan-review <N> --synthesis       # synthesis only

# Post-execution: review evidence packet (requires EVIDENCE)
./scripts/codex-review.sh post-review <N>

# Final gate decision (requires REVIEW_RESPONSE)
./scripts/codex-review.sh final-review <N>

# Mid-phase checkpoint
./scripts/codex-review.sh checkpoint <N>

# Ad-hoc file review
./scripts/codex-review.sh ad-hoc <files...> --prompt "Custom instructions"
```

All review outputs go to `.planning/reviews/phase-<N>/`. Codex runs in read-only sandbox mode.

## MCP Servers Available

- **Context7** — use for up-to-date docs on PlayCanvas, Babylon.js, Yjs, Zod, Next.js, Zustand, etc.
- **Supabase** — use for database operations, auth, storage management
- **Playwright** — use for browser automation, visual regression testing

## Plugins to Install Manually

Run these in Claude Code CLI when starting a new session:
```
/plugin install frontend-design@claude-plugins-official
/plugin install feature-dev@claude-plugins-official
/plugin install typescript-lsp@claude-plugins-official
```
