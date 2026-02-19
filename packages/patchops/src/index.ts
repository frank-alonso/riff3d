// Origin
export { OriginSchema, SafeModeConfigSchema, type Origin, type SafeModeConfig } from "./origin.js";

// Version
export { CURRENT_PATCHOP_VERSION } from "./version.js";

// Individual op schemas
export {
  CreateEntityOpSchema,
  type CreateEntityOp,
  DeleteEntityOpSchema,
  type DeleteEntityOp,
  SetPropertyOpSchema,
  type SetPropertyOp,
  AddChildOpSchema,
  type AddChildOp,
  RemoveChildOpSchema,
  type RemoveChildOp,
  ReparentOpSchema,
  type ReparentOp,
  AddComponentOpSchema,
  type AddComponentOp,
  RemoveComponentOpSchema,
  type RemoveComponentOp,
  SetComponentPropertyOpSchema,
  type SetComponentPropertyOp,
  AddAssetOpSchema,
  type AddAssetOp,
  RemoveAssetOpSchema,
  type RemoveAssetOp,
  ReplaceAssetRefOpSchema,
  type ReplaceAssetRefOp,
  AddKeyframeOpSchema,
  type AddKeyframeOp,
  RemoveKeyframeOpSchema,
  type RemoveKeyframeOp,
  SetKeyframeValueOpSchema,
  type SetKeyframeValueOp,
  BatchOpSchema,
  type BatchOp,
} from "./ops/index.js";

// Discriminated union
export { PatchOpSchema, type PatchOp } from "./schemas.js";

// Engine
export { applyOp, applyOps } from "./engine.js";

// Validation
export { validateOp, type ValidationResult } from "./validation.js";

// Migration
export { migrateOp, MIGRATION_REGISTRY } from "./migrations/migrate-op.js";
