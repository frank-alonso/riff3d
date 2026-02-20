import { z } from "zod";
import { TransformSchema } from "@riff3d/ecson";
import { PatchOpBase } from "../base";

export const CreateEntityOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("CreateEntity"),
  payload: z.object({
    entityId: z.string(),
    name: z.string(),
    parentId: z.string().nullable(),
    transform: TransformSchema.optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export type CreateEntityOp = z.infer<typeof CreateEntityOpSchema>;
