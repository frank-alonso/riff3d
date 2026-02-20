import { z } from "zod";
import { PatchOpBase } from "../base";

export const SetKeyframeValueOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("SetKeyframeValue"),
  payload: z.object({
    entityId: z.string(),
    trackId: z.string(),
    time: z.number(),
    value: z.unknown(),
    previousValue: z.unknown(),
  }),
});

export type SetKeyframeValueOp = z.infer<typeof SetKeyframeValueOpSchema>;
