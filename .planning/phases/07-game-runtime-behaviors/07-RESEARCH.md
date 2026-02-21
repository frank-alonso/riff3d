# Phase 7: Game Runtime & Behaviors - Research

**Researched:** 2026-02-20
**Domain:** Physics runtime, character controller, behavior components, event wiring, game state machine, timeline/animation
**Confidence:** MEDIUM-HIGH (physics and event systems HIGH, game state machine HIGH, timeline MEDIUM, verb UX MEDIUM)

## Summary

Phase 7 brings Riff3D's existing ECSON behavior component schemas to life at runtime. The schemas for ScoreZone, KillZone, TriggerZone, Timer, Spawner, MovingPlatform, PathFollower, Checkpoint, RigidBody, Collider, and Animation already exist in `packages/ecson/src/registry/components/`. The event wiring schema (`EventWireSchema`) and game settings (`GameSettingsSchema`) are also defined. What's missing is the **runtime execution layer** -- the physics simulation, behavior tick systems, event dispatch, character controller, game state machine, and timeline playback.

The architecture demands a clean separation: Rapier3D runs in a new `packages/game-runtime/` package that reads Canonical IR (not ECSON directly). Rendering adapters (PlayCanvas, Babylon.js) never touch physics -- they read transform updates from the runtime via the existing Zustand store / IRDelta mechanism. The runtime is engine-agnostic: it operates on IR nodes and writes back transform data that adapters consume. This means the game runtime is a **single implementation**, not per-adapter, which is a major architectural win.

**Primary recommendation:** Build a `packages/game-runtime/` package that owns the Rapier3D world, behavior systems, event bus, game state machine, and character controller. It reads CanonicalScene to initialize, ticks at a fixed timestep (1/60s), and writes transform updates back through the store. The rendering adapters remain unchanged (they just see transform deltas). XState v5 manages the game state machine with serializable configuration stored in ECSON `gameSettings`. The event wiring system is a simple typed dispatcher matching ECSON's existing `EventWireSchema`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GAME-01 | Pre-built behavior component library (ScoreZone, Timer, KillZone, Spawner, MovingPlatform, PathFollower, etc.) | Rapier sensors for zones, fixed-timestep tick loop for Timer/Spawner/MovingPlatform/PathFollower. ECSON schemas already define properties/events/actions -- runtime implements the tick+event logic. |
| GAME-02 | Verb-driven UX surface ("Add Character", "Make It Bouncy", "Start Game", etc.) mapping to PatchOps | Verb = composite PatchOp sequence (BatchOp). Implemented as action creators in a verb registry that emit PatchOps through existing dispatchOp. No new libraries needed. |
| GAME-03 | Game state machine (start, playing, end states with win/lose conditions) | XState v5 with serializable machine definition stored in ECSON gameSettings. Guards for win/lose conditions. Machine runs only in play mode. |
| GAME-04 | Event wiring system (WHEN trigger DO action) | Typed event bus consuming EventWireSchema from Canonical IR. Event emitters on behavior components, action handlers on target components. Runs in game-runtime package. |
| GAME-09 | Character entity model (skeleton refs, rig metadata) | Rapier KinematicCharacterController for physics. Character component schema (new) references skeleton asset. Animation integration via existing Animation component. |
| GAME-10 | Timeline v0 (tracks, clips, events -- minimal) | Custom minimal implementation: Track = array of keyframes, Clip = named segment, playback at runtime. No external library needed for v0 scope. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dimforge/rapier3d-compat` | ^0.19.x | Physics simulation (rigid bodies, colliders, sensors, character controller) | Decided in Rapier spike. WASM, ~0.3ms/step for 1000 bodies. `-compat` embeds WASM for bundler support. |
| `xstate` | ^5.x | Game state machine (lobby, countdown, playing, results) | 16.7 kB gzipped, zero deps, TypeScript-first, serializable machine definitions, guards, actions. Industry standard for state machines. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@xstate/store` | ^3.x | Lightweight event-driven state for simple behavior state (active/inactive toggles) | Only if full XState machines are overkill for individual behavior component state. Evaluate during implementation -- may not be needed if plain boolean flags suffice. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| XState for game state machine | Hand-rolled FSM | XState adds 16.7 kB but provides serialization, guards, actions, visualization tools, and TypeScript inference. Hand-rolled saves bundle size but loses debuggability and correctness guarantees. **Use XState.** |
| XState for per-component behavior state | Plain boolean flags | Individual components (Timer, MovingPlatform) have trivial state (active/inactive, direction). Full XState machines are overkill. **Use plain state + the behavior tick system.** |
| Custom physics | Rapier3D | Already decided in spike. No alternative considered. |
| Custom timeline library | anime.js, GSAP | v0 timeline is minimal (transform keyframes + event triggers). External libraries add complexity for easing/interpolation we can do in ~200 LoC. GSAP has license concerns. **Hand-roll v0, evaluate for v1.1.** |

