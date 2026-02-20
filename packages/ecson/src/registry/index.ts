// Registry API
export {
  registerComponent,
  getComponentDef,
  validateComponentProperties,
  listComponents,
  listComponentsByCategory,
  componentRegistry,
} from "./registry";

// Types
export type {
  ComponentDefinition,
  EditorHint,
  ComponentEvent,
  ComponentAction,
} from "./types";

// glTF Extension Allowlist
export {
  GLTF_ALLOWLIST,
  isAllowedExtension,
  getPortableExtensions,
} from "./gltf-allowlist";

export type { GltfExtensionEntry } from "./gltf-allowlist";
