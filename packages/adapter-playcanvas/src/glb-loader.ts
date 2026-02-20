import * as pc from "playcanvas";

/**
 * A node in the extracted GLB hierarchy.
 */
export interface GlbHierarchyNode {
  /** Name from the GLB node. */
  name: string;
  /** Index in the flat node list. */
  index: number;
  /** Parent index (-1 for root). */
  parentIndex: number;
  /** Local position. */
  position: { x: number; y: number; z: number };
  /** Local rotation as quaternion. */
  rotation: { x: number; y: number; z: number; w: number };
  /** Local scale. */
  scale: { x: number; y: number; z: number };
  /** Whether this node has a render/mesh component. */
  hasMesh: boolean;
  /** Extracted material properties if this node has a mesh. */
  materials: GlbMaterialInfo[];
}

/**
 * Material properties extracted from a PlayCanvas StandardMaterial.
 */
export interface GlbMaterialInfo {
  /** Material name. */
  name: string;
  /** Diffuse/base color as hex string. */
  baseColor: string;
  /** PBR metalness (0-1). */
  metallic: number;
  /** PBR roughness (0-1, converted from PlayCanvas gloss). */
  roughness: number;
  /** Emissive color as hex string. */
  emissive: string;
  /** Emissive intensity. */
  emissiveIntensity: number;
  /** Opacity (0-1). */
  opacity: number;
}

/**
 * Result of importing a GLB file into PlayCanvas.
 */
export interface GlbImportResult {
  /** The instantiated root entity (must be destroyed after extraction). */
  rootEntity: pc.Entity;
  /** Flat list of hierarchy nodes with transform and material data. */
  hierarchy: GlbHierarchyNode[];
  /** Extracted material information. */
  materials: GlbMaterialInfo[];
  /** Number of animations found (stored for future Phase 7 use). */
  animationCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function colorToHex(color: pc.Color): string {
  const r = Math.round(color.r * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round(color.g * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round(color.b * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${r}${g}${b}`;
}

function extractMaterial(mat: pc.Material): GlbMaterialInfo {
  const std = mat as pc.StandardMaterial;
  return {
    name: mat.name || "Unnamed Material",
    baseColor: std.diffuse ? colorToHex(std.diffuse) : "#cccccc",
    metallic: typeof std.metalness === "number" ? std.metalness : 0,
    roughness: typeof std.gloss === "number" ? 1 - std.gloss : 0.5,
    emissive: std.emissive ? colorToHex(std.emissive) : "#000000",
    emissiveIntensity:
      typeof std.emissiveIntensity === "number" ? std.emissiveIntensity : 1,
    opacity: typeof std.opacity === "number" ? std.opacity : 1,
  };
}

/**
 * Recursively walk a PlayCanvas entity tree and extract hierarchy data.
 */
function walkEntity(
  entity: pc.Entity,
  parentIndex: number,
  nodes: GlbHierarchyNode[],
  allMaterials: GlbMaterialInfo[],
): void {
  const index = nodes.length;

  const pos = entity.getLocalPosition();
  const rot = entity.getLocalRotation();
  const scl = entity.getLocalScale();

  const hasMesh = !!entity.render;
  const nodeMaterials: GlbMaterialInfo[] = [];

  if (hasMesh && entity.render) {
    const meshInstances = entity.render.meshInstances;
    if (meshInstances) {
      for (const mi of meshInstances) {
        if (mi.material) {
          const matInfo = extractMaterial(mi.material);
          nodeMaterials.push(matInfo);
          // Deduplicate materials by name
          if (!allMaterials.some((m) => m.name === matInfo.name)) {
            allMaterials.push(matInfo);
          }
        }
      }
    }
  }

  nodes.push({
    name: entity.name || `Node_${index}`,
    index,
    parentIndex,
    position: { x: pos.x, y: pos.y, z: pos.z },
    rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
    scale: { x: scl.x, y: scl.y, z: scl.z },
    hasMesh,
    materials: nodeMaterials,
  });

  for (let i = 0; i < entity.children.length; i++) {
    const child = entity.children[i];
    if (child instanceof pc.Entity) {
      walkEntity(child, index, nodes, allMaterials);
    }
  }
}

/**
 * Import a GLB file into PlayCanvas and extract its hierarchy data.
 *
 * Loads the GLB via PlayCanvas container asset system, instantiates
 * a render entity hierarchy, and walks it to extract:
 * - Entity tree structure (names, parent-child, transforms)
 * - Material properties (PBR: base color, metalness, roughness, emissive)
 * - Animation count (for Phase 7 future use)
 *
 * The caller is responsible for destroying the returned rootEntity
 * after extracting the data via glbToEcsonOps.
 *
 * @param app - The PlayCanvas Application instance
 * @param url - URL of the GLB file (e.g., from Supabase Storage)
 * @returns Promise resolving to the import result with hierarchy data
 */
export function importGlb(
  app: pc.Application,
  url: string,
): Promise<GlbImportResult> {
  return new Promise((resolve, reject) => {
    const asset = new pc.Asset("glb-import", "container", { url });

    asset.on("load", () => {
      try {
        const resource = asset.resource as {
          instantiateRenderEntity: (opts?: {
            castShadows?: boolean;
            receiveShadows?: boolean;
          }) => pc.Entity;
          animations?: unknown[];
        };

        const rootEntity = resource.instantiateRenderEntity({
          castShadows: true,
          receiveShadows: true,
        });

        // Walk the hierarchy to extract data
        const hierarchy: GlbHierarchyNode[] = [];
        const materials: GlbMaterialInfo[] = [];
        walkEntity(rootEntity, -1, hierarchy, materials);

        const animationCount = Array.isArray(resource.animations)
          ? resource.animations.length
          : 0;

        resolve({
          rootEntity,
          hierarchy,
          materials,
          animationCount,
        });
      } catch (err) {
        reject(
          err instanceof Error
            ? err
            : new Error(`Failed to instantiate GLB: ${String(err)}`),
        );
      }
    });

    asset.on("error", (err: string) => {
      reject(new Error(`Failed to load GLB from ${url}: ${err}`));
    });

    app.assets.add(asset);
    app.assets.load(asset);
  });
}
