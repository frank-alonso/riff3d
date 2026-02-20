import { z } from "zod";
import { registerComponent } from "../registry";
import type { ComponentDefinition } from "../types";

const MaterialSchema = z.object({
  // Asset reference (takes priority if set)
  materialAssetId: z.string().nullable().default(null),

  // PBR inline fallback properties (used when no asset)
  baseColor: z.string().default("#cccccc"),
  metallic: z.number().min(0).max(1).default(0),
  roughness: z.number().min(0).max(1).default(0.5),
  emissive: z.string().default("#000000"),
  emissiveIntensity: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
  alphaMode: z.enum(["opaque", "mask", "blend"]).default("opaque"),
  alphaCutoff: z.number().min(0).max(1).default(0.5),
  doubleSided: z.boolean().default(false),

  // Texture slots (asset IDs)
  baseColorMap: z.string().nullable().default(null),
  normalMap: z.string().nullable().default(null),
  metallicRoughnessMap: z.string().nullable().default(null),
  emissiveMap: z.string().nullable().default(null),
  occlusionMap: z.string().nullable().default(null),
});

export const MaterialComponentDef: ComponentDefinition = {
  type: "Material",
  category: "rendering",
  description:
    "Material component with PBR properties matching the portable subset. Can reference a material asset or define inline PBR fallback values.",
  singleton: false,
  schema: MaterialSchema,
  editorHints: {
    materialAssetId: {
      editorHint: "asset-ref",
      assetType: "material",
      label: "Material Asset",
    },
    baseColor: { editorHint: "color", label: "Base Color" },
    metallic: { editorHint: "slider", min: 0, max: 1, label: "Metallic" },
    roughness: { editorHint: "slider", min: 0, max: 1, label: "Roughness" },
    emissive: { editorHint: "color", label: "Emissive Color" },
    emissiveIntensity: { editorHint: "number", label: "Emissive Intensity" },
    opacity: { editorHint: "slider", min: 0, max: 1, label: "Opacity" },
    alphaMode: { editorHint: "dropdown", label: "Alpha Mode" },
    alphaCutoff: {
      editorHint: "slider",
      min: 0,
      max: 1,
      label: "Alpha Cutoff",
    },
    doubleSided: { editorHint: "checkbox", label: "Double Sided" },
    baseColorMap: {
      editorHint: "asset-ref",
      assetType: "texture",
      label: "Base Color Map",
    },
    normalMap: {
      editorHint: "asset-ref",
      assetType: "texture",
      label: "Normal Map",
    },
    metallicRoughnessMap: {
      editorHint: "asset-ref",
      assetType: "texture",
      label: "Metallic Roughness Map",
    },
    emissiveMap: {
      editorHint: "asset-ref",
      assetType: "texture",
      label: "Emissive Map",
    },
    occlusionMap: {
      editorHint: "asset-ref",
      assetType: "texture",
      label: "Occlusion Map",
    },
  },
};

registerComponent(MaterialComponentDef);
