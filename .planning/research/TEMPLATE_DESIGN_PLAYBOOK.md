# Riff3D Template Design Playbook

**Status:** Draft v2 (revised for Riff3D architecture alignment)
**Date:** 2026-02-19
**Revision flag:** RE-EVALUATE at Phase 8 planning — architecture, networking, and component registry decisions from Phases 1-7 will change assumptions here.
**Audience:** Engineers, designers, AI coding assistants working on Riff3D templates
**Goal:** Increase template reuse, speed-to-prototype, and measurable fun value while staying within Riff3D's contract-first architecture.
**Origin:** Initial draft by Codex; revised by Claude for Riff3D architecture integration.

---

## 1. Purpose and Scope

This playbook defines how game templates and their underlying archetypes should be designed, validated, and promoted within Riff3D. It serves two audiences:

- **Human designers/engineers:** A structured process for template creation with quality gates
- **AI coding assistants:** Machine-parseable contracts with clear boundaries on what can and cannot be modified

Templates are central to Riff3D's fun-first wedge. Per FOUNDATION.md, "Templates are the primary way we validate what belongs in the core." The 2-template promotion rule governs when a capability graduates from template-specific to core spec.

### What This Playbook Does NOT Cover

- VR-specific template variants (Phase 10 — v1.1 expansion)
- Networking architecture decisions (deferred to Phase 5 collaboration planning)
- Multiplayer infrastructure details (deferred to Phase 7 game runtime planning)

These topics will be incorporated when this playbook is re-evaluated at Phase 8 planning.

---

## 2. Non-Negotiable Platform Contracts

Every template must honor Riff3D's architectural constraints:

1. **PatchOps-first mutation model** — All template edits flow through PatchOps. No hidden state mutations. No direct ECSON manipulation.
2. **ECSON as the document format** — Templates are ECSON documents with stable entity/asset/component IDs. Zod schemas validate all template data.
3. **Canonical IR compilation** — Templates must compile to Canonical IR and render correctly in both PlayCanvas and Babylon.js adapters (within defined tolerance).
4. **Shared session wrapper** — All game templates follow the state machine: `Lobby → Input/Role Validation → Rules/Countdown → Active Round → End Trigger → Scoring → Rematch/Exit`
5. **Existing-template-first workflow** — Reuse and extend existing templates before creating new ones.
6. **2-template promotion rule** — Core spec expands only when 2+ independent templates need a capability.
7. **Component registry integration** — All game behaviors use registered components with typed Zod schemas, defaults, and editor hints.

---

## 3. Archetype Specification Schema

An archetype defines the abstract game pattern that one or more templates can implement. Use this schema for all new or revised archetypes.

### Schema (Zod-validated YAML)

