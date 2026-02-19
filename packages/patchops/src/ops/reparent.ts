import { z } from "zod";
import { PatchOpBase } from "../base.js";

export const ReparentOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("Reparent"),
  payload: z.object({
    entityId: z.string(),
    newParentId: z.string().nullable(),
    oldParentId: z.string().nullable(),
    oldIndex: z.number().int().min(0),
    newIndex: z.number().int().min(0).optional(),
  }),
});

export type ReparentOp = z.infer<typeof ReparentOpSchema>;
