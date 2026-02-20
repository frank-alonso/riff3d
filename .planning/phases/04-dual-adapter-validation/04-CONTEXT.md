# Phase 4: Dual Adapter Validation - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a Babylon.js adapter that renders all golden fixtures from Canonical IR, add incremental property-level updates to both adapters (replacing full scene rebuild), enable engine switching in the editor, and validate conformance across both engines. This phase proves the IR is truly engine-agnostic.

</domain>

<decisions>
## Implementation Decisions

### Engine switching UX
- Switcher lives in the **main editor toolbar** (top bar), not the viewport header
- Switching shows a **loading overlay** on the viewport while the new engine initializes
- **Camera position carries over** on switch; selection resets (preserve camera only)
- Active engine indicated by a **subtle engine icon** next to the switcher (not a text label)
- Switching requires a **confirmation dialog** ("Switch to Babylon.js? Scene will reload.")
- Switcher is **disabled during play-test mode** — must return to edit mode first
- Design constraint: architect adapter state serialization so hot-swap during play could be added later

### Visual consistency expectations
- Target: **same scene, correct materials** — objects in right positions, materials look right, lighting reasonable
- Rendering differences in shadow softness, anti-aliasing, ambient occlusion are acceptable
- Must-match list: **Claude's discretion** based on what Canonical IR actually carries (geometry, PBR, lights at minimum)
- **Dev-only comparison tool** for conformance validation — side-by-side snapshots, not in the main editor UI
- Brief **tooltip on the engine switcher** noting rendering may vary slightly between engines

### Engine tuning visibility
- Engine tuning shown as a **collapsible "Engine Tuning" section** in the inspector panel
- Flagged as an **advanced editor feature** — future phases may add a beginner/advanced mode toggle to hide these
- **Only active engine's tuning visible** by default; subtle toggle to peek at other engine's tuning (dimmed/read-only)
- **Subtle badge/dot** on the engine switcher if the current engine has custom tuning applied
- Tuning supported at **both scene-level and per-entity level** — per-entity only when user explicitly opts in (not on every entity by default)

### Default engine & persistence
- Engine choice is a **project-level setting** (stored with the project, not per-user preference)
- New projects default to **PlayCanvas** (primary adapter, battle-tested through Phases 1-3)
- Engine choice persists in the project — reopening loads the last-used engine

### Claude's Discretion
- Exact must-match feature list for visual conformance (based on IR capabilities)
- Loading overlay design and animation
- Confirmation dialog copy and styling
- Dev comparison tool implementation details
- How engine tuning badge indicates custom tuning presence

</decisions>

<specifics>
## Specific Ideas

- Beginner/advanced mode toggle for the whole editor (engine tuning would be one of many advanced sections) — captured as deferred idea
- Architect for future play-mode hot-swap: adapter state should be serializable enough that swapping engines mid-play could work later, even though we lock it for now

</specifics>

<deferred>
## Deferred Ideas

- **Beginner/advanced editor mode toggle** — ability to show/hide advanced options (like engine tuning) for simpler UX for beginners. Broader editor capability, not Phase 4 scope.
- **Play-mode engine hot-swap** — switching engines during play-test without stopping. Locked for Phase 4, but architecture should not preclude it.

</deferred>

---

*Phase: 04-dual-adapter-validation*
*Context gathered: 2026-02-20*
