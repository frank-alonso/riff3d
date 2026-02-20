import { z } from "zod";
import { PatchOpBase } from "../base";

export const AddChildOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("AddChild"),
  payload: z.object({
    parentId: z.string(),
    childId: z.string(),
    index: z.number().int().min(0).optional(),
  }),
});

export type AddChildOp = z.infer<typeof AddChildOpSchema>;
