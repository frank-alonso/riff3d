import { z } from "zod";
import { registerComponent } from "../registry";
import type { ComponentDefinition } from "../types";

const SpawnerSchema = z.object({
  templateEntityId: z.string().nullable().default(null),
  spawnInterval: z.number().min(0).default(5),
  maxActive: z.number().min(1).default(5),
  spawnOnStart: z.boolean().default(true),
});

export const SpawnerComponentDef: ComponentDefinition = {
  type: "Spawner",
  category: "gameplay",
  description:
    "Spawns entities from a template at configurable intervals with a cap on active instances.",
  singleton: false,
  schema: SpawnerSchema,
  editorHints: {
    templateEntityId: { editorHint: "entity-ref" },
    spawnInterval: { editorHint: "number" },
    maxActive: { editorHint: "number" },
    spawnOnStart: { editorHint: "checkbox" },
  },
  events: [{ name: "onSpawn", label: "On Spawn" }],
  actions: [
    { name: "spawn", label: "Spawn" },
    { name: "reset", label: "Reset" },
  ],
};

registerComponent(SpawnerComponentDef);