**Installation:**
```bash
pnpm add @dimforge/rapier3d-compat@^0.19.0 xstate@^5.0.0 --filter @riff3d/game-runtime
```

## Architecture Patterns

### Recommended Package Structure

```
packages/game-runtime/
├── src/
│   ├── index.ts                    # Public API
│   ├── physics/
│   │   ├── physics-world.ts        # Rapier world wrapper (init, step, cleanup)
│   │   ├── body-manager.ts         # Maps IR nodes -> Rapier bodies/colliders
│   │   ├── character-controller.ts # KinematicCharacterController wrapper
│   │   └── collision-events.ts     # EventQueue drain -> typed events
│   ├── behaviors/
│   │   ├── behavior-system.ts      # Tick loop: iterates registered behaviors
│   │   ├── score-zone.ts           # ScoreZone runtime logic
│   │   ├── kill-zone.ts            # KillZone runtime logic
│   │   ├── trigger-zone.ts         # TriggerZone runtime logic
│   │   ├── timer.ts                # Timer runtime logic
│   │   ├── spawner.ts              # Spawner runtime logic
│   │   ├── moving-platform.ts      # MovingPlatform runtime logic
│   │   ├── path-follower.ts        # PathFollower runtime logic
│   │   └── checkpoint.ts           # Checkpoint runtime logic
│   ├── events/
│   │   ├── event-bus.ts            # Typed event dispatcher (wire-based)
│   │   └── event-types.ts          # Event type definitions
│   ├── state-machine/
│   │   ├── game-fsm.ts             # XState game state machine
│   │   └── game-fsm-config.ts      # Serializable machine config from gameSettings
│   ├── timeline/
│   │   ├── timeline-player.ts      # Playback engine
│   │   ├── track.ts                # Track with keyframes
│   │   └── interpolation.ts        # Linear + eased interpolation
│   ├── character/
│   │   └── character-entity.ts     # Character component schema + controller
│   └── loop/
│       └── fixed-timestep.ts       # Fixed timestep accumulator
```

### Pattern 1: Game Runtime as IR Consumer (Engine-Agnostic Physics)

**What:** The game runtime reads Canonical IR to initialize physics bodies and behaviors. It writes transform updates back as `IRDelta` events. Rendering adapters never touch Rapier -- they consume the same delta mechanism they already use.

**When to use:** Always. This is the core architectural pattern for Phase 7.

**Why it works with existing architecture:** The `EngineAdapter` interface already has `applyDelta(delta: IRDelta)` with a `node-transform` delta type. The game runtime produces these deltas from Rapier's updated positions after each step. The existing `lastDelta` / `docVersion` subscriber pattern in the viewport triggers adapter updates.

```typescript
// Source: Riff3D architecture -- game runtime writes transforms via store
interface GameRuntime {
  /** Initialize from Canonical IR. Creates Rapier world, bodies, behaviors. */
  initialize(scene: CanonicalScene, wires: CanonicalWire[]): Promise<void>;

  /** Fixed-timestep tick. Returns transform deltas for changed bodies. */
  tick(dt: number): IRDelta[];

  /** Handle input events (keyboard, touch). */
  handleInput(input: InputEvent): void;

  /** Dispatch an action to a behavior component. */
  dispatchAction(targetNodeId: string, action: string, params?: Record<string, unknown>): void;

  /** Get the game state machine snapshot. */
  getGameState(): GameStateSnapshot;

  /** Clean up all Rapier objects (WASM .free()). */
  dispose(): void;
}
```

### Pattern 2: Fixed Timestep with Accumulator

**What:** Physics runs at a fixed 1/60s timestep regardless of frame rate. An accumulator collects real elapsed time; Rapier steps consume fixed chunks.

**When to use:** Always for physics. This is the industry-standard pattern (Gaffer on Games "Fix Your Timestep!").

