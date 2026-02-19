import { z } from "zod";

export const Vec3Schema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
});

export type Vec3 = z.infer<typeof Vec3Schema>;
