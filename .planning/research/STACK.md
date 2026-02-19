# Stack Research

**Domain:** Web-based 3D engine/editor foundation with contract-first architecture, real-time collaboration, portable scene representation, and multiple runtime adapters
**Researched:** 2026-02-19
**Confidence:** MEDIUM-HIGH (versions verified from local repo clones and installed packages; architectural rationale from prototype research, local codebase analysis, and training data)

> **Note on version verification:** WebSearch, WebFetch, and Bash were unavailable during this research session. Versions are sourced from: (1) installed `package.json` in `/home/frank/riff3d`, (2) local clones of PlayCanvas engine/editor and Babylon.js, (3) npm versions from the prototype's STACK.md research dated 2026-02-10. All versions marked accordingly. Versions should be re-verified via `npm view` before first install.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Next.js | 16.1.6 (installed) | App framework, routing, SSR for non-3D pages | Already installed in the project. App Router provides file-based routing, server components for editor chrome/lobby/profiles. Turbopack dev server for fast iteration. | HIGH |
| React | 19.2.3 (installed) | UI layer for editor panels, inspector, hierarchy | Already installed. React 19 brings `use()`, improved Suspense (critical for async 3D asset loading), and server components. The editor is a React app; the 3D runtimes are NOT React-based (see adapters below). | HIGH |
| TypeScript | ^5.9 (prototype verified) | Type safety | Non-negotiable for a multi-layer architecture (PatchOps, ECSON, Canonical IR, Adapters). Types are the contracts. Strict mode required. | HIGH |
| PlayCanvas Engine | ~2.16 (local clone: 2.16.1) | Web runtime adapter #1 | MIT licensed, full ECS architecture, native WebGPU support, built-in physics (Ammo.js), animation state graphs, script system with typed attributes. Its `Entity → Component → ComponentSystem` pattern maps directly to ECSON entities/components. PlayCanvas editor uses ShareDB (OT) for collaboration — proving the pattern works at scale. | HIGH |
| Babylon.js | ~8.51 (@babylonjs/core 8.51.2 from local clone) | Web runtime adapter #2 | Apache 2.0 licensed, imperative scene graph (TransformNode/Mesh hierarchy), Behavior interface for attachable logic, Observable pattern for events, Havok physics. Its architecture is fundamentally different from PlayCanvas — which is exactly the point: if the Canonical IR works for both, it is truly engine-agnostic. | HIGH |
| Zustand | ^5.0 (prototype verified 5.0.11) | Client state management for editor | Lightweight, works outside React render cycle via `getState()` (critical for editor operations that must not trigger re-renders). `subscribeWithSelector` for granular updates. Already proven in prototype. | HIGH |
| Zod | ^4.3 (prototype verified 4.3.6) | Runtime schema validation | TypeScript-first with inference. Validates PatchOps, ECSON documents, component properties, and API inputs. Critical for the contract-first architecture — every boundary needs validation. | HIGH |
| Tailwind CSS | ^4 (installed) | Utility-first CSS | v4 with CSS-first config. Zero-runtime CSS. Already installed. Fast iteration on editor UI panels. | HIGH |

### Schema & Serialization

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Zod | ^4.3 | ECSON schema definitions + validation | Zod schemas ARE the ECSON spec. They define entity/component shapes, validate PatchOps, and generate TypeScript types. Single source of truth for the contract layer. | HIGH |
| JSON (native) | — | ECSON and Canonical IR serialization format | JSON is human-readable, diffable, version-controllable, and trivially parseable in every target. ECSON stores as JSON. Canonical IR compiles to JSON (optionally packaged as glTF + extensions for asset bundling). No binary format needed for the portable subset. | HIGH |
| glTF 2.0 alignment | — | Canonical IR structure conventions | Align Canonical IR with glTF conventions: PBR materials match glTF PBR, physics uses KHR_physics_rigid_bodies naming, standard assets serialize as glTF. Game-specific data uses RIFF_ vendor extensions. This future-proofs for .glb export without requiring it now. | MEDIUM |
| nanoid | ^5.1 (prototype verified) | Stable ID generation | Entity IDs, component keys, operation IDs, wire IDs. Shorter than UUID, URL-safe, collision-resistant. All IDs must be globally unique and stable across sessions per PatchOps contract. | HIGH |