```yaml
# Archetype Spec v2 — must have a corresponding Zod schema in packages/ecson/
id: "archetype.quick_reaction_prompt.v2"
name: "Quick Reaction Prompt"
bucket: "reflex_skill"
summary: "Immediate response to unambiguous prompts under strict timing."

# Core game loop — each step maps to behavior components in the component registry
core_loop:
  - step: "spawn_prompt"
    components: ["Spawner", "Timer"]
    patchops: ["CreateEntity", "AddComponent", "SetComponentProperty"]
  - step: "open_input_window"
    components: ["Timer", "InputZone"]
    patchops: ["SetComponentProperty"]
  - step: "validate_input"
    components: ["ScoreZone", "KillZone"]
    patchops: ["SetComponentProperty"]
  - step: "apply_score"
    components: ["ScoreZone"]
    patchops: ["SetComponentProperty"]
  - step: "advance_or_end"
    components: ["GameStateMachine"]
    patchops: ["SetComponentProperty"]

player_dynamics:
  min_players: 1
  max_players: 16
  mode: "simultaneous_competitive"

round:
  target_seconds: 30
  min_seconds: 10
  max_seconds: 45

# Verbs that map to PatchOps via the verb surface (GAME-02)
verbs: ["tap", "grab", "point", "pose"]
inputs_supported: ["mouse_keyboard", "gamepad", "mobile_touch"]

win_conditions:
  - "highest_score"
  - "fastest_valid_response"
failure_conditions:
  - "invalid_input"
  - "timeout"
  - "false_start"

# Systems must reference registered components from packages/ecson/ component registry
systems: ["InputZone", "ScoreZone", "Timer", "GameStateMachine"]

balancing:
  handicap_model: "reaction_window_tiers"
  anti_dominance_rule: "streak_soft_cap"

# Fun hypothesis — see Section 5
fun_hypothesis:
  target_aesthetics: ["challenge", "sensation", "fellowship"]  # MDA aesthetics
  sdt_primary_need: "competence"  # SDT: competence | autonomy | relatedness
  primary_driver: "challenge_skill_balance"

# Template mapping — how this archetype relates to roadmap templates
template:
  parent_template: "Party Game Starter"  # Must be one of: GAME-05, GAME-06, GAME-07, GAME-08
  recommended_base: "Template_TimedRound"
  allowed_modifications: ["prompts", "visual_theme", "scoring_weights", "sfx_pack"]
  forbidden_modifications: ["session_wrapper", "patchops_pipeline", "ecson_schema"]

# Conformance — ties into golden fixtures and conformance harness
conformance:
  required_golden_fixture: true  # Must have a fixture in packages/fixtures/
  round_trip_test: true          # ECSON → Canonical IR → ECSON must pass
  adapter_tolerance_test: true   # Must render within tolerance on both adapters

instrumentation:
  required_events:
    - "round_start"
    - "prompt_shown"
    - "input_received"
    - "input_validated"
    - "round_end"
  required_metrics:
    - "response_time_ms_p50"
    - "response_time_ms_p90"
    - "invalid_input_rate"
    - "quit_rate_round_1"

accessibility_minimum:
  - "high_contrast_mode"
  - "remappable_controls"
  - "captioned_audio_cues"
  - "color_independent_signaling"
  - "time_window_assist_option"

promotion_gate:
  min_internal_playtests: 5       # Scaled to feasible scope for v1
  min_fun_score: 3.6
  min_replay_intent_rate: 0.35
  max_round1_quit_rate: 0.20
```

### Zod Integration Note

Each archetype spec YAML should have a corresponding Zod schema in `packages/ecson/src/schemas/archetypes/`. The Zod schema is the source of truth; the YAML is a human-readable representation validated against it. Types are derived with `z.infer<>`.

---

## 4. Template Surface Contracts

For each template, define what AI agents and designers can and cannot modify:

| Surface | Description | Examples | AI Default |
|---------|-------------|----------|------------|
| **frozen_surface** | Architectural invariants. Never modify. | Session state machine, PatchOps pipeline, ECSON schema structure, Canonical IR compilation, adapter interface | NEVER touch |
| **soft_surface** | Theme and tuning. Freely modifiable. | Verbs, art/audio packs, prompt sets, map modules, scoring weights, visual themes, SFX | Edit freely |
| **extension_points** | Approved hooks for new behavior. | Spawn rules, scoring modifiers, role assignment logic, custom event wires | Edit with care |
| **risk_flags** | Known failure modes requiring guard checks. | Latency-sensitive timing, physics edge cases, score overflow, accessibility regressions | Check before shipping |

**Rule:** AI assistants should only edit `soft_surface` and `extension_points` unless explicitly instructed by a human to modify frozen surfaces.

### PatchOps Mapping

All template modifications must produce valid PatchOps:

| Template Change | PatchOps |
|----------------|----------|
| Change visual theme | `SetComponentProperty` (material refs) |
| Add new spawn point | `CreateEntity` + `AddComponent` (Spawner) |
| Modify scoring weights | `SetComponentProperty` (ScoreZone config) |
| Wire new event | `SetComponentProperty` (event wiring) |
| Add behavior component | `AddComponent` + `SetComponentProperty` |
| Swap prompt set | `SetComponentProperty` (prompt data) |

