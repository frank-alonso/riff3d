# Spatial Validation Research Reference

**Status:** Research reference — not authoritative. Consult during Phase 7/8/9 planning.
**Date:** 2026-02-19 (combined from prototype research + playbook draft)
**Scope:** Deterministic spatial validation for platformer/physics content in Riff3D
**Roadmap fit:** Phase 7 (validator implementation), Phase 8 (template integration), Phase 9 (AI/IQL exposure)
**Supersedes:** prototype `03-spatial-validation-research.md` (read-only reference, no longer primary)

---

## 1) The Core Problem

### LLMs Cannot Reliably Reason in 3D Space

Research shows vision-language models achieve ~55% accuracy on 3D spatial reasoning tasks vs. 87% human baseline (SpatiaLab, 2025). Specific failure modes:

- Cannot reliably compute jump distances from physics parameters
- Depth perception and relative positioning degrade for 3+ objects
- Cannot generalize from described physics to spatial implications
- Small errors in platform height drastically change reachability

**Bottom line:** You cannot prompt-engineer an LLM into placing platforms at valid jump distances. A deterministic constraint layer must enforce this.

### What "Valid" Means for a Platformer

Given a character with known physics, a platform is reachable from another if:

1. **Horizontal gap** <= max jump distance (speed x air time)
2. **Vertical gap** <= max jump height (up) or within fall tolerance (down)
3. **The path is connected** — spawn to goal via valid jumps
4. **No softlocks** — every reachable platform has at least one outgoing edge (or is the goal)
5. **Difficulty is in range** — gaps aren't trivially easy or impossibly precise

### Research Validation

**Confirmed:**
1. Reachability constraints are the right backbone. Constraint-based platformer generation with precomputed movement states is proven for guaranteeing traversability under model assumptions.
2. Difficulty-as-percentage-of-max-range is concrete and testable (see Section 3.2).
3. Graph analysis supports optional path detection, dead-end analysis, softlock detection, and branch design.

**Needs care:**
1. **"Provably beatable" must be scoped.** Only true w.r.t. the exact movement/physics model used by the validator. If the validator model and the runtime character controller diverge, playability estimates drift.
2. **2D literature does not transfer automatically to 3D.** Riff3D must define a 3D movement envelope and tolerance bands. Most cited papers are 2D — 3D adds Z-axis platform surfaces, non-axis-aligned jumps, and vertical gameplay.
3. **`airControl` and `wallJump` change the envelope significantly** but are hard to model analytically. The v0 validator should handle static platforms with standard jumps; advanced mechanics are v1.1 extensions.

---

## 2) Non-Conflict Integration Rules

To avoid conflicts with in-flight phases:

1. **No ECSON/PatchOps/CIR changes from this document.**
2. **All schemas below are `[PROVISIONAL]` and phase-gated.**
3. **Promotion to core contracts requires the existing 2-template rule.**
4. **Phase activation:**
   - Phase 7: implement runtime-aligned movement model + validator API
   - Phase 8: template integration + telemetry tuning (GAME-05, GAME-07)
   - Phase 9: expose validator + IQL spatial verbs to AI workflows

---

## 3) Jump Arc Physics

### 3.1 Reachable Envelope

Given character physics (configurable per game template):

