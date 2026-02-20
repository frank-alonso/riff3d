import type { SceneDocument, Entity, ComponentInstance, AssetEntry } from "@riff3d/ecson";
import { generateOpId } from "@riff3d/ecson";
import { CURRENT_PATCHOP_VERSION } from "./version.js";
import { validateOp } from "./validation.js";
import type { PatchOp } from "./schemas.js";

// ─── Deep clone utility (ES2022 doesn't have deepClone) ────

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ─── Path utilities ──────────────────────────────────────────────

/**
 * Get a value at a dot-separated path from an object.
 * Returns undefined if path doesn't exist.
 */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Set a value at a dot-separated path on an object (mutating).
 */
function setByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (current[key] === undefined || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1]!;
  current[lastKey] = value;
}

// ─── Keyframe helpers ────────────────────────────────────────────

interface Keyframe {
  time: number;
  value: unknown;
}

interface Track {
  keyframes: Keyframe[];
}

interface AnimationTracks {
  [trackId: string]: Track;
}

function getAnimationComponent(entity: Entity): ComponentInstance | undefined {
  return entity.components.find((c) => c.type === "Animation");
}

function getTracksRecord(anim: ComponentInstance): AnimationTracks {
  const tracks = anim.properties["tracks"];
  if (tracks === undefined || tracks === null || typeof tracks !== "object") {
    anim.properties["tracks"] = {};
  }
  return anim.properties["tracks"] as AnimationTracks;
}

// ─── Inverse builder ─────────────────────────────────────────────

function makeInverse(type: string, payload: Record<string, unknown>): PatchOp {
  return {
    id: generateOpId(),
    timestamp: Date.now(),
    origin: "replay",
    version: CURRENT_PATCHOP_VERSION,
    type,
    payload,
  } as PatchOp;
}

// ─── Engine ──────────────────────────────────────────────────────

/**
 * Apply a single PatchOp to a SceneDocument (mutating in place).
 * Returns the inverse operation (for undo/redo).
 *
 * @throws Error if validation fails.
 */
export function applyOp(doc: SceneDocument, op: PatchOp): PatchOp {
  const validation = validateOp(doc, op);
  if (!validation.valid) {
    throw new Error(`PatchOp validation failed: ${validation.error}`);
  }

  switch (op.type) {
    case "CreateEntity":
      return applyCreateEntity(doc, op);
    case "DeleteEntity":
      return applyDeleteEntity(doc, op);
    case "SetProperty":
      return applySetProperty(doc, op);
    case "AddChild":
      return applyAddChild(doc, op);
    case "RemoveChild":
      return applyRemoveChild(doc, op);
    case "Reparent":
      return applyReparent(doc, op);
    case "AddComponent":
      return applyAddComponent(doc, op);
    case "RemoveComponent":
      return applyRemoveComponent(doc, op);
    case "SetComponentProperty":
      return applySetComponentProperty(doc, op);
    case "AddAsset":
      return applyAddAsset(doc, op);
    case "RemoveAsset":
      return applyRemoveAsset(doc, op);
    case "ReplaceAssetRef":
      return applyReplaceAssetRef(doc, op);
    case "AddKeyframe":
      return applyAddKeyframe(doc, op);
    case "RemoveKeyframe":
      return applyRemoveKeyframe(doc, op);
    case "SetKeyframeValue":
      return applySetKeyframeValue(doc, op);
    case "BatchOp":
      return applyBatchOp(doc, op);
    default: {
      const _exhaustive: never = op;
      throw new Error(`Unknown op type: ${(op as PatchOp).type}`);
    }
  }
}

/**
 * Apply a sequence of PatchOps. Returns the array of inverse operations
 * (one per input op, in the same order).
 */
export function applyOps(doc: SceneDocument, ops: PatchOp[]): PatchOp[] {
  const inverses: PatchOp[] = [];
  for (const op of ops) {
    inverses.push(applyOp(doc, op));
  }
  return inverses;
}

// ─── Per-op handlers ─────────────────────────────────────────────

