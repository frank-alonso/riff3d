import { z } from "zod";

/**
 * An event wire in Canonical IR.
 *
 * All fields required (no optionals). The `parameters` field is always
 * present (empty object if no parameters). This differs from ECSON's EventWire
 * where `parameters` is optional.
 */
export const CanonicalWireSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  sourceEvent: z.string(),
  targetNodeId: z.string(),
  targetAction: z.string(),
  parameters: z.record(z.string(), z.unknown()),
});

export type CanonicalWire = z.infer<typeof CanonicalWireSchema>;
