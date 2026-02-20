import {
  SceneDocumentSchema,
  EntitySchema,
  CURRENT_SCHEMA_VERSION,
  generateEntityId,
  type SceneDocument,
} from "@riff3d/ecson";

/**
 * Euler angles (degrees) to quaternion conversion.
 * Used for setting rotation on entities in the default scene.
 */
function eulerToQuaternion(
  pitchDeg: number,
  yawDeg: number,
  rollDeg: number,
): { x: number; y: number; z: number; w: number } {
  const DEG_TO_RAD = Math.PI / 180;
  const halfPitch = (pitchDeg * DEG_TO_RAD) / 2;
  const halfYaw = (yawDeg * DEG_TO_RAD) / 2;
  const halfRoll = (rollDeg * DEG_TO_RAD) / 2;

  const cp = Math.cos(halfPitch);
  const sp = Math.sin(halfPitch);
  const cy = Math.cos(halfYaw);
  const sy = Math.sin(halfYaw);
  const cr = Math.cos(halfRoll);
  const sr = Math.sin(halfRoll);

  return {
    x: sr * cp * cy - cr * sp * sy,
    y: cr * sp * cy + sr * cp * sy,
    z: cr * cp * sy - sr * sp * cy,
    w: cr * cp * cy + sr * sp * sy,
  };
}

/**
 * Build a default starter scene ECSON document.
 *
 * Creates a scene with:
 * - Ground plane (10x10, at y=0)
 * - Directional light (pointing down at 45 degrees, warm white, shadows)
 * - Cube (at position [0, 0.5, 0])
 * - Sphere (at position [2, 0.5, 0])
 * - Environment: ambient light, dark blue sky color
 *
 * This is used when creating new projects from the dashboard.
 *
 * @param name - The project name
 * @returns A complete SceneDocument with the starter entities
 */
export function createDefaultScene(name: string): SceneDocument {
  const docId = generateEntityId();
  const rootId = generateEntityId();
  const groundId = generateEntityId();
  const lightId = generateEntityId();
  const cubeId = generateEntityId();
  const sphereId = generateEntityId();

  // Root entity
  const rootEntity = EntitySchema.parse({
    id: rootId,
    name: "Root",
    parentId: null,
    children: [groundId, lightId, cubeId, sphereId],
  });

  // Ground plane -- 10x10 meters, gray material
  const groundEntity = EntitySchema.parse({
    id: groundId,
    name: "Ground",
    parentId: rootId,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 10, y: 1, z: 10 },
    },
    components: [
      {
        type: "MeshRenderer",
        properties: {
          primitive: "plane",
          castShadows: false,
          receiveShadows: true,
        },
      },
      {
        type: "Material",
        properties: {
          baseColor: "#888888",
          metallic: 0,
          roughness: 0.9,
        },
      },
    ],
  });

  // Directional light -- 45 degrees down, warm white, with shadows
  const lightRotation = eulerToQuaternion(-45, 30, 0);
  const lightEntity = EntitySchema.parse({
    id: lightId,
    name: "Directional Light",
    parentId: rootId,
    transform: {
      position: { x: 0, y: 10, z: 0 },
      rotation: lightRotation,
    },
    components: [
      {
        type: "Light",
        properties: {
          lightType: "directional",
          color: "#fff5e6",
          intensity: 1.2,
          castShadows: true,
          shadowBias: 0.005,
        },
      },
    ],
  });

  // Cube -- at y=0.5 so it sits on the ground plane
  const cubeEntity = EntitySchema.parse({
    id: cubeId,
    name: "Cube",
    parentId: rootId,
    transform: {
      position: { x: 0, y: 0.5, z: 0 },
    },
    components: [
      {
        type: "MeshRenderer",
        properties: {
          primitive: "box",
          castShadows: true,
          receiveShadows: true,
        },
      },
      {
        type: "Material",
        properties: {
          baseColor: "#4a90d9",
          metallic: 0.1,
          roughness: 0.4,
        },
      },
    ],
  });

  // Sphere -- offset to the right
  const sphereEntity = EntitySchema.parse({
    id: sphereId,
    name: "Sphere",
    parentId: rootId,
    transform: {
      position: { x: 2, y: 0.5, z: 0 },
    },
    components: [
      {
        type: "MeshRenderer",
        properties: {
          primitive: "sphere",
          castShadows: true,
          receiveShadows: true,
        },
      },
      {
        type: "Material",
        properties: {
          baseColor: "#d94a4a",
          metallic: 0.3,
          roughness: 0.2,
        },
      },
    ],
  });

  // Build and validate the complete document
  return SceneDocumentSchema.parse({
    id: docId,
    name,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    rootEntityId: rootId,
    entities: {
      [rootId]: rootEntity,
      [groundId]: groundEntity,
      [lightId]: lightEntity,
      [cubeId]: cubeEntity,
      [sphereId]: sphereEntity,
    },
    environment: {
      skybox: { type: "color", color: "#1a1a2e" },
      ambientLight: { color: "#ffffff", intensity: 0.3 },
      fog: { enabled: false },
    },
  });
}