```typescript
// [PROVISIONAL] — will be refined against actual Phase 7 character controller
interface CharacterPhysics {
  jumpForce: number        // Initial vertical velocity on jump (m/s)
  gravity: number          // Downward acceleration (m/s^2)
  moveSpeed: number        // Horizontal speed (m/s)
  walkSpeed?: number       // Slower horizontal speed (m/s)
  airControl?: number      // 0..1 — how much horizontal control mid-air
  coyoteTime?: number      // Extra air time after leaving platform edge (s)
  jumpBufferMs?: number    // Input buffer window for jump (ms)
  doubleJump?: boolean
  wallJump?: boolean       // Note: changes reachability graph fundamentally
}

interface ReachableEnvelope {
  maxHeight: number        // Max platform height gain achievable
  maxDistance: number       // Max horizontal distance at same height
  maxDropDistance: number   // Max horizontal distance when dropping down
  timeOfFlight: number     // Total air time for full jump
}

function computeEnvelope(physics: CharacterPhysics): ReachableEnvelope {
  const { jumpForce, gravity, moveSpeed } = physics

  // Time to reach apex: v = v0 - g*t => t_apex = v0/g
  const timeToApex = jumpForce / gravity

  // Total air time (symmetric arc): t_flight = 2 * t_apex
  const timeOfFlight = 2 * timeToApex

  // Max height: h = v0^2 / 2g
  const maxHeight = (jumpForce ** 2) / (2 * gravity)

  // Max horizontal distance at same height: d = speed * t_flight
  const maxDistance = moveSpeed * timeOfFlight

  // Max drop distance (~50% more range when dropping vs level jump)
  const maxDropDistance = moveSpeed * (timeOfFlight * 1.5)

  return { maxHeight, maxDistance, maxDropDistance, timeOfFlight }
}
```

### 3.2 Difficulty as % of Max Range

```typescript
type Difficulty = 'trivial' | 'easy' | 'medium' | 'hard' | 'precise'

const DIFFICULTY_RANGES: Record<Difficulty, { min: number; max: number }> = {
  trivial:  { min: 0.3, max: 0.5 },   // 30-50% of max jump
  easy:     { min: 0.5, max: 0.7 },   // 50-70%
  medium:   { min: 0.65, max: 0.82 }, // 65-82%
  hard:     { min: 0.78, max: 0.90 }, // 78-90%
  precise:  { min: 0.88, max: 0.95 }, // 88-95% — punishing
}

function validGapRange(
  envelope: ReachableEnvelope,
  difficulty: Difficulty
): { minGap: number; maxGap: number } {
  const { min, max } = DIFFICULTY_RANGES[difficulty]
  return {
    minGap: envelope.maxDistance * min,
    maxGap: envelope.maxDistance * max,
  }
}
```

### 3.3 Double Jump Extension

```typescript
function computeDoubleJumpEnvelope(physics: CharacterPhysics): ReachableEnvelope {
  const base = computeEnvelope(physics)
  // Second jump at apex adds ~70% of base height, extends distance
  return {
    maxHeight: base.maxHeight + (base.maxHeight * 0.7),
    maxDistance: base.maxDistance * 1.6,
    maxDropDistance: base.maxDropDistance * 1.6,
    timeOfFlight: base.timeOfFlight * 1.5,
  }
}
```

### 3.4 Jump Reachability Check

```typescript
function checkJumpReachable(
  horizontalDist: number,
  heightDelta: number,
  envelope: ReachableEnvelope
): boolean {
  // Can't jump higher than max height
  if (heightDelta > envelope.maxHeight) return false

  // Jumping up reduces horizontal range; dropping extends it
  const heightPenalty = heightDelta > 0
    ? (heightDelta / envelope.maxHeight) * 0.4  // Up costs 40% range
    : Math.abs(heightDelta) * 0.1               // Drop slightly extends

  const effectiveMaxDist = heightDelta > 0
    ? envelope.maxDistance * (1 - heightPenalty)
    : envelope.maxDropDistance

  return horizontalDist <= effectiveMaxDist
}
```

---

## 4) Reachability Graph

### 4.1 Graph Structure

```typescript
// [PROVISIONAL] — platform representation TBD based on Phase 7 entity model
interface PlatformNode {
  entityId: string
  bounds: {
    minX: number; maxX: number   // Surface extents
    minZ: number; maxZ: number
    y: number                    // Surface height
  }
  type: 'static' | 'moving' | 'bouncy' | 'slippery'  // v0: static only
  tags: string[]                 // 'spawn', 'goal', 'checkpoint', etc.
}

interface JumpEdge {
  from: string           // Entity ID
  to: string
  difficulty: number     // 0-1, % of max jump distance
  direction: 'up' | 'level' | 'down'
  distance: number       // Actual horizontal distance
  heightDelta: number    // Positive = jumping up
}

interface ReachabilityGraph {
  nodes: Record<string, PlatformNode>
  edges: JumpEdge[]
  connected: boolean           // Can spawn reach goal?
  unreachableNodes: string[]   // No incoming edges from spawn-connected set
  softlockNodes: string[]      // Reachable but no outgoing edges (not goal)
  criticalPath: string[]       // Shortest spawn-to-goal path
}
```

