import { z } from "zod";
import { Vec3Schema } from "./vec3";
import { QuaternionSchema } from "./quaternion";

export const TransformSchema = z.object({
  position: Vec3Schema.default({ x: 0, y: 0, z: 0 }),
  rotation: QuaternionSchema.default({ x: 0, y: 0, z: 0, w: 1 }),
  scale: Vec3Schema.default({ x: 1, y: 1, z: 1 }),
});

export type Transform = z.infer<typeof TransformSchema>;
