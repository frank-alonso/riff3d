/**
 * Persistence unit tests -- verifies server-side Y.Doc decode/re-encode,
 * Supabase persistence hooks, and collab document round-trip integrity.
 *
 * Resolves CF-P5-05: server-side unit tests for collab persistence.
 *
 * Mock strategy: vi.fn() for Supabase client methods. No running Supabase
 * instance required -- these tests run in CI without external dependencies.
 */
import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import { SceneDocumentSchema } from "@riff3d/ecson";
import {
  createPersistenceExtension,
  syncEcsonToProject,
} from "../src/persistence";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Populate a Y.Doc with a known ECSON-like structure, mirroring the shape
 * produced by sync-bridge initializeYDoc.
 */
function populateYDoc(doc: Y.Doc): void {
  doc.transact(() => {
    const yMeta = doc.getMap("meta");
    yMeta.set("id", "proj-persist-test");
    yMeta.set("name", "Persistence Test");
    yMeta.set("schemaVersion", 1);
    yMeta.set("rootEntityId", "root");
    yMeta.set("_shapeVersion", 1);

    const yEntities = doc.getMap("entities");

    const rootEntity = new Y.Map<unknown>();
    rootEntity.set("id", "root");
    rootEntity.set("name", "Root");
    rootEntity.set("parentId", null);
    rootEntity.set("children", ["child-1"]);
    rootEntity.set("components", []);
    rootEntity.set("tags", []);
    rootEntity.set("locked", false);
    yEntities.set("root", rootEntity);

    const childEntity = new Y.Map<unknown>();
    childEntity.set("id", "child-1");
    childEntity.set("name", "Child One");
    childEntity.set("parentId", "root");
    childEntity.set("children", []);
    childEntity.set("components", [
      {
        type: "Transform",
        properties: {
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
      },
    ]);
    childEntity.set("tags", []);
    childEntity.set("locked", false);
    yEntities.set("child-1", childEntity);

    const yAssets = doc.getMap("assets");
    yAssets.set("ast-1", {
      id: "ast-1",
      type: "texture",
      name: "test.png",
      uri: "/textures/test.png",
      metadata: {},
    });

    const yWiring = doc.getArray("wiring");
    yWiring.push([
      {
        id: "wir-1",
        sourceEntityId: "child-1",
        sourceEvent: "onCollide",
        targetEntityId: "root",
        targetAction: "destroy",
      },
    ]);

    const yEnvironment = doc.getMap("environment");
    yEnvironment.set("ambientLight", { color: "#ffffff", intensity: 0.7 });

    const yMetadata = doc.getMap("metadata");
    yMetadata.set("preferredEngine", "playcanvas");
  });
}

/**
 * Create a mock SupabaseClient with chainable query builder methods.
 * Tracks calls for assertion and returns configurable results.
 */
function createMockSupabase(overrides?: {
  selectResult?: { data: unknown; error: unknown };
  upsertResult?: { error: unknown };
  updateResult?: { error: unknown };
}) {
  const selectResult = overrides?.selectResult ?? { data: null, error: null };
  const upsertResult = overrides?.upsertResult ?? { error: null };
  const updateResult = overrides?.updateResult ?? { error: null };

  const eqFn = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue(selectResult),
    then: vi.fn().mockImplementation((cb: (r: { error: unknown }) => void) => {
      cb(updateResult);
      return Promise.resolve();
    }),
  });

  const fromFn = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ eq: eqFn }),
    upsert: vi.fn().mockResolvedValue(upsertResult),
    update: vi.fn().mockReturnValue({ eq: eqFn }),
  });

  return {
    client: { from: fromFn } as unknown as Parameters<typeof createPersistenceExtension>[0],
    fromFn,
    eqFn,
  };
}

// ---------------------------------------------------------------------------
// Y.Doc Round-Trip Tests
// ---------------------------------------------------------------------------

