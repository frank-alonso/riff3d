import { z } from "zod";

export const AssetTypeEnum = z.enum([
  "mesh",
  "texture",
  "material",
  "audio",
  "animation",
  "prefab",
  "other",
]);

export type AssetType = z.infer<typeof AssetTypeEnum>;

/**
 * An asset entry in the scene document's asset registry.
 *
 * Assets are referenced by ID from components and other schema elements.
 * `uri` is for external references (URLs, file paths).
 * `data` is for inline asset data.
 */
export const AssetEntrySchema = z.object({
  id: z.string(),
  type: AssetTypeEnum,
  name: z.string(),
  uri: z.string().optional(),
  data: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type AssetEntry = z.infer<typeof AssetEntrySchema>;
