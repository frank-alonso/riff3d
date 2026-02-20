import { z } from "zod";
import { TransformSchema } from "./transform";
import { ComponentInstanceSchema } from "./component-instance";
import { EngineTuningSchema } from "./engine-tuning";

/**
 * An entity in the scene graph.
 *
 * Entities are stored in a flat `Record<string, Entity>` map in the SceneDocument,
 * with `parentId` references for hierarchy. The `children` array preserves sibling order.
 */
export const EntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  children: z.array(z.string()).default([]),
  components: z.array(ComponentInstanceSchema).default([]),
  tags: z.array(z.string()).default([]),
  transform: TransformSchema.default({}),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  tuning: EngineTuningSchema.optional(),
});

export type Entity = z.infer<typeof EntitySchema>;
