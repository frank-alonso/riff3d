import { z } from "zod";
import { registerComponent } from "../registry";
import type { ComponentDefinition } from "../types";
import { Vec3Schema } from "../../schemas/vec3";

const CheckpointSchema = z.object({
  orderIndex: z.number().default(0),
  respawnOffset: Vec3Schema.default({ x: 0, y: 1, z: 0 }),
});

export const CheckpointComponentDef: ComponentDefinition = {
  type: "Checkpoint",
  category: "gameplay",
  description:
    "A checkpoint marker with order index and respawn offset. Activated when a player reaches it.",
  singleton: false,
  schema: CheckpointSchema,
  editorHints: {
    orderIndex: { editorHint: "number" },
    respawnOffset: { editorHint: "vec3" },
  },
  events: [{ name: "onActivate", label: "On Activate" }],
};

registerComponent(CheckpointComponentDef);