describe("Y.Doc encode/decode round-trip", () => {
  it("preserves all ECSON fields through encode/decode cycle", () => {
    const doc = new Y.Doc();
    populateYDoc(doc);

    // Encode to binary state
    const state = Y.encodeStateAsUpdate(doc);

    // Decode into a fresh Y.Doc
    const restored = new Y.Doc();
    Y.applyUpdate(restored, state);

    // Verify meta fields
    const yMeta = restored.getMap("meta");
    expect(yMeta.get("id")).toBe("proj-persist-test");
    expect(yMeta.get("name")).toBe("Persistence Test");
    expect(yMeta.get("schemaVersion")).toBe(1);
    expect(yMeta.get("rootEntityId")).toBe("root");

    // Verify entities
    const yEntities = restored.getMap("entities");
    expect(yEntities.size).toBe(2);
    const rootEntity = yEntities.get("root") as Y.Map<unknown>;
    expect(rootEntity).toBeInstanceOf(Y.Map);
    expect(rootEntity.get("name")).toBe("Root");
    expect(rootEntity.get("children")).toEqual(["child-1"]);

    const childEntity = yEntities.get("child-1") as Y.Map<unknown>;
    expect(childEntity).toBeInstanceOf(Y.Map);
    expect(childEntity.get("name")).toBe("Child One");
    expect(childEntity.get("components")).toEqual([
      {
        type: "Transform",
        properties: {
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
      },
    ]);

    // Verify assets
    const yAssets = restored.getMap("assets");
    expect(yAssets.get("ast-1")).toEqual({
      id: "ast-1",
      type: "texture",
      name: "test.png",
      uri: "/textures/test.png",
      metadata: {},
    });

    // Verify wiring
    const yWiring = restored.getArray("wiring");
    expect(yWiring.length).toBe(1);
    expect(yWiring.get(0)).toEqual({
      id: "wir-1",
      sourceEntityId: "child-1",
      sourceEvent: "onCollide",
      targetEntityId: "root",
      targetAction: "destroy",
    });

    // Verify environment
    const yEnvironment = restored.getMap("environment");
    expect(yEnvironment.get("ambientLight")).toEqual({
      color: "#ffffff",
      intensity: 0.7,
    });

    // Verify metadata
    const yMetadata = restored.getMap("metadata");
    expect(yMetadata.get("preferredEngine")).toBe("playcanvas");

    doc.destroy();
    restored.destroy();
  });

  it("preserves nested Y.Map entity structure through encode/decode", () => {
    const doc = new Y.Doc();
    populateYDoc(doc);

    const state = Y.encodeStateAsUpdate(doc);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, state);

    // Verify nested Y.Maps survive (entities are Y.Map, not plain objects)
    const yEntities = restored.getMap("entities");
    const child = yEntities.get("child-1");
    expect(child).toBeInstanceOf(Y.Map);

    // Verify per-property access on nested Y.Map
    const childMap = child as Y.Map<unknown>;
    expect(childMap.get("parentId")).toBe("root");

    doc.destroy();
    restored.destroy();
  });
});

// ---------------------------------------------------------------------------
// syncEcsonToProject Tests
// ---------------------------------------------------------------------------

describe("syncEcsonToProject", () => {
  it("produces valid ECSON from Y.Doc state and calls Supabase update", () => {
    const doc = new Y.Doc();
    populateYDoc(doc);
    const state = Y.encodeStateAsUpdate(doc);

    // Track the update payload
    let capturedPayload: Record<string, unknown> | null = null;

    const eqFn = vi.fn().mockReturnValue({
      then: vi.fn().mockImplementation((cb: (r: { error: unknown }) => void) => {
        cb({ error: null });
        return Promise.resolve();
      }),
    });

    const updateFn = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      capturedPayload = payload;
      return { eq: eqFn };
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: updateFn,
      }),
    } as unknown as Parameters<typeof syncEcsonToProject>[0];

    syncEcsonToProject(mockSupabase, "proj-persist-test", state);

    // Verify Supabase was called with "projects" table
    expect(mockSupabase.from).toHaveBeenCalledWith("projects");

    // Verify the update payload contains valid ECSON
    expect(capturedPayload).not.toBeNull();
    const ecson = capturedPayload!["ecson"] as Record<string, unknown>;
    expect(ecson).toBeDefined();
    expect(ecson["id"]).toBe("proj-persist-test");
    expect(ecson["rootEntityId"]).toBe("root");
    expect(Object.keys(ecson["entities"] as Record<string, unknown>)).toHaveLength(2);

    // Validate the ECSON against SceneDocumentSchema
    const parsed = SceneDocumentSchema.safeParse(ecson);
    expect(parsed.success).toBe(true);

    // Verify entity_count is correct
    expect(capturedPayload!["entity_count"]).toBe(2);

    doc.destroy();
  });

  it("does not call update when Y.Doc has no id or rootEntityId", () => {
    const doc = new Y.Doc();
    // Empty Y.Doc -- no meta fields
    const state = Y.encodeStateAsUpdate(doc);

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: vi.fn(),
          }),
        }),
      }),
    } as unknown as Parameters<typeof syncEcsonToProject>[0];

    // Should not throw
    syncEcsonToProject(mockSupabase, "empty-project", state);

    // The function checks `ecson.id && ecson.rootEntityId` before calling update.
    // Empty strings are falsy, so update should NOT be called.
    const fromResult = mockSupabase.from("projects");
    expect(fromResult.update).not.toHaveBeenCalled();

    doc.destroy();
  });
});

