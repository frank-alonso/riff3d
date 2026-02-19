import { z } from "zod";
import { CanonicalNodeSchema } from "./canonical-node.js";
import { CanonicalAssetSchema } from "./canonical-asset.js";
import { CanonicalWireSchema } from "./canonical-wire.js";
import { CanonicalEnvironmentSchema } from "./canonical-environment.js";

/**
 * The root Canonical IR scene type.
 *
 * This is the normalized, portable representation that adapters consume.
 * Key differences from ECSON SceneDocument:
 *
 * - Nodes are a topologically sorted flat array (parents before children)
 *   instead of a flat Record<string, Entity>.
 * - nodeIndex provides O(1) lookup by id -> array index.
 * - All values are explicit -- no defaults, no optionals (except tuning on nodes).
 * - Engine tuning is preserved but separated from portable data.
 * - gameSettings is nullable (not optional) for explicitness.
 */
export const CanonicalSceneSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceSchemaVersion: z.number().int().min(1),
  nodes: z.array(CanonicalNodeSchema),
  nodeIndex: z.record(z.string(), z.number()),
  rootNodeId: z.string(),
  assets: z.array(CanonicalAssetSchema),
  wires: z.array(CanonicalWireSchema),
  environment: CanonicalEnvironmentSchema,
  gameSettings: z.record(z.string(), z.unknown()).nullable(),
});

export type CanonicalScene = z.infer<typeof CanonicalSceneSchema>;
