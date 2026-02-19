import { z } from "zod";
import { registerComponent } from "../registry.js";
import type { ComponentDefinition } from "../types.js";

const PathFollowerSchema = z.object({
  waypointEntityIds: z.array(z.string()).default([]),
  speed: z.number().min(0).default(3),
  loopMode: z.enum(["once", "loop", "pingPong"]).default("loop"),
  lookAtNext: z.boolean().default(true),
});

export const PathFollowerComponentDef: ComponentDefinition = {
  type: "PathFollower",
  category: "gameplay",
  description:
    "Follows a path defined by waypoint entity IDs with configurable speed, loop mode, and orientation.",
  singleton: false,
  schema: PathFollowerSchema,
  editorHints: {
    waypointEntityIds: { editorHint: "entity-ref-list" },
    speed: { editorHint: "slider" },
    loopMode: { editorHint: "dropdown" },
    lookAtNext: { editorHint: "checkbox" },
  },
  events: [
    { name: "onWaypointReached", label: "On Waypoint Reached" },
    { name: "onPathComplete", label: "On Path Complete" },
  ],
  actions: [
    { name: "start", label: "Start" },
    { name: "stop", label: "Stop" },
    { name: "reset", label: "Reset" },
  ],
};

registerComponent(PathFollowerComponentDef);
