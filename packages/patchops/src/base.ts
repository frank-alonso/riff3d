import { z } from "zod";
import { OriginSchema } from "./origin.js";
import { CURRENT_PATCHOP_VERSION } from "./version.js";

/**
 * Shared base fields for every PatchOp.
 *
 * - id: nanoid for uniqueness across sessions
 * - timestamp: epoch milliseconds when op was created
 * - origin: who initiated this op (user/ai/system/replay)
 * - version: PatchOp format version (defaults to current)
 */
export const PatchOpBase = {
  id: z.string(),
  timestamp: z.number(),
  origin: OriginSchema,
  version: z.number().default(CURRENT_PATCHOP_VERSION),
};
