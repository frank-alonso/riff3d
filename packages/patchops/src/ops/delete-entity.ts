import { z } from "zod";
import { EntitySchema } from "@riff3d/ecson";
import { PatchOpBase } from "../base.js";

export const DeleteEntityOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("DeleteEntity"),
  payload: z.object({
    entityId: z.string(),
    previousState: EntitySchema,
  }),
});

export type DeleteEntityOp = z.infer<typeof DeleteEntityOpSchema>;