```typescript
// Source: https://www.gafferongames.com/post/fix_your_timestep/
const FIXED_DT = 1 / 60; // 16.67ms
const MAX_DT = 0.25; // Clamp to prevent spiral of death

class FixedTimestep {
  private accumulator = 0;

  update(frameDt: number, stepFn: (dt: number) => void): number {
    // Clamp to prevent spiral of death after pause/tab-switch
    const dt = Math.min(frameDt, MAX_DT);
    this.accumulator += dt;

    let steps = 0;
    while (this.accumulator >= FIXED_DT) {
      stepFn(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }

    // Return interpolation alpha for rendering (optional for v0)
    return this.accumulator / FIXED_DT;
  }
}
```

### Pattern 3: Behavior System (Component-Oriented Tick)

**What:** Each behavior type registers a tick handler. The behavior system iterates all active behaviors each physics step, passing them the current state and dt.

**When to use:** For all runtime behavior components (Timer, MovingPlatform, PathFollower, Spawner, etc.)

```typescript
// Behavior interface -- each component type implements this
interface BehaviorHandler {
  /** Component type this handler manages (e.g., "Timer", "MovingPlatform") */
  readonly componentType: string;

  /** Called once when entering play mode. */
  initialize(instance: BehaviorInstance): void;

  /** Called every fixed timestep. */
  tick(instance: BehaviorInstance, dt: number, context: TickContext): void;

  /** Called when receiving an action (e.g., "start", "stop", "reset"). */
  handleAction(instance: BehaviorInstance, action: string, params?: Record<string, unknown>): void;

  /** Called when leaving play mode. */
  dispose(instance: BehaviorInstance): void;
}

interface BehaviorInstance {
  nodeId: string;
  componentType: string;
  properties: Record<string, unknown>;
  state: Record<string, unknown>; // Mutable runtime state
}

interface TickContext {
  dt: number;
  physicsWorld: PhysicsWorld;
  eventBus: EventBus;
  gameState: GameStateSnapshot;
}
```

### Pattern 4: Event Bus (Wire-Based Dispatch)

**What:** The event bus reads `CanonicalWire[]` from the IR at initialization. When a behavior emits an event, the bus looks up matching wires and dispatches the corresponding action to the target behavior.

**When to use:** For all WHEN-DO event wiring (GAME-04).

```typescript
// Source: Matches existing EventWireSchema / CanonicalWireSchema
class EventBus {
  private wiresBySource: Map<string, CanonicalWire[]> = new Map();

  initialize(wires: CanonicalWire[]): void {
    // Index wires by sourceNodeId+sourceEvent for O(1) lookup
    for (const wire of wires) {
      const key = `${wire.sourceNodeId}:${wire.sourceEvent}`;
      const existing = this.wiresBySource.get(key) ?? [];
      existing.push(wire);
      this.wiresBySource.set(key, existing);
    }
  }

  emit(sourceNodeId: string, event: string, payload?: Record<string, unknown>): void {
    const key = `${sourceNodeId}:${event}`;
    const wires = this.wiresBySource.get(key);
    if (!wires) return;

    for (const wire of wires) {
      // Dispatch action to target behavior
      this.actionDispatcher(wire.targetNodeId, wire.targetAction, {
        ...wire.parameters,
        ...payload,
      });
    }
  }
}
```

### Pattern 5: XState Game State Machine

**What:** Game flow (lobby -> countdown -> playing -> results) managed by XState v5 with serializable configuration.

**When to use:** For GAME-03. Machine configuration derived from ECSON `gameSettings`.

```typescript
// Source: https://stately.ai/docs/machines
import { setup, createActor, assign } from 'xstate';

const gameStateMachine = setup({
  types: {
    context: {} as {
      scores: Record<string, number>;
      roundDuration: number;
      timeRemaining: number;
      maxPlayers: number;
    },
    events: {} as
      | { type: 'START_GAME' }
      | { type: 'COUNTDOWN_COMPLETE' }
      | { type: 'TIMER_TICK'; dt: number }
      | { type: 'PLAYER_SCORED'; playerId: string; points: number }
      | { type: 'WIN_CONDITION_MET'; winnerId: string }
      | { type: 'TIME_UP' }
      | { type: 'RESTART' },
  },
  guards: {
    isTimeUp: ({ context }) => context.timeRemaining <= 0,
  },
  actions: {
    decrementTimer: assign({
      timeRemaining: ({ context, event }) =>
        context.timeRemaining - (event.type === 'TIMER_TICK' ? event.dt : 0),
    }),
    addScore: assign({
      scores: ({ context, event }) => {
        if (event.type !== 'PLAYER_SCORED') return context.scores;
        return {
          ...context.scores,
          [event.playerId]: (context.scores[event.playerId] ?? 0) + event.points,
        };
      },
    }),
  },
}).createMachine({
  id: 'game',
  initial: 'lobby',
  context: ({ input }) => ({
    scores: {},
    roundDuration: input.roundDuration,
    timeRemaining: input.roundDuration,
    maxPlayers: input.maxPlayers,
  }),
  states: {
    lobby: { on: { START_GAME: 'countdown' } },
    countdown: {
      after: { 3000: 'playing' },
    },
    playing: {
      on: {
        TIMER_TICK: {
          actions: ['decrementTimer'],
          guard: ({ context }) => context.timeRemaining > 0,
        },
        PLAYER_SCORED: { actions: ['addScore'] },
        WIN_CONDITION_MET: 'results',
        TIME_UP: 'results',
      },
    },
    results: {
      on: { RESTART: 'lobby' },
    },
  },
});
```