---

## 5. Fun Value Framework

### Measurement Approach

Fun measurement uses two complementary tools:

1. **Structured self-report** — iGEQ (In-Game Experience Questionnaire, short form) for validated fun/engagement/tension measurement after playtests. This is the primary fun signal.
2. **Behavioral telemetry** — Session metrics (see Section 6) for product health. This catches problems that self-report misses.

### Design Checklist: 5-Factor Score (1-5 each)

Use during design and after playtests:

1. **Clarity** — Players understand objective in ≤ 10 seconds.
2. **Agency** — Outcomes feel affected by player choices/skill.
3. **Social Energy** — Laughter, conversation, callouts, rematch intent.
4. **Tension Curve** — Meaningful peak moments per short round.
5. **Variety per Minute** — Micro-variation without rule confusion.

**Weighting:**
```
FunScore = 0.20*Clarity + 0.20*Agency + 0.25*SocialEnergy + 0.20*TensionCurve + 0.15*Variety
```

Social Energy is weighted highest because party games live or die on social dynamics. This aligns with SDT research showing **relatedness is the dominant psychological need** for social/party games (see Section 11).

### Promotion Thresholds

| Stage | FunScore | Additional Gate |
|-------|----------|-----------------|
| Prototype survives | ≥ 3.2 | — |
| Template candidate | ≥ 3.6 | Telemetry passes Section 6 gates |
| Core promotion | ≥ 3.6 | 2+ independent templates need same capability |

---

## 6. Telemetry Specification

### Product Health Metrics

