/**
 * Collaboration tests — verifies sync bridge, lock manager, and undo isolation.
 *
 * Uses headless Y.Docs (no Hocuspocus server needed) to deterministically test:
 * - ECSON ↔ Y.Doc round-trip (entities, assets, environment, wiring, metadata)
 * - Environment sync via __environment__ virtual entityId
 * - Schema validation in yDocToEcson
 * - Lock acquisition, release, and hierarchical propagation
 * - Per-user undo isolation
 *
 * Addresses Codex review finding P5-004 (S1).
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
import {
  acquireLock,
  releaseLock,
  isEntityLocked,
  getLockedEntities,
  releaseAllLocks,
  type AwarenessLike,
} from "../src/collaboration/lock-manager";

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
      const result = yDocToEcson(yDoc);

      expect(Object.keys(result.entities)).toEqual(
        expect.arrayContaining(Object.keys(doc.entities)),
      );
      expect(Object.keys(result.entities).length).toBe(
        Object.keys(doc.entities).length,
      );

      // Verify entity structure preserved
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
      const result = yDocToEcson(yDoc);

      expect(result.assets["ast-1"]).toBeDefined();
      expect(result.assets["ast-1"].name).toBe("wood.png");
      expect(result.assets["ast-1"].uri).toBe("/textures/wood.png");
    });

    it("preserves wiring through Y.Doc round-trip (P5-001)", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();

      initializeYDoc(yDoc, doc);
      const result = yDocToEcson(yDoc);

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
      const result = yDocToEcson(yDoc);

      expect(result.environment.ambientLight.intensity).toBe(0.5);
      expect(result.environment.ambientLight.color).toBe("#334455");
    });

    it("preserves metadata through Y.Doc round-trip", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();

      initializeYDoc(yDoc, doc);
      const result = yDocToEcson(yDoc);

      expect(result.metadata.preferredEngine).toBe("playcanvas");
    });

    it("preserves meta fields through Y.Doc round-trip", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();

      initializeYDoc(yDoc, doc);
      const result = yDocToEcson(yDoc);

      expect(result.id).toBe("proj-test");
      expect(result.name).toBe("Test Project");
      expect(result.schemaVersion).toBe(1);
      expect(result.rootEntityId).toBe("root");
    });

    it("result passes schema validation (P5-003)", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();

      initializeYDoc(yDoc, doc);
      const result = yDocToEcson(yDoc);

      // Should not throw
      const validated = SceneDocumentSchema.parse(result);
      expect(validated.id).toBe(doc.id);
    });
  });

  describe("syncToYDoc", () => {
    it("syncs single entity property changes", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      // Modify entity name in ECSON
      const modified = structuredClone(doc);
      modified.entities["child-a"].name = "Renamed A";

      syncToYDoc(yDoc, modified, "child-a");
      const result = yDocToEcson(yDoc);

      expect(result.entities["child-a"].name).toBe("Renamed A");
      // Other entities unchanged
      expect(result.entities["child-b"].name).toBe("Child B");
    });

    it("syncs environment via __environment__ entityId (P5-002)", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      // Modify environment in ECSON
      const modified = structuredClone(doc);
      modified.environment.ambientLight.intensity = 0.8;

      syncToYDoc(yDoc, modified, "__environment__");
      const result = yDocToEcson(yDoc);

      expect(result.environment.ambientLight.intensity).toBe(0.8);
    });

    it("syncs entity deletion in full-sync mode", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      // Delete entity
      const modified = structuredClone(doc);
      delete modified.entities["child-b"];
      modified.entities["root"].children = ["child-a"];

      syncToYDoc(yDoc, modified);
      const result = yDocToEcson(yDoc);

      expect(result.entities["child-b"]).toBeUndefined();
      expect(result.entities["root"].children).toEqual(["child-a"]);
    });

    it("syncs wiring changes in full-sync mode", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      // Add a second wire
      const modified = structuredClone(doc);
      modified.wiring.push({
        id: "wir-2",
        sourceEntityId: "root",
        sourceEvent: "onLoad",
        targetEntityId: "child-a",
        targetAction: "enable",
      });

      syncToYDoc(yDoc, modified);
      const result = yDocToEcson(yDoc);

      expect(result.wiring).toHaveLength(2);
      expect(result.wiring[1].id).toBe("wir-2");
    });

    it("syncs asset changes in full-sync mode", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      // Add a new asset
      const modified = structuredClone(doc);
      modified.assets["ast-2"] = {
        id: "ast-2",
        type: "mesh" as const,
        name: "cube.glb",
        uri: "/models/cube.glb",
        metadata: {},
      };

      syncToYDoc(yDoc, modified);
      const result = yDocToEcson(yDoc);

      expect(result.assets["ast-2"]).toBeDefined();
      expect(result.assets["ast-2"].name).toBe("cube.glb");
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

      // Simulate a remote change (different origin than ORIGIN_LOCAL)
      yDoc.transact(() => {
        const yEntities = yDoc.getMap("entities");
        const yChildA = yEntities.get("child-a") as Y.Map<unknown>;
        yChildA.set("name", "Remote Rename");
      }, "remote-client-123");

      // Wait for debounce (50ms + margin)
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

      // Local change (ORIGIN_LOCAL)
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

      // Init change
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

      // Simulate remote wiring change
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

  describe("schema validation", () => {
    it("validates well-formed Y.Doc → ECSON", () => {
      const doc = makeTestDoc();
      const yDoc = new Y.Doc();
      initializeYDoc(yDoc, doc);

      const result = yDocToEcson(yDoc);

      // Should be valid
      const parsed = SceneDocumentSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it("handles empty Y.Doc gracefully (returns fallback)", () => {
      const yDoc = new Y.Doc();

      // yDocToEcson on an empty doc should not throw
      const result = yDocToEcson(yDoc);
      expect(result).toBeDefined();
      expect(result.id).toBe("");
    });
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

    // Create undo manager tracking only ORIGIN_LOCAL
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
    let result = yDocToEcson(yDoc);
    expect(result.entities["child-a"].name).toBe("Alice-edit");
    expect(result.entities["child-b"].name).toBe("Bob-edit");

    // Undo should only revert the local edit (child-a), not the remote edit (child-b)
    undoManager.undo();
    result = yDocToEcson(yDoc);
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

    // Local edit
    yDoc.transact(() => {
      const yChildA = yEntities.get("child-a") as Y.Map<unknown>;
      yChildA.set("name", "Local-edit");
    }, ORIGIN_LOCAL);

    // Undo then redo
    undoManager.undo();
    let result = yDocToEcson(yDoc);
    expect(result.entities["child-a"].name).toBe("Child A");

    undoManager.redo();
    result = yDocToEcson(yDoc);
    expect(result.entities["child-a"].name).toBe("Local-edit");

    undoManager.destroy();
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

    // Alice locks child-a
    const aliceResult = acquireLock("child-a", doc, alice);
    expect(aliceResult.success).toBe(true);

    // Bob tries to lock same entity — should fail
    const bobResult = acquireLock("child-a", doc, bob);
    expect(bobResult.success).toBe(false);
    expect(bobResult.holder?.name).toBe("Alice");
  });

  it("hierarchical lock propagation: locks descendants", () => {
    const doc = makeTestDoc();
    const [alice, bob] = createMockAwareness();

    // Alice locks child-a (which has grandchild)
    acquireLock("child-a", doc, alice);

    // Bob tries to lock grandchild — should fail (inherited)
    const bobResult = acquireLock("grandchild", doc, bob);
    expect(bobResult.success).toBe(false);
  });

  it("ancestor lock blocks descendant lock acquisition", () => {
    const doc = makeTestDoc();
    const [alice, bob] = createMockAwareness();

    // Alice locks root
    acquireLock("root", doc, alice);

    // Bob tries to lock child-a — should fail (ancestor locked)
    const bobResult = acquireLock("child-a", doc, bob);
    expect(bobResult.success).toBe(false);
  });

  it("releaseLock removes entity and descendant locks", () => {
    const doc = makeTestDoc();
    const [alice, bob] = createMockAwareness();

    acquireLock("child-a", doc, alice);

    // Verify grandchild is also locked
    const lockInfo = isEntityLocked("grandchild", doc, alice, alice.clientID);
    expect(lockInfo.locked).toBe(true);

    // Release child-a
    releaseLock("child-a", doc, alice);

    // Now Bob can lock grandchild
    const bobResult = acquireLock("grandchild", doc, bob);
    expect(bobResult.success).toBe(true);
  });

  it("releaseAllLocks clears all locks for a user", () => {
    const doc = makeTestDoc();
    const [alice, bob] = createMockAwareness();

    acquireLock("child-a", doc, alice);
    acquireLock("child-b", doc, alice);

    releaseAllLocks(alice);

    // Bob can now lock both
    expect(acquireLock("child-a", doc, bob).success).toBe(true);
    expect(acquireLock("child-b", doc, bob).success).toBe(true);
  });

  it("isEntityLocked reports inherited locks correctly", () => {
    const doc = makeTestDoc();
    const [alice] = createMockAwareness();

    acquireLock("child-a", doc, alice);

    const info = isEntityLocked("grandchild", doc, alice, alice.clientID);
    expect(info.locked).toBe(true);
    expect(info.lockedByMe).toBe(true);
    // grandchild is directly locked (included in lock propagation), not inherited
    // The direct lock is set by acquireLock which adds descendants
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

    // Alice locks child-a, Bob locks child-b (siblings, independent)
    expect(acquireLock("child-a", doc, alice).success).toBe(true);
    expect(acquireLock("child-b", doc, bob).success).toBe(true);
  });
});
