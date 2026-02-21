/**
 * Stress test helpers for 200-entity scene construction, multi-client
 * sync utilities, and convergence validation.
 *
 * Provides:
 * - build200EntityScene(): Programmatic 200-entity ECSON scene
 * - syncDocs(): Bidirectional Y.Doc sync (pair)
 * - syncAll(): Full pairwise sync for N docs
 * - docsConverged(): Convergence check across N docs
 * - measureFps(): FPS measurement helper for Playwright
 */
import * as Y from "yjs";
import {
  SceneDocumentSchema,
  type SceneDocument,
  type ComponentInstance,
} from "@riff3d/ecson";
import { yDocToEcson } from "../src/collaboration/sync-bridge";

// ---------------------------------------------------------------------------
// 200-Entity Scene Builder
// ---------------------------------------------------------------------------

/**
 * Build a 200-entity ECSON scene with diverse component types.
 *
 * Entity breakdown:
 * - 50 mesh entities: Transform + MeshRenderer (box) + Material (varied colors)
 * - 30 light entities: 10 directional, 10 point, 10 spot
 * - 20 camera entities: Perspective projection, varied positions
 * - 50 group entities: 10 parent groups + 40 children (2-level nesting)
 * - 50 multi-component entities: Transform + MeshRenderer + Material + tags
 *
 * All IDs use predictable prefixes: mesh-N, light-N, cam-N, grp-N, multi-N.
 * Returns a validated SceneDocument (passes SceneDocumentSchema.parse).
 */