### Anti-Patterns to Avoid

- **Physics in the rendering adapter:** Rapier must NEVER live inside `adapter-playcanvas` or `adapter-babylon`. It lives in `game-runtime`. Adapters only read transform deltas.
- **Mutating ECSON during play mode:** Runtime state (scores, timer values, entity positions during physics) is transient. ECSON is snapshot-restored on Stop. Runtime state lives in `game-runtime` package only.
- **Per-adapter behavior implementations:** Behavior logic (Timer countdown, ScoreZone detection) is engine-agnostic. Implement once in `game-runtime`, not per adapter.
- **Event wiring in React components:** Event wires fire during physics ticks, not React renders. The event bus runs in `game-runtime`, not in the editor UI.
- **Variable timestep for physics:** Always use fixed timestep accumulator. Variable dt causes non-deterministic physics and tunneling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Physics simulation | Custom collision detection, broadphase, constraint solver | Rapier3D (`@dimforge/rapier3d-compat`) | Physics is thousands of edge cases. Rapier handles CCD, sensor/trigger, character controller, collision groups, WASM performance. Custom would take months and have bugs. |
| Character controller sliding/stepping | Custom ray-casts + movement correction | Rapier `KinematicCharacterController` | Handles slopes, stairs, snapping, grounding detection, dynamic body interaction. Reimplementing is weeks of tuning. |
| Game state machine | Custom switch-case state tracker | XState v5 | Serializable, TypeScript-inferred, guardable transitions, built-in timers (`after`), debuggable with Stately Inspector. Custom loses all of this. |
| Easing functions | Custom bezier/cubic implementations | Built-in or tiny utility (~30 LoC) | Standard easing (linear, easeIn, easeOut, easeInOut) is 4 one-line functions. Not worth a library, but also not worth getting wrong. Use `Math.pow` / cubic bezier formulas. |

**Key insight:** The only thing worth hand-rolling in this phase is the behavior tick system, the event bus, and the timeline v0 playback. These are simple, domain-specific, and tightly coupled to our IR schema. Everything else (physics, state machine, character controller) uses battle-tested libraries.

## Common Pitfalls

### Pitfall 1: WASM Memory Leaks from Rapier Objects

**What goes wrong:** Every Rapier body, collider, joint, and character controller is a WASM heap allocation. If `.free()` is not called when entities are deleted or play mode stops, the WASM heap grows unboundedly.

**Why it happens:** JavaScript's GC does not track WASM allocations. Developers forget to free objects, especially during rapid iteration or error paths.

**How to avoid:**
1. Create a `PhysicsWorld` wrapper that tracks all created Rapier handles in a `Map<string, RapierHandle>`.
2. On entity deletion or `dispose()`, iterate all handles and call `.free()`.
3. On play mode stop, call `world.free()` (frees all bodies/colliders at once).
4. Use try/finally in initialization to ensure partial creation cleanup.

**Warning signs:** Browser memory growing during repeated play/stop cycles. Use DevTools Memory tab to check WASM heap.

### Pitfall 2: Broadphase Not Built Before Queries

**What goes wrong:** Scene queries (raycasts, shape casts, overlap tests) return no results or incorrect results.

**Why it happens:** Rapier's broadphase is lazy -- it only updates during `world.step()`. If you query before the first step, the broadphase tree is empty.

**How to avoid:** Always call `world.step()` once after adding all bodies/colliders before any scene queries. In the character controller flow, `computeColliderMovement()` internally uses the broadphase, so the world must have been stepped.

