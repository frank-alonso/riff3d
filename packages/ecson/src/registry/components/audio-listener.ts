import { z } from "zod";
import { registerComponent } from "../registry";
import type { ComponentDefinition } from "../types";

const AudioListenerSchema = z.object({
  active: z.boolean().default(true),
});

export const AudioListenerComponentDef: ComponentDefinition = {
  type: "AudioListener",
  category: "audio",
  description:
    "Marks which entity 'hears' audio. Typically one per scene, attached to the player or camera.",
  singleton: true,
  schema: AudioListenerSchema,
  editorHints: {
    active: { editorHint: "checkbox" },
  },
};

registerComponent(AudioListenerComponentDef);
