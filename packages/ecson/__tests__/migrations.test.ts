import { describe, it, expect, vi } from "vitest";
import {
  SceneDocumentSchema,
  CURRENT_SCHEMA_VERSION,
  type SceneDocument,
} from "../src/schemas/index";
import { migrateDocument } from "../src/migrations/migrate";
import { createEmptyDocument, createEntity } from "../src/helpers";

// ---------------------------------------------------------------------------
// migrateDocument
// ---------------------------------------------------------------------------

describe("migrateDocument", () => {
  it("document at current version passes through unchanged", () => {
    const input = createEmptyDocument("Test");
    const result = migrateDocument(input);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.name).toBe("Test");
  });

  it("returns a valid SceneDocument per Zod", () => {
    const input = createEmptyDocument("Validated");
    const result = migrateDocument(input);
    // Should not throw
    const reparsed = SceneDocumentSchema.parse(result);
    expect(reparsed.id).toBe(result.id);
  });

  it("rejects document without schemaVersion", () => {
    expect(() => migrateDocument({ id: "bad", name: "bad" })).toThrow(
      "schemaVersion",
    );
  });

  it("rejects non-object input", () => {
    expect(() => migrateDocument("not an object")).toThrow("non-null object");
    expect(() => migrateDocument(null)).toThrow("non-null object");
  });

  it("rejects invalid document at version 0 (no migration path)", () => {
    // There are no migrations from v0 to v1, and v0 is below min(1),
    // so it should fail Zod validation because schemaVersion must be >= 1
    expect(() =>
      migrateDocument({
        id: "d0",
        name: "Old",
        schemaVersion: 0,
        rootEntityId: "root",
        entities: {},
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// createEmptyDocument
// ---------------------------------------------------------------------------

describe("createEmptyDocument", () => {
  it("produces a valid SceneDocument", () => {
    const doc = createEmptyDocument();
    // Must not throw
    SceneDocumentSchema.parse(doc);
  });

  it("has default name 'Untitled Scene'", () => {
    const doc = createEmptyDocument();
    expect(doc.name).toBe("Untitled Scene");
  });

  it("accepts a custom name", () => {
    const doc = createEmptyDocument("My Project");
    expect(doc.name).toBe("My Project");
  });

  it("has a root entity referenced by rootEntityId", () => {
    const doc = createEmptyDocument();
    const root = doc.entities[doc.rootEntityId];
    expect(root).toBeDefined();
    expect(root!.name).toBe("Root");
    expect(root!.parentId).toBeNull();
  });

  it("has schemaVersion set to CURRENT_SCHEMA_VERSION", () => {
    const doc = createEmptyDocument();
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("has empty assets, wiring, and metadata", () => {
    const doc = createEmptyDocument();
    expect(Object.keys(doc.assets)).toHaveLength(0);
    expect(doc.wiring).toHaveLength(0);
    expect(Object.keys(doc.metadata)).toHaveLength(0);
  });

  it("has default environment settings", () => {
    const doc = createEmptyDocument();
    expect(doc.environment.gravity.y).toBe(-9.81);
    expect(doc.environment.skybox.type).toBe("color");
  });
});

// ---------------------------------------------------------------------------
// createEntity
// ---------------------------------------------------------------------------

describe("createEntity", () => {
  it("produces a valid Entity with generated ID", () => {
    const entity = createEntity("Player");
    expect(entity.id).toBeDefined();
    expect(entity.id).toHaveLength(16);
    expect(entity.name).toBe("Player");
    expect(entity.parentId).toBeNull();
  });

  it("accepts parentId parameter", () => {
    const entity = createEntity("Child", "parent-id-123");
    expect(entity.parentId).toBe("parent-id-123");
  });

  it("has default transform", () => {
    const entity = createEntity("Positioned");
    expect(entity.transform.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(entity.transform.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("has empty components and tags", () => {
    const entity = createEntity("Empty");
    expect(entity.components).toEqual([]);
    expect(entity.tags).toEqual([]);
  });

  it("is visible and unlocked by default", () => {
    const entity = createEntity("Defaults");
    expect(entity.visible).toBe(true);
    expect(entity.locked).toBe(false);
  });
});
