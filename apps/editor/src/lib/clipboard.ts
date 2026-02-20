import type { SceneDocument, Entity } from "@riff3d/ecson";
import type { PatchOp } from "@riff3d/patchops";
import { generateEntityId, generateOpId } from "@riff3d/ecson";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";

/**
 * Clipboard data format for serialized entities.
 * Stored as JSON in the system clipboard and in an internal buffer.
 */
interface ClipboardEntity {
  /** Original entity ID (used for remapping references within the pasted group). */
  originalId: string;
  name: string;
  parentOffset: string | null;
  components: Array<{ type: string; properties: Record<string, unknown> }>;
  transform: Entity["transform"];
  tags: string[];
  visible: boolean;
  locked: boolean;
  /** Original children IDs (for rebuilding hierarchy within pasted group). */
  childrenIds: string[];
}

interface ClipboardData {
  type: "riff3d-entities";
  entities: ClipboardEntity[];
}

/** Internal paste buffer as fallback when clipboard API is unavailable. */
let internalBuffer: string | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────

function makeOp(type: string, payload: Record<string, unknown>): PatchOp {
  return {
    id: generateOpId(),
    timestamp: Date.now(),
    origin: "user",
    version: CURRENT_PATCHOP_VERSION,
    type,
    payload,
  } as PatchOp;
}

/**
 * Recursively collect an entity and all its descendants from the document.
 */
function collectEntityTree(
  entityId: string,
  doc: SceneDocument,
  collected: Map<string, ClipboardEntity>,
  rootIds: Set<string>,
): void {
  const entity = doc.entities[entityId];
  if (!entity || collected.has(entityId)) return;

  collected.set(entityId, {
    originalId: entity.id,
    name: entity.name,
    // parentOffset is relative to the copy set -- null if the entity's parent
    // is not in the copied set (it will be reparented to the paste target)
    parentOffset: entity.parentId && rootIds.has(entity.parentId) ? null : entity.parentId,
    components: entity.components.map((c) => ({
      type: c.type,
      properties: JSON.parse(JSON.stringify(c.properties)) as Record<string, unknown>,
    })),
    transform: JSON.parse(JSON.stringify(entity.transform)) as Entity["transform"],
    tags: [...entity.tags],
    visible: entity.visible,
    locked: entity.locked,
    childrenIds: [...entity.children],
  });

  for (const childId of entity.children) {
    collectEntityTree(childId, doc, collected, rootIds);
  }
}

// ─── Copy ────────────────────────────────────────────────────────────

/**
 * Copy selected entities (and their descendants) to the clipboard.
 * Returns the serialized clipboard data for the internal paste buffer.
 */
export async function copyEntities(
  entityIds: string[],
  ecsonDoc: SceneDocument,
): Promise<string> {
  const rootIds = new Set(entityIds);
  const collected = new Map<string, ClipboardEntity>();

  for (const id of entityIds) {
    collectEntityTree(id, ecsonDoc, collected, rootIds);
  }

  // Fix parentOffset: entities whose parent is within the copied set
  // should store the original parent ID so we can remap it during paste.
  for (const ce of collected.values()) {
    if (ce.originalId !== ce.parentOffset && collected.has(ce.parentOffset ?? "")) {
      // Parent is in the copied set -- keep the reference for remapping
    } else if (!rootIds.has(ce.originalId)) {
      // This is a descendant whose parent is in the copy set
      // parentOffset already points to the original parent
    } else {
      // This is a root-level copied entity -- paste target will be its parent
      ce.parentOffset = null;
    }
  }

  const data: ClipboardData = {
    type: "riff3d-entities",
    entities: Array.from(collected.values()),
  };

  const json = JSON.stringify(data);
  internalBuffer = json;

  try {
    await navigator.clipboard.writeText(json);
  } catch {
    // Clipboard API may fail in non-secure contexts or without focus;
    // the internal buffer will still work.
  }

  return json;
}

// ─── Paste ───────────────────────────────────────────────────────────

/**
 * Generate PatchOps to paste entities from clipboard data.
 * Returns the ops to dispatch (should be wrapped in a BatchOp) and the
 * IDs of the newly created root entities.
 */
