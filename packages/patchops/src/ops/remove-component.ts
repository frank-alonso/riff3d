import { z } from "zod";
import { ComponentInstanceSchema } from "@riff3d/ecson";
import { PatchOpBase } from "../base.js";

export const RemoveComponentOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("RemoveComponent"),
  payload: z.object({
    entityId: z.string(),
    componentType: z.string(),
    previousComponent: ComponentInstanceSchema,
  }),
});

export type RemoveComponentOp = z.infer<typeof RemoveComponentOpSchema>;
