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

// glTF Extension Allowlist
export {
  GLTF_ALLOWLIST,
  isAllowedExtension,
  getPortableExtensions,
} from "./gltf-allowlist.js";

export type { GltfExtensionEntry } from "./gltf-allowlist.js";
