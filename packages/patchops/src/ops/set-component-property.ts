import { z } from "zod";
import { PatchOpBase } from "../base";

export const SetComponentPropertyOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("SetComponentProperty"),
  payload: z.object({
    entityId: z.string(),
    componentType: z.string(),
    propertyPath: z.string(),
    value: z.unknown(),
    previousValue: z.unknown(),
  }),
});

export type SetComponentPropertyOp = z.infer<
  typeof SetComponentPropertyOpSchema
>;
