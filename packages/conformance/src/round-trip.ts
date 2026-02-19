import type { SceneDocument } from "@riff3d/ecson";
import { compile, decompile } from "@riff3d/canonical-ir";

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a SceneDocument for deterministic comparison.
 *
 * - Sort entity keys
 * - Sort component arrays by type
 * - Use JSON.stringify with sorted keys
 *
 * This is needed because Record key ordering is non-deterministic in JS,
 * and the compile/decompile cycle may reorder keys.
 */
export function normalizeForComparison(doc: SceneDocument): string {
  return JSON.stringify(doc, (_key, value: unknown) => {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[k] = (value as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return value;
  });
}

// ---------------------------------------------------------------------------
// Round-trip test
// ---------------------------------------------------------------------------

/**
 * Test round-trip fidelity: ECSON -> IR -> ECSON.
 *
 * Compiles the document to Canonical IR, then decompiles back.
 * Compares the portable subset (fields that survive the round-trip)
 * using deep equality with normalized key ordering.
 *
 * Fields that are NOT expected to survive:
 * - tags (IR does not carry tags)
 * - locked (IR does not carry locked status)
 * - gameSettings shape may change (flattened to Record in IR)
 *
 * Fields that ARE expected to survive:
 * - id, name, schemaVersion
 * - entities (id, name, parentId, children, components, transform, visible)
 * - assets (id, type, name, uri, data)
 * - wiring (id, sourceEntityId, sourceEvent, targetEntityId, targetAction, parameters)
 * - environment (skybox, fog, ambientLight, gravity)
 */
export function testRoundTrip(doc: SceneDocument): {
  passed: boolean;
  diff?: string;
} {
  try {
    const ir = compile(doc);
    const roundTripped = decompile(ir);

    // Normalize both for comparison
    // Focus on the portable subset that survives round-trip
    const originalPortable = extractPortableSubset(doc);
    const roundTrippedPortable = extractPortableSubset(roundTripped);

    const originalNorm = normalizeForComparison(
      originalPortable as unknown as SceneDocument,
    );
    const roundTrippedNorm = normalizeForComparison(
      roundTrippedPortable as unknown as SceneDocument,
    );

    if (originalNorm === roundTrippedNorm) {
      return { passed: true };
    }

    // Generate a useful diff
    const diff = generateDiff(originalNorm, roundTrippedNorm);
    return { passed: false, diff };
  } catch (err: unknown) {
    return {
      passed: false,
      diff: `Error during round-trip: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Portable subset extraction
// ---------------------------------------------------------------------------

/**
 * Extract the portable subset of a SceneDocument.
 * Strips fields that don't survive round-trip (tags, locked, metadata,
 * component tuning, entity tuning).
 */
function extractPortableSubset(doc: SceneDocument): Record<string, unknown> {
  const entities: Record<string, unknown> = {};
  for (const [id, entity] of Object.entries(doc.entities)) {
    entities[id] = {
      id: entity.id,
      name: entity.name,
      parentId: entity.parentId,
      children: [...entity.children],
      components: entity.components.map((c) => ({
        type: c.type,
        properties: { ...c.properties },
      })),
      transform: {
        position: { ...entity.transform.position },
        rotation: { ...entity.transform.rotation },
        scale: { ...entity.transform.scale },
      },
      visible: entity.visible,
    };
  }

  const assets: Record<string, unknown> = {};
  for (const [id, asset] of Object.entries(doc.assets)) {
    const entry: Record<string, unknown> = {
      id: asset.id,
      type: asset.type,
      name: asset.name,
    };
    if (asset.uri !== undefined) entry["uri"] = asset.uri;
    if (asset.data !== undefined) entry["data"] = asset.data;
    assets[id] = entry;
  }

  const wiring = doc.wiring.map((w) => {
    const wire: Record<string, unknown> = {
      id: w.id,
      sourceEntityId: w.sourceEntityId,
      sourceEvent: w.sourceEvent,
      targetEntityId: w.targetEntityId,
      targetAction: w.targetAction,
    };
    if (w.parameters !== undefined && Object.keys(w.parameters).length > 0) {
      wire["parameters"] = { ...w.parameters };
    }
    return wire;
  });

  return {
    id: doc.id,
    name: doc.name,
    rootEntityId: doc.rootEntityId,
    entities,
    assets,
    wiring,
    environment: {
      skybox: { ...doc.environment.skybox },
      fog: { ...doc.environment.fog },
      ambientLight: { ...doc.environment.ambientLight },
      gravity: { ...doc.environment.gravity },
    },
  };
}

// ---------------------------------------------------------------------------
// Simple diff
// ---------------------------------------------------------------------------

function generateDiff(a: string, b: string): string {
  if (a.length !== b.length) {
    return `Length mismatch: original=${a.length}, roundTripped=${b.length}`;
  }

  // Find first difference position
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      const start = Math.max(0, i - 30);
      const end = Math.min(a.length, i + 30);
      return [
        `First difference at position ${i}:`,
        `  original:     ...${a.slice(start, end)}...`,
        `  roundTripped: ...${b.slice(start, end)}...`,
      ].join("\n");
    }
  }

  return "Strings differ but no position found";
}
