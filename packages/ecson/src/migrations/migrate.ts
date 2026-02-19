import {
  SceneDocumentSchema,
  CURRENT_SCHEMA_VERSION,
  type SceneDocument,
} from "../schemas/index.js";

/* eslint-disable no-var -- global augmentation for console in non-DOM lib */
declare var console: { warn(...args: unknown[]): void };
/* eslint-enable no-var */

/**
 * A migration transforms a document from version N-1 to version N.
 *
 * - `version`: the target version after this migration runs.
 * - `description`: human-readable label for logging.
 * - `up`: transforms the document forward. Receives and returns `unknown`
 *   because the intermediate shape is not necessarily a valid SceneDocument.
 */
export interface Migration {
  version: number;
  description: string;
  up: (doc: unknown) => unknown;
}

/**
 * Registry of all migrations, ordered by version.
 *
 * For v1, this array is empty (no prior versions to migrate from).
 * Future migrations are added here in version order.
 */
export const migrations: Migration[] = [];

/**
 * Migrate a document from its current schemaVersion to the latest.
 *
 * - Applies each migration where `doc.schemaVersion < migration.version`, in order.
 * - After all migrations, validates the result against `SceneDocumentSchema`.
 * - Throws if the document is invalid after migration.
 *
 * If the document is already at CURRENT_SCHEMA_VERSION, it is validated and returned.
 */
export function migrateDocument(doc: unknown): SceneDocument {
  let current: Record<string, unknown>;

  // Ensure we have an object with a schemaVersion field
  if (typeof doc !== "object" || doc === null) {
    throw new Error("migrateDocument: input must be a non-null object");
  }

  current = { ...(doc as Record<string, unknown>) };

  const startVersion =
    typeof current["schemaVersion"] === "number"
      ? (current["schemaVersion"] as number)
      : undefined;

  if (startVersion === undefined) {
    throw new Error("migrateDocument: document is missing schemaVersion field");
  }

  // Apply migrations in order
  for (const migration of migrations) {
    const currentVersion = current["schemaVersion"] as number;
    if (currentVersion < migration.version) {
      const prev = currentVersion;
      const result = migration.up(current);
      if (typeof result !== "object" || result === null) {
        throw new Error(
          `Migration to v${migration.version} returned a non-object`,
        );
      }
      current = result as Record<string, unknown>;
      current["schemaVersion"] = migration.version;
      console.warn(
        `Migrated ECSON document from v${prev} to v${migration.version}`,
      );
    }
  }

  // Final validation
  return SceneDocumentSchema.parse(current);
}

// Re-export for convenience
export { CURRENT_SCHEMA_VERSION };
