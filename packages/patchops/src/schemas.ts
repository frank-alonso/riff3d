import { z } from "zod";
import { CreateEntityOpSchema } from "./ops/create-entity.js";
import { DeleteEntityOpSchema } from "./ops/delete-entity.js";
import { SetPropertyOpSchema } from "./ops/set-property.js";
import { AddChildOpSchema } from "./ops/add-child.js";
import { RemoveChildOpSchema } from "./ops/remove-child.js";
import { ReparentOpSchema } from "./ops/reparent.js";
import { AddComponentOpSchema } from "./ops/add-component.js";
import { RemoveComponentOpSchema } from "./ops/remove-component.js";
import { SetComponentPropertyOpSchema } from "./ops/set-component-property.js";
import { AddAssetOpSchema } from "./ops/add-asset.js";
import { RemoveAssetOpSchema } from "./ops/remove-asset.js";
import { ReplaceAssetRefOpSchema } from "./ops/replace-asset-ref.js";
import { AddKeyframeOpSchema } from "./ops/add-keyframe.js";
import { RemoveKeyframeOpSchema } from "./ops/remove-keyframe.js";
import { SetKeyframeValueOpSchema } from "./ops/set-keyframe-value.js";
import { PatchOpBase } from "./base.js";

/**
 * All 15 non-recursive PatchOp types as a discriminated union on `type`.
 * BatchOp is handled separately due to its recursive nature.
 */
const NonBatchPatchOpSchema = z.discriminatedUnion("type", [
  CreateEntityOpSchema,
  DeleteEntityOpSchema,
  SetPropertyOpSchema,
  AddChildOpSchema,
  RemoveChildOpSchema,
  ReparentOpSchema,
  AddComponentOpSchema,
  RemoveComponentOpSchema,
  SetComponentPropertyOpSchema,
  AddAssetOpSchema,
  RemoveAssetOpSchema,
  ReplaceAssetRefOpSchema,
  AddKeyframeOpSchema,
  RemoveKeyframeOpSchema,
  SetKeyframeValueOpSchema,
]);

type NonBatchPatchOp = z.infer<typeof NonBatchPatchOpSchema>;

/**
 * The inferred TypeScript type for any PatchOp.
 * BatchOp is defined manually due to its recursive nature.
 */
export type PatchOp =
  | NonBatchPatchOp
  | {
      id: string;
      timestamp: number;
      origin: "user" | "ai" | "system" | "replay";
      version: number;
      type: "BatchOp";
      payload: { ops: PatchOp[] };
    };

/**
 * BatchOp schema with proper recursive reference to PatchOpSchema.
 * Uses z.lazy() to break the circular dependency.
 */
const BatchOpWithRecursionSchema = z.object({
  ...PatchOpBase,
  type: z.literal("BatchOp"),
  payload: z.object({
    ops: z.lazy((): z.ZodType<PatchOp[]> => z.array(PatchOpSchema)),
  }),
});

/**
 * The complete PatchOp schema: all 16 operation types.
 *
 * Each op carries: id, timestamp, origin (user/ai/system/replay), version.
 * Discriminates on the `type` field.
 *
 * Note: We use z.union instead of z.discriminatedUnion for the top level
 * because BatchOp uses z.lazy() which is incompatible with discriminatedUnion.
 * The NonBatchPatchOpSchema handles efficient discrimination for the 15 non-recursive types.
 */
export const PatchOpSchema: z.ZodType<PatchOp> = z.union([
  NonBatchPatchOpSchema,
  BatchOpWithRecursionSchema,
]) as z.ZodType<PatchOp>;