**Warning signs:** Character controller falls through floor on first frame. Trigger zones don't fire on first overlap.

### Pitfall 3: Collision Events Require ActiveEvents Flag

**What goes wrong:** Collision events never fire. `drainCollisionEvents` callback is never called.

**Why it happens:** Rapier only generates collision events between two colliders if at least one has `ActiveEvents.COLLISION_EVENTS` set. By default this flag is not set.

**How to avoid:** When creating colliders for trigger zones, score zones, kill zones, and any component that declares `events` in its schema, set `ActiveEvents.COLLISION_EVENTS` on the collider descriptor.

**Warning signs:** Sensor overlaps detected via `intersectionPairsWith()` but event queue is empty.

### Pitfall 4: Spiral of Death in Fixed Timestep

**What goes wrong:** After a tab switch or debugger pause, accumulated time is huge, causing hundreds of physics steps in one frame, which takes even longer, causing more accumulation.

**Why it happens:** The accumulator holds all time since last frame. If `frameDt` is 2 seconds (tab was hidden), that's 120 physics steps.

**How to avoid:** Clamp `frameDt` to a maximum (250ms = 15 steps max). This is standard practice.

**Warning signs:** Frame rate drops to 0 after alt-tabbing back. Browser freezes on re-focus.

### Pitfall 5: Mutating ECSON During Play Mode

**What goes wrong:** Runtime changes (entity positions, scores, timer values) leak into the saved ECSON document, corrupting the project.

**Why it happens:** If the runtime writes transform updates back to `ecsonDoc` in the Zustand store, those changes persist after play mode stops (snapshot restore might not cover all state).

**How to avoid:** Runtime state is EXCLUSIVELY owned by `game-runtime`. It never writes to `ecsonDoc`. Transform updates flow through `IRDelta` to the adapter for rendering only. On Stop, the existing snapshot restore in `playtest-slice.ts` handles ECSON restoration. Game state (scores, timers, spawned entities) exists only in `game-runtime` memory.

**Warning signs:** Entity positions changed after play/stop cycle. Undo stack contains runtime ops.

### Pitfall 6: Physics-Rendering Coordinate Mismatch

**What goes wrong:** Objects appear at wrong positions or with flipped orientations.

**Why it happens:** Rapier uses right-handed Y-up coordinates with `{x,y,z}` / `{x,y,z,w}` plain objects. PlayCanvas also uses right-handed Y-up. Babylon.js uses left-handed. If transforms are passed through without conversion, Babylon adapter shows mirrored physics.

**How to avoid:** The game runtime outputs transforms in the same coordinate system as Canonical IR (right-handed Y-up, matching PlayCanvas). The Babylon adapter already handles coordinate conversion in its existing delta application code (z-flip). No additional conversion needed in game-runtime.

**Warning signs:** Objects fly in wrong direction in Babylon adapter. Character moves backwards.

### Pitfall 7: XState Bundle Size in Game Runtime

**What goes wrong:** XState adds ~16.7 kB gzipped to the game-runtime bundle. For projects that don't use the game state machine, this is waste.

**Why it happens:** XState is always imported if game-runtime depends on it.

**How to avoid:** Use dynamic import (`import('xstate')`) for the game FSM module. If `gameSettings` is null/absent in the scene, skip XState initialization entirely. The game FSM is only needed when the scene has game settings with state machine configuration.

**Warning signs:** Bundle size increase disproportionate to feature use.

## Code Examples

### Rapier World Initialization and Tick Loop

```typescript
// Source: https://rapier.rs/docs/user_guides/javascript/getting_started_js/
// + https://rapier.rs/docs/user_guides/javascript/character_controller/
import RAPIER from '@dimforge/rapier3d-compat';

async function createPhysicsWorld(): Promise<RAPIER.World> {
  // MUST await init before ANY Rapier API usage
  await RAPIER.init();

  const gravity = { x: 0.0, y: -9.81, z: 0.0 };
  const world = new RAPIER.World(gravity);
  return world;
}

function createSensorCollider(
  world: RAPIER.World,
  position: { x: number; y: number; z: number },
  halfExtents: { x: number; y: number; z: number },
): RAPIER.Collider {
  const bodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(position.x, position.y, position.z);
  const body = world.createRigidBody(bodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.cuboid(
    halfExtents.x, halfExtents.y, halfExtents.z
  )
    .setSensor(true)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

  return world.createCollider(colliderDesc, body);
}
```

### Rapier Character Controller Setup

