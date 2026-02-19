import { z } from "zod";
import { registerComponent } from "../registry.js";
import type { ComponentDefinition } from "../types.js";

const MeshRendererSchema = z.object({
  primitive: z
    .enum(["box", "sphere", "cylinder", "capsule", "cone", "plane", "torus"])
    .nullable()
    .default(null),
  meshAssetId: z.string().nullable().default(null),
  castShadows: z.boolean().default(true),
  receiveShadows: z.boolean().default(true),
  materialAssetId: z.string().nullable().default(null),
});

export const MeshRendererComponentDef: ComponentDefinition = {
  type: "MeshRenderer",
  category: "rendering",
  description:
    "Renders a mesh (primitive shape or asset) with material and shadow settings.",
  singleton: true,
  schema: MeshRendererSchema,
  editorHints: {
    primitive: { editorHint: "dropdown", label: "Primitive Shape" },
    meshAssetId: {
      editorHint: "asset-ref",
      assetType: "mesh",
      label: "Mesh Asset",
    },
    castShadows: { editorHint: "checkbox", label: "Cast Shadows" },
    receiveShadows: { editorHint: "checkbox", label: "Receive Shadows" },
    materialAssetId: {
      editorHint: "asset-ref",
      assetType: "material",
      label: "Material",
    },
  },
};

registerComponent(MeshRendererComponentDef);
