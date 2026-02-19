import { z } from "zod";
import { registerComponent } from "../registry.js";
import type { ComponentDefinition } from "../types.js";

const LightSchema = z.object({
  lightType: z.enum(["directional", "point", "spot"]).default("point"),
  color: z.string().default("#ffffff"),
  intensity: z.number().min(0).max(100).default(1),
  range: z.number().min(0).default(10),
  innerConeAngle: z.number().default(30),
  outerConeAngle: z.number().default(45),
  castShadows: z.boolean().default(false),
  shadowBias: z.number().default(0.005),
});

export const LightComponentDef: ComponentDefinition = {
  type: "Light",
  category: "rendering",
  description:
    "A light source (directional, point, or spot) with color, intensity, range, and shadow settings.",
  singleton: true,
  schema: LightSchema,
  editorHints: {
    lightType: { editorHint: "dropdown" },
    color: { editorHint: "color" },
    intensity: { editorHint: "slider", step: 0.1 },
    range: { editorHint: "slider" },
    innerConeAngle: { editorHint: "slider", min: 0, max: 90 },
    outerConeAngle: { editorHint: "slider", min: 0, max: 90 },
    castShadows: { editorHint: "checkbox" },
    shadowBias: { editorHint: "number" },
  },
};

registerComponent(LightComponentDef);
