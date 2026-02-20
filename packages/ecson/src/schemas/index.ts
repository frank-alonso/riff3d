// Primitives
export { Vec3Schema, type Vec3 } from "./vec3";
export { QuaternionSchema, type Quaternion } from "./quaternion";

// Transform
export { TransformSchema, type Transform } from "./transform";

// Engine tuning
export { EngineTuningSchema, type EngineTuning } from "./engine-tuning";

// Components
export {
  ComponentInstanceSchema,
  type ComponentInstance,
} from "./component-instance";

// Entity
export { EntitySchema, type Entity } from "./entity";

// Assets
export {
  AssetTypeEnum,
  AssetEntrySchema,
  type AssetType,
  type AssetEntry,
} from "./asset";

// Wiring
export { EventWireSchema, type EventWire } from "./wiring";

// Environment
export {
  SkyboxTypeEnum,
  SkyboxSchema,
  FogTypeEnum,
  FogSchema,
  AmbientLightSchema,
  EnvironmentSettingsSchema,
  type EnvironmentSettings,
} from "./environment";

// Game settings
export { GameSettingsSchema, type GameSettings } from "./game-settings";

// Scene document
export {
  CURRENT_SCHEMA_VERSION,
  SceneDocumentSchema,
  type SceneDocument,
} from "./scene-document";
