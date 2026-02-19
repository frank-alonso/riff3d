import { z } from "zod";
import { PatchOpBase } from "../base.js";

export const RemoveChildOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("RemoveChild"),
  payload: z.object({
    parentId: z.string(),
    childId: z.string(),
    previousIndex: z.number().int().min(0),
  }),
});

export type RemoveChildOp = z.infer<typeof RemoveChildOpSchema>;