export function build200EntityScene(): SceneDocument {
  const entities: Record<string, EntityInput> = {};
  const rootChildren: string[] = [];

  // --- 50 mesh entities ---
  for (let i = 0; i < 50; i++) {
    const id = `mesh-${i}`;
    const hue = Math.round((i / 50) * 360);
    rootChildren.push(id);
    entities[id] = {
      id,
      name: `Mesh ${i}`,
      parentId: "root",
      children: [],
      components: [
        {
          type: "MeshRenderer",
          properties: { primitive: "box", castShadows: true, receiveShadows: true },
        },
        {
          type: "Material",
          properties: {
            baseColor: hslToHex(hue, 70, 50),
            roughness: 0.5,
            metallic: 0,
          },
        },
      ],
      tags: [],
      locked: false,
      transform: {
        position: { x: i * 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    };
  }

  // --- 30 light entities (10 directional, 10 point, 10 spot) ---
  const lightTypes: Array<"directional" | "point" | "spot"> = [
    "directional",
    "point",
    "spot",
  ];
  for (let i = 0; i < 30; i++) {
    const id = `light-${i}`;
    const lightType = lightTypes[i % 3]!;
    rootChildren.push(id);
    entities[id] = {
      id,
      name: `Light ${i} (${lightType})`,
      parentId: "root",
      children: [],
      components: [
        {
          type: "Light",
          properties: {
            lightType,
            color: "#ffffff",
            intensity: 0.5 + (i % 10) * 0.1,
            range: 20,
            castShadows: i % 5 === 0,
          },
        },
      ],
      tags: [],
      locked: false,
      transform: {
        position: { x: i * 3, y: 5 + (i % 5), z: -10 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    };
  }

  // --- 20 camera entities ---
  for (let i = 0; i < 20; i++) {
    const id = `cam-${i}`;
    rootChildren.push(id);
    entities[id] = {
      id,
      name: `Camera ${i}`,
      parentId: "root",
      children: [],
      components: [
        {
          type: "Camera",
          properties: {
            projection: "perspective",
            fov: 45 + i * 2,
            nearClip: 0.1,
            farClip: 1000,
          },
        },
      ],
      tags: [],
      locked: false,
      transform: {
        position: { x: i * 5, y: 2, z: 10 + i },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    };
  }

  // --- 50 group entities (10 parent groups + 40 children = 50 total, 2-level nesting) ---
  for (let g = 0; g < 10; g++) {
    const groupId = `grp-${g}`;
    const childIds: string[] = [];

    for (let c = 0; c < 4; c++) {
      const childIndex = g * 4 + c;
      const childId = `grp-${10 + childIndex}`;
      childIds.push(childId);
      entities[childId] = {
        id: childId,
        name: `Group Child ${childIndex}`,
        parentId: groupId,
        children: [],
        components: [],
        tags: [],
        locked: false,
      };
    }

    rootChildren.push(groupId);
    entities[groupId] = {
      id: groupId,
      name: `Group ${g}`,
      parentId: "root",
      children: childIds,
      components: [],
      tags: [],
      locked: false,
    };
  }

  // --- 50 multi-component entities ---
  for (let i = 0; i < 50; i++) {
    const id = `multi-${i}`;
    const hue = Math.round(((i + 25) / 50) * 360) % 360;
    rootChildren.push(id);
    entities[id] = {
      id,
      name: `MultiComp ${i}`,
      parentId: "root",
      children: [],
      components: [
        {
          type: "MeshRenderer",
          properties: {
            primitive: i % 2 === 0 ? "sphere" : "cylinder",
            castShadows: true,
            receiveShadows: true,
          },
        },
        {
          type: "Material",
          properties: {
            baseColor: hslToHex(hue, 60, 55),
            roughness: 0.3 + (i % 5) * 0.1,
            metallic: i % 3 === 0 ? 0.8 : 0,
          },
        },
      ],
      tags: [`tag-${i % 5}`, "multi-component"],
      locked: false,
      transform: {
        position: { x: i * 2, y: 0, z: 10 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    };
  }

  // --- Root entity ---
  entities["root"] = {
    id: "root",
    name: "Root",
    parentId: null,
    children: rootChildren,
    components: [],
    tags: [],
    locked: false,
  };

  const doc = SceneDocumentSchema.parse({
    id: "stress-test-200",
    name: "Stress Test 200-Entity Scene",
    schemaVersion: 1,
    rootEntityId: "root",
    entities,
    assets: {},
    wiring: [],
  });

  return doc;
}

// ---------------------------------------------------------------------------
// Multi-Client Sync Utilities
// ---------------------------------------------------------------------------

/**
 * Bidirectional sync between two Y.Docs using Y.encodeStateAsUpdate /
 * Y.applyUpdate. Simulates a Hocuspocus relay without a server.
 */
export function syncDocs(docA: Y.Doc, docB: Y.Doc): void {
  const stateA = Y.encodeStateAsUpdate(docA);
  const stateB = Y.encodeStateAsUpdate(docB);
  Y.applyUpdate(docB, stateA);
  Y.applyUpdate(docA, stateB);
}

/**
 * Full pairwise sync across all docs in the array.
 * Performs N*(N-1)/2 bidirectional syncs for N docs.
 */
export function syncAll(docs: Y.Doc[]): void {
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      syncDocs(docs[i]!, docs[j]!);
    }
  }
}

/**
 * Canonicalize an ECSON document for deep comparison.
 * Sorts entity keys and stringifies for deterministic comparison.
 */
function canonicalizeEcson(doc: SceneDocument): string {
  const sortedEntities: Record<string, unknown> = {};
  for (const id of Object.keys(doc.entities).sort()) {
    sortedEntities[id] = doc.entities[id];
  }
  return JSON.stringify({
    id: doc.id,
    name: doc.name,
    schemaVersion: doc.schemaVersion,
    rootEntityId: doc.rootEntityId,
    entities: sortedEntities,
    assets: doc.assets,
    wiring: doc.wiring,
    environment: doc.environment,
    metadata: doc.metadata,
  });
}

/**
 * Check that all Y.Docs have converged to identical ECSON state.
 * Performs full deep comparison using canonicalized JSON serialization
 * of the complete ECSON document (entities, assets, wiring, environment,
 * metadata). Returns false if any doc fails ECSON reconstruction or if
 * any field diverges across documents.
 */
export function docsConverged(docs: Y.Doc[]): boolean {
  if (docs.length < 2) return true;

  const ecsons: SceneDocument[] = [];
  for (const doc of docs) {
    const ecson = yDocToEcson(doc);
    if (!ecson) return false;
    ecsons.push(ecson);
  }

  const referenceCanonical = canonicalizeEcson(ecsons[0]!);

  for (let i = 1; i < ecsons.length; i++) {
    if (canonicalizeEcson(ecsons[i]!) !== referenceCanonical) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// FPS Measurement Helper (for Playwright E2E)
// ---------------------------------------------------------------------------

/**
 * Returns a Playwright page.evaluate snippet that measures FPS over
 * `durationMs` milliseconds using requestAnimationFrame + performance.now().
 *
 * Usage in Playwright:
 *   const fps = await page.evaluate(measureFpsScript(3000));
 */
export function measureFpsScript(durationMs: number = 3000): string {
  return `
    () => new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      function count() {
        frames++;
        if (performance.now() - start >= ${durationMs}) {
          resolve(frames / ((performance.now() - start) / 1000));
        } else {
          requestAnimationFrame(count);
        }
      }
      requestAnimationFrame(count);
    })
  `;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Input type for entity construction before Zod parsing fills defaults. */
type EntityInput = {
  id: string;
  name: string;
  parentId: string | null;
  children: string[];
  components: ComponentInstance[];
  tags: string[];
  locked: boolean;
  transform?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    scale: { x: number; y: number; z: number };
  };
};

/**
 * Convert HSL to hex color string.
 * h: 0-360, s: 0-100, l: 0-100
 */
function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