### 4.2 Building the Graph

```typescript
function buildReachabilityGraph(
  platforms: PlatformNode[],
  physics: CharacterPhysics,
  spawnId: string,
  goalId: string
): ReachabilityGraph {
  const envelope = physics.doubleJump
    ? computeDoubleJumpEnvelope(physics)
    : computeEnvelope(physics)

  const edges: JumpEdge[] = []

  for (const from of platforms) {
    for (const to of platforms) {
      if (from.entityId === to.entityId) continue

      const horizontalDist = minHorizontalDistance(from.bounds, to.bounds)
      const heightDelta = to.bounds.y - from.bounds.y

      if (checkJumpReachable(horizontalDist, heightDelta, envelope)) {
        edges.push({
          from: from.entityId,
          to: to.entityId,
          difficulty: horizontalDist / envelope.maxDistance,
          direction: heightDelta > 0.5 ? 'up' : heightDelta < -0.5 ? 'down' : 'level',
          distance: horizontalDist,
          heightDelta,
        })
      }
    }
  }

  // A* from spawn to goal
  const criticalPath = astar(spawnId, goalId, edges)
  const unreachableNodes = findUnreachable(platforms, edges, spawnId)
  const softlockNodes = findSoftlocks(platforms, edges, goalId)

  return {
    nodes: Object.fromEntries(platforms.map(p => [p.entityId, p])),
    edges,
    connected: criticalPath.length > 0,
    unreachableNodes,
    softlockNodes,
    criticalPath,
  }
}
```

---

## 5) Hazard Modeling

The prototype research did not include hazard modeling. Hazards affect difficulty metrics and can create softlocks (e.g., inescapable enemy patrol zones).

```typescript
// [PROVISIONAL] — v0 may skip hazards entirely and add in Phase 8
interface Hazard {
  id: string
  type: 'spike' | 'enemy' | 'projectile' | 'moving_hazard'
  position: [number, number, number]
  size?: [number, number, number]
}
```

Hazards contribute to:
- `hazardDensity` metric (hazards per unit path length)
- `estimatedSuccessProb` heuristic (more hazards = lower probability)
- Softlock detection (hazard placement that blocks the only exit from a platform)

---

## 6) Validation Report

### 6.1 `[PROVISIONAL]` Report Structure

```typescript
interface ValidationIssue {
  type: 'impossible_jump' | 'unreachable_node' | 'softlock_risk' | 'tight_jump'
  severity: 'error' | 'warning'
  fromId?: string
  toId?: string
  nodeId?: string
  message: string
  margin?: number  // 0..1 — how close to the limit
}

interface ValidationMetrics {
  pathExists: boolean
  avgJumpTightness: number   // 0..1
  p50JumpMargin: number      // median margin across all required jumps
  p10JumpMargin: number      // 10th percentile (tightest jumps)
  hazardDensity: number      // hazards per unit path length
  // Note: estimatedSuccessProb deferred — needs a defined heuristic before inclusion
}

interface ValidationReport {
  levelId: string
  modelVersion: string
  pass: boolean
  issues: ValidationIssue[]
  metrics: ValidationMetrics
  repairHints: string[]      // machine-readable suggestions for AI iteration
}
```

### 6.2 Structured Feedback for AI Iteration

When validation fails, return structured feedback so the AI can self-correct:

```
ERROR: Platform "Island 3" is unreachable.
  Nearest reachable platform: "Island 2" at distance 8.4m
  Max jump distance at 'medium' difficulty: 5.2m
  Suggested fix: Move "Island 3" to within 5.2m of "Island 2",
  or add an intermediate platform between them.
```

---

## 7) IQL Spatial Verbs (Phase 9)