Use HEART-style dimensions selectively for product health monitoring (not fun measurement — that's Section 5):

| Dimension | Signal | Why It Matters |
|-----------|--------|----------------|
| **Adoption** | First-session completion rate | Do new players finish their first game? |
| **Engagement** | Rounds per session, active input density | Are players actively participating or idle? |
| **Retention** | Session return rate (same-party context) | Do groups come back to play again? |

Note: HEART's Happiness and Task Success dimensions are replaced by the iGEQ-based fun measurement in Section 5, which is better validated for game contexts.

### Required Event Envelope

All template events must follow this structure:

```json
{
  "event_name": "round_end",
  "ts_utc": "2026-02-19T20:13:14.132Z",
  "build_id": "tmpl_partygame_0.4.2",
  "template_id": "party_game_starter",
  "archetype_id": "archetype.quick_reaction_prompt.v2",
  "session_id": "sess_...",
  "party_id": "party_...",
  "player_id_hash": "p_...",
  "input_mode": "mouse_keyboard",
  "metrics": {
    "round_duration_s": 28.4,
    "score": 14,
    "won": false
  }
}
```

### Required Events Per Template

Every template must emit at minimum:
- `round_start`, `round_end`
- `player_join`, `player_leave`
- `input_received` (for engagement density)
- `game_state_transition` (lobby → playing → results)

---

## 7. Latency and Fairness Budgets

> **Note:** Specific networking architecture will be decided during Phase 5 (collaboration) and Phase 7 (game runtime) planning. These are target budgets, not implementation specs.

### Target Budgets by Game Type

| Game Type | Target Input Latency | Hard Fail Threshold | Notes |
|-----------|---------------------|---------------------|-------|
| Reflex/Reaction | ≤ 100ms end-to-end | 150ms | Timing-critical games must degrade gracefully |
| Physics/Interaction | ≤ 150ms | 200ms | State correction should avoid visible snapping |
| Turn-based/Strategy | ≤ 500ms | 1000ms | Relaxed — perception less affected |

### Fairness Rules

- If latency exceeds hard fail threshold, downshift game mode from competitive scoring to casual/party (no ranked penalties).
- All timing-sensitive scoring must use server-authoritative timestamps (implementation TBD in Phase 7).
- Role rotation required for any asymmetric game modes to prevent advantage stacking.

---

## 8. Accessibility Baseline

Every template must meet this baseline before internal release:

1. **Remappable controls** — All input bindings configurable
2. **Subtitle/caption support** — Critical audio cues have text equivalents
3. **High-contrast UI mode** — All game UI elements visible in high-contrast
4. **Color-independent signaling** — Success/failure never communicated by color alone (shape, icon, sound, position)
5. **Time-window assist** — Precision-heavy prompts offer an extended timing option

References: Xbox Accessibility Guidelines, Game Accessibility Guidelines (gameaccessibilityguidelines.com).

---

## 9. AI Assistant Workflow

When asked to generate or modify a game template, the AI assistant must produce:

### Required Outputs

1. **Archetype Spec** (v2 YAML, per Section 3) — with component registry references and PatchOps mapping
2. **Template Diff Plan** — soft-surface and extension-point changes only, unless human-approved for frozen surface
3. **Event Instrumentation Plan** — events per Section 6
4. **Risk Register** — latency, fairness, accessibility, and architecture risks
5. **Playtest Plan** — minimum 5 sessions with iGEQ collection
6. **Promotion Decision** — `reject`, `iterate`, or `template_candidate`

### Prompt Skeleton for AI Agents

```text
You are extending a Riff3D game template.

Architecture constraints:
- All edits flow through PatchOps. No direct ECSON mutation.
- Templates are ECSON documents compiled to Canonical IR.
- Behavior components come from the registered component library (packages/ecson/).
- Reuse existing template first. Only create new components via the 2-template promotion rule.
- Only modify soft surfaces and extension points unless explicitly authorized.

Required outputs:
- Archetype Spec v2 YAML (Section 3 schema)
- Template Diff Plan with PatchOps mapping
- Event instrumentation plan
- Risk register (latency/fairness/accessibility/architecture)
- FunScore estimate with target aesthetics (MDA) and primary SDT need
```

---

## 10. Template Backlog: Mapping Archetypes to Roadmap Templates

The roadmap defines four v1 templates (GAME-05 through GAME-08). Each template can host multiple archetype variants. Archetypes are the game *patterns*; templates are the *implementation scaffolds*.

### GAME-05: Party Game Starter
**Purpose:** Spawn points, scoring, round loop, simple UI — the core party game scaffold.

| Archetype | Bucket | Core Mechanic | Social Modifier |
|-----------|--------|---------------|-----------------|
| Quick Reaction Prompt | reflex_skill | Timed response to prompts | Teams, audience vote |
| Target Spawner | aim_skill | Score attack on moving targets | Co-op defense variant |
| Race Checkpoints | traversal | Time trial through checkpoints | Team relay |

Each archetype variant needs:
- 1 core mechanic profile (archetype spec)
- 2-3 theme/reskin packs (soft surface)
- 2 difficulty configurations (scoring weight tuning)
- 1 social modifier mode (teams, sabotage, vote, or audience influence)

### GAME-06: Character Playground
**Purpose:** Rig import, basic animation playback, simple interactions.

Archetype variants: Emote showcase, character interaction sandbox, animation testing ground. These are exploration-focused (no win/lose), validating the character entity model (GAME-09).

### GAME-07: Physics Toy
**Purpose:** Portable physics behavior + explicit engine tuning.

Archetype variants: Demolition sandbox, stacking challenge, physics puzzle. These validate Rapier integration and the engine tuning escape hatch (CORE-08).

### GAME-08: Cinematic Clip
**Purpose:** Camera cuts, transform keyframes, events.

Archetype variants: Cutscene player, camera fly-through, event-triggered sequence. These validate Timeline v0 (GAME-10) and the animation portable subset.

### Cross-Template Validation

Each template exercises different portable subset capabilities. All four must pass conformance tests, validating:
- Component registry coverage across game types
- PatchOps coverage for all template operations
- Canonical IR compilation for all template content
- Dual-adapter rendering within tolerance

---

## 11. Research Framework Summary

This playbook draws on the following frameworks. Each is applied within its validated scope:

### MDA (Mechanics-Dynamics-Aesthetics)
**Application:** Target 1-3 aesthetics per archetype, then work *backward* to select mechanics that produce them. The designer's direction is aesthetics → mechanics (goal-setting), even though the system operates mechanics → dynamics → aesthetics.

Eight canonical aesthetics: Sensation, Fantasy, Narrative, Challenge, Fellowship, Discovery, Expression, Submission.

**Source:** Hunicke, LeBlanc, Zubek (2004). [MDA: A Formal Approach to Game Design and Game Research](https://aaai.org/papers/ws04-04-001-mda-a-formal-approach-to-game-design-and-game-research/).

### SDT (Self-Determination Theory)
**Application:** Design checklist — does the template satisfy competence (mastery moments, feedback), autonomy (meaningful choices), and relatedness (social connection)?

**Critical note for party games:** Relatedness is the dominant need. A 2024 study found relatedness is ignored in 43% of SDT-based game analyses — this is exactly wrong for social games. Weight relatedness highest in design reviews.

**Source:** Ryan, Rigby, Przybylski (2006). [Motivation and Enjoyment of Video Games](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf). Autonomy limitation in rule-bound games noted in Deci & Ryan (2000), [PubMed](https://pubmed.ncbi.nlm.nih.gov/11392867/).

### iGEQ (In-Game Experience Questionnaire)
**Application:** Primary fun measurement tool. Short-form (14 items) administered after playtests. Measures: competence, immersion, flow, tension, challenge, negative affect, positive affect. Validated for short-session game contexts.

**Why not HEART for fun?** HEART (Google, CHI 2010) is a product health dashboard designed for web applications. It measures adoption, engagement, retention — useful for product metrics (Section 6) but not validated for measuring "fun" in game contexts. iGEQ is purpose-built for this.

### LFCG (Living Framework for Cooperative Games)
**Application:** Design reference for any cooperative or semi-cooperative template variants. Defines play structure, player context, forms of cooperation, and cooperation design patterns. Published CHI 2024, analyzed 129 cooperative games.

**Source:** [A Living Framework for Understanding Cooperative Games](https://dl.acm.org/doi/10.1145/3613904.3641953). Web tool at lfcooperativegames.com.

### BANGS (Basic Needs in Games Scale)
**Application:** If more rigorous SDT measurement is needed during playtesting, BANGS provides a validated 6-subscale instrument measuring both *satisfaction and frustration* of competence, autonomy, and relatedness. Useful for diagnosing why a template feels unfun (frustration dimension).

**Source:** [BANGS 2024](https://www.sciencedirect.com/science/article/pii/S1071581924000739).

### Additional References

- Riot Games netcode fairness tradeoffs: https://technology.riotgames.com/news/peeking-valorants-netcode
- Valve lag compensation: https://developer.valvesoftware.com/wiki/Lag_compensation
- Xbox Accessibility Guidelines: https://learn.microsoft.com/en-us/gaming/accessibility/guidelines
- Game Accessibility Guidelines: https://gameaccessibilityguidelines.com/

---

## 12. Revision Schedule

| Trigger | Action |
|---------|--------|
| **Phase 7 planning starts** | Review latency budgets and fairness rules against actual networking architecture decisions from Phase 5 |
| **Phase 8 planning starts** | **Full re-evaluation.** Reconcile with actual component registry, validate archetype specs against built game runtime, update playtest process to use available infrastructure, finalize template backlog priorities |
| **Phase 10 planning starts** | Add VR-specific archetype variants, VR comfort budgets, asymmetric play patterns |
| **After each template ships** | Update promotion gate data with real playtest results; evaluate 2-template promotion candidates |

---

*Originally drafted by Codex (2026-02-19). Revised by Claude for Riff3D architecture alignment (2026-02-19).*
*This document is research-grade reference material. It becomes actionable at Phase 8 (Templates, Party System & Ejection).*
