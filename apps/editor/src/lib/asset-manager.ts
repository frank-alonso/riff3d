import type { PatchOp } from "@riff3d/patchops";
import { generateEntityId, generateOpId } from "@riff3d/ecson";
import { CURRENT_PATCHOP_VERSION } from "@riff3d/patchops";

/**
 * Starter asset category.
 *
 * Used to organize assets in the asset browser panel and strip.
 */
export type AssetCategory = "primitives" | "lights" | "cameras" | "other";

/**
 * A starter asset definition in the asset catalog.
 *
 * Each starter asset knows how to create itself as a set of PatchOps
 * (CreateEntity + AddComponent) that can be dispatched as a BatchOp.
 */
export interface StarterAsset {
  /** Unique identifier for the asset in the catalog. */
  id: string;
  /** Display name shown in the asset browser. */
  name: string;
  /** Category for grouping in the browser. */
  category: AssetCategory;
  /** Lucide icon name to render in the card. */
  icon: string;
  /** Short description shown on hover. */
  description: string;
  /** Generate PatchOps to spawn this asset under the given parent. */
  createOps: (parentId: string) => PatchOp[];
}

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
 * Create a standard entity spawn op set: CreateEntity + AddComponent(s).
 * The entity is positioned at the origin by default.
 */
function createEntityOps(
  parentId: string,
  name: string,
  components: Array<{ type: string; properties: Record<string, unknown> }>,
): PatchOp[] {
  const entityId = generateEntityId();
  const ops: PatchOp[] = [];

  ops.push(
    makeOp("CreateEntity", {
      entityId,
      name,
      parentId,
    }),
  );

  for (const component of components) {
    ops.push(
      makeOp("AddComponent", {
        entityId,
        component: {
          type: component.type,
          properties: component.properties,
        },
      }),
    );
  }

  return ops;
}

// ─── Primitives ───────────────────────────────────────────────────────

function makePrimitive(
  id: string,
  name: string,
  primitive: string,
  icon: string,
  description: string,
): StarterAsset {
  return {
    id,
    name,
    category: "primitives",
    icon,
    description,
    createOps: (parentId) =>
      createEntityOps(parentId, name, [
        {
          type: "MeshRenderer",
          properties: { primitive, castShadows: true, receiveShadows: true },
        },
        {
          type: "Material",
          properties: { baseColor: "#cccccc", metallic: 0.0, roughness: 0.5 },
        },
      ]),
  };
}

// ─── Lights ───────────────────────────────────────────────────────────

function makeLight(
  id: string,
  name: string,
  lightType: string,
  icon: string,
  description: string,
  extraProps: Record<string, unknown> = {},
): StarterAsset {
  return {
    id,
    name,
    category: "lights",
    icon,
    description,
    createOps: (parentId) =>
      createEntityOps(parentId, name, [
        {
          type: "Light",
          properties: {
            lightType,
            color: "#ffffff",
            intensity: 1,
            castShadows: true,
            ...extraProps,
          },
        },
      ]),
  };
}

// ─── Starter Asset Catalog ────────────────────────────────────────────

/**
 * The complete catalog of starter assets available in the asset browser.
 *
 * Categories:
 * - **Primitives:** Basic 3D shapes (cube, sphere, cylinder, cone, capsule, plane)
 * - **Lights:** Point, spot, and directional lights
 * - **Cameras:** Perspective and orthographic cameras
 * - **Other:** Empty entity (grouping node)
 */
export const STARTER_ASSETS: StarterAsset[] = [
  // Primitives
  makePrimitive("prim-cube", "Cube", "box", "Box", "A unit cube (1x1x1)"),
  makePrimitive("prim-sphere", "Sphere", "sphere", "Circle", "A unit sphere"),
  makePrimitive("prim-cylinder", "Cylinder", "cylinder", "CylinderIcon", "A unit cylinder"),
  makePrimitive("prim-cone", "Cone", "cone", "Triangle", "A unit cone"),
  makePrimitive("prim-capsule", "Capsule", "capsule", "Pill", "A capsule shape"),
  makePrimitive("prim-plane", "Plane", "plane", "Square", "A flat plane"),

  // Lights
  makeLight("light-point", "Point Light", "point", "Lightbulb", "Emits light in all directions"),
  makeLight("light-spot", "Spot Light", "spot", "FlashlightIcon", "Directed cone of light", {
    innerConeAngle: 40,
    outerConeAngle: 45,
    range: 10,
  }),
  makeLight("light-directional", "Directional Light", "directional", "Sun", "Parallel light rays (like the sun)"),

  // Cameras
  {
    id: "cam-perspective",
    name: "Perspective Camera",
    category: "cameras",
    icon: "Camera",
    description: "A perspective projection camera",
    createOps: (parentId) =>
      createEntityOps(parentId, "Perspective Camera", [
        {
          type: "Camera",
          properties: {
            projection: "perspective",
            fov: 60,
            nearClip: 0.1,
            farClip: 1000,
          },
        },
      ]),
  },
  {
    id: "cam-orthographic",
    name: "Orthographic Camera",
    category: "cameras",
    icon: "Scan",
    description: "An orthographic projection camera",
    createOps: (parentId) =>
      createEntityOps(parentId, "Orthographic Camera", [
        {
          type: "Camera",
          properties: {
            projection: "orthographic",
            orthoHeight: 10,
            nearClip: 0.1,
            farClip: 1000,
          },
        },
      ]),
  },

  // Other
  {
    id: "other-empty",
    name: "Empty Entity",
    category: "other",
    icon: "Folder",
    description: "An empty entity for grouping",
    createOps: (parentId) => createEntityOps(parentId, "Empty Entity", []),
  },
];

/**
 * Assets shown in the compact asset strip below the viewport.
 * These are the most commonly used assets for quick drag-and-drop.
 */
export const STRIP_ASSET_IDS = [
  "prim-cube",
  "prim-sphere",
  "prim-cylinder",
  "light-point",
  "other-empty",
];

/**
 * Look up a starter asset by its catalog ID.
 */
export function getStarterAsset(id: string): StarterAsset | undefined {
  return STARTER_ASSETS.find((a) => a.id === id);
}

/**
 * Get all starter assets grouped by category.
 */
export function getAssetsByCategory(): Record<AssetCategory, StarterAsset[]> {
  const result: Record<AssetCategory, StarterAsset[]> = {
    primitives: [],
    lights: [],
    cameras: [],
    other: [],
  };

  for (const asset of STARTER_ASSETS) {
    result[asset.category].push(asset);
  }

  return result;
}

/**
 * MIME type for the drag-and-drop data transfer.
 * Using a custom type so the viewport drop handler can distinguish
 * asset drops from other drag events.
 */
export const ASSET_DRAG_MIME = "application/x-riff3d-asset";
