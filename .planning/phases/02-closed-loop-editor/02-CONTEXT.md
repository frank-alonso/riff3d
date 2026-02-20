# Phase 2: Closed-Loop Editor - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A functional 3D editor shell where users can create projects, view and edit scenes via PlayCanvas, manipulate entities with gizmos and panels, undo/redo, and play-test — the full pipeline (PatchOps → ECSON → Canonical IR → PlayCanvas adapter) working end-to-end. Collaboration, Babylon.js adapter, game runtime behaviors, and templates are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Editor shell layout
- VS Code-style layout: activity bar on far left with icon tabs, left sidebar panel (hierarchy/assets), center viewport, right sidebar for inspector
- Fixed panel positions for Phase 2 — no drag-and-drop docking or user-configurable layouts
- Editing tools live in a floating toolbar embedded in the viewport (Figma-style), not in the top bar
- Top bar is minimal: project name, save status, and play/pause/stop controls centered
- Asset browser has dual presence: activity bar tab for full browsing + compact bottom strip below viewport for drag-and-drop into scene

### Visual style
- Dark theme as the default and only theme shipped in Phase 2
- Design with theming in mind (CSS custom properties / Tailwind theme tokens) so light theme can be added later without a rewrite

### Dashboard & project flow
- Card grid layout for project listing — thumbnail cards showing project name, relative timestamp, entity count, and collaborator avatars
- "New Project" opens a modal with blank scene option and template slots (templates locked/placeholder until Phase 8, but the UI slot exists now)
- Project name field in the creation modal
- Empty dashboard (new user, no projects) shows a hero CTA — welcoming illustration/graphic with a prominent "Create your first project" button

### Viewport & interaction
- Camera: both game-style (right-click+drag to look, WASD to fly) and orbit mode (Alt+click to orbit, Alt+middle to pan). Default is game-style. Toggle via key shortcut or UI button
- Gizmos: standard RGB axes (red=X, green=Y, blue=Z) for translate, rotate, and scale. Familiar industry-standard style
- Selection: click to select, Shift+click to add/remove, drag rectangle for box/marquee selection
- Default blank scene: starter kit — ground plane, sky/environment, directional light, plus a couple of placeholder objects (cube, sphere) to immediately show the pipeline working

### Play-test transition
- In-place transition: viewport stays in the same location, colored border/tint signals play mode (like Unity's blue tint)
- Panels collapse when entering play mode but are "peekable" — user can hover or toggle panels back temporarily to inspect runtime values
- Play/Pause/Stop controls centered in the top bar, always visible regardless of mode
- On Stop: discard all runtime changes (scene resets to pre-play state). Aspirational: "offer to keep changes" prompt — planner should evaluate feasibility during planning; if too many edge cases (character movement, physics state leaking back), fall back to discard-all and defer as a future enhancement

### Claude's Discretion
- Loading skeleton design and spinner placement
- Exact spacing, typography, icon set
- Panel resize handle behavior and min/max widths
- Error state handling and toast/notification design
- Keyboard shortcut assignments (beyond camera toggle)
- Auto-save interval and debounce strategy
- Thumbnail generation approach (viewport screenshot vs. server-side render)

</decisions>

<specifics>
## Specific Ideas

- VS Code as the mental model for the shell — activity bar with icon tabs switching left panel content
- Figma as the reference for the floating viewport toolbar — tools inside the canvas, not in chrome
- Unity as the reference for play-mode tint and play/stop behavior
- Project cards should show useful metadata at a glance (entity count, collaborator avatars, timestamps)
- Template slots in the "New Project" modal from day one, even if locked — signals that templates are coming

</specifics>

<deferred>
## Deferred Ideas

- Configurable/dockable panel layout (drag panels, save/restore layouts) — user wants this eventually, explore open-source docking libraries during research but don't ship in Phase 2
- Light theme — design with theming in mind but ship dark-only for now
- "Keep runtime changes" prompt on Stop — evaluate feasibility during planning, defer if too complex

</deferred>

---

*Phase: 02-closed-loop-editor*
*Context gathered: 2026-02-19*
