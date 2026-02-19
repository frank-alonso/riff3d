import { z } from "zod";

/**
 * Engine tuning is the "escape hatch" for engine-specific properties.
 *
 * The outer key is the engine name (e.g., "playcanvas", "babylon").
 * The inner record holds arbitrary engine-specific properties.
 *
 * Tuning can ADD engine-exclusive properties and OVERRIDE portable values.
 * Tuning is optional and must never be required for portable subset features.
 */
export const EngineTuningSchema = z.record(
  z.string(),
  z.record(z.string(), z.unknown()),
);

export type EngineTuning = z.infer<typeof EngineTuningSchema>;
