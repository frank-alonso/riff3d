import { z } from "zod";
import { EntitySchema } from "./entity";
import { AssetEntrySchema } from "./asset";
import { EventWireSchema } from "./wiring";
import { EnvironmentSettingsSchema } from "./environment";
import { GameSettingsSchema } from "./game-settings";

/** Current schema version for new documents. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * The root ECSON scene document.
 *
 * This is the authoritative project file format. All meaningful edits flow through
 * PatchOps which mutate this structure. The compiler reads this to produce Canonical IR.
 */
export const SceneDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  schemaVersion: z.number().int().min(1),
  entities: z.record(z.string(), EntitySchema).default({}),
  rootEntityId: z.string(),
  assets: z.record(z.string(), AssetEntrySchema).default({}),
  wiring: z.array(EventWireSchema).default([]),
  environment: EnvironmentSettingsSchema.default({}),
  gameSettings: GameSettingsSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type SceneDocument = z.infer<typeof SceneDocumentSchema>;
