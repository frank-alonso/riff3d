---
phase: 02-closed-loop-editor
plan: 04
subsystem: ui, editor, state-management
tags: [react-arborist, inspector, hierarchy, property-widgets, patchops, editorHints, scene-tree]

# Dependency graph
requires:
  - phase: 02-closed-loop-editor
    plan: 02
    provides: PlayCanvas adapter, scene builder, Zustand store slices (scene, viewport), dispatchOp
  - phase: 02-closed-loop-editor
    plan: 03
    provides: GizmoManager, SelectionManager, Grid, selection sync (selectedEntityIds)
provides:
  - Scene hierarchy tree with react-arborist (drag-to-reparent, multi-select, search/filter, context menu)
  - Inspector panel auto-generating property widgets from component registry editorHints
  - 7 property widget types (slider, color, vec3, checkbox, dropdown, number, textbox)
  - EntityHeader with inline name editing, transform inputs (position/rotation/scale), Add Component button
  - ComponentInspector with collapsible sections, remove button, enum option extraction from Zod schemas
  - Context menu for hierarchy (Add Entity with 8 presets, Rename, Delete)
  - Bidirectional selection sync between hierarchy tree and viewport
affects: [02-05, 02-06, 02-07, 02-08]

# Tech tracking
tech-stack:
  added: []
  patterns: ["react-arborist Tree component for scene hierarchy with onMove/onRename/onSelect handlers", "PropertyWidget dispatcher pattern mapping editorHint type to specialized widget component", "Debounced PatchOp dispatch (300ms) for keyboard inputs with immediate dispatch for sliders/checkboxes/colors", "Quaternion-to-Euler conversion for rotation display (stored as quaternion, displayed as degrees)", "Zod schema introspection via _def to extract enum options for dropdown widgets without direct zod dependency"]

key-files:
  created:
    - apps/editor/src/components/editor/hierarchy/scene-tree.tsx
    - apps/editor/src/components/editor/hierarchy/tree-node.tsx
    - apps/editor/src/components/editor/hierarchy/tree-context-menu.tsx
    - apps/editor/src/components/editor/inspector/inspector-panel.tsx
    - apps/editor/src/components/editor/inspector/entity-header.tsx
    - apps/editor/src/components/editor/inspector/component-inspector.tsx
    - apps/editor/src/components/editor/inspector/property-widget.tsx
    - apps/editor/src/components/editor/inspector/widgets/slider-field.tsx
    - apps/editor/src/components/editor/inspector/widgets/color-picker.tsx
    - apps/editor/src/components/editor/inspector/widgets/vec3-input.tsx
    - apps/editor/src/components/editor/inspector/widgets/checkbox-field.tsx
    - apps/editor/src/components/editor/inspector/widgets/dropdown-field.tsx
    - apps/editor/src/components/editor/inspector/widgets/number-field.tsx
    - apps/editor/src/components/editor/inspector/widgets/textbox-field.tsx
  modified:
    - apps/editor/src/components/editor/shell/editor-shell.tsx

key-decisions:
  - "Zod schema introspection via _def property instead of direct zod import (avoids adding zod as editor dependency)"
  - "Quaternion-to-Euler conversion for rotation display with bidirectional conversion for user-friendly editing"
  - "Debounced dispatch for keyboard inputs (300ms) with immediate dispatch for slider/checkbox/color/dropdown widgets"
  - "Context menu implemented as fixed-position overlay with CSS hover submenu (no external menu library)"

patterns-established:
  - "PropertyWidget dispatcher: switch on editorHint type to render correct widget, with onChange callback for PatchOp dispatch"
  - "ComponentInspector pattern: look up ComponentDefinition via getComponentDef(), iterate editorHints, auto-generate widgets"
  - "Scene tree data derivation: build nested TreeNodeData[] from flat ECSON entity map using entity.children ordering"
  - "Add entity pattern: CreateEntity + AddComponent PatchOps dispatched sequentially for preset entity types"

requirements-completed: [EDIT-03, EDIT-04]

# Metrics
duration: 7min
completed: 2026-02-19
---

# Phase 2 Plan 04: Scene Hierarchy and Inspector Panel Summary

**Scene hierarchy tree with react-arborist drag-to-reparent and inspector panel auto-generating property widgets from component registry editorHints**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-02-20T03:10:43Z
- **Completed:** 2026-02-20T03:18:23Z
- **Tasks:** 2 (both auto)
- **Files modified:** 15 (14 created, 1 modified)

## Accomplishments

- Scene hierarchy tree using react-arborist with entity tree structure derived from flat ECSON entity map
- Click-to-select synced bidirectionally with viewport selection, multi-select via Ctrl/Cmd-click and Shift-click
- Drag-to-reparent in hierarchy dispatches Reparent PatchOp with correct old/new parent and index tracking
- Search/filter entities by name using react-arborist's built-in search with custom match function
- Context menu with Add Entity (8 presets: Empty, Cube, Sphere, Plane, Cylinder, Point Light, Spot Light, Camera), Rename, Delete
- Inspector panel auto-generates form widgets from component registry editorHints for all registered component types
- 7 property widget types: SliderField, ColorPicker, Vec3Input, CheckboxField, DropdownField, NumberField, TextboxField
- EntityHeader with editable name, transform inputs (position/rotation/scale as Vec3, rotation displayed as Euler angles)
- All property edits dispatch SetComponentProperty PatchOps with debounced dispatch for keyboard input
- Add Component dropdown listing all registered components grouped by category, Remove Component button
- Enum options auto-extracted from Zod schemas via _def introspection for dropdown widgets