```typescript
// Source: https://rapier.rs/docs/user_guides/javascript/character_controller/
function createCharacterController(world: RAPIER.World): RAPIER.KinematicCharacterController {
  const offset = 0.01; // Skin width for numerical stability
  const controller = world.createCharacterController(offset);

  // Configure auto-stepping (stairs up to 0.5m, min 0.2m width on top)
  controller.enableAutostep(0.5, 0.2, true);

  // Snap to ground (stay grounded on slopes/stairs)
  controller.enableSnapToGround(0.5);

  // Slope limits
  controller.setMaxSlopeClimbAngle(45 * Math.PI / 180);
  controller.setMinSlopeSlideAngle(30 * Math.PI / 180);

  // Push dynamic bodies when walking into them
  controller.setApplyImpulsesToDynamicBodies(true);

  return controller;
}

function moveCharacter(
  controller: RAPIER.KinematicCharacterController,
  collider: RAPIER.Collider,
  body: RAPIER.RigidBody,
  desiredMovement: { x: number; y: number; z: number },
): { grounded: boolean; translation: { x: number; y: number; z: number } } {
  // Compute corrected movement (slides along obstacles)
  controller.computeColliderMovement(collider, desiredMovement);

  // Get the actual movement after collision resolution
  const corrected = controller.computedMovement();
  const grounded = controller.computedGrounded();

  // Apply to kinematic body
  const currentPos = body.translation();
  body.setNextKinematicTranslation({
    x: currentPos.x + corrected.x,
    y: currentPos.y + corrected.y,
    z: currentPos.z + corrected.z,
  });

  return { grounded, translation: body.translation() };
}
```

### Collision Event Drain Pattern

```typescript
// Source: https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js/
function drainEvents(
  world: RAPIER.World,
  eventQueue: RAPIER.EventQueue,
  colliderNodeMap: Map<number, string>, // Rapier collider handle -> IR node ID
  eventBus: EventBus,
): void {
  // Drain collision events (sensor enter/exit)
  eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    const nodeId1 = colliderNodeMap.get(handle1);
    const nodeId2 = colliderNodeMap.get(handle2);
    if (!nodeId1 || !nodeId2) return;

    // Determine which is the sensor/trigger
    const collider1 = world.getCollider(handle1);
    const collider2 = world.getCollider(handle2);

    if (collider1.isSensor()) {
      eventBus.emit(nodeId1, started ? 'onEnter' : 'onExit', { otherNodeId: nodeId2 });
    }
    if (collider2.isSensor()) {
      eventBus.emit(nodeId2, started ? 'onEnter' : 'onExit', { otherNodeId: nodeId1 });
    }
  });

  // Drain contact force events (for KillZone damage, etc.)
  eventQueue.drainContactForceEvents((event) => {
    const nodeId1 = colliderNodeMap.get(event.collider1());
    const nodeId2 = colliderNodeMap.get(event.collider2());
    if (!nodeId1 || !nodeId2) return;

    eventBus.emit(nodeId1, 'onContact', { otherNodeId: nodeId2 });
    eventBus.emit(nodeId2, 'onContact', { otherNodeId: nodeId1 });
  });
}
```

### Verb Action Creator Pattern

```typescript
// Verbs are composite PatchOp sequences emitted through dispatchOp
// Source: Riff3D architecture -- verb registry maps intents to PatchOps
import type { PatchOp } from '@riff3d/patchops';
import { generateId } from '@riff3d/ecson';

interface VerbDefinition {
  name: string;
  label: string;
  description: string;
  category: 'create' | 'modify' | 'game';
  /** Creates the PatchOps for this verb. May need context (e.g., selected entity). */
  createOps: (context: VerbContext) => PatchOp[];
}

interface VerbContext {
  selectedEntityIds: string[];
  ecsonDoc: SceneDocument;
}

// Example: "Add Character" verb
const addCharacterVerb: VerbDefinition = {
  name: 'addCharacter',
  label: 'Add Character',
  description: 'Add a controllable character entity to the scene',
  category: 'create',
  createOps: (context) => {
    const entityId = generateId();
    const parentId = context.selectedEntityIds[0] ?? context.ecsonDoc.rootEntityId;

    // BatchOp: CreateEntity + AddComponent(RigidBody) + AddComponent(Collider) + AddComponent(Character)
    return [{
      type: 'BatchOp',
      ops: [
        { type: 'CreateEntity', entityId, name: 'Character', parentId },
        { type: 'AddComponent', entityId, componentType: 'RigidBody',
          properties: { bodyType: 'kinematicPosition', mass: 1 } },
        { type: 'AddComponent', entityId, componentType: 'Collider',
          properties: { shape: 'capsule', radius: 0.3, height: 1.8 } },
        { type: 'AddComponent', entityId, componentType: 'Character',
          properties: { moveSpeed: 5, jumpForce: 8, gravity: 20 } },
      ],
    }];
  },
};
```

