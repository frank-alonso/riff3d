/**
 * Collaboration tests — verifies sync bridge, lock manager, and undo isolation.
 *
 * Uses headless Y.Docs (no Hocuspocus server needed) to deterministically test:
 * - ECSON ↔ Y.Doc round-trip (entities, assets, environment, wiring, metadata)
 * - Environment sync via __environment__ virtual entityId
 * - Schema validation / fail-closed in yDocToEcson
 * - Two-client conflict propagation via Y.applyUpdate
 * - Lock acquisition, release, and hierarchical propagation
 * - Per-user undo isolation across clients
 *
 * Addresses Codex review findings P5-001..P5-004.
 */
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { SceneDocumentSchema, type SceneDocument } from "@riff3d/ecson";
import {
  initializeYDoc,
  syncToYDoc,
  yDocToEcson,
  observeRemoteChanges,
  ORIGIN_LOCAL,
} from "../src/collaboration/sync-bridge";
import { applyOp, CURRENT_PATCHOP_VERSION, type PatchOp } from "@riff3d/patchops";

/** Build a minimal valid PatchOp with required base fields. */
function makeOp(
  type: PatchOp["type"],
  payload: Record<string, unknown>,
): PatchOp {
  return {
    id: `op_${Math.random().toString(36).slice(2, 10)}`,
    type,
    payload,
    timestamp: Date.now(),
    origin: "user",
    version: CURRENT_PATCHOP_VERSION,
  } as PatchOp;
}
import {
  acquireLock,
  releaseLock,
  isEntityLocked,
  getLockedEntities,
  releaseAllLocks,
  type AwarenessLike,
} from "../src/collaboration/lock-manager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert that yDocToEcson returns a valid, non-null SceneDocument. */
function expectValidEcson(yDoc: Y.Doc): SceneDocument {
  const result = yDocToEcson(yDoc);
  expect(result).not.toBeNull();
  return result!;
}

/**
 * Sync two Y.Docs bidirectionally via Y.applyUpdate (simulating a
 * Hocuspocus relay without requiring a server).
 */
