// Origin
export { OriginSchema, SafeModeConfigSchema, type Origin, type SafeModeConfig } from "./origin";

// Version
export { CURRENT_PATCHOP_VERSION } from "./version";

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
} from "./ops/index";

// Discriminated union
export { PatchOpSchema, type PatchOp } from "./schemas";

// Engine
export { applyOp, applyOps } from "./engine";

// Validation
export { validateOp, type ValidationResult } from "./validation";

// Migration
export { migrateOp, MIGRATION_REGISTRY } from "./migrations/migrate-op";
