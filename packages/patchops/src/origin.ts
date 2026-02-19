import { z } from "zod";

/**
 * Origin of a PatchOp -- who or what initiated the mutation.
 *
 * - user: Human user action (UI interaction, drag-drop, property edit)
 * - ai: AI-generated operation (IQL execution, AI suggestions)
 * - system: Internal system operation (scene loading, migration, sync)
 * - replay: Operation replay (undo/redo, collaboration replay)
 */
export const OriginSchema = z.enum(["user", "ai", "system", "replay"]);

export type Origin = z.infer<typeof OriginSchema>;

/**
 * Configuration for AI safe mode -- restricts which operations AI can execute.
 * When enabled, ops with types in `restrictedOps` are rejected if origin is 'ai'.
 */
export const SafeModeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  restrictedOps: z.array(z.string()).default([]),
});

export type SafeModeConfig = z.infer<typeof SafeModeConfigSchema>;
