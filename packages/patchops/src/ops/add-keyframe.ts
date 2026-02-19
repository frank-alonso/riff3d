import { z } from "zod";
import { PatchOpBase } from "../base.js";

export const AddKeyframeOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("AddKeyframe"),
  payload: z.object({
    entityId: z.string(),
    trackId: z.string(),
    time: z.number(),
    value: z.unknown(),
  }),
});

export type AddKeyframeOp = z.infer<typeof AddKeyframeOpSchema>;
