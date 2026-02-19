// Primitives
export { Vec3Schema, type Vec3 } from "./vec3.js";
export { QuaternionSchema, type Quaternion } from "./quaternion.js";

// Transform
export { TransformSchema, type Transform } from "./transform.js";

// Engine tuning
export { EngineTuningSchema, type EngineTuning } from "./engine-tuning.js";

// Components
export {
  ComponentInstanceSchema,
  type ComponentInstance,
} from "./component-instance.js";

// Entity
export { EntitySchema, type Entity } from "./entity.js";

// Assets
export {
  AssetTypeEnum,
  AssetEntrySchema,
  type AssetType,
  type AssetEntry,
} from "./asset.js";

// Wiring
export { EventWireSchema, type EventWire } from "./wiring.js";

// Environment
export {
  SkyboxTypeEnum,
  SkyboxSchema,
  FogTypeEnum,
  FogSchema,
  AmbientLightSchema,
  EnvironmentSettingsSchema,
  type EnvironmentSettings,
} from "./environment.js";

// Game settings
export { GameSettingsSchema, type GameSettings } from "./game-settings.js";

// Scene document
export {
  CURRENT_SCHEMA_VERSION,
  SceneDocumentSchema,
  type SceneDocument,
} from "./scene-document.js";
