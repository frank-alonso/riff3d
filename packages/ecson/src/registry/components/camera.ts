import { z } from "zod";
import { registerComponent } from "../registry";
import type { ComponentDefinition } from "../types";

const CameraSchema = z.object({
  projection: z.enum(["perspective", "orthographic"]).default("perspective"),
  fov: z.number().min(1).max(179).default(60),
  nearClip: z.number().default(0.1),
  farClip: z.number().default(1000),
  orthoSize: z.number().default(5),
  clearColor: z.string().default("#000000"),
  priority: z.number().default(0),
});

export const CameraComponentDef: ComponentDefinition = {
  type: "Camera",
  category: "rendering",
  description:
    "A camera with perspective or orthographic projection, FOV, clipping planes, and clear color.",
  singleton: true,
  schema: CameraSchema,
  editorHints: {
    projection: { editorHint: "dropdown" },
    fov: { editorHint: "slider" },
    nearClip: { editorHint: "number" },
    farClip: { editorHint: "number" },
    orthoSize: { editorHint: "number" },
    clearColor: { editorHint: "color" },
    priority: { editorHint: "number" },
  },
};

registerComponent(CameraComponentDef);
