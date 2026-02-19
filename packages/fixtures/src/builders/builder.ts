import {
  SceneDocumentSchema,
  CURRENT_SCHEMA_VERSION,
  type SceneDocument,
  type Entity,
  type AssetEntry,
  type EventWire,
  type Transform,
  type AssetType,
  type EnvironmentSettings,
  type GameSettings,
} from "@riff3d/ecson";

// ---------------------------------------------------------------------------
// Deterministic ID generation
// ---------------------------------------------------------------------------

/**
 * Create a deterministic ID generator for test reproducibility.
 * Uses a simple counter with a seed prefix to produce predictable IDs.
 */
export function createDeterministicIdGenerator(seed: string): () => string {
  let counter = 0;
  return () => {
    counter++;
    const raw = `${seed}_${String(counter).padStart(4, "0")}`;
    // Pad or truncate to 16 characters for entity IDs
    return raw.slice(0, 16).padEnd(16, "0");
  };
}

/**
 * Create a deterministic asset ID generator (prefixed with ast_).
 */
export function createDeterministicAssetIdGenerator(
  seed: string,
): () => string {
  let counter = 0;
  return () => {
    counter++;
    return `ast_${seed}${String(counter).padStart(4, "0")}`;
  };
}

/**
 * Create a deterministic wire ID generator (prefixed with wir_).
 */
export function createDeterministicWireIdGenerator(
  seed: string,
): () => string {
  let counter = 0;
  return () => {
    counter++;
    return `wir_${seed}${String(counter).padStart(4, "0")}`;
  };
}

// ---------------------------------------------------------------------------
// EntityBuilder
// ---------------------------------------------------------------------------

export class EntityBuilder {
  private readonly _scene: SceneBuilder;
  private readonly _id: string;
  private readonly _name: string;
  private readonly _parentId: string | null;
  private _tags: string[] = [];
  private _transform: Transform = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  };
  private readonly _components: Array<{
    type: string;
    properties: Record<string, unknown>;
    tuning?: Record<string, Record<string, unknown>>;
  }> = [];
  private _tuning?: Record<string, Record<string, unknown>>;
  private _visible = true;
  private _locked = false;
  private readonly _childBuilders: EntityBuilder[] = [];

  constructor(
    scene: SceneBuilder,
    id: string,
    name: string,
    parentId: string | null,
    opts?: { tags?: string[] },
  ) {
    this._scene = scene;
    this._id = id;
    this._name = name;
    this._parentId = parentId;
    if (opts?.tags) {
      this._tags = [...opts.tags];
    }
  }

  addComponent(
    type: string,
    properties?: Record<string, unknown>,
  ): this {
    this._components.push({
      type,
      properties: properties ?? {},
    });
    return this;
  }

  addComponentWithTuning(
    type: string,
    properties: Record<string, unknown>,
    tuning: Record<string, Record<string, unknown>>,
  ): this {
    this._components.push({
      type,
      properties,
      tuning,
    });
    return this;
  }

  setTransform(transform: Partial<Transform>): this {
    if (transform.position) {
      this._transform.position = { ...this._transform.position, ...transform.position };
    }
    if (transform.rotation) {
      this._transform.rotation = { ...this._transform.rotation, ...transform.rotation };
    }
    if (transform.scale) {
      this._transform.scale = { ...this._transform.scale, ...transform.scale };
    }
    return this;
  }

  setTags(tags: string[]): this {
    this._tags = [...tags];
    return this;
  }

  setTuning(
    engine: string,
    properties: Record<string, unknown>,
  ): this {
    if (!this._tuning) {
      this._tuning = {};
    }
    this._tuning[engine] = properties;
    return this;
  }

  setVisible(visible: boolean): this {
    this._visible = visible;
    return this;
  }

  setLocked(locked: boolean): this {
    this._locked = locked;
    return this;
  }

  addChild(name: string, opts?: { tags?: string[] }): EntityBuilder {
    const childId = this._scene._generateEntityId();
    const child = new EntityBuilder(
      this._scene,
      childId,
      name,
      this._id,
      opts,
    );
    this._childBuilders.push(child);
    return child;
  }

  done(): SceneBuilder {
    return this._scene;
  }

  getId(): string {
    return this._id;
  }

  /**
   * Flatten this entity and all descendants into an entity map.
   * Returns [entityMap, childIds] where childIds is the direct children of this entity.
   */
  _flatten(): [Record<string, Entity>, string[]] {
    const entities: Record<string, Entity> = {};
    const childIds: string[] = [];

    // Process children
    for (const childBuilder of this._childBuilders) {
      const [childEntities, grandchildIds] = childBuilder._flatten();
      Object.assign(entities, childEntities);

      // The child entity itself
      const childEntity: Entity = {
        id: childBuilder._id,
        name: childBuilder._name,
        parentId: this._id,
        children: grandchildIds,
        components: childBuilder._components.map((c) => {
          const comp: { type: string; properties: Record<string, unknown>; tuning?: Record<string, Record<string, unknown>> } = {
            type: c.type,
            properties: { ...c.properties },
          };
          if (c.tuning) {
            comp.tuning = c.tuning;
          }
          return comp;
        }),
        tags: [...childBuilder._tags],
        transform: JSON.parse(JSON.stringify(childBuilder._transform)) as Transform,
        visible: childBuilder._visible,
        locked: childBuilder._locked,
      };

      if (childBuilder._tuning) {
        childEntity.tuning = childBuilder._tuning;
      }

      entities[childBuilder._id] = childEntity;
      childIds.push(childBuilder._id);
    }

    return [entities, childIds];
  }
}