function syncDocs(docA: Y.Doc, docB: Y.Doc): void {
  const stateA = Y.encodeStateAsUpdate(docA);
  const stateB = Y.encodeStateAsUpdate(docB);
  Y.applyUpdate(docB, stateA);
  Y.applyUpdate(docA, stateB);
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeTestDoc(): SceneDocument {
  return SceneDocumentSchema.parse({
    id: "proj-test",
    name: "Test Project",
    schemaVersion: 1,
    rootEntityId: "root",
    entities: {
      root: {
        id: "root",
        name: "Root",
        parentId: null,
        children: ["child-a", "child-b"],
        components: [],
        tags: [],
        locked: false,
      },
      "child-a": {
        id: "child-a",
        name: "Child A",
        parentId: "root",
        children: ["grandchild"],
        components: [],
        tags: [],
        locked: false,
      },
      "child-b": {
        id: "child-b",
        name: "Child B",
        parentId: "root",
        children: [],
        components: [],
        tags: [],
        locked: false,
      },
      grandchild: {
        id: "grandchild",
        name: "Grandchild",
        parentId: "child-a",
        children: [],
        components: [],
        tags: [],
        locked: false,
      },
    },
    assets: {
      "ast-1": {
        id: "ast-1",
        type: "texture",
        name: "wood.png",
        uri: "/textures/wood.png",
        metadata: {},
      },
    },
    wiring: [
      {
        id: "wir-1",
        sourceEntityId: "child-a",
        sourceEvent: "onCollide",
        targetEntityId: "child-b",
        targetAction: "destroy",
      },
    ],
    environment: {
      ambientLight: { color: "#334455", intensity: 0.5 },
    },
    metadata: { preferredEngine: "playcanvas" },
  });
}

/**
 * Create a mock AwarenessLike with two clients.
 * Returns [localAwareness, remoteAwareness] where each has its own clientID
 * but shares the same state map (simulating Yjs Awareness sync).
 */
function createMockAwareness(): [AwarenessLike, AwarenessLike] {
  const states = new Map<number, Record<string, unknown>>();
  states.set(1, { user: { id: "u1", name: "Alice", color: "#f00" }, locks: [] });
  states.set(2, { user: { id: "u2", name: "Bob", color: "#0f0" }, locks: [] });

  function makeAwareness(clientId: number): AwarenessLike {
    return {
      clientID: clientId,
      getStates: () => states,
      getLocalState: () => states.get(clientId) ?? null,
      setLocalStateField: (key: string, value: unknown) => {
        const current = states.get(clientId) ?? {};
        states.set(clientId, { ...current, [key]: value });
      },
      on: () => {},
      off: () => {},
    };
  }

  return [makeAwareness(1), makeAwareness(2)];
}

// ---------------------------------------------------------------------------
// Sync Bridge Tests
// ---------------------------------------------------------------------------

describe("Sync Bridge", () => {
  describe("initializeYDoc + yDocToEcson round-trip", () => {
    it("preserves entities through Y.Doc round-trip", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();

      initializeYDoc(yDoc, doc);
      const result = expectValidEcson(yDoc);

      expect(Object.keys(result.entities)).toEqual(
        expect.arrayContaining(Object.keys(doc.entities)),
      );
      expect(Object.keys(result.entities).length).toBe(
        Object.keys(doc.entities).length,
      );

      for (const [id, entity] of Object.entries(doc.entities)) {
        expect(result.entities[id].name).toBe(entity.name);
        expect(result.entities[id].parentId).toBe(entity.parentId);
        expect(result.entities[id].children).toEqual(entity.children);
      }
    });

    it("preserves assets through Y.Doc round-trip", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();

      initializeYDoc(yDoc, doc);
      const result = expectValidEcson(yDoc);

      expect(result.assets["ast-1"]).toBeDefined();
      expect(result.assets["ast-1"].name).toBe("wood.png");
      expect(result.assets["ast-1"].uri).toBe("/textures/wood.png");
    });

    it("preserves wiring through Y.Doc round-trip (P5-001)", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();

      initializeYDoc(yDoc, doc);
      const result = expectValidEcson(yDoc);

      expect(result.wiring).toHaveLength(1);
      expect(result.wiring[0].id).toBe("wir-1");
      expect(result.wiring[0].sourceEntityId).toBe("child-a");
      expect(result.wiring[0].sourceEvent).toBe("onCollide");
      expect(result.wiring[0].targetEntityId).toBe("child-b");
      expect(result.wiring[0].targetAction).toBe("destroy");
    });

    it("preserves environment through Y.Doc round-trip", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();

      initializeYDoc(yDoc, doc);
      const result = expectValidEcson(yDoc);

      expect(result.environment.ambientLight.intensity).toBe(0.5);
      expect(result.environment.ambientLight.color).toBe("#334455");
    });

    it("preserves metadata through Y.Doc round-trip", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();

      initializeYDoc(yDoc, doc);
      const result = expectValidEcson(yDoc);

      expect(result.metadata.preferredEngine).toBe("playcanvas");
    });

    it("preserves meta fields through Y.Doc round-trip", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();

      initializeYDoc(yDoc, doc);
      const result = expectValidEcson(yDoc);

      expect(result.id).toBe("proj-test");
      expect(result.name).toBe("Test Project");
      expect(result.schemaVersion).toBe(1);
      expect(result.rootEntityId).toBe("root");
    });

    it("result passes schema validation (P5-003)", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();

      initializeYDoc(yDoc, doc);
      const result = expectValidEcson(yDoc);

      const validated = SceneDocumentSchema.parse(result);
      expect(validated.id).toBe(doc.id);
    });
  });

  describe("syncToYDoc", () => {
    it("syncs single entity property changes", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      const modified = structuredClone(doc);
      modified.entities["child-a"].name = "Renamed A";

      syncToYDoc(yDoc, modified, "child-a");
      const result = expectValidEcson(yDoc);

      expect(result.entities["child-a"].name).toBe("Renamed A");
      expect(result.entities["child-b"].name).toBe("Child B");
    });

    it("syncs environment via __environment__ entityId (P5-002)", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      const modified = structuredClone(doc);
      modified.environment.ambientLight.intensity = 0.8;

      syncToYDoc(yDoc, modified, "__environment__");
      const result = expectValidEcson(yDoc);

      expect(result.environment.ambientLight.intensity).toBe(0.8);
    });

    it("syncs entity deletion in full-sync mode", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      const modified = structuredClone(doc);
      delete modified.entities["child-b"];
      modified.entities["root"].children = ["child-a"];

      syncToYDoc(yDoc, modified);
      const result = expectValidEcson(yDoc);

      expect(result.entities["child-b"]).toBeUndefined();
      expect(result.entities["root"].children).toEqual(["child-a"]);
    });

    it("syncs wiring changes in full-sync mode", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      const modified = structuredClone(doc);
      modified.wiring.push({
        id: "wir-2",
        sourceEntityId: "root",
        sourceEvent: "onLoad",
        targetEntityId: "child-a",
        targetAction: "enable",
      });

      syncToYDoc(yDoc, modified);
      const result = expectValidEcson(yDoc);

      expect(result.wiring).toHaveLength(2);
      expect(result.wiring[1].id).toBe("wir-2");
    });

    it("syncs asset changes in full-sync mode", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      const modified = structuredClone(doc);
      modified.assets["ast-2"] = {
        id: "ast-2",
        type: "mesh" as const,
        name: "cube.glb",
        uri: "/models/cube.glb",
        metadata: {},
      };

      syncToYDoc(yDoc, modified);
      const result = expectValidEcson(yDoc);

      expect(result.assets["ast-2"]).toBeDefined();
      expect(result.assets["ast-2"].name).toBe("cube.glb");
    });
  });

  describe("syncToYDoc after in-place mutation (regression: shared-ref bug)", () => {
    it("detects second in-place edit after first syncToYDoc stored a reference", () => {
      // This test exercises the exact bug path: applyOp mutates entities in place,
      // and Yjs stores plain objects by reference (ContentAny). Without
      // structuredClone in syncEntity, the second syncToYDoc sees the same object
      // ref for both "existing" (from Y.Doc) and "value" (from ECSON), so
      // JSON.stringify comparison returns equal and the write is silently skipped.
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      // First edit: mutate ECSON in place (as applyOp does) and sync
      const op1 = makeOp("SetProperty", { entityId: "child-a", path: "name", value: "Edit-1", previousValue: "Child A" });
      applyOp(doc, op1);
      syncToYDoc(yDoc, doc, "child-a");

      const after1 = expectValidEcson(yDoc);
      expect(after1.entities["child-a"].name).toBe("Edit-1");

      // Second edit: mutate the SAME entity in place again and sync
      const op2 = makeOp("SetProperty", { entityId: "child-a", path: "name", value: "Edit-2", previousValue: "Edit-1" });
      applyOp(doc, op2);
      syncToYDoc(yDoc, doc, "child-a");

      const after2 = expectValidEcson(yDoc);
      expect(after2.entities["child-a"].name).toBe("Edit-2");
    });

    it("propagates multiple sequential in-place edits to remote client", async () => {
      // End-to-end: two Y.Docs, local applies ops in place + syncs, remote
      // observer fires for BOTH the first and second edit.
      const doc = makeTestDoc();
      const localYDoc = new Y.Doc();
      const remoteYDoc = new Y.Doc();

      initializeYDoc(localYDoc, doc);
      syncDocs(localYDoc, remoteYDoc);

      // Track remote observer callbacks
      const remoteEdits: string[] = [];
      const unobserve = observeRemoteChanges(remoteYDoc, (ecson) => {
        remoteEdits.push(ecson.entities["child-a"].name);
      });

      // First in-place edit + sync to Y.Doc + propagate to remote
      const op1 = makeOp("SetProperty", { entityId: "child-a", path: "name", value: "First", previousValue: "Child A" });
      applyOp(doc, op1);
      syncToYDoc(localYDoc, doc, "child-a");
      syncDocs(localYDoc, remoteYDoc);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second in-place edit + sync + propagate
      const op2 = makeOp("SetProperty", { entityId: "child-a", path: "name", value: "Second", previousValue: "First" });
      applyOp(doc, op2);
      syncToYDoc(localYDoc, doc, "child-a");
      syncDocs(localYDoc, remoteYDoc);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Remote must have seen BOTH edits
      expect(remoteEdits.length).toBeGreaterThanOrEqual(2);
      expect(remoteEdits).toContain("First");
      expect(remoteEdits).toContain("Second");

      // Final state must be "Second"
      const finalRemote = expectValidEcson(remoteYDoc);
      expect(finalRemote.entities["child-a"].name).toBe("Second");

      unobserve();
    });

    it("handles nested property in-place mutation (transform path)", () => {
      // Tests deep path mutation — transform.position is a nested object
      // that applyOp modifies via setByPath.
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      // First edit: change position.x
      const op1 = makeOp("SetProperty", {
        entityId: "child-a",
        path: "transform.position.x",
        value: 5,
        previousValue: 0,
      });
      applyOp(doc, op1);
      syncToYDoc(yDoc, doc, "child-a");

      const after1 = expectValidEcson(yDoc);
      expect(after1.entities["child-a"].transform.position.x).toBe(5);

      // Second edit: change position.x again
      const op2 = makeOp("SetProperty", {
        entityId: "child-a",
        path: "transform.position.x",
        value: 10,
        previousValue: 5,
      });
      applyOp(doc, op2);
      syncToYDoc(yDoc, doc, "child-a");

      const after2 = expectValidEcson(yDoc);
      expect(after2.entities["child-a"].transform.position.x).toBe(10);
    });
  });

  describe("observeRemoteChanges", () => {
    it("triggers callback on remote entity changes", async () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      let receivedEcson: SceneDocument | null = null;
      const unobserve = observeRemoteChanges(yDoc, (ecson) => {
        receivedEcson = ecson;
      });

      yDoc.transact(() => {
        const yEntities = yDoc.getMap("entities");
        const yChildA = yEntities.get("child-a") as Y.Map<unknown>;
        yChildA.set("name", "Remote Rename");
      }, "remote-client-123");

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedEcson).not.toBeNull();
      expect(receivedEcson!.entities["child-a"].name).toBe("Remote Rename");

      unobserve();
    });

    it("does NOT trigger callback for local changes", async () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      let callCount = 0;
      const unobserve = observeRemoteChanges(yDoc, () => {
        callCount++;
      });

      yDoc.transact(() => {
        const yEntities = yDoc.getMap("entities");
        const yChildA = yEntities.get("child-a") as Y.Map<unknown>;
        yChildA.set("name", "Local Rename");
      }, ORIGIN_LOCAL);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callCount).toBe(0);

      unobserve();
    });

    it("does NOT trigger callback for init origin", async () => {
      const yDoc = new Y.Doc();

      let callCount = 0;
      const unobserve = observeRemoteChanges(yDoc, () => {
        callCount++;
      });

      const doc = makeTestDoc();
      initializeYDoc(yDoc, doc);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callCount).toBe(0);

      unobserve();
    });

    it("triggers callback on remote wiring changes", async () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      let receivedEcson: SceneDocument | null = null;
      const unobserve = observeRemoteChanges(yDoc, (ecson) => {
        receivedEcson = ecson;
      });

      yDoc.transact(() => {
        const yWiring = yDoc.getArray("wiring");
        yWiring.push([{
          id: "wir-remote",
          sourceEntityId: "root",
          sourceEvent: "onStart",
          targetEntityId: "child-b",
          targetAction: "play",
        }]);
      }, "remote-client-456");

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedEcson).not.toBeNull();
      expect(receivedEcson!.wiring).toHaveLength(2);

      unobserve();
    });
  });

  describe("schema validation (fail-closed)", () => {
    it("returns valid SceneDocument for well-formed Y.Doc", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      const result = yDocToEcson(yDoc);
      expect(result).not.toBeNull();

      const parsed = SceneDocumentSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it("handles empty Y.Doc without throwing (fail-closed contract)", () => {
      const yDoc = new Y.Doc();

      // Empty Y.Doc has empty string for id/rootEntityId from the default
      // getMap().get() fallback. The ECSON schema allows empty strings,
      // so an empty Y.Doc may produce a valid-but-empty SceneDocument
      // (all maps empty, default values applied by Zod) OR null if
      // validation fails. Either outcome satisfies the fail-closed contract:
      // - Valid parse: returns a SceneDocument (no crash, no malformed state)
      // - Invalid parse: returns null (fail-closed, callers preserve last-known-good)
      const result = yDocToEcson(yDoc);

      if (result === null) {
        // Fail-closed: schema validation rejected the empty doc
        expect(result).toBeNull();
      } else {
        // Schema accepted with defaults: verify it's a valid SceneDocument
        const parsed = SceneDocumentSchema.safeParse(result);
        expect(parsed.success).toBe(true);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Two-Client Sync Tests (via Y.applyUpdate)
// ---------------------------------------------------------------------------

describe("Two-Client Sync", () => {
  it("propagates entity changes from client A to client B", () => {
    const doc = makeTestDoc();

    // Client A initializes
    const docA = new Y.Doc();
    initializeYDoc(docA, doc);

    // Client B receives A's state
    const docB = new Y.Doc();
    syncDocs(docA, docB);

    // Verify B has same content
    const resultB = expectValidEcson(docB);
    expect(resultB.entities["child-a"].name).toBe("Child A");

    // Client A renames an entity
    docA.transact(() => {
      const yEntities = docA.getMap("entities");
      const yChild = yEntities.get("child-a") as Y.Map<unknown>;
      yChild.set("name", "Alice-renamed");
    });

    // Sync A→B
    syncDocs(docA, docB);

    const afterSync = expectValidEcson(docB);
    expect(afterSync.entities["child-a"].name).toBe("Alice-renamed");
  });

  it("merges concurrent edits to different entities (no conflict)", () => {
    const doc = makeTestDoc();

    const docA = new Y.Doc();
    initializeYDoc(docA, doc);

    const docB = new Y.Doc();
    syncDocs(docA, docB);

    // A edits child-a, B edits child-b (concurrent, no conflict)
    docA.transact(() => {
      const yEntities = docA.getMap("entities");
      const yChild = yEntities.get("child-a") as Y.Map<unknown>;
      yChild.set("name", "A-edit");
    });

    docB.transact(() => {
      const yEntities = docB.getMap("entities");
      const yChild = yEntities.get("child-b") as Y.Map<unknown>;
      yChild.set("name", "B-edit");
    });

    // Sync both directions
    syncDocs(docA, docB);

    // Both should have both edits
    const resultA = expectValidEcson(docA);
    const resultB = expectValidEcson(docB);

    expect(resultA.entities["child-a"].name).toBe("A-edit");
    expect(resultA.entities["child-b"].name).toBe("B-edit");
    expect(resultB.entities["child-a"].name).toBe("A-edit");
    expect(resultB.entities["child-b"].name).toBe("B-edit");
  });

  it("resolves concurrent edits to same property (LWW)", () => {
    const doc = makeTestDoc();

    const docA = new Y.Doc();
    initializeYDoc(docA, doc);

    const docB = new Y.Doc();
    syncDocs(docA, docB);

    // Both edit same property concurrently
    docA.transact(() => {
      const yEntities = docA.getMap("entities");
      const yChild = yEntities.get("child-a") as Y.Map<unknown>;
      yChild.set("name", "A-wins-maybe");
    });

    docB.transact(() => {
      const yEntities = docB.getMap("entities");
      const yChild = yEntities.get("child-a") as Y.Map<unknown>;
      yChild.set("name", "B-wins-maybe");
    });

    syncDocs(docA, docB);

    // After sync, both docs must agree (LWW resolution)
    const resultA = expectValidEcson(docA);
    const resultB = expectValidEcson(docB);

    expect(resultA.entities["child-a"].name).toBe(
      resultB.entities["child-a"].name,
    );
  });

  it("propagates wiring changes between clients", () => {
    const doc = makeTestDoc();

    const docA = new Y.Doc();
    initializeYDoc(docA, doc);

    const docB = new Y.Doc();
    syncDocs(docA, docB);

    // A adds a wiring entry
    docA.transact(() => {
      const yWiring = docA.getArray("wiring");
      yWiring.push([{
        id: "wir-from-a",
        sourceEntityId: "root",
        sourceEvent: "onStart",
        targetEntityId: "child-b",
        targetAction: "enable",
      }]);
    });

    syncDocs(docA, docB);

    const resultB = expectValidEcson(docB);
    expect(resultB.wiring).toHaveLength(2);
    expect(resultB.wiring.some((w) => w.id === "wir-from-a")).toBe(true);
  });

  it("propagates environment changes between clients", () => {
    const doc = makeTestDoc();

    const docA = new Y.Doc();
    initializeYDoc(docA, doc);

    const docB = new Y.Doc();
    syncDocs(docA, docB);

    // A changes environment
    docA.transact(() => {
      const yEnv = docA.getMap("environment");
      yEnv.set("ambientLight", { color: "#ffffff", intensity: 1.0 });
    });

    syncDocs(docA, docB);

    const resultB = expectValidEcson(docB);
    expect(resultB.environment.ambientLight.intensity).toBe(1.0);
    expect(resultB.environment.ambientLight.color).toBe("#ffffff");
  });

  it("simulates reconnect: client B catches up after offline edits", () => {
    const doc = makeTestDoc();

    const docA = new Y.Doc();
    initializeYDoc(docA, doc);

    const docB = new Y.Doc();
    syncDocs(docA, docB);

    // A makes multiple edits while B is "offline"
    docA.transact(() => {
      const yEntities = docA.getMap("entities");
      (yEntities.get("child-a") as Y.Map<unknown>).set("name", "Edit-1");
    });
    docA.transact(() => {
      const yEntities = docA.getMap("entities");
      (yEntities.get("child-a") as Y.Map<unknown>).set("name", "Edit-2");
    });
    docA.transact(() => {
      const yEntities = docA.getMap("entities");
      (yEntities.get("child-b") as Y.Map<unknown>).set("name", "Also-edited");
    });

    // B comes back online and syncs
    syncDocs(docA, docB);

    const resultB = expectValidEcson(docB);
    expect(resultB.entities["child-a"].name).toBe("Edit-2");
    expect(resultB.entities["child-b"].name).toBe("Also-edited");
  });
});

// ---------------------------------------------------------------------------
// Persistence Round-Trip Tests
// ---------------------------------------------------------------------------

describe("Persistence Round-Trip", () => {
  it("Y.Doc state survives encode/decode cycle", () => {
    const doc = makeTestDoc();
    const yDoc = new Y.Doc();
    initializeYDoc(yDoc, doc);

    // Simulate persistence: encode to binary, create new doc, apply update
    const state = Y.encodeStateAsUpdate(yDoc);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, state);

    const result = expectValidEcson(restored);
    expect(result.id).toBe("proj-test");
    expect(result.wiring).toHaveLength(1);
    expect(result.wiring[0].id).toBe("wir-1");
    expect(Object.keys(result.entities)).toHaveLength(4);
    expect(result.environment.ambientLight.intensity).toBe(0.5);
    expect(result.metadata.preferredEngine).toBe("playcanvas");

    yDoc.destroy();
    restored.destroy();
  });

  it("edits persist through encode/decode cycle", () => {
    const doc = makeTestDoc();
    const yDoc = new Y.Doc();
    initializeYDoc(yDoc, doc);

    // Make some edits
    yDoc.transact(() => {
      const yEntities = yDoc.getMap("entities");
      const yChild = yEntities.get("child-a") as Y.Map<unknown>;
      yChild.set("name", "Persisted-Name");
    });

    // Persist and restore
    const state = Y.encodeStateAsUpdate(yDoc);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, state);

    const result = expectValidEcson(restored);
    expect(result.entities["child-a"].name).toBe("Persisted-Name");

    yDoc.destroy();
    restored.destroy();
  });
});

// ---------------------------------------------------------------------------
// Undo Isolation Tests
// ---------------------------------------------------------------------------

describe("Undo Isolation", () => {
  it("Y.UndoManager only undoes local-origin changes", () => {
    const doc = makeTestDoc();
    const yDoc = new Y.Doc();
    initializeYDoc(yDoc, doc);

    const yEntities = yDoc.getMap("entities");

    const undoManager = new Y.UndoManager([yEntities], {
      trackedOrigins: new Set([ORIGIN_LOCAL]),
      captureTimeout: 0,
    });

    // Local edit: rename child-a
    yDoc.transact(() => {
      const yChildA = yEntities.get("child-a") as Y.Map<unknown>;
      yChildA.set("name", "Alice-edit");
    }, ORIGIN_LOCAL);

    // Remote edit: rename child-b
    yDoc.transact(() => {
      const yChildB = yEntities.get("child-b") as Y.Map<unknown>;
      yChildB.set("name", "Bob-edit");
    }, "remote-client");

    // Verify both changes applied
    let result = expectValidEcson(yDoc);
    expect(result.entities["child-a"].name).toBe("Alice-edit");
    expect(result.entities["child-b"].name).toBe("Bob-edit");

    // Undo should only revert the local edit (child-a)
    undoManager.undo();
    result = expectValidEcson(yDoc);
    expect(result.entities["child-a"].name).toBe("Child A");
    expect(result.entities["child-b"].name).toBe("Bob-edit");

    undoManager.destroy();
  });

  it("redo restores local changes without affecting remote changes", () => {
    const doc = makeTestDoc();
    const yDoc = new Y.Doc();
    initializeYDoc(yDoc, doc);

    const yEntities = yDoc.getMap("entities");

    const undoManager = new Y.UndoManager([yEntities], {
      trackedOrigins: new Set([ORIGIN_LOCAL]),
      captureTimeout: 0,
    });

    yDoc.transact(() => {
      const yChildA = yEntities.get("child-a") as Y.Map<unknown>;
      yChildA.set("name", "Local-edit");
    }, ORIGIN_LOCAL);

    undoManager.undo();
    let result = expectValidEcson(yDoc);
    expect(result.entities["child-a"].name).toBe("Child A");

    undoManager.redo();
    result = expectValidEcson(yDoc);
    expect(result.entities["child-a"].name).toBe("Local-edit");

    undoManager.destroy();
  });

  it("two-client undo isolation: A undo does not affect B edits", () => {
    const doc = makeTestDoc();

    // Both clients start with same state
    const docA = new Y.Doc();
    initializeYDoc(docA, doc);
    const docB = new Y.Doc();
    syncDocs(docA, docB);

    const yEntitiesA = docA.getMap("entities");
    const yEntitiesB = docB.getMap("entities");

    const ORIGIN_A = "client-a";
    const ORIGIN_B = "client-b";

    const undoA = new Y.UndoManager([yEntitiesA], {
      trackedOrigins: new Set([ORIGIN_A]),
      captureTimeout: 0,
    });

    // A edits child-a
    docA.transact(() => {
      (yEntitiesA.get("child-a") as Y.Map<unknown>).set("name", "A-edit");
    }, ORIGIN_A);

    // B edits child-b
    docB.transact(() => {
      (yEntitiesB.get("child-b") as Y.Map<unknown>).set("name", "B-edit");
    }, ORIGIN_B);

    // Sync
    syncDocs(docA, docB);

    // A undoes their edit
    undoA.undo();

    // Sync again
    syncDocs(docA, docB);

    // A's edit reverted, B's edit preserved
    const resultA = expectValidEcson(docA);
    const resultB = expectValidEcson(docB);

    expect(resultA.entities["child-a"].name).toBe("Child A");
    expect(resultA.entities["child-b"].name).toBe("B-edit");
    expect(resultB.entities["child-a"].name).toBe("Child A");
    expect(resultB.entities["child-b"].name).toBe("B-edit");

    undoA.destroy();
    docA.destroy();
    docB.destroy();
  });
});

// ---------------------------------------------------------------------------
// Lock Manager Tests
// ---------------------------------------------------------------------------

describe("Lock Manager", () => {
  it("acquires a lock on an entity", () => {
    const doc = makeTestDoc();
    const [alice] = createMockAwareness();

    const result = acquireLock("child-a", doc, alice);
    expect(result.success).toBe(true);
  });

  it("blocks lock acquisition when entity is locked by another user", () => {
    const doc = makeTestDoc();
    const [alice, bob] = createMockAwareness();

    const aliceResult = acquireLock("child-a", doc, alice);
    expect(aliceResult.success).toBe(true);

    const bobResult = acquireLock("child-a", doc, bob);
    expect(bobResult.success).toBe(false);
    expect(bobResult.holder?.name).toBe("Alice");
  });

  it("hierarchical lock propagation: locks descendants", () => {
    const doc = makeTestDoc();
    const [alice, bob] = createMockAwareness();

    acquireLock("child-a", doc, alice);

    const bobResult = acquireLock("grandchild", doc, bob);
    expect(bobResult.success).toBe(false);
  });

  it("ancestor lock blocks descendant lock acquisition", () => {
    const doc = makeTestDoc();
    const [alice, bob] = createMockAwareness();

    acquireLock("root", doc, alice);

    const bobResult = acquireLock("child-a", doc, bob);
    expect(bobResult.success).toBe(false);
  });

  it("releaseLock removes entity and descendant locks", () => {
    const doc = makeTestDoc();
    const [alice, bob] = createMockAwareness();

    acquireLock("child-a", doc, alice);

    const lockInfo = isEntityLocked("grandchild", doc, alice, alice.clientID);
    expect(lockInfo.locked).toBe(true);

    releaseLock("child-a", doc, alice);

    const bobResult = acquireLock("grandchild", doc, bob);
    expect(bobResult.success).toBe(true);
  });

  it("releaseAllLocks clears all locks for a user", () => {
    const doc = makeTestDoc();
    const [alice, bob] = createMockAwareness();

    acquireLock("child-a", doc, alice);
    acquireLock("child-b", doc, alice);

    releaseAllLocks(alice);

    expect(acquireLock("child-a", doc, bob).success).toBe(true);
    expect(acquireLock("child-b", doc, bob).success).toBe(true);
  });

  it("isEntityLocked reports lock state correctly", () => {
    const doc = makeTestDoc();
    const [alice] = createMockAwareness();

    acquireLock("child-a", doc, alice);

    const info = isEntityLocked("grandchild", doc, alice, alice.clientID);
    expect(info.locked).toBe(true);
    expect(info.lockedByMe).toBe(true);
  });

  it("getLockedEntities returns all locked entities", () => {
    const doc = makeTestDoc();
    const [alice] = createMockAwareness();

    acquireLock("child-a", doc, alice);

    const locked = getLockedEntities(alice, alice.clientID);
    expect(locked.has("child-a")).toBe(true);
    expect(locked.has("grandchild")).toBe(true);
    expect(locked.has("child-b")).toBe(false);
  });

  it("independent entities can be locked by different users", () => {
    const doc = makeTestDoc();
    const [alice, bob] = createMockAwareness();

    expect(acquireLock("child-a", doc, alice).success).toBe(true);
    expect(acquireLock("child-b", doc, bob).success).toBe(true);
  });
});
