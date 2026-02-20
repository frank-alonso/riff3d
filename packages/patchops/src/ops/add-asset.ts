import { z } from "zod";
import { AssetEntrySchema } from "@riff3d/ecson";
import { PatchOpBase } from "../base";

export const AddAssetOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("AddAsset"),
  payload: z.object({
    asset: AssetEntrySchema,
  }),
});

export type AddAssetOp = z.infer<typeof AddAssetOpSchema>;
