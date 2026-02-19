import { z } from "zod";
import { CanonicalComponentSchema } from "./canonical-component.js";

/**
 * Explicit Vec3 for Canonical IR -- no defaults.
 * Every field is required. This is NOT the ECSON Vec3 (which has defaults).
 */
const IRVec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

/**
 * Explicit Quaternion for Canonical IR -- no defaults.
 */
const IRQuaternionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  w: z.number(),
});

/**
 * Explicit Transform for Canonical IR -- all fields required, no defaults.
 * The key difference from ECSON's TransformSchema: nothing is optional or defaulted.
 */
const IRTransformSchema = z.object({
  position: IRVec3Schema,
  rotation: IRQuaternionSchema,
  scale: IRVec3Schema,
});

/**
 * Engine tuning in Canonical IR -- preserved but explicitly separated from portable data.
 * Outer key = engine name, inner record = arbitrary engine-specific properties.
 */
const IREngineTuningSchema = z.record(
  z.string(),
  z.record(z.string(), z.unknown()),
);

/**
 * A node in the Canonical IR scene graph.
 *
 * Unlike ECSON entities which have optional/defaulted fields, IR nodes are
 * fully explicit: every transform component is required, no defaults are applied.
 * Nodes are stored in a topologically sorted flat array (parents before children).
 *
 * The `tuning` field preserves engine-specific data through compilation but is
 * explicitly separated from portable data.
 */
export const CanonicalNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  childIds: z.array(z.string()),
  transform: IRTransformSchema,
  components: z.array(CanonicalComponentSchema),
  visible: z.boolean(),
  tuning: IREngineTuningSchema.optional(),
});

export type CanonicalNode = z.infer<typeof CanonicalNodeSchema>;
