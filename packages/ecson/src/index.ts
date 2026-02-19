export const VERSION = "0.0.1";

// All ECSON schemas and types
export * from "./schemas/index.js";

// ID generation
export {
  generateEntityId,
  generateOpId,
  generateAssetId,
  generateWireId,
} from "./ids.js";

// Migration infrastructure
export { migrateDocument, type Migration } from "./migrations/migrate.js";

// Helper utilities
export { createEmptyDocument, createEntity } from "./helpers.js";
