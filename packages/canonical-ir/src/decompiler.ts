import {
  SceneDocumentSchema,
  CURRENT_SCHEMA_VERSION,
  type SceneDocument,
  type Entity,
  type ComponentInstance,
  type AssetEntry,
  type EventWire,
  type EnvironmentSettings,
  type GameSettings,
} from "@riff3d/ecson";
import {
  CanonicalSceneSchema,
  type CanonicalScene,
  type CanonicalNode,
  type CanonicalComponent,
  type CanonicalAsset,
  type CanonicalWire,
  type CanonicalEnvironment,
} from "./types/index.js";

// ---------------------------------------------------------------------------
// Decompiler: Canonical IR -> ECSON SceneDocument
// ---------------------------------------------------------------------------

/**
 * Decompile a Canonical IR CanonicalScene back into an ECSON SceneDocument.
 *
 * The decompiler:
 * 1. Validates input with CanonicalSceneSchema
 * 2. Converts the flat node array back to an entity record
 * 3. Restores parent/child relationships
 * 4. Converts IR components back to ECSON ComponentInstances
 * 5. Converts IR assets, wires, environment back to ECSON format
 * 6. Sets schemaVersion to CURRENT_SCHEMA_VERSION
 * 7. Validates output with SceneDocumentSchema
 *
 * @throws {ZodError} If input is not a valid CanonicalScene
 */
export function decompile(ir: CanonicalScene): SceneDocument {
  // Validate input
  const validated = CanonicalSceneSchema.parse(ir);

  // Convert nodes to entity record
  const entities = decompileNodes(validated.nodes);

  // Convert assets
  const assets = decompileAssets(validated.assets);

  // Convert wires
  const wiring = decompileWires(validated.wires);

  // Convert environment
  const environment = decompileEnvironment(validated.environment);

  // Convert game settings
  const gameSettings = decompileGameSettings(validated.gameSettings);

  // Build and validate the result
  const doc: SceneDocument = SceneDocumentSchema.parse({
    id: validated.id,
    name: validated.name,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rootEntityId: validated.rootNodeId,
    entities,
    assets,
    wiring,
    environment,
    gameSettings,
  });

  return doc;
}

// ---------------------------------------------------------------------------
// Node Decompilation
// ---------------------------------------------------------------------------

function decompileNodes(
  nodes: CanonicalNode[],
): Record<string, Entity> {
  const entities: Record<string, Entity> = {};

  for (const node of nodes) {
    const entity: Entity = {
      id: node.id,
      name: node.name,
      parentId: node.parentId,
      children: [...node.childIds],
      components: node.components.map(decompileComponent),
      tags: [],
      transform: {
        position: { ...node.transform.position },
        rotation: { ...node.transform.rotation },
        scale: { ...node.transform.scale },
      },
      visible: node.visible,
      locked: false,
    };

    // Restore tuning if present
    if (node.tuning !== undefined) {
      entity.tuning = node.tuning;
    }

    entities[node.id] = entity;
  }

  return entities;
}

function decompileComponent(comp: CanonicalComponent): ComponentInstance {
  return {
    type: comp.type,
    properties: { ...comp.properties },
  };
}

// ---------------------------------------------------------------------------
// Asset Decompilation
// ---------------------------------------------------------------------------

function decompileAssets(
  assets: CanonicalAsset[],
): Record<string, AssetEntry> {
  const record: Record<string, AssetEntry> = {};

  for (const asset of assets) {
    const entry: AssetEntry = {
      id: asset.id,
      type: asset.type as AssetEntry["type"],
      name: asset.name,
      metadata: {},
    };

    // Restore optional fields
    if (asset.uri !== null) {
      entry.uri = asset.uri;
    }
    if (asset.data !== null) {
      entry.data = asset.data;
    }

    record[asset.id] = entry;
  }

  return record;
}

// ---------------------------------------------------------------------------
// Wire Decompilation
// ---------------------------------------------------------------------------

function decompileWires(wires: CanonicalWire[]): EventWire[] {
  return wires.map((wire) => {
    const eventWire: EventWire = {
      id: wire.id,
      sourceEntityId: wire.sourceNodeId,
      sourceEvent: wire.sourceEvent,
      targetEntityId: wire.targetNodeId,
      targetAction: wire.targetAction,
    };

    // Only include parameters if non-empty
    if (Object.keys(wire.parameters).length > 0) {
      eventWire.parameters = { ...wire.parameters };
    }

    return eventWire;
  });
}

// ---------------------------------------------------------------------------
// Environment Decompilation
// ---------------------------------------------------------------------------

function decompileEnvironment(
  env: CanonicalEnvironment,
): EnvironmentSettings {
  const skybox: EnvironmentSettings["skybox"] = {
    type: env.skybox.type,
  };

  if (env.skybox.color !== null) {
    skybox.color = env.skybox.color;
  }
  if (env.skybox.uri !== null) {
    skybox.uri = env.skybox.uri;
  }

  return {
    skybox,
    fog: {
      enabled: env.fog.enabled,
      type: env.fog.type,
      color: env.fog.color,
      near: env.fog.near,
      far: env.fog.far,
      density: env.fog.density,
    },
    ambientLight: {
      color: env.ambientLight.color,
      intensity: env.ambientLight.intensity,
    },
    gravity: {
      x: env.gravity.x,
      y: env.gravity.y,
      z: env.gravity.z,
    },
  };
}

// ---------------------------------------------------------------------------
// Game Settings Decompilation
// ---------------------------------------------------------------------------

function decompileGameSettings(
  settings: Record<string, unknown> | null,
): GameSettings | undefined {
  if (settings === null) return undefined;

  return {
    maxPlayers: settings["maxPlayers"] as number,
    roundDuration: settings["roundDuration"] as number,
    respawnEnabled: settings["respawnEnabled"] as boolean,
    respawnDelay: settings["respawnDelay"] as number,
  };
}
