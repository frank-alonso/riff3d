import { z } from "zod";
import { registerComponent } from "../registry";
import type { ComponentDefinition } from "../types";

const TriggerZoneSchema = z.object({
  triggerOnce: z.boolean().default(false),
  filterTags: z.array(z.string()).default([]),
});

export const TriggerZoneComponentDef: ComponentDefinition = {
  type: "TriggerZone",
  category: "gameplay",
  description:
    "A zone that fires events when entities enter, exit, or stay. Supports tag-based filtering and one-shot mode.",
  singleton: false,
  schema: TriggerZoneSchema,
  editorHints: {
    triggerOnce: { editorHint: "checkbox" },
    filterTags: { editorHint: "tags" },
  },
  events: [
    { name: "onEnter", label: "On Enter" },
    { name: "onExit", label: "On Exit" },
    { name: "onStay", label: "On Stay" },
  ],
  actions: [
    { name: "activate", label: "Activate" },
    { name: "deactivate", label: "Deactivate" },
  ],
};

registerComponent(TriggerZoneComponentDef);
