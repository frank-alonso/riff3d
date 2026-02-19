import { z } from "zod";
import { registerComponent } from "../registry.js";
import type { ComponentDefinition } from "../types.js";
import { Vec3Schema } from "../../schemas/vec3.js";

const ColliderSchema = z.object({
  shape: z
    .enum(["box", "sphere", "capsule", "cylinder", "cone", "mesh"])
    .default("box"),
  size: Vec3Schema.default({ x: 1, y: 1, z: 1 }),
  offset: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
  radius: z.number().default(0.5),
  height: z.number().default(1),
  isTrigger: z.boolean().default(false),
  meshAssetId: z.string().nullable().default(null),
});

export const ColliderComponentDef: ComponentDefinition = {
  type: "Collider",
  category: "physics",
  description:
    "A collision shape (box, sphere, capsule, cylinder, cone, or mesh) with size, offset, and trigger settings. Multiple colliders per entity allowed.",
  singleton: false,
  schema: ColliderSchema,
  editorHints: {
    shape: { editorHint: "dropdown" },
    size: { editorHint: "vec3" },
    offset: { editorHint: "vec3" },
    radius: { editorHint: "number" },
    height: { editorHint: "number" },
    isTrigger: { editorHint: "checkbox" },
    meshAssetId: { editorHint: "asset-ref", assetType: "mesh" },
  },
};

registerComponent(ColliderComponentDef);
