import { z } from "zod";
import { PatchOpBase } from "../base";

export const ReplaceAssetRefOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("ReplaceAssetRef"),
  payload: z.object({
    entityId: z.string(),
    componentType: z.string(),
    propertyPath: z.string(),
    newAssetId: z.string(),
    oldAssetId: z.string(),
  }),
});

export type ReplaceAssetRefOp = z.infer<typeof ReplaceAssetRefOpSchema>;