// ---------------------------------------------------------------------------
// SceneBuilder
// ---------------------------------------------------------------------------

export class SceneBuilder {
  private readonly _name: string;
  private readonly _docId: string;
  private readonly _rootId: string;
  private readonly _rootChildBuilders: EntityBuilder[] = [];
  private readonly _assets: Record<string, AssetEntry> = {};
  private readonly _wires: EventWire[] = [];
  private _environment: Partial<EnvironmentSettings> = {};
  private _gameSettings?: Partial<GameSettings>;
  private _rootTags: string[] = [];
  private _rootComponents: Array<{
    type: string;
    properties: Record<string, unknown>;
  }> = [];
  private _rootTuning?: Record<string, Record<string, unknown>>;

  /** @internal */
  readonly _entityIdGen: () => string;
  private readonly _assetIdGen: () => string;
  private readonly _wireIdGen: () => string;

  private constructor(name: string, seed: string) {
    this._name = name;
    this._entityIdGen = createDeterministicIdGenerator(seed);
    this._assetIdGen = createDeterministicAssetIdGenerator(seed);
    this._wireIdGen = createDeterministicWireIdGenerator(seed);
    this._docId = this._entityIdGen();
    this._rootId = this._entityIdGen();
  }

  static create(name: string, seed?: string): SceneBuilder {
    return new SceneBuilder(name, seed ?? name.toLowerCase().replace(/\s+/g, ""));
  }

  /** @internal */
  _generateEntityId(): string {
    return this._entityIdGen();
  }

  getRootId(): string {
    return this._rootId;
  }

  addEntity(name: string, opts?: { tags?: string[] }): EntityBuilder {
    const entityId = this._entityIdGen();
    const builder = new EntityBuilder(this, entityId, name, this._rootId, opts);
    this._rootChildBuilders.push(builder);
    return builder;
  }

  addAsset(type: AssetType, name: string, opts?: { uri?: string; data?: unknown }): string {
    const id = this._assetIdGen();
    this._assets[id] = {
      id,
      type,
      name,
      metadata: {},
      ...(opts?.uri !== undefined ? { uri: opts.uri } : {}),
      ...(opts?.data !== undefined ? { data: opts.data } : {}),
    };
    return id;
  }

