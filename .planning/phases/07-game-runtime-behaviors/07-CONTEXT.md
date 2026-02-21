# Phase 7: Game Runtime & Behaviors - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can add game logic to scenes using pre-built behavior components, wire events, control characters, and play-test complete game loops — all authored through verbs and the inspector. Deliverables: physics integration (Rapier3D), character controller, behavior component runtime, event wiring system, game state machine (XState), verb-driven UX surface, timeline v0, and a default HUD. Templates and party system are Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Verb surface design
- **Toolbar + command palette + context menus.** Bottom toolbar for 5-6 common verbs (icon + short label, Figma-style). Command palette (Cmd+K) for full catalog. Context menus for contextual verbs on right-click.
- **Bottom toolbar placement.** Verb toolbar lives next to the quick asset panel in the bottom bar. Bottom = "creation zone" (assets + verbs), top bar = editing tools.
- **Context-sensitive verbs.** Scene-level verbs (Add Character, Add Spawn Point, Start Game) always active. Entity-level verbs (Make It Bouncy, Make It a Zone, Add Movement) only active when an entity is selected. Grayed out otherwise.
- **Instant application with defaults.** Verbs fire immediately with sensible defaults — no configuration popover. User tweaks in inspector after.
- **Template-overridable defaults.** Verb defaults are parameterizable via `gameSettings.verbDefaults`. Templates in Phase 8 can override defaults (e.g., a third-person template's "Add Character" defaults to third-person controller). Phase 7 builds the mechanism, Phase 8 populates it.
- **Unified command palette.** Single search palette with fuzzy matching (type "bouncy" → finds "Make It Bouncy"). Visual category badges ("Verb", "Entity", "Setting") inline on results. Smart ranking — recent actions, context-relevant items higher. No tabs or sections, but grouped visually.

### Character control feel
- **Both camera modes available.** Third-person orbit and first-person as character controller variants. Third-person as default. User picks mode per character in the inspector. Templates set their preferred mode.
- **Capsule placeholder now, mannequin later.** Default character is a procedural capsule with a direction indicator. No external GLB asset needed. Phase 8 templates bring their own character models; a default mannequin can be added then.
- **Inspector tuning: minimal by default, advanced toggle.** Basic properties always shown: speed, jump height, gravity multiplier (~3 sliders). Advanced toggle reveals: acceleration, air control, step height, slope limit (~8 total). Toggle is per-component-section in inspector, not a global editor mode.
- **Both boundary types as components.** KillZone floor (fall-off → respawn) and invisible wall (edge prevention) both exist as placeable components. Phase 7 builds both; templates in Phase 8 decide which to use.

### Game state UX
- **Layered state transitions.** Minimal HUD overlay during gameplay (score, timer in corners). Full-screen moments only for major transitions: countdown numbers at start, results screen overlay at game end. Scene stays visible during play.
- **Built-in default HUD.** Auto-detects what to show based on scene components: score zone present → show score, timer present → show countdown, etc. No user customization of HUD layout in Phase 7. **Carry-forward to Phase 8: configurable HUD** (position, toggle elements, styling).
- **Win/lose: preset dropdowns backed by event wires.** Common condition presets as the easy path: "Score reaches X", "Timer runs out", "All zones triggered", "Player reaches checkpoint". Presets generate event wires behind the scenes. Power users can edit the underlying wire directly. Presets are sugar over wires.
- **Stats summary on results screen.** Game end shows: outcome (Win/Lose/Time's Up) + final score + time elapsed + zones triggered + deaths count. Gives creators feedback on their game design during play-test.

### Event wiring authoring
- **Inline on component (primary).** Event wires authored right in the inspector on each behavior component. Each component shows its available triggers (e.g., ScoreZone shows "On Player Enter") with a "+ Add event wire" button. Unity/Godot pattern.
- **Multiple wires per trigger.** A single trigger can fire multiple actions (e.g., "On Player Enter" → Add Score AND Play Sound). Each wire is a separate row under the trigger.
- **Target picking: dropdown + hierarchy drag.** When an action needs a target entity: searchable dropdown filtered to compatible entities, plus drag-and-drop from the hierarchy panel into the target slot. No viewport eyedropper — hierarchy drag is more reliable. Actions without a target (game-level actions like "Add Score") skip the target picker.
- **"All Wires" overview panel.** Read-only panel listing all event wires in the scene. Each wire shows source → trigger → action (→ target). Locate icon per wire — clicking selects the source entity in hierarchy, scrolls inspector to the event section, highlights the specific wire with a brief pulse animation. Single source of truth for editing stays in the inspector.

### Claude's Discretion
- Exact verb set for the toolbar (likely ~5-6, shaken out during implementation)
- Whether "Make It a Zone" is one verb with a sub-type or three separate verbs
- Command palette ranking algorithm details
- Specific HUD positioning and styling
- Timeline v0 keyframe interpolation details
- Physics body default parameters
- Overview panel icon choice (locate/crosshair style)

</decisions>

<specifics>
## Specific Ideas

- Verbs should feel template-aware: "If you opened a third-person template, pressing Add Character would add a third-person one." The verb system reads project context, not just global defaults.
- Command palette should surface items "you might have been thinking of but didn't type exactly right" — fuzzy matching with semantic awareness, not just substring matching.
- Inspector advanced toggle is per-component-section — contextual, not a global editor mode switch.
- Event wire overview panel navigation should feel like clicking an error in a console → jumping to source line. Smooth scroll, brief highlight pulse, not jarring.
- Win/lose presets are "sugar over wires" — they generate real event wires that power users can inspect and edit directly. One authoring model under the hood.

</specifics>

<deferred>
## Deferred Ideas

- Configurable HUD (position, element toggles, styling) — Phase 8 carry-forward
- Default mannequin character model (replace capsule) — Phase 8 when templates ship character models
- Viewport eyedropper for wire target picking — evaluate if hierarchy drag proves insufficient
- Visual node graph for event wiring — v3 visual scripting (VSCR-01)
- Per-component-property CRDT merge depth (CF-P6-01) — evaluate during Phase 7

</deferred>

---

*Phase: 07-game-runtime-behaviors*
*Context gathered: 2026-02-21*
