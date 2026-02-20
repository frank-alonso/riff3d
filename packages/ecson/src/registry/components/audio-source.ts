import { z } from "zod";
import { registerComponent } from "../registry";
import type { ComponentDefinition } from "../types";

const AudioSourceSchema = z.object({
  audioAssetId: z.string().nullable().default(null),
  autoPlay: z.boolean().default(false),
  loop: z.boolean().default(false),
  volume: z.number().min(0).max(1).default(1),
  pitch: z.number().min(0.1).max(4).default(1),
  spatial: z.boolean().default(true),
  refDistance: z.number().default(1),
  maxDistance: z.number().default(100),
  rolloffFactor: z.number().default(1),
});

export const AudioSourceComponentDef: ComponentDefinition = {
  type: "AudioSource",
  category: "audio",
  description:
    "An audio source that plays sound clips with volume, pitch, spatial, and distance settings.",
  singleton: false,
  schema: AudioSourceSchema,
  editorHints: {
    audioAssetId: { editorHint: "asset-ref", assetType: "audio" },
    autoPlay: { editorHint: "checkbox" },
    loop: { editorHint: "checkbox" },
    volume: { editorHint: "slider" },
    pitch: { editorHint: "slider" },
    spatial: { editorHint: "checkbox" },
    refDistance: { editorHint: "number" },
    maxDistance: { editorHint: "number" },
    rolloffFactor: { editorHint: "number" },
  },
  events: [
    { name: "onPlay", label: "On Play" },
    { name: "onStop", label: "On Stop" },
    { name: "onEnd", label: "On End" },
  ],
};

registerComponent(AudioSourceComponentDef);
