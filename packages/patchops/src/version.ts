/**
 * Current PatchOp format version.
 *
 * Increment when the PatchOp schema structure changes (new fields, removed fields,
 * changed semantics). The migrateOp() runner uses this to walk the migration chain.
 */
export const CURRENT_PATCHOP_VERSION = 1;