export function pasteEntities(
  clipboardJson: string,
  parentId: string,
): { ops: PatchOp[]; newEntityIds: string[] } {
  const data = JSON.parse(clipboardJson) as ClipboardData;
  if (data.type !== "riff3d-entities" || !Array.isArray(data.entities)) {
    return { ops: [], newEntityIds: [] };
  }

  // Build ID remapping: old ID -> new ID
  const idMap = new Map<string, string>();
  for (const ce of data.entities) {
    idMap.set(ce.originalId, generateEntityId());
  }

  const ops: PatchOp[] = [];
  const newRootIds: string[] = [];

  for (const ce of data.entities) {
    const newId = idMap.get(ce.originalId)!;

    // Determine parent: if parentOffset is null, use the paste target.
    // If parentOffset is in the idMap, use the remapped ID.
    let newParentId: string;
    if (ce.parentOffset === null) {
      newParentId = parentId;
      newRootIds.push(newId);
    } else if (idMap.has(ce.parentOffset)) {
      newParentId = idMap.get(ce.parentOffset)!;
    } else {
      newParentId = parentId;
      newRootIds.push(newId);
    }

    // CreateEntity
    ops.push(makeOp("CreateEntity", {
      entityId: newId,
      name: `${ce.name} (Copy)`,
      parentId: newParentId,
      transform: ce.transform,
      tags: ce.tags,
    }));

    // AddComponent for each component
    for (const comp of ce.components) {
      ops.push(makeOp("AddComponent", {
        entityId: newId,
        component: {
          type: comp.type,
          properties: comp.properties,
        },
      }));
    }
  }

  return { ops, newEntityIds: newRootIds };
}

/**
 * Read clipboard data from the system clipboard, falling back to internal buffer.
 */
export async function readClipboard(): Promise<string | null> {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      const parsed = JSON.parse(text) as { type?: string };
      if (parsed.type === "riff3d-entities") return text;
    }
  } catch {
    // Fall back to internal buffer
  }
  return internalBuffer;
}

// ─── Duplicate ───────────────────────────────────────────────────────

/**
 * Duplicate selected entities in-place with a position offset.
 * Returns the ops to dispatch and the IDs of the new entities.
 */
export function duplicateEntities(
  entityIds: string[],
  ecsonDoc: SceneDocument,
): { ops: PatchOp[]; newEntityIds: string[] } {
  const rootIds = new Set(entityIds);
  const collected = new Map<string, ClipboardEntity>();

  for (const id of entityIds) {
    collectEntityTree(id, ecsonDoc, collected, rootIds);
  }

  // Build ID remapping
  const idMap = new Map<string, string>();
  for (const ce of collected.values()) {
    idMap.set(ce.originalId, generateEntityId());
  }

  const ops: PatchOp[] = [];
  const newRootIds: string[] = [];

  for (const ce of collected.values()) {
    const newId = idMap.get(ce.originalId)!;
    const isRoot = rootIds.has(ce.originalId);

    // Determine parent
    let newParentId: string | null;
    if (isRoot) {
      // Duplicate goes under the same parent as the original
      const original = ecsonDoc.entities[ce.originalId];
      newParentId = original?.parentId ?? null;
      newRootIds.push(newId);
    } else if (idMap.has(ecsonDoc.entities[ce.originalId]?.parentId ?? "")) {
      newParentId = idMap.get(ecsonDoc.entities[ce.originalId]!.parentId!)!;
    } else {
      const original = ecsonDoc.entities[ce.originalId];
      newParentId = original?.parentId ?? null;
    }

    // Offset position for root duplicated entities (+0.5 on X)
    const transform = JSON.parse(JSON.stringify(ce.transform)) as Entity["transform"];
    if (isRoot) {
      transform.position.x += 0.5;
    }

    ops.push(makeOp("CreateEntity", {
      entityId: newId,
      name: `${ce.name} (Copy)`,
      parentId: newParentId,
      transform,
      tags: ce.tags,
    }));

    for (const comp of ce.components) {
      ops.push(makeOp("AddComponent", {
        entityId: newId,
        component: {
          type: comp.type,
          properties: JSON.parse(JSON.stringify(comp.properties)) as Record<string, unknown>,
        },
      }));
    }
  }

  return { ops, newEntityIds: newRootIds };
}
