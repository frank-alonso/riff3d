import { describe, it, expect } from "vitest";
import {
  createEmptyDocument,
  createEntity,
  SceneDocumentSchema,
  EntitySchema,
  type SceneDocument,
  type Entity,
} from "@riff3d/ecson";
import { compile } from "../src/compiler.js";
import { decompile } from "../src/decompiler.js";

// ---------------------------------------------------------------------------
// Normalization for comparison
// ---------------------------------------------------------------------------

/**
 * Normalize a SceneDocument for stable comparison.
 * - Sort entity keys
 * - Sort component arrays by type
 * - Sort asset keys
 * - Sort wiring by id
 * - Convert to sorted JSON for deep equality
 */
function normalize(doc: SceneDocument): string {
  const sortedEntities: Record<string, unknown> = {};
  for (const key of Object.keys(doc.entities).sort()) {
    const entity = doc.entities[key];
    sortedEntities[key] = {
      ...entity,
      children: [...entity.children].sort(),
      components: [...entity.components].sort((a, b) =>
        a.type.localeCompare(b.type),
      ),
    };
  }

  const sortedAssets: Record<string, unknown> = {};
  for (const key of Object.keys(doc.assets).sort()) {
    sortedAssets[key] = doc.assets[key];
  }

  const sortedWiring = [...doc.wiring].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  const normalized = {
    id: doc.id,
    name: doc.name,
    schemaVersion: doc.schemaVersion,
    rootEntityId: doc.rootEntityId,
    entities: sortedEntities,
    assets: sortedAssets,
    wiring: sortedWiring,
    environment: doc.environment,
    gameSettings: doc.gameSettings,
    metadata: doc.metadata,
  };

  return JSON.stringify(normalized, null, 0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function addEntityToDoc(
  doc: SceneDocument,
  entity: Entity,
  parentId: string,
): SceneDocument {
  const updatedEntities = { ...doc.entities };
  updatedEntities[entity.id] = { ...entity, parentId };

  const parent = updatedEntities[parentId];
  if (parent) {
    updatedEntities[parentId] = {
      ...parent,
      children: [...parent.children, entity.id],
    };
  }

  return SceneDocumentSchema.parse({
    ...doc,
    entities: updatedEntities,
  });
}

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------
describe("round-trip: ECSON -> compile -> decompile -> compare", () => {
  it("round-trips empty document", () => {
    const original = createEmptyDocument("Empty");
    const roundTripped = decompile(compile(original));

    expect(normalize(roundTripped)).toBe(normalize(original));
  });

  it("round-trips single entity", () => {
    let doc = createEmptyDocument("Single");
    const rootId = doc.rootEntityId;

    const entity = EntitySchema.parse({
      id: "entity-1",
      name: "Box",
      parentId: rootId,
      transform: {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 2, y: 2, z: 2 },
      },
      visible: true,
    });

    doc = addEntityToDoc(doc, entity, rootId);

    const roundTripped = decompile(compile(doc));
    expect(normalize(roundTripped)).toBe(normalize(doc));
  });

  it("round-trips nested hierarchy", () => {
    let doc = createEmptyDocument("Hierarchy");
    const rootId = doc.rootEntityId;

    const child1 = createEntity("Child1", rootId);
    doc = addEntityToDoc(doc, child1, rootId);

    const child2 = createEntity("Child2", rootId);
    doc = addEntityToDoc(doc, child2, rootId);

    const grandchild = createEntity("Grandchild", child1.id);
    doc = addEntityToDoc(doc, grandchild, child1.id);

    const greatGrandchild = createEntity("GreatGrandchild", grandchild.id);
    doc = addEntityToDoc(doc, greatGrandchild, grandchild.id);

    const roundTripped = decompile(compile(doc));
    expect(normalize(roundTripped)).toBe(normalize(doc));
  });

  it("round-trips entity with multiple components", () => {
    let doc = createEmptyDocument("Components");
    const rootId = doc.rootEntityId;

    const entity = EntitySchema.parse({
      id: "multi-component",
      name: "Player",
      parentId: rootId,
      components: [
        { type: "MeshRenderer", properties: { meshAssetId: "ast_mesh1" } },
        { type: "RigidBody", properties: { bodyType: "dynamic", mass: 10 } },
        { type: "Collider", properties: { shapeType: "capsule", radius: 0.5 } },
        { type: "AudioSource", properties: { volume: 0.7, spatial: true } },
      ],
    });

    doc = addEntityToDoc(doc, entity, rootId);

    const roundTripped = decompile(compile(doc));
    expect(normalize(roundTripped)).toBe(normalize(doc));
  });

  it("round-trips entity with engine tuning", () => {
    let doc = createEmptyDocument("Tuning");
    const rootId = doc.rootEntityId;

    const entity = EntitySchema.parse({
      id: "tuned",
      name: "TunedEntity",
      parentId: rootId,
      tuning: {
        playcanvas: { castShadows: true, batchGroupId: 5 },
        babylon: { billboardMode: 7 },
      },
    });

    doc = addEntityToDoc(doc, entity, rootId);

    const roundTripped = decompile(compile(doc));
    expect(normalize(roundTripped)).toBe(normalize(doc));
  });

  it("round-trips full document with assets and wiring", () => {
    let doc = createEmptyDocument("Full");
    const rootId = doc.rootEntityId;

    const entity1 = EntitySchema.parse({
      id: "entity-1",
      name: "Platform",
      parentId: rootId,
      components: [
        { type: "MeshRenderer", properties: { meshAssetId: "ast_001" } },
        { type: "Collider", properties: { shapeType: "box", size: { x: 10, y: 1, z: 10 } } },
      ],
    });

    const entity2 = EntitySchema.parse({
      id: "entity-2",
      name: "ScoreZone",
      parentId: rootId,
      components: [
        { type: "Collider", properties: { shapeType: "box", isTrigger: true } },
      ],
    });

    doc = addEntityToDoc(doc, entity1, rootId);
    doc = addEntityToDoc(doc, entity2, rootId);

    doc = SceneDocumentSchema.parse({
      ...doc,
      assets: {
        ast_001: {
          id: "ast_001",
          type: "mesh",
          name: "PlatformMesh",
          uri: "https://example.com/platform.glb",
        },
        ast_002: {
          id: "ast_002",
          type: "audio",
          name: "ScoreSound",
          uri: "https://example.com/score.ogg",
        },
      },
      wiring: [
        {
          id: "wir_001",
          sourceEntityId: "entity-2",
          sourceEvent: "onTriggerEnter",
          targetEntityId: "entity-1",
          targetAction: "addScore",
          parameters: { points: 100 },
        },
      ],
    });

    const roundTripped = decompile(compile(doc));
    expect(normalize(roundTripped)).toBe(normalize(doc));
  });

  it("round-trips document with custom environment", () => {
    let doc = createEmptyDocument("CustomEnv");

    doc = SceneDocumentSchema.parse({
      ...doc,
      environment: {
        skybox: { type: "hdri", uri: "https://example.com/sky.hdr" },
        fog: {
          enabled: true,
          type: "exponential2",
          color: "#aabbcc",
          near: 1,
          far: 200,
          density: 0.02,
        },
        ambientLight: { color: "#112233", intensity: 0.3 },
        gravity: { x: 0, y: -20, z: 0 },
      },
    });

    const roundTripped = decompile(compile(doc));
    expect(normalize(roundTripped)).toBe(normalize(doc));
  });

  it("round-trips document with game settings", () => {
    let doc = createEmptyDocument("GameSettings");

    doc = SceneDocumentSchema.parse({
      ...doc,
      gameSettings: {
        maxPlayers: 16,
        roundDuration: 300,
        respawnEnabled: false,
        respawnDelay: 5,
      },
    });

    const roundTripped = decompile(compile(doc));
    expect(normalize(roundTripped)).toBe(normalize(doc));
  });
});
