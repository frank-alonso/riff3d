export const VERSION = "0.0.1";

// All ECSON schemas and types
export * from "./schemas/index";

// ID generation
export {
  generateEntityId,
  generateOpId,
  generateAssetId,
  generateWireId,
} from "./ids";

// Migration infrastructure
export { migrateDocument, type Migration } from "./migrations/migrate";

// Helper utilities
export { createEmptyDocument, createEntity } from "./helpers";

// Component registry
export {
  registerComponent,
  getComponentDef,
  validateComponentProperties,
  listComponents,
  listComponentsByCategory,
  componentRegistry,
} from "./registry/index";

export type {
  ComponentDefinition,
  EditorHint,
  ComponentEvent,
  ComponentAction,
  GltfExtensionEntry,
} from "./registry/index";

// glTF Extension Allowlist
export {
  GLTF_ALLOWLIST,
  isAllowedExtension,
  getPortableExtensions,
} from "./registry/index";
