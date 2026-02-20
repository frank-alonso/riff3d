import { z } from "zod";
import { PatchOpBase } from "../base";

/**
 * BatchOp contains an array of sub-ops that are applied atomically.
 * Uses z.lazy() for the recursive reference to PatchOpSchema.
 *
 * The actual PatchOpSchema reference is injected by schemas.ts to avoid
 * circular imports. This file exports the schema factory and the final schema.
 */
export const BatchOpSchema = z.object({
  ...PatchOpBase,
  type: z.literal("BatchOp"),
  payload: z.object({
    ops: z.lazy(() => z.array(z.any())),
  }),
});

export type BatchOp = z.infer<typeof BatchOpSchema>;
