/**
 * Stress Test: 4-Client Collaboration
 *
 * Validates the core platform under load with headless Y.Docs:
 * - 4 concurrent clients editing a 200-entity scene
 * - Convergence after full sync
 * - Concurrent edits to SAME entity (LWW per property)
 * - Rapid sequential edits preserved across sync
 * - Network partition simulation and recovery
 * - Shape version consistency across clients
 * - 200-entity scene compiles to Canonical IR
 *
 * These are deterministic headless tests (no rendering, no server).
 * Should complete in under 10 seconds total.
 */
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import {
  initializeYDoc,
  yDocToEcson,
  COLLAB_SHAPE_VERSION,
} from "../src/collaboration/sync-bridge";
import { compile } from "@riff3d/canonical-ir";
import {
  build200EntityScene,
  syncDocs,
  syncAll,
  docsConverged,
} from "./stress-test-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create 4 Y.Doc clients. Client 0 initializes from the 200-entity scene,
 * then syncs state to clients 1-3.
 */
function create4Clients() {
  const scene = build200EntityScene();
  const docs = [new Y.Doc(), new Y.Doc(), new Y.Doc(), new Y.Doc()];

  // Client 0 initializes
  initializeYDoc(docs[0]!, scene);

  // Sync to clients 1-3
  for (let i = 1; i < 4; i++) {
    syncDocs(docs[0]!, docs[i]!);
  }

  return { scene, docs };
}

/** Rename an entity in a Y.Doc by setting its name in the entities Y.Map. */
function renameEntity(doc: Y.Doc, entityId: string, newName: string): void {
  doc.transact(() => {
    const yEntities = doc.getMap("entities");
    const yEntity = yEntities.get(entityId) as Y.Map<unknown>;
    if (yEntity) {
      yEntity.set("name", newName);
    }
  });
}

/** Set a nested property on an entity in a Y.Doc. */
function setEntityProperty(
  doc: Y.Doc,
  entityId: string,
  key: string,
  value: unknown,
): void {
  doc.transact(() => {
    const yEntities = doc.getMap("entities");
    const yEntity = yEntities.get(entityId) as Y.Map<unknown>;
    if (yEntity) {
      yEntity.set(key, value);
    }
  });
}

// ---------------------------------------------------------------------------
// Stress Tests
// ---------------------------------------------------------------------------

