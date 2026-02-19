import { z } from "zod";

/**
 * Canonical IR environment -- flattened, explicit, no defaults.
 *
 * Every value is baked in at compile time. This is the fully-resolved version
 * of ECSON's EnvironmentSettings where defaults have been applied and all
 * fields are required.
 */

const IRSkyboxSchema = z.object({
  type: z.enum(["color", "image", "hdri"]),
  color: z.string().nullable(),
  uri: z.string().nullable(),
});

const IRFogSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(["linear", "exponential", "exponential2"]),
  color: z.string(),
  near: z.number(),
  far: z.number(),
  density: z.number(),
});

const IRAmbientLightSchema = z.object({
  color: z.string(),
  intensity: z.number(),
});

const IRVec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const CanonicalEnvironmentSchema = z.object({
  skybox: IRSkyboxSchema,
  fog: IRFogSchema,
  ambientLight: IRAmbientLightSchema,
  gravity: IRVec3Schema,
});

export type CanonicalEnvironment = z.infer<typeof CanonicalEnvironmentSchema>;
