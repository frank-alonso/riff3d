import { z } from "zod";
import { PatchOpBase } from "../base.js";

export const RemoveKeyframeOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("RemoveKeyframe"),
  payload: z.object({
    entityId: z.string(),
    trackId: z.string(),
    time: z.number(),
    previousValue: z.unknown(),
  }),
});

export type RemoveKeyframeOp = z.infer<typeof RemoveKeyframeOpSchema>;