  addWire(wire: {
    sourceEntityId: string;
    sourceEvent: string;
    targetEntityId: string;
    targetAction: string;
    parameters?: Record<string, unknown>;
  }): this {
    const id = this._wireIdGen();
    const eventWire: EventWire = {
      id,
      sourceEntityId: wire.sourceEntityId,
      sourceEvent: wire.sourceEvent,
      targetEntityId: wire.targetEntityId,
      targetAction: wire.targetAction,
    };
    if (wire.parameters) {
      eventWire.parameters = wire.parameters;
    }
    this._wires.push(eventWire);
    return this;
  }

  setEnvironment(env: Partial<EnvironmentSettings>): this {
    this._environment = { ...this._environment, ...env };
    return this;
  }

  setGameSettings(settings: Partial<GameSettings>): this {
    this._gameSettings = { ...this._gameSettings, ...settings };
    return this;
  }

  setRootTags(tags: string[]): this {
    this._rootTags = [...tags];
    return this;
  }

  addRootComponent(
    type: string,
    properties?: Record<string, unknown>,
  ): this {
    this._rootComponents.push({
      type,
      properties: properties ?? {},
    });
    return this;
  }

  setRootTuning(
    engine: string,
    properties: Record<string, unknown>,
  ): this {
    if (!this._rootTuning) {
      this._rootTuning = {};
    }
    this._rootTuning[engine] = properties;
    return this;
  }

  /**
   * Build the SceneDocument. Validates with Zod, throws on invalid.
   *
   * Internally tracks the tree structure via EntityBuilders
   * and flattens on build to produce ECSON's flat entity record format.
   */
  build(): SceneDocument {
    // Flatten all entity builders into a flat entity map
    const entities: Record<string, Entity> = {};
    const rootChildIds: string[] = [];

    for (const childBuilder of this._rootChildBuilders) {
      const [childEntities, grandchildIds] = childBuilder._flatten();
      Object.assign(entities, childEntities);

      // Build the child entity itself
      const childEntity: Entity = {
        id: childBuilder.getId(),
        name: (childBuilder as unknown as { _name: string })._name,
        parentId: this._rootId,
        children: grandchildIds,
        components: (
          childBuilder as unknown as {
            _components: Array<{
              type: string;
              properties: Record<string, unknown>;
              tuning?: Record<string, Record<string, unknown>>;
            }>;
          }
        )._components.map((c) => {
          const comp: { type: string; properties: Record<string, unknown>; tuning?: Record<string, Record<string, unknown>> } = {
            type: c.type,
            properties: { ...c.properties },
          };
          if (c.tuning) {
            comp.tuning = c.tuning;
          }
          return comp;
        }),
        tags: [...(childBuilder as unknown as { _tags: string[] })._tags],
        transform: JSON.parse(
          JSON.stringify((childBuilder as unknown as { _transform: Transform })._transform),
        ) as Transform,
        visible: (childBuilder as unknown as { _visible: boolean })._visible,
        locked: (childBuilder as unknown as { _locked: boolean })._locked,
      };

      const tuning = (childBuilder as unknown as { _tuning?: Record<string, Record<string, unknown>> })._tuning;
      if (tuning) {
        childEntity.tuning = tuning;
      }

      entities[childBuilder.getId()] = childEntity;
      rootChildIds.push(childBuilder.getId());
    }

    // Build root entity
    const rootEntity: Entity = {
      id: this._rootId,
      name: "Root",
      parentId: null,
      children: rootChildIds,
      components: this._rootComponents.map((c) => ({
        type: c.type,
        properties: { ...c.properties },
      })),
      tags: [...this._rootTags],
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      visible: true,
      locked: false,
    };

    if (this._rootTuning) {
      rootEntity.tuning = this._rootTuning;
    }

    entities[this._rootId] = rootEntity;

    // Build the doc
    const raw = {
      id: this._docId,
      name: this._name,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      rootEntityId: this._rootId,
      entities,
      assets: this._assets,
      wiring: this._wires,
      environment: this._environment,
      gameSettings: this._gameSettings,
      metadata: {},
    };

    // Validate with Zod -- throws on invalid
    return SceneDocumentSchema.parse(raw);
  }
}