### Timeline v0 Playback

```typescript
// Minimal timeline: tracks with keyframes, linear/eased interpolation
interface Keyframe {
  time: number; // seconds
  value: { x: number; y: number; z: number };
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

interface Track {
  targetNodeId: string;
  property: 'position' | 'rotation' | 'scale';
  keyframes: Keyframe[]; // Sorted by time
}

interface TimelineClip {
  name: string;
  duration: number;
  tracks: Track[];
  loop: boolean;
}

function evaluateTrack(track: Track, time: number): { x: number; y: number; z: number } | null {
  const kfs = track.keyframes;
  if (kfs.length === 0) return null;
  if (time <= kfs[0].time) return kfs[0].value;
  if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

  // Find bracketing keyframes
  for (let i = 0; i < kfs.length - 1; i++) {
    if (time >= kfs[i].time && time < kfs[i + 1].time) {
      const t = (time - kfs[i].time) / (kfs[i + 1].time - kfs[i].time);
      const eased = applyEasing(t, kfs[i + 1].easing ?? 'linear');
      return lerpVec3(kfs[i].value, kfs[i + 1].value, eased);
    }
  }
  return null;
}

function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case 'easeIn': return t * t;
    case 'easeOut': return t * (2 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    default: return t; // linear
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ammo.js (Bullet WASM port) for web physics | Rapier3D (Rust WASM) | 2023-2024 | Rapier is 2-5x faster, actively maintained, better API. ammo.js is unmaintained. |
| Custom FSM with switch/case | XState v5 with TypeScript inference | 2023 (XState v5 release) | Serializable, guardable, inspectable state machines. Replaces thousands of lines of custom FSM code. |
| Three.js AnimationMixer pattern (external) | Engine-native anim systems (PlayCanvas AnimComponent) | 2024 | PlayCanvas has modern AnimComponent with state graph, parameters, and events. Timeline v0 can interop. |
| Variable timestep physics | Fixed timestep with accumulator | Always been best practice | "Fix Your Timestep!" (Gaffer on Games). Deterministic, stable, networkable. |

**Deprecated/outdated:**
- **ammo.js:** Unmaintained port of Bullet. PlayCanvas still ships it as default but community is moving to alternatives. We use Rapier independently.
- **XState v4:** Replaced by v5. Completely different API (setup-based, no `interpret()`, no `Machine()`).
- **PlayCanvas legacy AnimationComponent:** Use modern `AnimComponent` (anim) with state graph.

## Open Questions

1. **Character component schema design**
   - What we know: Need moveSpeed, jumpForce, gravity, capsule dimensions. Existing ECSON has RigidBody + Collider schemas. Need a new "Character" component or extend existing.
   - What's unclear: Should Character be a thin component that orchestrates RigidBody+Collider+Animation, or a standalone component with its own physics?
   - Recommendation: Create a new `Character` component in ECSON registry. It stores gameplay properties (moveSpeed, jumpForce, gravity). At runtime, it requires RigidBody + Collider on the same entity. The character controller reads Character props but uses the entity's RigidBody/Collider for physics.

2. **How game-runtime writes transforms back to adapters**
   - What we know: During play mode, Rapier updates body positions. Adapters need these updates for rendering. The existing `IRDelta` `node-transform` type can carry this.
   - What's unclear: Should transforms flow through the Zustand store (like edit-mode deltas) or directly to the adapter? Store path adds overhead (~1ms per 100 entities per frame). Direct path breaks the existing subscriber model.
   - Recommendation: Use a dedicated play-mode channel. During play mode, game-runtime calls adapter's `applyDelta()` directly via a callback, bypassing the store for per-frame transform updates. Scores, game state, and other UI-visible state still go through Zustand.

3. **Spawner entity cloning during runtime**
   - What we know: Spawner needs to instantiate copies of a template entity at runtime. ECSON uses `CreateEntity` PatchOps for this.
   - What's unclear: Runtime entity creation should NOT mutate ECSON (Pitfall 5). But adapters need to render spawned entities.
   - Recommendation: Game-runtime maintains a separate runtime entity registry for spawned entities. It sends `IRDelta` additions to the adapter directly. These entities are transient -- they don't persist in ECSON and vanish on Stop.

4. **Timeline schema in ECSON**
   - What we know: Need tracks with keyframes. GAME-10 says "minimal." Existing `AddKeyframe`/`RemoveKeyframe`/`SetKeyframeValue` PatchOps exist.
   - What's unclear: Where does timeline data live in ECSON? As a component on an entity? As a top-level array in SceneDocument?
   - Recommendation: Timeline as a new component type (`Timeline`) on a dedicated entity. Tracks reference other entities by ID. Keyframes store time + property + value. This follows the existing pattern where everything is entity+component.

5. **Performance budget for game-runtime**
   - What we know: Rapier does ~0.3ms for 1000 bodies. Behavior ticks should be trivial (<0.1ms for 50 behaviors). Total budget: <2ms per frame at 60fps for physics+behaviors.
   - What's unclear: How to enforce this? What happens when a scene exceeds 1000 dynamic bodies?
   - Recommendation: Set hard limits in game-runtime: max 500 dynamic bodies, max 200 behaviors. Log warnings at 80% capacity. Profile continuously with Vitest benchmarks.

## Sources

### Primary (HIGH confidence)
- `/websites/rapier_rs_javascript3d` (Context7) - KinematicCharacterController API, EventQueue, collision events, sensor configuration
- https://rapier.rs/docs/user_guides/javascript/character_controller/ - Official Rapier character controller guide with full API docs
- https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js/ - Collision events, sensors, contact graph, physics hooks
- https://rapier.rs/docs/user_guides/javascript/colliders/ - Collider creation, sensor flag, active events, collision groups
- https://rapier.rs/docs/user_guides/javascript/getting_started_js/ - World creation, game loop, WASM init
- `/websites/stately_ai` (Context7) - XState v5 API: setup(), createMachine(), guards, actions, assign, TypeScript types
- `/playcanvas/engine` (Context7) - PlayCanvas AnimComponent, physics system (ammo.js), collision events, scripting
- `packages/ecson/src/registry/components/` (local) - All existing behavior component schemas
- `packages/canonical-ir/src/types/` (local) - CanonicalScene, CanonicalWire, CanonicalNode, IRDelta, EngineAdapter interface
- `.planning/research/RAPIER_SPIKE.md` (local) - Rapier evaluation results (decided)

### Secondary (MEDIUM confidence)
- https://www.gafferongames.com/post/fix_your_timestep/ - Fixed timestep pattern (classic, universally cited)
- https://gameprogrammingpatterns.com/state.html - Game state pattern (Bob Nystrom)
- https://gameprogrammingpatterns.com/event-queue.html - Event queue pattern (Bob Nystrom)
- https://developer.playcanvas.com/user-manual/physics/ammo-alternatives/ - PlayCanvas physics alternatives (confirms we bypass their physics, use Rapier independently)
- https://stately.ai/blog/2023-12-01-xstate-v5 - XState v5 release announcement ("smaller than ever")
- https://github.com/ievgennaida/animation-timeline-control - Canvas-based TypeScript timeline control (reference for timeline UI)

### Tertiary (LOW confidence)
- XState bundle size ~16.7 kB gzipped - from older comparison article; verify with bundlephobia for current version
- Babylon.js Rapier integration - forum discussions only; no official plugin. Our architecture bypasses this entirely (Rapier in game-runtime, not in adapter)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Rapier decided in spike, XState v5 verified via Context7 and official docs
- Architecture: HIGH - game-runtime as IR consumer follows existing adapter pattern; fixed timestep is industry standard
- Behavior system: HIGH - Simple tick loop pattern, well-understood, schemas already exist
- Event wiring: HIGH - Wire schema exists in ECSON/IR, bus is simple dispatch
- Character controller: HIGH - Rapier KinematicCharacterController verified in official docs
- Game state machine: HIGH - XState v5 serializable machines verified, fits gameSettings model
- Timeline v0: MEDIUM - Custom implementation for minimal scope; track/keyframe/clip pattern is standard but our specific IR integration needs design work
- Verb UX: MEDIUM - Pattern is straightforward (composite PatchOps) but no prior art to reference for our specific architecture
- Pitfalls: HIGH - WASM memory management, broadphase timing, active events flag all documented in official Rapier docs
- Performance: MEDIUM - Rapier benchmarks from spike, but behavior system overhead and delta throughput need validation

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable -- Rapier and XState APIs are mature)
