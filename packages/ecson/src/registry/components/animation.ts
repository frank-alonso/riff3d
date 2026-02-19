import { z } from "zod";
import { registerComponent } from "../registry.js";
import type { ComponentDefinition } from "../types.js";

const AnimationClipSchema = z.object({
  name: z.string(),
  assetId: z.string().nullable().default(null),
});

const AnimationSchema = z.object({
  clips: z.array(AnimationClipSchema).default([]),
  defaultClip: z.string().nullable().default(null),
  speed: z.number().default(1),
  loop: z.boolean().default(true),
});

export const AnimationComponentDef: ComponentDefinition = {
  type: "Animation",
  category: "rendering",
  description:
    "Animation playback with multiple clips, default clip selection, speed, and loop settings.",
  singleton: false,
  schema: AnimationSchema,
  editorHints: {
    clips: { editorHint: "array" },
    defaultClip: { editorHint: "dropdown" },
    speed: { editorHint: "slider", min: 0, max: 5 },
    loop: { editorHint: "checkbox" },
  },
  events: [
    { name: "onClipStart", label: "On Clip Start" },
    { name: "onClipEnd", label: "On Clip End" },
  ],
};

registerComponent(AnimationComponentDef);
