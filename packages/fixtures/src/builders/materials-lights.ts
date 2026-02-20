import type { SceneDocument } from "@riff3d/ecson";
import { SceneBuilder } from "./builder";

/**
 * Golden fixture: materials and lights.
 *
 * - 3 entities sharing the same material asset (SharedMaterial pattern)
 * - One directional light, one point light, one spot light
 * - One entity with an unlit material (KHR_materials_unlit coverage)
 * - Material asset with full PBR properties (metallic, roughness, emissive)
 * - Texture asset references (baseColorMap, normalMap)
 *
 * Tests: material sharing, light types, PBR properties, asset references.
 */
export function buildMaterialsLightsFixture(): SceneDocument {
  const scene = SceneBuilder.create("Materials & Lights", "matlt");

  // Assets: shared PBR material + textures
  const baseColorTexId = scene.addAsset("texture", "BaseColorTex", {
    uri: "textures/basecolor.png",
  });
  const normalTexId = scene.addAsset("texture", "NormalTex", {
    uri: "textures/normal.png",
  });
  const sharedMatId = scene.addAsset("material", "SharedPBRMaterial", {
    data: {
      baseColor: "#cc8833",
      metallic: 0.8,
      roughness: 0.2,
      emissive: "#110000",
      opacity: 1.0,
      alphaMode: "opaque",
      doubleSided: false,
      baseColorMap: baseColorTexId,
      normalMap: normalTexId,
    },
  });
  const unlitMatId = scene.addAsset("material", "UnlitMaterial", {
    data: {
      baseColor: "#ffffff",
      unlit: true,
    },
  });

  // 3 entities sharing the same material
  scene
    .addEntity("BoxA")
    .setTransform({ position: { x: -3, y: 0, z: 0 } })
    .addComponent("MeshRenderer", { meshType: "box", materialAssetId: sharedMatId })
    .addComponent("Material", {
      baseColor: "#cc8833",
      metallic: 0.8,
      roughness: 0.2,
      emissive: "#110000",
      materialAssetId: sharedMatId,
    });

  scene
    .addEntity("SphereA")
    .setTransform({ position: { x: 0, y: 0, z: 0 } })
    .addComponent("MeshRenderer", { meshType: "sphere", materialAssetId: sharedMatId })
    .addComponent("Material", {
      baseColor: "#cc8833",
      metallic: 0.8,
      roughness: 0.2,
      emissive: "#110000",
      materialAssetId: sharedMatId,
    });

  scene
    .addEntity("CylinderA")
    .setTransform({ position: { x: 3, y: 0, z: 0 } })
    .addComponent("MeshRenderer", { meshType: "cylinder", materialAssetId: sharedMatId })
    .addComponent("Material", {
      baseColor: "#cc8833",
      metallic: 0.8,
      roughness: 0.2,
      emissive: "#110000",
      materialAssetId: sharedMatId,
    });

  // Unlit entity
  scene
    .addEntity("UnlitPlane")
    .setTransform({ position: { x: 0, y: -1, z: 0 }, scale: { x: 10, y: 1, z: 10 } })
    .addComponent("MeshRenderer", { meshType: "box", materialAssetId: unlitMatId })
    .addComponent("Material", {
      baseColor: "#ffffff",
      unlit: true,
      materialAssetId: unlitMatId,
    });

  // Directional light
  scene
    .addEntity("DirectionalLight")
    .setTransform({
      rotation: { x: -0.3535534, y: 0.3535534, z: 0.1464466, w: 0.8535534 },
    })
    .addComponent("Light", {
      type: "directional",
      color: "#ffffee",
      intensity: 1.5,
      castShadows: true,
    });

  // Point light
  scene
    .addEntity("PointLight")
    .setTransform({ position: { x: 2, y: 4, z: -1 } })
    .addComponent("Light", {
      type: "point",
      color: "#ff8800",
      intensity: 2.0,
      range: 10,
      castShadows: false,
    });

  // Spot light
  scene
    .addEntity("SpotLight")
    .setTransform({ position: { x: -2, y: 5, z: 3 } })
    .addComponent("Light", {
      type: "spot",
      color: "#0088ff",
      intensity: 3.0,
      range: 15,
      innerConeAngle: 15,
      outerConeAngle: 45,
      castShadows: true,
    });

  return scene.build();
}
