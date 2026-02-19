import { z } from "zod";

/**
 * An asset in Canonical IR.
 *
 * Normalized from ECSON AssetEntry. All fields are required (no optionals in IR).
 * `uri` and `data` are nullable instead of optional -- they must be explicitly set.
 */
export const CanonicalAssetSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  uri: z.string().nullable(),
  data: z.unknown().nullable(),
});

export type CanonicalAsset = z.infer<typeof CanonicalAssetSchema>;
