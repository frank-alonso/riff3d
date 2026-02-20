import { z } from "zod";
import { EngineTuningSchema } from "./engine-tuning";

/**
 * A component instance attached to an entity.
 *
 * The `type` field is the component registry key (e.g., "Light", "MeshRenderer").
 * Properties are validated dynamically against the component registry (Phase 1 Plan 5).
 * For now, properties accept any key-value pairs.
 */
export const ComponentInstanceSchema = z.object({
  type: z.string(),
  properties: z.record(z.string(), z.unknown()).default({}),
  tuning: EngineTuningSchema.optional(),
});

export type ComponentInstance = z.infer<typeof ComponentInstanceSchema>;
