import { z } from "zod";

export const QuaternionSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
  w: z.number().default(1),
});

export type Quaternion = z.infer<typeof QuaternionSchema>;