describe("Stress Test: 4-Client Collaboration", () => {
  it("200-entity scene builder produces valid scene with 201 entities", () => {
    const scene = build200EntityScene();
    const entityCount = Object.keys(scene.entities).length;

    // 50 mesh + 30 light + 20 camera + 50 group (10 parents + 40 children) + 50 multi + 1 root
    expect(entityCount).toBe(201);
    expect(scene.rootEntityId).toBe("root");
    expect(scene.entities["root"]).toBeDefined();

    // Verify entity prefixes
    expect(scene.entities["mesh-0"]).toBeDefined();
    expect(scene.entities["mesh-49"]).toBeDefined();
    expect(scene.entities["light-0"]).toBeDefined();
    expect(scene.entities["light-29"]).toBeDefined();
    expect(scene.entities["cam-0"]).toBeDefined();
    expect(scene.entities["cam-19"]).toBeDefined();
    expect(scene.entities["grp-0"]).toBeDefined();
    expect(scene.entities["grp-9"]).toBeDefined();
    expect(scene.entities["grp-10"]).toBeDefined();
    expect(scene.entities["grp-49"]).toBeDefined();
    expect(scene.entities["multi-0"]).toBeDefined();
    expect(scene.entities["multi-49"]).toBeDefined();
  });

  it("4 clients editing 200-entity scene converge to consistent state", () => {
    const { docs } = create4Clients();

    // Verify all 4 clients start with 201 entities
    for (const doc of docs) {
      const ecson = yDocToEcson(doc);
      expect(ecson).not.toBeNull();
      expect(Object.keys(ecson!.entities).length).toBe(201);
    }

    // Each client edits a disjoint subset
    // Client 0: mesh entities (mesh-0 to mesh-49)
    for (let i = 0; i < 50; i++) {
      renameEntity(docs[0]!, `mesh-${i}`, `Client0-mesh-${i}`);
    }

    // Client 1: light entities (light-0 to light-29)
    for (let i = 0; i < 30; i++) {
      renameEntity(docs[1]!, `light-${i}`, `Client1-light-${i}`);
    }

    // Client 2: camera entities (cam-0 to cam-19)
    for (let i = 0; i < 20; i++) {
      renameEntity(docs[2]!, `cam-${i}`, `Client2-cam-${i}`);
    }

    // Client 3: multi-component entities (multi-0 to multi-49)
    for (let i = 0; i < 50; i++) {
      renameEntity(docs[3]!, `multi-${i}`, `Client3-multi-${i}`);
    }

    // Sync all
    syncAll(docs);

    // Assert convergence
    expect(docsConverged(docs)).toBe(true);

    // Spot-check specific renames in all 4 docs
    for (const doc of docs) {
      const ecson = yDocToEcson(doc)!;
      expect(Object.keys(ecson.entities).length).toBe(201);
      expect(ecson.entities["mesh-0"]!.name).toBe("Client0-mesh-0");
      expect(ecson.entities["light-15"]!.name).toBe("Client1-light-15");
      expect(ecson.entities["cam-10"]!.name).toBe("Client2-cam-10");
      expect(ecson.entities["multi-25"]!.name).toBe("Client3-multi-25");
    }

    // Cleanup
    for (const doc of docs) doc.destroy();
  });

  it("concurrent edits to SAME entity converge via LWW per property", () => {
    const { docs } = create4Clients();

    // All 4 clients edit the same entity (mesh-0) on DIFFERENT properties
    // Client 0: changes name
    renameEntity(docs[0]!, "mesh-0", "SharedEdit-Name");

    // Client 1: changes a component property (position.x via transform)
    setEntityProperty(docs[1]!, "mesh-0", "transform", {
      position: { x: 99, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    });

    // Client 2: changes components (swap material color)
    setEntityProperty(docs[2]!, "mesh-0", "components", [
      {
        type: "MeshRenderer",
        properties: { primitive: "box", castShadows: true, receiveShadows: true },
      },
      {
        type: "Material",
        properties: { baseColor: "#ff0000", roughness: 0.5, metallic: 0 },
      },
    ]);

    // Client 3: changes tags
    setEntityProperty(docs[3]!, "mesh-0", "tags", [
      "edited-by-client3",
      "stress-test",
    ]);

    // Sync all
    syncAll(docs);

    // All 4 docs should converge
    expect(docsConverged(docs)).toBe(true);

    // Verify all edits survive (different Y.Map keys => all preserved)
    const ecson = yDocToEcson(docs[0]!)!;
    const mesh0 = ecson.entities["mesh-0"]!;

    // Name from Client 0
    expect(mesh0.name).toBe("SharedEdit-Name");

    // Transform from Client 1
    expect(mesh0.transform.position.x).toBe(99);

    // Tags from Client 3
    expect(mesh0.tags).toContain("edited-by-client3");
    expect(mesh0.tags).toContain("stress-test");

    // Components from Client 2
    const materialComp = mesh0.components.find(
      (c) => c.type === "Material",
    );
    expect(materialComp).toBeDefined();
    expect(materialComp!.properties.baseColor).toBe("#ff0000");

    // Cleanup
    for (const doc of docs) doc.destroy();
  });

  it("rapid sequential edits from single client preserved", () => {
    const { docs } = create4Clients();

    // Client 0 makes 100 rapid sequential edits without intermediate sync
    for (let i = 0; i < 100; i++) {
      const entityId = i < 50 ? `mesh-${i}` : `multi-${i - 50}`;
      renameEntity(docs[0]!, entityId, `Rapid-${i}`);
    }

    // Sync all
    syncAll(docs);

    // Assert all 100 renames visible in all 4 docs
    expect(docsConverged(docs)).toBe(true);

    for (const doc of docs) {
      const ecson = yDocToEcson(doc)!;
      for (let i = 0; i < 50; i++) {
        expect(ecson.entities[`mesh-${i}`]!.name).toBe(`Rapid-${i}`);
      }
      for (let i = 0; i < 50; i++) {
        expect(ecson.entities[`multi-${i}`]!.name).toBe(`Rapid-${i + 50}`);
      }
    }

    // Cleanup
    for (const doc of docs) doc.destroy();
  });

  it("network partition: delayed sync still converges", () => {
    const { docs } = create4Clients();

    // Partition A: clients 0 and 1 edit independently
    renameEntity(docs[0]!, "mesh-0", "Partition-A-Client0");
    renameEntity(docs[1]!, "mesh-1", "Partition-A-Client1");

    // Partition B: clients 2 and 3 edit independently
    renameEntity(docs[2]!, "mesh-2", "Partition-B-Client2");
    renameEntity(docs[3]!, "mesh-3", "Partition-B-Client3");

    // Phase 1: Sync within partitions only
    syncDocs(docs[0]!, docs[1]!); // A partition
    syncDocs(docs[2]!, docs[3]!); // B partition

    // Verify partitions have their own edits but NOT cross-partition
    const ecsonA0 = yDocToEcson(docs[0]!)!;
    expect(ecsonA0.entities["mesh-0"]!.name).toBe("Partition-A-Client0");
    expect(ecsonA0.entities["mesh-1"]!.name).toBe("Partition-A-Client1");
    expect(ecsonA0.entities["mesh-2"]!.name).toBe("Mesh 2"); // Not yet synced

    const ecsonB2 = yDocToEcson(docs[2]!)!;
    expect(ecsonB2.entities["mesh-2"]!.name).toBe("Partition-B-Client2");
    expect(ecsonB2.entities["mesh-3"]!.name).toBe("Partition-B-Client3");
    expect(ecsonB2.entities["mesh-0"]!.name).toBe("Mesh 0"); // Not yet synced

    // Phase 2: Cross-partition sync (simulating network recovery)
    syncAll(docs);

    // All 4 docs should converge with ALL edits
    expect(docsConverged(docs)).toBe(true);

    for (const doc of docs) {
      const ecson = yDocToEcson(doc)!;
      expect(ecson.entities["mesh-0"]!.name).toBe("Partition-A-Client0");
      expect(ecson.entities["mesh-1"]!.name).toBe("Partition-A-Client1");
      expect(ecson.entities["mesh-2"]!.name).toBe("Partition-B-Client2");
      expect(ecson.entities["mesh-3"]!.name).toBe("Partition-B-Client3");
    }

    // Cleanup
    for (const doc of docs) doc.destroy();
  });

  it("Y.Doc shape version preserved through 4-client sync", () => {
    const { docs } = create4Clients();

    // Verify _shapeVersion is present in all 4 docs
    for (let i = 0; i < docs.length; i++) {
      const yMeta = docs[i]!.getMap("meta");
      const shapeVersion = yMeta.get("_shapeVersion");
      expect(shapeVersion).toBe(COLLAB_SHAPE_VERSION);
    }

    // Make edits and sync again
    renameEntity(docs[0]!, "mesh-0", "VersionCheck");
    syncAll(docs);

    // Shape version still preserved after sync
    for (let i = 0; i < docs.length; i++) {
      const yMeta = docs[i]!.getMap("meta");
      const shapeVersion = yMeta.get("_shapeVersion");
      expect(shapeVersion).toBe(COLLAB_SHAPE_VERSION);
    }

    // Cleanup
    for (const doc of docs) doc.destroy();
  });

  it("200-entity scene compiles to Canonical IR without error", () => {
    const scene = build200EntityScene();

    // Compile to Canonical IR
    const ir = compile(scene);

    // Assert compilation succeeded
    expect(ir).toBeDefined();
    expect(ir.nodes).toBeDefined();
    expect(ir.nodes.length).toBe(201); // 200 entities + root
    expect(ir.nodeIndex).toBeDefined();

    // Verify key nodes exist in IR
    expect(ir.nodeIndex["root"]).toBeDefined();
    expect(ir.nodeIndex["mesh-0"]).toBeDefined();
    expect(ir.nodeIndex["light-0"]).toBeDefined();
    expect(ir.nodeIndex["cam-0"]).toBeDefined();
    expect(ir.nodeIndex["grp-0"]).toBeDefined();
    expect(ir.nodeIndex["multi-0"]).toBeDefined();

    // Verify IR nodes have expected structure
    const meshNode = ir.nodes[ir.nodeIndex["mesh-0"]!]!;
    expect(meshNode.id).toBe("mesh-0");
    expect(meshNode.components.length).toBeGreaterThan(0);
  });
});