### Collaboration & Real-Time

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Yjs | ^13.6 (training data; VERIFY) | CRDT-based shared operation log | Yjs is the standard CRDT library for collaborative editing (used by Tiptap, BlockNote, Liveblocks, JupyterLab). For Riff3D: model ECSON as a Yjs document with shared types (Y.Map for entities, Y.Array for ordered children). PatchOps compile to Yjs mutations. Yjs handles conflict resolution, offline editing, and automatic merge. This replaces both Colyseus and Socket.io for editor collaboration. | MEDIUM |
| y-websocket | ^2.0 (training data; VERIFY) | WebSocket provider for Yjs | Standard transport for Yjs documents. Handles connection management, reconnection, and awareness (cursors/presence). Can run on any Node.js server. | MEDIUM |
| y-indexeddb | ^9.0 (training data; VERIFY) | Offline persistence for Yjs | Stores Yjs document state in IndexedDB for offline editing. Users can edit without connection; changes merge automatically when reconnected. Critical for mobile/unreliable-network scenarios. | MEDIUM |

### Monorepo & Build

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| pnpm | ^9 (training data; VERIFY) | Package manager | Workspace support, disk-efficient (content-addressable store), strict by default (no phantom dependencies). Better than npm workspaces for monorepos. | MEDIUM |
| Turborepo | ^2 (training data; VERIFY) | Monorepo build orchestration | Caches build outputs, parallelizes tasks across packages, understands dependency graph. Pairs with pnpm workspaces. Required for the `packages/ecson`, `packages/patchops`, `packages/canonical-ir`, etc. structure. | MEDIUM |
| Vitest | ^4.0 (prototype verified 4.0.18) | Unit/integration testing | Fast, ESM-native, Vite-based. Test PatchOps determinism, ECSON round-trips, Canonical IR compilation, adapter mapping. The testing spine is the project's safety net. | HIGH |
| Playwright | ^1.58 (prototype verified 1.58.2) | E2E and visual regression | Test editor interactions, golden path flows. Visual comparison for 3D viewport output (screenshot-based regression for PlayCanvas and Babylon adapter rendering). | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| Immer | ^11.1 (prototype verified) | Immutable state updates | Complex nested ECSON mutations in the editor store. Zustand has built-in Immer middleware. Use for scene graph mutations that must produce new references for React. | HIGH |
| @tanstack/react-query | ^5.90 (prototype verified) | Server state / async data | Fetching project lists, user profiles, template catalogs. Caching, deduplication, background refetch. NOT for real-time scene state (Yjs handles that). | HIGH |
| Radix UI | ^1.1 (prototype verified) | Accessible headless UI primitives | Dialog, dropdown, context menu, tooltip, tabs for editor panels. Unstyled = works with Tailwind. Use for all editor chrome. | HIGH |
| @supabase/supabase-js | ^2.95 (prototype verified) | Backend: auth, DB, storage | Auth (social logins), Postgres (project metadata, user profiles), Storage (3D assets — GLB, textures, audio). NOT for real-time scene data (Yjs handles that). | HIGH |
| @supabase/ssr | ^0.8 (prototype verified) | Supabase + Next.js SSR integration | Cookie-based auth in server components and middleware. Required for App Router auth patterns. | HIGH |

### Development Tools

| Tool | Version | Purpose | Notes | Confidence |
|------|---------|---------|-------|------------|
| Vitest | ^4.0 | Unit / integration testing | Primary test runner. Test PatchOps, ECSON, Canonical IR, adapters. | HIGH |
| Playwright | ^1.58 | E2E / visual regression | Editor flows, golden path, adapter visual conformance. | HIGH |
| ESLint | ^9 (installed) | Linting | Flat config. Use with `@typescript-eslint`. | HIGH |
| Turbopack | (bundled with Next.js) | Dev bundler | `next dev --turbo`. Fast HMR for the editor app. | HIGH |

---

## PlayCanvas vs. Babylon.js: Architecture Comparison for Adapter Feasibility

This comparison is central to the dual-adapter strategy. Both engines must be viable targets for the Canonical IR.

