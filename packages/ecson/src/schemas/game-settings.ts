import { z } from "zod";

/**
 * Game settings for multiplayer and gameplay configuration.
 * Optional in SceneDocument.
 */
export const GameSettingsSchema = z.object({
  maxPlayers: z.number().int().min(1).default(8),
  roundDuration: z.number().min(0).default(120),
  respawnEnabled: z.boolean().default(true),
  respawnDelay: z.number().min(0).default(3),
});

export type GameSettings = z.infer<typeof GameSettingsSchema>;
