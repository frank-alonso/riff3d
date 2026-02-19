import { z } from "zod";

/**
 * An event wire represents a WHEN-DO connection between entities.
 *
 * When `sourceEvent` fires on `sourceEntityId`, the `targetAction` is
 * invoked on `targetEntityId`, optionally with parameters.
 */
export const EventWireSchema = z.object({
  id: z.string(),
  sourceEntityId: z.string(),
  sourceEvent: z.string(),
  targetEntityId: z.string(),
  targetAction: z.string(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export type EventWire = z.infer<typeof EventWireSchema>;