### Architecture Models

| Aspect | PlayCanvas (v2.17) | Babylon.js (v8.52) |
|--------|--------------------|--------------------|
| **Core paradigm** | Entity-Component-System (ECS) | Imperative scene graph (OOP) |
| **Scene node** | `Entity` extends `GraphNode` | `TransformNode` / `Mesh` extends `Node` |
| **Component model** | `entity.addComponent('render', data)` — components are data bags managed by global `ComponentSystem` instances | No component system. Functionality via class hierarchy (`Mesh`, `Light`, `Camera`) and `Behavior<T>` interface |
| **Behavior/logic** | `ScriptComponent` with typed attributes, lifecycle: `initialize/update/postUpdate` | `Behavior<T>` interface: `init/attach/detach`. No built-in update loop — attach to `scene.onBeforeRenderObservable` |
| **Physics** | Built-in Ammo.js: `rigidbody` + `collision` as separate components | Pluggable: Havok (default), Cannon, Ammo. `PhysicsAggregate` wraps body+shape |
| **Event system** | `app.fire/on` (global event bus), per-entity events | `Observable<T>` pattern — type-safe, per-object observables |
| **Scene format** | Flat entity map keyed by GUID, `parent` field references, component data as nested objects | Flat arrays for meshes/lights/cameras/materials, `parentId` references, physics on mesh |
| **Serialization** | `SceneParser` reads flat JSON entity map, creates `Entity` hierarchy | `SceneSerializer`/`SerializationHelper` with decorator-driven serialization |
| **Asset system** | Numeric asset IDs in a shared registry, components reference by ID | Materials/textures as separate objects referenced by ID/name |
| **TypeScript** | Engine in JavaScript, types via JSDoc + `.d.ts`. Editor in TypeScript | Engine fully in TypeScript (monorepo with ~80 packages) |
| **WebGPU** | Native support (in keywords) | Native support |
| **License** | MIT | Apache 2.0 |

### Adapter Feasibility Assessment

| Canonical IR Concept | PlayCanvas Adapter | Babylon.js Adapter | Difficulty |
|---------------------|--------------------|--------------------|------------|
| Entity + Transform | `new Entity()` + `setPosition/Rotation/Scale` | `new TransformNode()` or `new Mesh()` | Easy for both |
| MeshRenderer (primitive) | `addComponent('render', { type: 'box' })` | `MeshBuilder.CreateBox(name, opts, scene)` | Easy — different API, same result |
| MeshRenderer (asset) | `addComponent('render', { asset: modelAsset })` | `SceneLoader.ImportMesh(...)` | Easy — both load glTF natively |
| PBR Material | PlayCanvas `StandardMaterial` | Babylon `PBRMaterial` | Medium — property name mapping needed |
| Light (all types) | `addComponent('light', { type, ... })` | `new DirectionalLight/PointLight/SpotLight(...)` | Easy — constructor vs component |
| Camera | `addComponent('camera', { ... })` | `new FreeCamera/ArcRotateCamera(...)` | Easy |
| RigidBody + Collider | `addComponent('rigidbody', ...)` + `addComponent('collision', ...)` | `new PhysicsAggregate(node, shapeType, { mass, ... })` | Medium — PC separates body/collider, Babylon combines in aggregate |
| Trigger volume | `collision` component with `trigger: true` | `PhysicsAggregate` as sensor | Medium |
| Audio | `addComponent('sound', { ... })` | `new Sound(name, url, scene, ...)` | Easy |
| Custom behavior | `ScriptComponent` with attributes | `Behavior<T>` class | Hard — fundamentally different models. PC scripts have lifecycle hooks; Babylon behaviors are simpler. Need code generation for each. |
| Event wiring | Script-based event dispatch | Observable subscriptions | Medium — different patterns, both expressible |
| Animation | `addComponent('anim', ...)` with state graph | `AnimationGroup` + `Animator` | Medium |
| Parent-child hierarchy | `entity.addChild(child)` | `node.parent = parentNode` | Easy |

**Adapter size estimate:**
- PlayCanvas adapter: ~800-1200 LoC (ECS maps naturally to ECSON components)
- Babylon.js adapter: ~1000-1500 LoC (imperative API requires more mapping code for the non-component model)