function applyCreateEntity(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "CreateEntity" }>,
): PatchOp {
  const { entityId, name, parentId, transform, tags } = op.payload;

  const newEntity: Entity = {
    id: entityId,
    name,
    parentId: parentId ?? null,
    children: [],
    components: [],
    tags: tags ?? [],
    transform: transform ?? {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    visible: true,
    locked: false,
  };

  doc.entities[entityId] = newEntity;

  // Add to parent's children
  if (parentId !== null && parentId !== undefined) {
    const parent = doc.entities[parentId];
    if (parent !== undefined) {
      parent.children.push(entityId);
    }
  }

  return makeInverse("DeleteEntity", {
    entityId,
    previousState: deepClone(newEntity),
  });
}

function applyDeleteEntity(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "DeleteEntity" }>,
): PatchOp {
  const { entityId } = op.payload;
  const entity = doc.entities[entityId]!;
  const capturedState = deepClone(entity);

  // Remove from parent's children
  if (entity.parentId !== null) {
    const parent = doc.entities[entity.parentId];
    if (parent !== undefined) {
      const idx = parent.children.indexOf(entityId);
      if (idx !== -1) {
        parent.children.splice(idx, 1);
      }
    }
  }

  delete doc.entities[entityId];

  // Build the inverse: CreateEntity + AddComponent for each component the entity had
  const createInverse = makeInverse("CreateEntity", {
    entityId: capturedState.id,
    name: capturedState.name,
    parentId: capturedState.parentId,
    transform: capturedState.transform,
    tags: capturedState.tags,
  });

  if (capturedState.components.length === 0) {
    return createInverse;
  }

  // Entity had components -- produce a BatchOp that recreates and re-adds them
  const subOps: PatchOp[] = [createInverse];
  for (const comp of capturedState.components) {
    subOps.push(
      makeInverse("AddComponent", {
        entityId: capturedState.id,
        component: deepClone(comp),
      }),
    );
  }

  return makeInverse("BatchOp", { ops: subOps });
}

function applySetProperty(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "SetProperty" }>,
): PatchOp {
  const { entityId, path, value, previousValue: _previousValue } = op.payload;
  const entity = doc.entities[entityId]!;

  const actualPrevious = getByPath(entity as unknown as Record<string, unknown>, path);
  setByPath(entity as unknown as Record<string, unknown>, path, value);

  return makeInverse("SetProperty", {
    entityId,
    path,
    value: actualPrevious,
    previousValue: value,
  });
}

function applyAddChild(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "AddChild" }>,
): PatchOp {
  const { parentId, childId, index } = op.payload;
  const parent = doc.entities[parentId]!;

  if (index !== undefined) {
    parent.children.splice(index, 0, childId);
  } else {
    parent.children.push(childId);
  }

  const insertedIndex = parent.children.indexOf(childId);

  return makeInverse("RemoveChild", {
    parentId,
    childId,
    previousIndex: insertedIndex,
  });
}

function applyRemoveChild(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "RemoveChild" }>,
): PatchOp {
  const { parentId, childId, previousIndex } = op.payload;
  const parent = doc.entities[parentId]!;

  const idx = parent.children.indexOf(childId);
  if (idx !== -1) {
    parent.children.splice(idx, 1);
  }

  return makeInverse("AddChild", {
    parentId,
    childId,
    index: previousIndex,
  });
}

function applyReparent(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "Reparent" }>,
): PatchOp {
  const { entityId, newParentId, oldParentId, oldIndex, newIndex } = op.payload;
  const entity = doc.entities[entityId]!;

  // Remove from old parent
  if (oldParentId !== null) {
    const oldParent = doc.entities[oldParentId];
    if (oldParent !== undefined) {
      const idx = oldParent.children.indexOf(entityId);
      if (idx !== -1) {
        oldParent.children.splice(idx, 1);
      }
    }
  }

  // Add to new parent
  if (newParentId !== null) {
    const newParent = doc.entities[newParentId];
    if (newParent !== undefined) {
      if (newIndex !== undefined) {
        newParent.children.splice(newIndex, 0, entityId);
      } else {
        newParent.children.push(entityId);
      }
    }
  }

  // Update entity's parentId
  entity.parentId = newParentId;

  // Compute the new index for the inverse
  let actualNewIndex = 0;
  if (newParentId !== null) {
    const newParent = doc.entities[newParentId];
    if (newParent !== undefined) {
      actualNewIndex = newParent.children.indexOf(entityId);
    }
  }

  return makeInverse("Reparent", {
    entityId,
    newParentId: oldParentId,
    oldParentId: newParentId,
    oldIndex: actualNewIndex,
    newIndex: oldIndex,
  });
}

function applyAddComponent(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "AddComponent" }>,
): PatchOp {
  const { entityId, component } = op.payload;
  const entity = doc.entities[entityId]!;

  entity.components.push(component as ComponentInstance);

  return makeInverse("RemoveComponent", {
    entityId,
    componentType: component.type,
    previousComponent: deepClone(component),
  });
}

function applyRemoveComponent(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "RemoveComponent" }>,
): PatchOp {
  const { entityId, componentType, previousComponent } = op.payload;
  const entity = doc.entities[entityId]!;

  const idx = entity.components.findIndex((c) => c.type === componentType);
  if (idx !== -1) {
    entity.components.splice(idx, 1);
  }

  return makeInverse("AddComponent", {
    entityId,
    component: deepClone(previousComponent),
  });
}