These IQL verbs are physics-aware and would be implemented when the IQL compiler lands in Phase 9. Included here for design context.

### 7.1 Proposed Verbs

```
# Chain platforms at valid jump distances
CHAIN platform COUNT 5 DIFFICULTY medium DIRECTION +x
CHAIN platform COUNT 8 DIFFICULTY hard STYLE zigzag

# Scatter platforms within reachable range of an anchor
SCATTER platform COUNT 6 AROUND @spawn_point DIFFICULTY easy

# Validate without modifying
VALIDATE reachability FROM @spawn_point TO @goal
VALIDATE reachability    # checks whole level

# Debug visualization in editor
SHOW jump_arcs FROM "Platform 1"
SHOW reachability_graph
```

### 7.2 CHAIN Style Modifiers

```
STYLE linear     — straight line, uniform spacing
STYLE zigzag     — alternating left/right with height variation
STYLE spiral     — circular pattern, rising
STYLE random     — valid but random within envelope, seed-able
STYLE ascending  — gradually increasing height (climb sequence)
STYLE gauntlet   — narrow platforms, max difficulty, linear
```

### 7.3 IQL Compiler Integration

When the IQL compiler processes spatial commands, it:

1. Reads `CharacterPhysics` from `GameSettings.characterSettings`
2. Computes the reachable envelope
3. Snaps proposed positions to valid gap range for the requested difficulty
4. Runs post-placement reachability check on the full graph
5. Returns structured repair feedback if validation fails

```typescript
// Sketch of IQL spatial resolution (Phase 9)
function resolveRelativePosition(
  modifier: 'ABOVE' | 'NEAR' | 'AFTER',
  reference: PlatformNode,
  difficulty: Difficulty,
  physics: CharacterPhysics
): Vec3 {
  const envelope = computeEnvelope(physics)
  const { minGap, maxGap } = validGapRange(envelope, difficulty)
  const gap = lerp(minGap, maxGap, Math.random())

  if (modifier === 'AFTER') {
    const heightDelta = (Math.random() - 0.5) * 0.8 * envelope.maxHeight
    return {
      x: reference.bounds.maxX + gap,
      y: reference.bounds.y + heightDelta,
      z: reference.bounds.minZ + (reference.bounds.maxZ - reference.bounds.minZ) / 2,
    }
  }
  // ... other modifiers
}
```

---

## 8) Editor Tooling Concepts (Phase 7/8)

### Jump Arc Visualizer

When a platform is selected, overlay the reachable envelope:
- **Green zone:** easily reachable (trivial-easy)
- **Yellow zone:** reachable but challenging (medium-hard)
- **Red zone:** at the edge of possible (precise)
- **Grey:** unreachable

### Reachability Overlay

One-click "validate level" button:
1. Builds the reachability graph
2. Colors platforms: green (reachable), red (unreachable), orange (softlock risk)
3. Draws jump arc lines between connected platforms
4. Reports critical path and difficulty distribution

### Auto-Fix Suggestions

When validation fails, offer:
- "Move platform to nearest valid position"
- "Insert bridging platform between isolated sections"
- "Adjust difficulty: relax all gaps to easy"

---

## 9) Acceptance Tests (Phase 7/8 Gate Candidates)

### Contract tests
1. `valid_level_draft_parses`: valid draft parses under schema
2. `invalid_platform_rejected`: non-positive platform dimensions fail
3. `movement_model_bounds`: invalid gravity/speed/air-control rejected

### Reachability tests
1. `path_exists_simple`: linear 4-platform level returns `pathExists=true`
2. `gap_too_wide_fails`: single oversized mandatory gap returns `impossible_jump`
3. `unreachable_branch_detected`: optional island flags `unreachable_node`
4. `softlock_detected`: platform with incoming edges but no outgoing (and not goal) flags `softlock_risk`

### Difficulty tests
1. `tight_jump_flagged`: jump with margin under threshold emits warning
2. `hazard_density_metric`: hazard density computed deterministically
3. `difficulty_band_mapping_stable`: fixed fixture maps to same band across runs

