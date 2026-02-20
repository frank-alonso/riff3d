export const VERSION = "0.0.1";

// All Canonical IR type schemas and types
export * from "./types/index";

// Portable subset v0 definition
export {
  PORTABLE_COMPONENT_TYPES,
  PORTABLE_LIGHT_TYPES,
  PORTABLE_CAMERA_TYPES,
  PORTABLE_MATERIAL_PROPERTIES,
  isPortableComponent,
  isPortableProperty,
} from "./portable-subset";

// Compiler and decompiler
export { compile } from "./compiler";
export { decompile } from "./decompiler";

// Delta computation (PatchOp -> IRDelta mapping)
export { computeDelta } from "./delta";