function applySetComponentProperty(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "SetComponentProperty" }>,
): PatchOp {
  const { entityId, componentType, propertyPath, value, previousValue: _previousValue } =
    op.payload;
  const entity = doc.entities[entityId]!;
  const comp = entity.components.find((c) => c.type === componentType);

  if (comp === undefined) {
    throw new Error(
      `Component '${componentType}' not found on entity '${entityId}'`,
    );
  }

  const actualPrev = getByPath(comp.properties, propertyPath);
  setByPath(comp.properties, propertyPath, value);

  return makeInverse("SetComponentProperty", {
    entityId,
    componentType,
    propertyPath,
    value: actualPrev,
    previousValue: value,
  });
}

function applyAddAsset(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "AddAsset" }>,
): PatchOp {
  const { asset } = op.payload;
  doc.assets[asset.id] = asset as AssetEntry;

  return makeInverse("RemoveAsset", {
    assetId: asset.id,
    previousAsset: deepClone(asset),
  });
}

function applyRemoveAsset(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "RemoveAsset" }>,
): PatchOp {
  const { assetId, previousAsset } = op.payload;

  delete doc.assets[assetId];

  return makeInverse("AddAsset", {
    asset: deepClone(previousAsset),
  });
}

function applyReplaceAssetRef(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "ReplaceAssetRef" }>,
): PatchOp {
  const { entityId, componentType, propertyPath, newAssetId, oldAssetId } =
    op.payload;
  const entity = doc.entities[entityId]!;
  const comp = entity.components.find((c) => c.type === componentType);

  if (comp === undefined) {
    throw new Error(
      `Component '${componentType}' not found on entity '${entityId}'`,
    );
  }

  setByPath(comp.properties, propertyPath, newAssetId);

  return makeInverse("ReplaceAssetRef", {
    entityId,
    componentType,
    propertyPath,
    newAssetId: oldAssetId,
    oldAssetId: newAssetId,
  });
}

function applyAddKeyframe(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "AddKeyframe" }>,
): PatchOp {
  const { entityId, trackId, time, value } = op.payload;
  const entity = doc.entities[entityId]!;
  const anim = getAnimationComponent(entity);

  if (anim === undefined) {
    throw new Error(`Animation component not found on entity '${entityId}'`);
  }

  const tracks = getTracksRecord(anim);
  if (tracks[trackId] === undefined) {
    tracks[trackId] = { keyframes: [] };
  }
  tracks[trackId]!.keyframes.push({ time, value });

  return makeInverse("RemoveKeyframe", {
    entityId,
    trackId,
    time,
    previousValue: value,
  });
}

function applyRemoveKeyframe(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "RemoveKeyframe" }>,
): PatchOp {
  const { entityId, trackId, time, previousValue } = op.payload;
  const entity = doc.entities[entityId]!;
  const anim = getAnimationComponent(entity);

  if (anim === undefined) {
    throw new Error(`Animation component not found on entity '${entityId}'`);
  }

  const tracks = getTracksRecord(anim);
  const track = tracks[trackId];
  if (track !== undefined) {
    const idx = track.keyframes.findIndex((kf) => kf.time === time);
    if (idx !== -1) {
      track.keyframes.splice(idx, 1);
    }
  }

  // Remove empty track
  if (track !== undefined && track.keyframes.length === 0) {
    delete tracks[trackId];
  }

  return makeInverse("AddKeyframe", {
    entityId,
    trackId,
    time,
    value: previousValue,
  });
}

function applySetKeyframeValue(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "SetKeyframeValue" }>,
): PatchOp {
  const { entityId, trackId, time, value, previousValue } = op.payload;
  const entity = doc.entities[entityId]!;
  const anim = getAnimationComponent(entity);

  if (anim === undefined) {
    throw new Error(`Animation component not found on entity '${entityId}'`);
  }

  const tracks = getTracksRecord(anim);
  const track = tracks[trackId];
  if (track !== undefined) {
    const kf = track.keyframes.find((k) => k.time === time);
    if (kf !== undefined) {
      kf.value = value;
    }
  }

  return makeInverse("SetKeyframeValue", {
    entityId,
    trackId,
    time,
    value: previousValue,
    previousValue: value,
  });
}

function applyBatchOp(
  doc: SceneDocument,
  op: Extract<PatchOp, { type: "BatchOp" }>,
): PatchOp {
  const subInverses: PatchOp[] = [];
  for (const subOp of op.payload.ops) {
    subInverses.push(applyOp(doc, subOp));
  }

  // Reverse the inverses so that undoing a batch applies sub-inverses in reverse order
  return makeInverse("BatchOp", {
    ops: subInverses.reverse(),
  });
}
