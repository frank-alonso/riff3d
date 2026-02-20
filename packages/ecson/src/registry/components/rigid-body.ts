import { z } from "zod";
import { registerComponent } from "../registry";
import type { ComponentDefinition } from "../types";

const RigidBodySchema = z.object({
  bodyType: z
    .enum(["dynamic", "fixed", "kinematicPosition", "kinematicVelocity"])
    .default("dynamic"),
  mass: z.number().min(0).default(1),
  friction: z.number().min(0).default(0.5),
  restitution: z.number().min(0).default(0.3),
  linearDamping: z.number().default(0.01),
  angularDamping: z.number().default(0.05),
  gravityScale: z.number().default(1),
  ccdEnabled: z.boolean().default(false),
});

export const RigidBodyComponentDef: ComponentDefinition = {
  type: "RigidBody",
  category: "physics",
  description:
    "A rigid body with body type, mass, friction, restitution, damping, gravity, and CCD settings.",
  singleton: true,
  schema: RigidBodySchema,
  editorHints: {
    bodyType: { editorHint: "dropdown" },
    mass: { editorHint: "number" },
    friction: { editorHint: "slider", min: 0, max: 1 },
    restitution: { editorHint: "slider", min: 0, max: 1 },
    linearDamping: { editorHint: "number" },
    angularDamping: { editorHint: "number" },
    gravityScale: { editorHint: "number" },
    ccdEnabled: { editorHint: "checkbox" },
  },
};

registerComponent(RigidBodyComponentDef);
