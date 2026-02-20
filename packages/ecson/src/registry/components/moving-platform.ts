import { z } from "zod";
import { registerComponent } from "../registry";
import type { ComponentDefinition } from "../types";

const MovingPlatformSchema = z.object({
  axis: z.enum(["x", "y", "z"]).default("y"),
  distance: z.number().default(5),
  speed: z.number().min(0).default(2),
  easing: z
    .enum(["linear", "easeInOut", "easeIn", "easeOut"])
    .default("easeInOut"),
  pauseDuration: z.number().min(0).default(1),
});

export const MovingPlatformComponentDef: ComponentDefinition = {
  type: "MovingPlatform",
  category: "gameplay",
  description:
    "A platform that moves along an axis with configurable distance, speed, easing, and pause duration.",
  singleton: false,
  schema: MovingPlatformSchema,
  editorHints: {
    axis: { editorHint: "dropdown" },
    distance: { editorHint: "number" },
    speed: { editorHint: "slider" },
    easing: { editorHint: "dropdown" },
    pauseDuration: { editorHint: "number" },
  },
  events: [
    { name: "onReachEnd", label: "On Reach End" },
    { name: "onReachStart", label: "On Reach Start" },
  ],
  actions: [
    { name: "start", label: "Start" },
    { name: "stop", label: "Stop" },
    { name: "reverse", label: "Reverse" },
  ],
};

registerComponent(MovingPlatformComponentDef);
