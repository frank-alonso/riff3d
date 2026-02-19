import { z } from "zod";

/**
 * A component in Canonical IR.
 *
 * Pure data: type + properties. No editor hints, no metadata, no tuning.
 * The component type is the registry key (e.g., "MeshRenderer", "Light").
 *
 * This is deliberately simpler than ECSON's ComponentInstance which can
 * carry editor-specific tuning. In IR, engine tuning lives on the node level.
 */
export const CanonicalComponentSchema = z.strictObject({
  type: z.string(),
  properties: z.record(z.string(), z.unknown()),
});

export type CanonicalComponent = z.infer<typeof CanonicalComponentSchema>;