**Key insight from codebase analysis:** PlayCanvas's ECS is closer to ECSON's component model, making it the "easier" adapter. Babylon.js's imperative/OOP model requires the adapter to construct class instances and wire observables — more code but well-defined mapping. Both engines serialize to flat JSON with parent references, which aligns with the Canonical IR's flat node array design.

**Risk assessment:** LOW for standard components (mesh, light, camera, physics). MEDIUM for custom behaviors (script generation). The Canonical IR's `BehaviorComponent` with per-engine implementation references (designed in the prototype's canonical layer research) handles this cleanly.

---

## Collaboration Strategy: Yjs CRDTs vs. Alternatives

### Why Yjs over OT (ShareDB), Colyseus, or Socket.io

The prototype used Colyseus for editor collaboration (message-based deltas with object locking). The FOUNDATION.md specifies a "shared operation log model" and "collaboration-ready core." After analyzing the PlayCanvas editor's ShareDB-based OT approach and the prototype's lock-based approach, the recommendation is Yjs CRDTs.

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Object locking (prototype)** | Simple to implement, prevents conflicts by exclusion | Frustrating UX (can't edit locked objects), doesn't scale to 5+ users, no offline support, doesn't compose with undo/redo | Rejected — too limiting |
| **ShareDB / OT (PlayCanvas editor)** | Proven at PlayCanvas scale, strong consistency | Requires always-online server, complex operation transform functions, hard to extend, no offline | Rejected — too coupled to server |
| **Colyseus schema sync** | Built for game state, delta serialization | Not designed for document editing, no conflict resolution, schema is rigid, no offline | Rejected — wrong tool for editor state |
| **Yjs CRDTs** | Automatic conflict resolution, offline-first, provider-agnostic (WebSocket/WebRTC/IndexedDB), awareness protocol for cursors/presence, battle-tested in collaborative editors | Higher learning curve, eventual consistency (not immediate), document size grows over time | **Recommended** |

### How Yjs fits the architecture

```
IQL (intent)
    ↓ compiles to
PatchOps (operations)
    ↓ applied to
ECSON (Yjs shared document)  ←→  y-websocket server  ←→  Other clients
    ↓ compiles to                                         (automatic CRDT merge)
Canonical IR
    ↓
Engine Adapters
```

- **ECSON as Yjs document:** The entity map is a `Y.Map<string, Y.Map>`. Each entity's components are nested `Y.Map`s. Yjs handles concurrent edits, merges, and undo/redo natively.
- **PatchOps → Yjs mutations:** Each PatchOp (CreateEntity, SetProperty, etc.) maps to a Yjs transaction. Transactions are atomic and generate undo/redo entries automatically.
- **Awareness for presence:** Yjs awareness protocol provides cursor positions, selection state, and "who's editing what" — replacing the manual presence system from the prototype.
- **Offline editing:** `y-indexeddb` persists the Yjs document locally. Users can edit offline; changes merge when reconnected.
- **Server persistence:** The y-websocket server can snapshot Yjs documents to Supabase (or any DB) for durable storage.

### CRDT Library Comparison

| Library | Architecture | Maturity | Size | Best For | Confidence |
|---------|-------------|----------|------|----------|------------|
| **Yjs** (recommended) | Integrated CRDT types (Y.Map, Y.Array, Y.Text) | Very mature, 10+ years | ~15KB min | Document-oriented collaboration, editor state | MEDIUM (training data) |
| **Automerge** | General-purpose CRDT, Rust+WASM core | Mature, backed by Ink & Switch | ~300KB WASM | Complex nested JSON collaboration | MEDIUM (training data) |
| **Liveblocks** | SaaS platform wrapping Yjs | Production-ready | N/A (SaaS) | Fast integration, managed infrastructure | MEDIUM (training data) |
| **PartyKit** | Serverless collab platform | Newer | N/A (platform) | Cloudflare-native, simpler model | LOW (training data) |

**Why Yjs over Automerge:** Yjs is smaller (~15KB vs ~300KB WASM), has more providers (WebSocket, WebRTC, IndexedDB), and is the foundation for most collaborative editors (Tiptap, BlockNote, JupyterLab). Automerge's Rust WASM core adds complexity. For ECSON's structure (maps of maps with typed values), Yjs shared types are a natural fit.

**Why not Liveblocks:** SaaS dependency for a core architectural concern. Riff3D needs to own the collaboration layer to support self-hosting and custom server logic. However, Liveblocks uses Yjs under the hood — if self-hosting is deferred, it's a viable shortcut.

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| React-Three-Fiber (R3F) as a runtime | R3F couples the 3D runtime to React. Riff3D's architecture requires engine-agnostic runtimes. The editor is React; the 3D runtimes are PlayCanvas and Babylon.js — neither uses React. Using R3F would make the "portable Canonical IR" concept impossible. | PlayCanvas + Babylon.js as runtime adapters. Editor UI is React; 3D viewport is engine-native canvas. |
| Three.js directly | Three.js has no ECS, no built-in physics, no script system, no scene serialization format. You'd rebuild PlayCanvas poorly. It's a rendering library, not an engine. | PlayCanvas (which uses its own renderer, WebGPU-capable) or Babylon.js |
| Colyseus for editor collaboration | Colyseus is designed for game rooms with authoritative server state, not collaborative document editing. Its schema system is rigid and doesn't support offline editing, undo/redo, or automatic conflict resolution. | Yjs with y-websocket for editor collaboration. Reserve Colyseus for potential future game runtime if multiplayer gameplay is added as a top layer. |
| Socket.io for anything | Socket.io is a generic WebSocket wrapper with no collaboration semantics. You'd rebuild Yjs (or Colyseus) poorly. | Yjs y-websocket (which uses WebSocket underneath) |
| MongoDB / document DB | The core data model (ECSON) is a structured JSON document with typed schemas. Supabase (Postgres) with JSONB columns handles this while providing relational queries for metadata (users, projects, templates). Document DBs add complexity without benefit. | Supabase (Postgres) for metadata; Yjs document state for live ECSON; Supabase Storage for binary assets |
| Redux / Redux Toolkit | Too much boilerplate for editor state that changes frequently. `dispatch` + middleware pattern doesn't fit high-frequency PatchOp application. | Zustand with `subscribeWithSelector` — lightweight, works outside React, integrates with Yjs via `subscribe` |
| CSS-in-JS (styled-components, emotion) | Runtime CSS-in-JS hurts performance in React 19 server components and adds JS bundle size. | Tailwind CSS 4 (zero-runtime) |
| Firebase | Unpredictable per-read pricing at scale. Weaker SQL capabilities for complex queries (project search, template catalogs). | Supabase — Postgres-based, predictable pricing, better query capabilities |
| Custom binary scene format | Premature optimization. JSON is human-readable, diffable, debuggable, and version-controllable. Binary formats optimize for a problem (file size) that doesn't exist yet. GLB bundling for asset delivery is different from the authoring format. | JSON for ECSON and Canonical IR. Optional .glb packaging for asset delivery (later). |
| ShareDB / OT | Requires always-online server for conflict resolution. More complex than CRDTs for the same result. PlayCanvas uses it because they have a centralized server — Riff3D's architecture is designed for offline-first. | Yjs CRDTs — offline-first, automatic merge, no server required for conflict resolution |
| `next-auth` / Auth.js | Supabase has built-in auth with RLS integration. Adding a separate auth layer creates token translation complexity and breaks Supabase's security model. | `@supabase/supabase-js` auth + `@supabase/ssr` |

---

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| Web runtime #1 | PlayCanvas | Three.js + custom ECS | Never for Riff3D — PlayCanvas already IS Three.js-level rendering + ECS + physics + scripting. Building a custom ECS on Three.js is reinventing PlayCanvas. |
| Web runtime #2 | Babylon.js | A-Frame | Never — A-Frame is a thin HTML wrapper over Three.js, not a production engine. No serialization, no physics, no behavior system. |
| Collaboration | Yjs | Automerge | If ECSON documents exceed Yjs's practical size limits (~10MB+), Automerge's Rust/WASM core may perform better. Evaluate during Phase 2 if scenes become very large. |
| Collaboration | Yjs | Liveblocks (SaaS) | If self-hosting is not a requirement and you want managed infrastructure. Liveblocks wraps Yjs with a nice API + dashboards. Can migrate from Liveblocks to self-hosted Yjs later. |
| State management | Zustand | Jotai | If the editor evolves to need highly granular atom-based reactivity (e.g., hundreds of independent inspector fields). Zustand's single-store model is better for the initial architecture. |
| Validation | Zod | Valibot | If bundle size becomes critical (Valibot is smaller). Zod's ecosystem and TypeScript inference are stronger. |
| DB/Auth | Supabase | Neon (Postgres) + Clerk (auth) | If you need more control over auth flows or Supabase's auth doesn't support a specific provider. More integration work. |
| Testing | Vitest | Jest | Never for this project — Vitest is faster, ESM-native, same API. No reason to use Jest. |
| Monorepo | Turborepo + pnpm | Nx + pnpm | If you need more advanced dependency graph analysis or code generation. Nx is heavier but more powerful. Turborepo is simpler and sufficient. |

---

## Stack Patterns by Variant

**If starting Phase 0 (Contracts First):**
- Focus on `packages/ecson`, `packages/patchops`, `packages/canonical-ir`, `packages/fixtures`
- No 3D engine needed yet — pure TypeScript + Zod + Vitest
- Define the Zod schemas, implement PatchOps, write round-trip tests
- This is the most important phase — get the contracts right

**If building the editor shell (Phase 1):**
- Next.js app + React + Zustand + Tailwind + Radix UI
- Integrate Yjs for the ECSON document model
- PlayCanvas engine embedded in a canvas element (not React-controlled)
- The editor is React; the viewport is PlayCanvas. Communication via Zustand store + events.

**If adding the second adapter (Babylon.js):**
- Babylon.js replaces PlayCanvas in the viewport canvas
- Same editor React code, same ECSON, same Canonical IR
- Different adapter code generates Babylon.js scene from Canonical IR
- This is the acid test: if it works, the Canonical IR is sound

**If deploying collaboration:**
- y-websocket server on a long-running Node.js process (not serverless)
- Supabase for auth, project metadata, and asset storage
- Yjs document persistence to Supabase via server-side snapshots
- Deploy y-websocket to Railway, Fly.io, or a VPS (same as you'd deploy Colyseus)

---

## Installation

```bash
# Core framework (already installed)
# next@16.1.6 react@19.2.3 react-dom@19.2.3

# 3D engines (runtime adapters)
pnpm add playcanvas@~2.16
pnpm add @babylonjs/core@~8.51 @babylonjs/loaders@~8.51

# State management
pnpm add zustand@^5.0 immer@^11.1

# Validation
pnpm add zod@^4.3

# Collaboration (CRDT)
pnpm add yjs@^13.6 y-websocket@^2.0 y-indexeddb@^9.0

# ID generation
pnpm add nanoid@^5.1

# Backend
pnpm add @supabase/supabase-js@^2.95 @supabase/ssr@^0.8

# Data fetching
pnpm add @tanstack/react-query@^5.90

# UI
pnpm add @radix-ui/react-dialog@^1.1 @radix-ui/react-dropdown-menu@^2.1 @radix-ui/react-tooltip@^1.1 @radix-ui/react-context-menu@^2.2 @radix-ui/react-tabs@^1.1

# Dev dependencies
pnpm add -D typescript@^5.9 vitest@^4.0 @playwright/test@^1.58 turbo@^2 @types/react@^19 eslint@^9 @typescript-eslint/eslint-plugin@^8
```

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.1.6 | react@19.2.3 | Already installed and confirmed working |
| playcanvas@~2.16 | (standalone, no React deps) | Engine runs in its own canvas. Zero React coupling. |
| @babylonjs/core@~8.51 | @babylonjs/loaders@~8.51 | Keep Babylon packages at same version. Zero React coupling. |
| yjs@^13.6 | y-websocket@^2.0, y-indexeddb@^9.0 | Provider versions must be compatible with Yjs major version |
| zustand@^5.0 | react@^18 or react@^19 | v5 works with React 19 |
| zod@^4.3 | (standalone, no React deps) | Works in both client and server |
| tailwindcss@^4 | (PostCSS plugin) | v4 uses CSS-first config, already installed |

---

## Monorepo Package Structure

Based on FOUNDATION.md's repo structure recommendation:

```
riff3d/
├── apps/
│   └── editor/              # Next.js app (React editor shell)
│       ├── package.json     # next, react, zustand, radix-ui, tailwind
│       └── src/
├── packages/
│   ├── ecson/               # ECSON schema, types, Zod validators, Yjs bindings
│   │   └── package.json     # zod, yjs, nanoid
│   ├── patchops/            # PatchOps spec, validators, replay engine
│   │   └── package.json     # depends on @riff3d/ecson
│   ├── canonical-ir/        # IR spec, ECSON→IR compiler
│   │   └── package.json     # depends on @riff3d/ecson
│   ├── iql/                 # IQL parser, preset registry, compiler
│   │   └── package.json     # depends on @riff3d/patchops, @riff3d/ecson
│   ├── adapter-playcanvas/  # PlayCanvas runtime adapter
│   │   └── package.json     # playcanvas, depends on @riff3d/canonical-ir
│   ├── adapter-babylon/     # Babylon.js runtime adapter
│   │   └── package.json     # @babylonjs/core, depends on @riff3d/canonical-ir
│   ├── fixtures/            # Golden projects, snapshots, test data
│   │   └── package.json     # depends on @riff3d/ecson
│   └── conformance/         # Test harness for adapter conformance
│       └── package.json     # vitest, depends on @riff3d/canonical-ir, fixtures
├── servers/
│   └── collab/              # y-websocket collaboration server
│       └── package.json     # y-websocket, supabase persistence
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

**Dependency graph:**
```
ecson (foundation — no internal deps)
  ↑
patchops (depends on ecson)
  ↑
canonical-ir (depends on ecson)
  ↑
iql (depends on patchops, ecson)
  ↑
adapter-playcanvas (depends on canonical-ir)
adapter-babylon (depends on canonical-ir)
  ↑
fixtures (depends on ecson)
conformance (depends on canonical-ir, fixtures, adapters)
  ↑
editor app (depends on ecson, patchops, iql, adapters, yjs)
```

**Rule:** Adapters depend on contracts (`canonical-ir`), never on the editor app. The editor app depends on everything. Packages never have circular dependencies.

---

## Key Architectural Decision: React Editor + Non-React 3D Viewport

The prototype used React-Three-Fiber (R3F) which couples the 3D scene to React. The rebuild explicitly rejects this:

**Editor (React)** ←→ **Zustand Store** ←→ **Engine Viewport (PlayCanvas or Babylon.js canvas)**

- The editor (panels, inspector, hierarchy, toolbar) is a React app
- The 3D viewport is a raw `<canvas>` element managed by PlayCanvas or Babylon.js
- Communication between React and the engine uses Zustand as a bridge:
  - React writes to Zustand when the user edits properties
  - The engine adapter subscribes to Zustand changes and updates the 3D scene
  - The engine fires events (selection, transform gizmo drag) that update Zustand
  - React re-renders inspector panels when Zustand changes

This pattern is proven by both PlayCanvas editor (uses PCUI, not React, for editor + PlayCanvas engine for viewport) and Babylon.js editor (uses React for editor + Babylon.js for viewport).

**Why not R3F:** R3F makes every scene node a React component. With 500+ entities, React's reconciliation becomes the bottleneck. More critically, R3F prevents adapter-agnostic rendering — R3F IS the Three.js adapter. The whole point of Riff3D is that the 3D runtime is pluggable.

---

## Prototype Research Aggregation

The following prototype research documents informed this stack:

| Document | Key Insights Carried Forward | File |
|----------|------------------------------|------|
| Prototype STACK.md | Version compatibility matrix (React 19 ↔ R3F 9 ↔ Three.js), Zustand patterns, Zod validation approach | `/home/frank/riff3d-prototype/.planning/research/STACK.md` |
| Universal Schema Research | Flat entity map > nested tree, separated Collider from RigidBody, shared asset registry, typed property schemas, granular delta operations | `/home/frank/riff3d-prototype/.planning/rebuild-research/00-universal-schema-research.md` |
| Canonical Layer Research | LLVM IR analogy, glTF alignment strategy, adapter interface design, behavior compilation pipeline, ~1000 LoC per adapter target | `/home/frank/riff3d-prototype/.planning/rebuild-research/01-canonical-layer-research.md` |
| IQL Research | Token efficiency (90-97% reduction), PatchOp compilation pipeline, preset/modifier registries, MCP server design | `/home/frank/riff3d-prototype/.planning/rebuild-research/02-iql-research.md` |
| Spatial Validation Research | Jump arc physics, reachability graph, physics-aware preset snapping | `/home/frank/riff3d-prototype/.planning/rebuild-research/03-spatial-validation-research.md` |
| FOUNDATION.md | Contract-first architecture, PatchOps spec, ECSON/Canonical IR pipeline, testing spine, template-driven development, phase gates | `/home/frank/riff3d-prototype/.planning/rebuild-research/FOUNDATION.md` |
| Architecture Research | PlayCanvas ECS analysis, Babylon.js scene graph analysis, ejection mapping tables, build order dependencies | `/home/frank/riff3d-prototype/.planning/research/ARCHITECTURE.md` |
| Pitfalls Research | Scene format rigidity, collaboration conflicts, scope creep, state entanglement, physics desync | `/home/frank/riff3d-prototype/.planning/research/PITFALLS.md` |

**Key divergences from prototype stack:**
1. **Dropped R3F/Three.js** — Replaced with PlayCanvas + Babylon.js as native runtime adapters (per FOUNDATION.md dual-adapter strategy)
2. **Dropped Colyseus for editor collaboration** — Replaced with Yjs CRDTs (better offline support, automatic conflict resolution, proper undo/redo)
3. **Dropped Socket.io** — Yjs y-websocket handles all real-time collaboration
4. **Added pnpm + Turborepo** — Monorepo tooling required by the `packages/` structure in FOUNDATION.md
5. **Added glTF alignment** — Canonical IR aligns with glTF conventions per the canonical layer research

---

## Sources

### HIGH Confidence (verified from local files)
- PlayCanvas engine v2.16.1: `/home/frank/playcanvas-engine/package.json` — ECS architecture, Entity/Component/ComponentSystem pattern, SceneParser flat entity map
- PlayCanvas editor v2.14.2: `/home/frank/playcanvas-editor/package.json` — ShareDB-based OT collaboration (`src/editor-api/realtime/connection.ts`), Observer sync pattern
- Babylon.js core v8.51.2: `/home/frank/babylonjs/packages/public/@babylonjs/core/package.json` — TransformNode/Mesh hierarchy, Behavior interface, Observable pattern, SceneSerializer
- Next.js 16.1.6 + React 19.2.3: `/home/frank/riff3d/package.json` — installed and confirmed
- Prototype research (all docs): `/home/frank/riff3d-prototype/.planning/rebuild-research/` — Universal Schema, Canonical IR, IQL, Spatial Validation, FOUNDATION

### MEDIUM Confidence (from prototype npm verification, 2026-02-10)
- Zustand 5.0.11, Zod 4.3.6, Vitest 4.0.18, Playwright 1.58.2, Immer 11.1.4, nanoid 5.1.6, @tanstack/react-query 5.90.20 — verified via npm registry on 2026-02-10 (prototype STACK.md)
- Supabase packages: @supabase/supabase-js 2.95.3, @supabase/ssr 0.8.0 — same source

### LOW Confidence (training data only — VERIFY before use)
- Yjs version (^13.6), y-websocket (^2.0), y-indexeddb (^9.0) — from training data. Yjs is a mature library that has been at v13 for years, so major version is likely correct. Specific minor/patch versions need npm verification.
- pnpm (^9), Turborepo (^2) — from training data. Major versions likely correct but verify.
- Automerge, Liveblocks, PartyKit comparisons — training data assessments

---
*Stack research for: Web-based 3D engine/editor foundation with contract-first architecture*
*Researched: 2026-02-19*
*Aggregates prototype research from: 2026-02-10*
