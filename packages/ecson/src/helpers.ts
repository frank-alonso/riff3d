import {
  SceneDocumentSchema,
  EntitySchema,
  CURRENT_SCHEMA_VERSION,
  type SceneDocument,
  type Entity,
} from "./schemas/index";
import { generateEntityId } from "./ids";

/**
 * Create a valid empty SceneDocument with a root entity, no assets,
 * no wiring, default environment, and schema version 1.
 */
export function createEmptyDocument(name?: string): SceneDocument {
  const docId = generateEntityId();
  const rootEntityId = generateEntityId();

  const rootEntity: Entity = EntitySchema.parse({
    id: rootEntityId,
    name: "Root",
    parentId: null,
  });

  return SceneDocumentSchema.parse({
    id: docId,
    name: name ?? "Untitled Scene",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rootEntityId,
    entities: { [rootEntityId]: rootEntity },
  });
}

/**
 * Create a valid Entity with a generated ID, empty components,
 * and default transform.
 */
export function createEntity(
  name: string,
  parentId?: string | null,
): Entity {
  return EntitySchema.parse({
    id: generateEntityId(),
    name,
    parentId: parentId ?? null,
  });
}
