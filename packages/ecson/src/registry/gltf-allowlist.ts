/**
 * glTF Extension Allowlist v0
 *
 * Defines which glTF extensions are recognized by the ECSON pipeline,
 * whether they are in the portable subset, and which fixtures cover them.
 */

export interface GltfExtensionEntry {
  /** Extension name (e.g., 'KHR_lights_punctual') */
  name: string;
  /** Khronos status */
  status: "ratified" | "draft";
  /** Whether this extension is in the portable subset v0 */
  portable: boolean;
  /** Which golden fixtures exercise this extension */
  fixturesCovering: string[];
  /** Human-readable notes */
  notes: string;
}

/**
 * The glTF extension allowlist v0.
 *
 * Portable extensions are included in the portable subset and must be
 * supported by all adapters. Non-portable extensions are recognized but
 * may have limited or no adapter support.
 */
export const GLTF_ALLOWLIST: GltfExtensionEntry[] = [
  {
    name: "core_gltf_2.0",
    status: "ratified",
    portable: true,
    fixturesCovering: ["all"],
    notes:
      "Meshes, materials (metallic-roughness), animations, scene graph",
  },
  {
    name: "KHR_lights_punctual",
    status: "ratified",
    portable: true,
    fixturesCovering: ["materials-lights"],
    notes: "Directional, point, spot lights",
  },
  {
    name: "KHR_materials_unlit",
    status: "ratified",
    portable: true,
    fixturesCovering: ["materials-lights"],
    notes: "Unlit materials for UI/effects",
  },
  {
    name: "KHR_texture_transform",
    status: "ratified",
    portable: false,
    fixturesCovering: [],
    notes:
      "UV offset/scale/rotation -- schema defined but not in portable subset v0",
  },
  {
    name: "KHR_physics_rigid_bodies",
    status: "draft",
    portable: false,
    fixturesCovering: [],
    notes: "Schema inspired by, not dependent on",
  },
];

/** Set of all allowed extension names for O(1) lookup */
const allowedSet = new Set(GLTF_ALLOWLIST.map((e) => e.name));

/**
 * Check if a glTF extension is in the allowlist.
 */
export function isAllowedExtension(name: string): boolean {
  return allowedSet.has(name);
}

/**
 * Get all extensions that are part of the portable subset v0.
 */
export function getPortableExtensions(): GltfExtensionEntry[] {
  return GLTF_ALLOWLIST.filter((e) => e.portable);
}