### Regression tests
1. `sim_vs_analytic_consistency`: analytic and simulation checks agree within epsilon on fixtures
2. `runtime_parity_smoke`: validator-passing fixtures are completable by runtime bot policy
3. `report_schema_stable`: report payload remains backward-compatible

---

## 10) Suggested Minimal Deliverable (Phase 7)

1. Static-platform reachability graph (no moving platforms)
2. Analytical jump feasibility with height penalty and safety margin
3. Structured `ValidationReport` with typed issues
4. 10 fixture levels (5 pass, 5 fail) in conformance harness
5. `computeEnvelope()` + `buildReachabilityGraph()` as tested library functions

**Defer to v1.1 unless Phase 7 is stable:**
- Moving/bouncy/slippery platform types
- Wall jump envelope expansion
- Air control impact on reachability
- Dynamic hazard pathing
- Bot traversal testing

---

## 11) Roadmap Fit

| Phase | Role | Activation |
|-------|------|------------|
| Phase 1-6 | Research only, no contract mutation | Current |
| Phase 7 | Implement movement model + validator aligned to actual character controller | Plan 07-01 reference |
| Phase 8 | Integrate validator into GAME-05 (Party Game Starter) and GAME-07 (Physics Toy) | Template authoring |
| Phase 9 | Expose `validate_level`, `repair_level`, and IQL spatial verbs (CHAIN/SCATTER/VALIDATE) | AI authoring toolchain |

---

## 12) Academic References & Prior Art

### Most Relevant Papers

- **Constraint Is All You Need: GLDL** (FDG 2024) — LLM generates spatial constraints, solver finds valid positions. Direct blueprint for IQL's constraint layer. Validated in Unity with playability checks.
- **A Framework for Analysis of 2D Platformer Levels** (Smith, 2008) — Foundational reachability analysis. Directed graph: nodes = platforms, edges = possible jumps. Difficulty metrics per edge.
- **Procedural Level Design for Platform Games** (Compton & Mateas, 2006) — Pre-computing valid jump destinations as constraints. Genetic algorithms + constraint satisfaction.
- **Fast Procedural Level Population with Playability Constraints** (AAAI 2020) — Path constraints enforce traversability. Incremental generation with per-step validation.
- **Literally Unplayable: On Constraint-Based Generation of Uncompletable Levels** (FDG 2024) — Inverted approach: characterize what makes levels fail. Useful for edge case tests.
- Partlan, Lee, Cooper. *Precomputing Player Movement in Platformers for Level Generation with Reachability Constraints* (FDG workshop)
- Mourato, Santos. *Measuring Difficulty in Platform Videogames* (2010)
- Mourato et al. *Enhancing Level Difficulty and Additional Content in Platform Videogames through Graph Analysis* (2012)
- Shi, Chen. *Online Level Generation in Super Mario Bros via Learning Constructive Primitives* (2016)

### Spatial Reasoning Limitations
- **SpatiaLab: Can VLMs Perform Spatial Reasoning in the Wild?** — 55% LLM accuracy vs 87% human on 3D spatial tasks
- **How to Enable LLM with 3D Capacity?** (Survey, 2025) — 10-25% accuracy drop in open-ended 3D settings

### Open Source References
- **Surfacer** (Godot, open source) — Platform graph pre-computation with A* traversal, in-editor reachability inspector
- **WaveFunctionCollapse** — Pattern-based generation with local + global constraints
- **AI Level Designer for Unity 6** — Natural language to level layout with constraint validation

---

## 13) Related Research

- `.planning/research/TEMPLATE_DESIGN_PLAYBOOK.md` — game template design, archetypes, telemetry, promotion gates. Spatial validation feeds into template conformance testing (GAME-05, GAME-07).
- `.planning/research/RAPIER_SPIKE.md` — Rapier physics evaluation. The character controller physics that this validator must align to will be built on Rapier.

---

*Combined: 2026-02-19 from prototype 03-spatial-validation-research.md + playbook draft*
*Status: Research reference for Phase 7/8/9 planning*
