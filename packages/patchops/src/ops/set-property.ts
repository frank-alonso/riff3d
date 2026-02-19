import { z } from "zod";
import { PatchOpBase } from "../base.js";

export const SetPropertyOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("SetProperty"),
  payload: z.object({
    entityId: z.string(),
    path: z.string(),
    value: z.unknown(),
    previousValue: z.unknown(),
  }),
});

export type SetPropertyOp = z.infer<typeof SetPropertyOpSchema>;
