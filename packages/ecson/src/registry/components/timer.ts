import { z } from "zod";
import { registerComponent } from "../registry.js";
import type { ComponentDefinition } from "../types.js";

const TimerSchema = z.object({
  duration: z.number().min(0).default(60),
  autoStart: z.boolean().default(false),
  loop: z.boolean().default(false),
});

export const TimerComponentDef: ComponentDefinition = {
  type: "Timer",
  category: "logic",
  description:
    "A countdown timer with configurable duration, auto-start, and loop settings.",
  singleton: false,
  schema: TimerSchema,
  editorHints: {
    duration: { editorHint: "number" },
    autoStart: { editorHint: "checkbox" },
    loop: { editorHint: "checkbox" },
  },
  events: [
    { name: "onStart", label: "On Start" },
    { name: "onTick", label: "On Tick" },
    { name: "onComplete", label: "On Complete" },
  ],
  actions: [
    { name: "start", label: "Start" },
    { name: "stop", label: "Stop" },
    { name: "reset", label: "Reset" },
  ],
};

registerComponent(TimerComponentDef);
