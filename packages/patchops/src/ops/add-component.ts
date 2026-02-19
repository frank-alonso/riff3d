import { z } from "zod";
import { ComponentInstanceSchema } from "@riff3d/ecson";
import { PatchOpBase } from "../base.js";

export const AddComponentOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("AddComponent"),
  payload: z.object({
    entityId: z.string(),
    component: ComponentInstanceSchema,
  }),
});

export type AddComponentOp = z.infer<typeof AddComponentOpSchema>;
