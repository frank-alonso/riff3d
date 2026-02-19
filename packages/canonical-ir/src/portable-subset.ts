/**
 * Portable Subset v0 -- defines which Canonical IR fields/components are
 * guaranteed to work identically across all supported engines.
 *
 * The portable subset is the core portability contract. When data round-trips
 * through ECSON -> IR -> ECSON, portable subset fields are guaranteed to be
 * preserved identically. Non-portable data (engine tuning, custom components)
 * is preserved but may not be meaningful across engines.
 *
 * Portable Subset v0 covers:
 * - Scene graph structure (nodes, parenting, transforms)
 * - Mesh rendering (MeshRenderer references)
 * - Baseline PBR materials (Material component with standard properties)
 * - Lights (directional, point, spot)
 * - Cameras (perspective, orthographic)
 * - Physics (RigidBody, Collider)
 * - Audio (AudioSource, AudioListener)
 * - Animation (Animation component)
 * - Event wiring (wires between nodes)
 *
 * NOT in Portable Subset v0:
 * - Hemisphere lights (engine-specific)
 * - Custom/script components
 * - Engine-specific material properties
 * - Advanced physics (joints, constraints)
 * - Particle systems
 */

// ---------------------------------------------------------------------------
// Component Types
// ---------------------------------------------------------------------------

/**
 * Component types guaranteed portable across all engines.
 * Any component type NOT in this set is treated as engine-specific.
 */
export const PORTABLE_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  "MeshRenderer",
  "Light",
  "Camera",
  "RigidBody",
  "Collider",
  "AudioSource",
  "AudioListener",
  "Animation",
  "Material",
]);

// ---------------------------------------------------------------------------
// Light Types
// ---------------------------------------------------------------------------

/**
 * Light types guaranteed portable. Hemisphere lights are engine-specific.
 */
export const PORTABLE_LIGHT_TYPES: ReadonlySet<string> = new Set([
  "directional",
  "point",
  "spot",
]);

// ---------------------------------------------------------------------------
// Camera Types
// ---------------------------------------------------------------------------

/**
 * Camera types guaranteed portable.
 */
export const PORTABLE_CAMERA_TYPES: ReadonlySet<string> = new Set([
  "perspective",
  "orthographic",
]);

// ---------------------------------------------------------------------------
// Material Properties (Baseline PBR)
// ---------------------------------------------------------------------------

/**
 * Material properties guaranteed portable -- covers baseline PBR.
 * These map to glTF 2.0's metallic-roughness PBR model.
 */
export const PORTABLE_MATERIAL_PROPERTIES: ReadonlySet<string> = new Set([
  // Core PBR values
  "baseColor",
  "metallic",
  "roughness",
  "emissive",
  "emissiveIntensity",
  "opacity",
  "alphaMode",
  "alphaCutoff",
  "doubleSided",

  // Texture slots
  "baseColorMap",
  "normalMap",
  "metallicRoughnessMap",
  "emissiveMap",
  "occlusionMap",
]);

// ---------------------------------------------------------------------------
// Per-component portable properties
// ---------------------------------------------------------------------------

/**
 * Portable properties keyed by component type.
 * Used by isPortableProperty() to check whether a specific property
 * is guaranteed portable for a given component type.
 */
const PORTABLE_PROPERTIES_BY_TYPE: Record<string, ReadonlySet<string>> = {
  MeshRenderer: new Set(["meshAssetId", "materialAssetId", "castShadows", "receiveShadows"]),
  Light: new Set(["lightType", "color", "intensity", "range", "innerConeAngle", "outerConeAngle", "castShadows"]),
  Camera: new Set(["cameraType", "fov", "near", "far", "orthoSize", "aspectRatio"]),
  RigidBody: new Set(["bodyType", "mass", "linearDamping", "angularDamping", "gravityScale"]),
  Collider: new Set(["shapeType", "size", "radius", "height", "isTrigger", "friction", "restitution"]),
  AudioSource: new Set(["audioAssetId", "volume", "pitch", "loop", "spatial", "minDistance", "maxDistance"]),
  AudioListener: new Set(["enabled"]),
  Animation: new Set(["animationAssetId", "playing", "loop", "speed"]),
  Material: PORTABLE_MATERIAL_PROPERTIES,
};

// ---------------------------------------------------------------------------
// Query Functions
// ---------------------------------------------------------------------------

/**
 * Check if a component type is in the portable subset.
 * Non-portable components are engine-specific and may not work across engines.
 */
export function isPortableComponent(type: string): boolean {
  return PORTABLE_COMPONENT_TYPES.has(type);
}

/**
 * Check if a specific property is portable for a given component type.
 *
 * Returns false if:
 * - The component type is not portable
 * - The property is not in the portable set for that component type
 */
export function isPortableProperty(
  componentType: string,
  propertyPath: string,
): boolean {
  const portableProps = PORTABLE_PROPERTIES_BY_TYPE[componentType];
  if (!portableProps) return false;
  return portableProps.has(propertyPath);
}