## Task Commits

Each task was committed atomically:

1. **Task 1: Scene hierarchy tree with drag-to-reparent, search, and context menu** - `85be305` (feat)
2. **Task 2: Inspector panel with auto-generated property widgets from editorHints** - `e5fdae3` (feat)

## Files Created/Modified

### Hierarchy (apps/editor/src/components/editor/hierarchy/)
- `scene-tree.tsx` - Main SceneTree component: react-arborist tree, search bar, context menu, selection sync, drag-to-reparent
- `tree-node.tsx` - Custom tree node renderer: entity icon (based on primary component type), name, edit mode
- `tree-context-menu.tsx` - Right-click context menu: Add Entity (8 presets), Rename, Duplicate (placeholder), Delete

### Inspector (apps/editor/src/components/editor/inspector/)
- `inspector-panel.tsx` - InspectorPanel: reads selection, shows EntityHeader + ComponentInspectors
- `entity-header.tsx` - EntityHeader: name, transform Vec3 inputs, quaternion-to-Euler conversion, Add Component dropdown
- `component-inspector.tsx` - ComponentInspector: collapsible section, auto-generates widgets from editorHints, enum extraction
- `property-widget.tsx` - PropertyWidget dispatcher: maps editorHint type to widget component

### Widgets (apps/editor/src/components/editor/inspector/widgets/)
- `slider-field.tsx` - Range input with value display (min/max/step from EditorHint)
- `color-picker.tsx` - Native color input with hex text field
- `vec3-input.tsx` - Three inline number inputs with colored X/Y/Z labels (red/green/blue)
- `checkbox-field.tsx` - Toggle switch with label
- `dropdown-field.tsx` - Select element with auto-detected enum options
- `number-field.tsx` - Number input with optional min/max/step
- `textbox-field.tsx` - Text input with label

### Shell
- `editor-shell.tsx` - Updated: SceneTree in left panel (hierarchy tab), InspectorPanel in right panel

## Decisions Made

1. **Zod schema introspection via _def** - Instead of importing `zod` directly in the editor package (which would add it as a dependency), the ComponentInspector accesses Zod's internal `_def` structure to walk through schema wrappers (default/nullable/optional) and extract enum values. This keeps the editor package's dependency graph clean.

2. **Quaternion-to-Euler conversion** - ECSON stores rotation as quaternion (x,y,z,w) per architectural decision 01-02. The inspector displays rotation as Euler angles in degrees (more intuitive for users) with bidirectional conversion using intrinsic Tait-Bryan XYZ rotation order.

3. **Debounced PatchOp dispatch** - Keyboard inputs (text, number) use 300ms debounce to avoid flooding the PatchOps engine with operations per keystroke. Slider, checkbox, color, and dropdown inputs dispatch immediately since they produce discrete value changes.

4. **CSS hover submenu for context menu** - The Add Entity submenu in the hierarchy context menu uses CSS `group-hover` visibility instead of a separate state variable. This is simpler and avoids focus management complexity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useRef requires initial argument in strict mode (TypeScript 5 strict)**
- **Found during:** Task 1 (scene-tree.tsx)
- **Issue:** `useRef<TreeApi<TreeNodeData>>()` without initial argument causes TS2554 in strict mode
- **Fix:** Changed to `useRef<TreeApi<TreeNodeData> | undefined>(undefined)`
- **Files modified:** `apps/editor/src/components/editor/hierarchy/scene-tree.tsx`
- **Verification:** `pnpm typecheck --filter @riff3d/editor` passes
- **Committed in:** 85be305

**2. [Rule 3 - Blocking] Cannot import zod directly in editor package**
- **Found during:** Task 2 (component-inspector.tsx)
- **Issue:** `import { z } from "zod"` fails because zod is not a direct dependency of the editor package (it comes through @riff3d/ecson). Also ZodType doesn't have a `shape` property accessible via safe casting.
- **Fix:** Replaced Zod class-based introspection with `_def` property access through `any` cast, avoiding the need for zod as a direct dependency
- **Files modified:** `apps/editor/src/components/editor/inspector/component-inspector.tsx`
- **Verification:** `pnpm typecheck --filter @riff3d/editor` passes
- **Committed in:** e5fdae3

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were necessary for TypeScript compilation. No scope changes.

## Issues Encountered

None beyond the auto-fixed TypeScript issues.

## User Setup Required

None - no external service configuration required. All changes are client-side React components.

## Next Phase Readiness

- Scene hierarchy tree fully integrated into the editor shell left panel
- Inspector panel fully integrated into the editor shell right panel
- Bidirectional selection sync working: click in tree selects in viewport, click in viewport selects in tree
- All mutations flow through PatchOps (Reparent, SetProperty, SetComponentProperty, CreateEntity, DeleteEntity, AddComponent, RemoveComponent)
- PropertyWidget dispatcher extensible for future widget types (asset-ref picker in 02-06)
- ComponentInspector auto-generates UI for any registered component (new components automatically get inspector widgets)
- Ready for 02-05 (undo/redo consuming inverse ops from dispatchOp)
- Ready for 02-06 (asset browser integration, asset-ref pickers in inspector)

## Self-Check: PASSED

All 14 created files verified present on disk. All 2 commit hashes (85be305, e5fdae3) verified in git log.

---
*Phase: 02-closed-loop-editor, Plan: 04*
*Completed: 2026-02-19*