// ---------------------------------------------------------------------------
// Persistence Extension Fetch Tests
// ---------------------------------------------------------------------------

describe("createPersistenceExtension fetch", () => {
  it("returns null for unknown project (first session)", async () => {
    const { client } = createMockSupabase({
      selectResult: {
        data: null,
        error: { code: "PGRST116", message: "not found" },
      },
    });

    const extension = createPersistenceExtension(client);

    // Access the fetch handler via the Database extension's configuration.
    // The Database class wraps our fetch/store callbacks. We call them
    // via the extension's configuration property.
    const config = (extension as unknown as { configuration: { fetch: (ctx: { documentName: string }) => Promise<unknown> } }).configuration;
    const result = await config.fetch({ documentName: "unknown-project" });

    expect(result).toBeNull();
  });

  it("returns Uint8Array for existing project with persisted state", async () => {
    // Create a Y.Doc, encode it, base64-encode it (simulating DB storage)
    const doc = new Y.Doc();
    populateYDoc(doc);
    const state = Y.encodeStateAsUpdate(doc);
    const base64State = Buffer.from(state).toString("base64");

    const { client } = createMockSupabase({
      selectResult: {
        data: { ydoc_state: base64State },
        error: null,
      },
    });

    const extension = createPersistenceExtension(client);
    const config = (extension as unknown as { configuration: { fetch: (ctx: { documentName: string }) => Promise<unknown> } }).configuration;
    const result = await config.fetch({ documentName: "proj-persist-test" });

    // Result should be a Buffer (Uint8Array subclass) of the decoded state
    expect(result).toBeInstanceOf(Buffer);

    // Verify the returned state can be applied to a fresh Y.Doc
    const restored = new Y.Doc();
    Y.applyUpdate(restored, result as Uint8Array);
    const yMeta = restored.getMap("meta");
    expect(yMeta.get("id")).toBe("proj-persist-test");

    doc.destroy();
    restored.destroy();
  });
});

// ---------------------------------------------------------------------------
// Shape Version Tests
// ---------------------------------------------------------------------------

describe("shape version in Y.Doc", () => {
  it("_shapeVersion is present after initialization and survives round-trip", () => {
    const doc = new Y.Doc();
    populateYDoc(doc);

    // Verify version is stamped
    const yMeta = doc.getMap("meta");
    expect(yMeta.get("_shapeVersion")).toBe(1);

    // Encode, decode, verify version persists
    const state = Y.encodeStateAsUpdate(doc);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, state);

    const restoredMeta = restored.getMap("meta");
    expect(restoredMeta.get("_shapeVersion")).toBe(1);

    doc.destroy();
    restored.destroy();
  });

  it("pre-versioning Y.Doc (no _shapeVersion) returns undefined for field", () => {
    // Simulate a pre-versioning Y.Doc that has no _shapeVersion field
    const doc = new Y.Doc();
    doc.transact(() => {
      const yMeta = doc.getMap("meta");
      yMeta.set("id", "old-project");
      yMeta.set("name", "Old Project");
      yMeta.set("schemaVersion", 1);
      yMeta.set("rootEntityId", "root");
      // No _shapeVersion set -- simulates version 0 (implicit)
    });

    const yMeta = doc.getMap("meta");
    expect(yMeta.get("_shapeVersion")).toBeUndefined();

    doc.destroy();
  });
});
