import { z } from "zod";
import { registerComponent } from "../registry";
import type { ComponentDefinition } from "../types";

const ScoreZoneSchema = z.object({
  points: z.number().default(10),
  teamFilter: z.string().nullable().default(null),
  repeatable: z.boolean().default(false),
  cooldown: z.number().min(0).default(0),
});

export const ScoreZoneComponentDef: ComponentDefinition = {
  type: "ScoreZone",
  category: "gameplay",
  description:
    "A zone that awards points when entered. Supports team filtering, repeatability, and cooldown.",
  singleton: false,
  schema: ScoreZoneSchema,
  editorHints: {
    points: { editorHint: "number" },
    teamFilter: { editorHint: "textbox" },
    repeatable: { editorHint: "checkbox" },
    cooldown: { editorHint: "number" },
  },
  events: [{ name: "onScore", label: "On Score" }],
  actions: [
    { name: "activate", label: "Activate" },
    { name: "deactivate", label: "Deactivate" },
  ],
};

registerComponent(ScoreZoneComponentDef);
