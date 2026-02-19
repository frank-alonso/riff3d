import { CURRENT_PATCHOP_VERSION } from "../version.js";
import { PatchOpSchema, type PatchOp } from "../schemas.js";

declare const console: { warn(...args: unknown[]): void };

/**
 * Migration registry: maps fromVersion -> migration function.
 *
 * Empty for v1 -- no old formats to migrate from yet.
 * Future versions add entries: MIGRATION_REGISTRY.set(1, migrateV1ToV2);
 */
export const MIGRATION_REGISTRY: Map<number, (raw: unknown) => unknown> =
  new Map();

/**
 * Auto-migrate a raw PatchOp to the current format version.
 *
 * Walks the migration chain from the op's version to CURRENT_PATCHOP_VERSION,
 * applying each registered migration in sequence. Logs a warning when migration
 * is applied (per LOCKED DECISION: "Old-format PatchOps auto-migrated on load
 * with a logged warning").
 *
 * @param rawOp - The raw PatchOp object (possibly in an older format)
 * @returns The migrated and validated PatchOp
 * @throws ZodError if the result doesn't pass schema validation
 */
export function migrateOp(rawOp: unknown): PatchOp {
  if (rawOp === null || typeof rawOp !== "object") {
    return PatchOpSchema.parse(rawOp);
  }

  const obj = rawOp as Record<string, unknown>;
  let version =
    typeof obj["version"] === "number"
      ? obj["version"]
      : CURRENT_PATCHOP_VERSION;

  let current: unknown = rawOp;

  if (version < CURRENT_PATCHOP_VERSION) {
    const fromVersion = version;

    while (version < CURRENT_PATCHOP_VERSION) {
      const migration = MIGRATION_REGISTRY.get(version);
      if (migration !== undefined) {
        current = migration(current);
      }
      version++;
    }

    console.warn(
      `PatchOp migrated from v${String(fromVersion)} to v${String(CURRENT_PATCHOP_VERSION)}`,
    );
  }

  return PatchOpSchema.parse(current);
}
