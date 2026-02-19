import { z } from "zod";
import { Vec3Schema } from "./vec3.js";

export const SkyboxTypeEnum = z.enum(["color", "image", "hdri"]);

export const SkyboxSchema = z.object({
  type: SkyboxTypeEnum.default("color"),
  color: z.string().optional(),
  uri: z.string().optional(),
});

export const FogTypeEnum = z.enum(["linear", "exponential", "exponential2"]);

export const FogSchema = z.object({
  enabled: z.boolean().default(false),
  type: FogTypeEnum.default("linear"),
  color: z.string().default("#cccccc"),
  near: z.number().default(10),
  far: z.number().default(100),
  density: z.number().default(0.01),
});

export const AmbientLightSchema = z.object({
  color: z.string().default("#ffffff"),
  intensity: z.number().default(0.5),
});

/**
 * Environment settings for the scene.
 *
 * Covers skybox, fog, ambient lighting, and gravity.
 */
export const EnvironmentSettingsSchema = z.object({
  skybox: SkyboxSchema.default({}),
  fog: FogSchema.default({}),
  ambientLight: AmbientLightSchema.default({}),
  gravity: Vec3Schema.default({ x: 0, y: -9.81, z: 0 }),
});

export type EnvironmentSettings = z.infer<typeof EnvironmentSettingsSchema>;
