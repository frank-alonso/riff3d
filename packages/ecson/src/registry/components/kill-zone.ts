import { z } from "zod";
import { registerComponent } from "../registry";
import type { ComponentDefinition } from "../types";

const KillZoneSchema = z.object({
  respawnBehavior: z
    .enum(["respawnPoint", "lastCheckpoint", "spectate"])
    .default("lastCheckpoint"),
  damage: z.number().default(Infinity),
});

export const KillZoneComponentDef: ComponentDefinition = {
  type: "KillZone",
  category: "gameplay",
  description:
    "A zone that kills or damages entities. Default is instant kill (Infinity damage).",
  singleton: false,
  schema: KillZoneSchema,
  editorHints: {
    respawnBehavior: { editorHint: "dropdown" },
    damage: { editorHint: "number" },
  },
  events: [{ name: "onKill", label: "On Kill" }],
  actions: [
    { name: "activate", label: "Activate" },
    { name: "deactivate", label: "Deactivate" },
  ],
};

registerComponent(KillZoneComponentDef);
