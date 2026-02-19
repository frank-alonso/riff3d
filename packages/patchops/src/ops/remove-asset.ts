import { z } from "zod";
import { AssetEntrySchema } from "@riff3d/ecson";
import { PatchOpBase } from "../base.js";

export const RemoveAssetOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("RemoveAsset"),
  payload: z.object({
    assetId: z.string(),
    previousAsset: AssetEntrySchema,
  }),
});

export type RemoveAssetOp = z.infer<typeof RemoveAssetOpSchema>;
