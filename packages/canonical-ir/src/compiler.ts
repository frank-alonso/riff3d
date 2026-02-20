import {
  SceneDocumentSchema,
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
} from "./types/index";

// ---------------------------------------------------------------------------
// Compiler: ECSON SceneDocument -> Canonical IR
// ---------------------------------------------------------------------------

/**
 * Compile an ECSON SceneDocument into a Canonical IR CanonicalScene.
 *
 * The compiler:
 * 1. Validates input with SceneDocumentSchema
 * 2. Topologically sorts entities (parents before children)
 * 3. Bakes all defaults into explicit values
 * 4. Normalizes optional fields to required (nullable where appropriate)
 * 5. Builds nodeIndex for O(1) lookup
 * 6. Validates output with CanonicalSceneSchema
 *
 * @throws {ZodError} If input is not a valid SceneDocument
 */
export function compile(doc: SceneDocument): CanonicalScene {
  // Validate input
  const validated = SceneDocumentSchema.parse(doc);

  // Topologically sort entities (BFS from root)
  const sortedEntities = topologicalSort(validated);

  // Build nodes array and index
  const nodes: CanonicalNode[] = [];
  const nodeIndex: Record<string, number> = {};

  for (const entity of sortedEntities) {
    const idx = nodes.length;
    nodeIndex[entity.id] = idx;
    nodes.push(compileNode(entity));
  }

  // Compile assets
  const assets = compileAssets(validated.assets);

  // Compile wires
  const wires = compileWires(validated.wiring);

  // Compile environment (bake defaults)
  const environment = compileEnvironment(validated.environment);

  // Compile game settings
  const gameSettings = compileGameSettings(validated.gameSettings);

  // Build and validate the result
  const result: CanonicalScene = CanonicalSceneSchema.parse({
    id: validated.id,
    name: validated.name,
    sourceSchemaVersion: validated.schemaVersion,
    nodes,
    nodeIndex,
    rootNodeId: validated.rootEntityId,
    assets,
    wires,
    environment,
    gameSettings,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Topological Sort
// ---------------------------------------------------------------------------

/**
 * BFS from root entity, producing parents before children.
 */
function topologicalSort(doc: SceneDocument): Entity[] {
  const sorted: Entity[] = [];
  const queue: string[] = [doc.rootEntityId];

  while (queue.length > 0) {
    const entityId = queue.shift()!;
    const entity = doc.entities[entityId];

    if (!entity) continue;

    sorted.push(entity);

    // Enqueue children in order
    for (const childId of entity.children) {
      queue.push(childId);
    }
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Node Compilation
// ---------------------------------------------------------------------------

function compileNode(entity: Entity): CanonicalNode {
  const node: CanonicalNode = {
    id: entity.id,
    name: entity.name,
    parentId: entity.parentId,
    childIds: [...entity.children],
    transform: {
      position: {
        x: entity.transform.position.x,
        y: entity.transform.position.y,
        z: entity.transform.position.z,
      },
      rotation: {
        x: entity.transform.rotation.x,
        y: entity.transform.rotation.y,
        z: entity.transform.rotation.z,
        w: entity.transform.rotation.w,
      },
      scale: {
        x: entity.transform.scale.x,
        y: entity.transform.scale.y,
        z: entity.transform.scale.z,
      },
    },
    components: entity.components.map(compileComponent),
    visible: entity.visible,
  };

  // Preserve tuning if present
  if (entity.tuning !== undefined) {
    node.tuning = entity.tuning;
  }

  return node;
}

function compileComponent(comp: ComponentInstance): CanonicalComponent {
  return {
    type: comp.type,
    properties: { ...comp.properties },
  };
}

// ---------------------------------------------------------------------------
// Asset Compilation
// ---------------------------------------------------------------------------

function compileAssets(
  assets: Record<string, AssetEntry>,
): CanonicalAsset[] {
  return Object.values(assets).map((asset) => ({
    id: asset.id,
    type: asset.type,
    name: asset.name,
    uri: asset.uri ?? null,
    data: asset.data ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Wire Compilation
// ---------------------------------------------------------------------------

function compileWires(wires: EventWire[]): CanonicalWire[] {
  return wires.map((wire) => ({
    id: wire.id,
    sourceNodeId: wire.sourceEntityId,
    sourceEvent: wire.sourceEvent,
    targetNodeId: wire.targetEntityId,
    targetAction: wire.targetAction,
    parameters: wire.parameters ?? {},
  }));
}

// ---------------------------------------------------------------------------
// Environment Compilation
// ---------------------------------------------------------------------------

function compileEnvironment(env: EnvironmentSettings): CanonicalEnvironment {
  return {
    skybox: {
      type: env.skybox.type,
      color: env.skybox.color ?? null,
      uri: env.skybox.uri ?? null,
    },
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
// Game Settings Compilation
// ---------------------------------------------------------------------------

function compileGameSettings(
  settings: GameSettings | undefined,
): Record<string, unknown> | null {
  if (!settings) return null;

  // Flatten GameSettings to a plain record for IR
  return {
    maxPlayers: settings.maxPlayers,
    roundDuration: settings.roundDuration,
    respawnEnabled: settings.respawnEnabled,
    respawnDelay: settings.respawnDelay,
  };
}
