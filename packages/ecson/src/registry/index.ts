// Registry API
export {
  registerComponent,
  getComponentDef,
  validateComponentProperties,
  listComponents,
  listComponentsByCategory,
  componentRegistry,
} from "./registry.js";

// Types
export type {
  ComponentDefinition,
  EditorHint,
  ComponentEvent,
  ComponentAction,
} from "./types.js";
