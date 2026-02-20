import type { SceneDocument } from "@riff3d/ecson";
import { SceneBuilder } from "./builder";

/**
 * Golden fixture: transforms and parenting hierarchy.
 *
 * Structure:
 *   Root (origin)
 *     -> Parent A (translated)
 *       -> Child A1 (box, rotated)
 *       -> Child A2 (sphere, scaled)
 *     -> Parent B (rotated + scaled)
 *       -> Child B1 (cylinder, translated)
 *
 * Tests: hierarchy traversal, transform inheritance, parenting.
 * Structural-only: no asset references beyond primitives.
 */
export function buildTransformsParentingFixture(): SceneDocument {
  const scene = SceneBuilder.create("Transforms & Parenting", "txpar");

  // Parent A at (5, 0, 0)
  const parentA = scene
    .addEntity("Parent A")
    .setTransform({
      position: { x: 5, y: 0, z: 0 },
    });

  // Child A1 with box MeshRenderer, rotated 45 degrees around Y
  parentA
    .addChild("Child A1")
    .setTransform({
      rotation: { x: 0, y: 0.3826834, z: 0, w: 0.9238795 }, // ~45 deg Y
    })
    .addComponent("MeshRenderer", {
      meshType: "box",
      castShadows: true,
      receiveShadows: true,
    });

  // Child A2 with sphere MeshRenderer, non-uniform scale
  parentA
    .addChild("Child A2")
    .setTransform({
      position: { x: 0, y: 2, z: 0 },
      scale: { x: 1.5, y: 0.5, z: 2.0 },
    })
    .addComponent("MeshRenderer", {
      meshType: "sphere",
      castShadows: true,
      receiveShadows: true,
    });

  // Parent B rotated and scaled
  const parentB = scene
    .addEntity("Parent B")
    .setTransform({
      position: { x: -3, y: 1, z: 2 },
      rotation: { x: 0.7071068, y: 0, z: 0, w: 0.7071068 }, // ~90 deg X
      scale: { x: 2, y: 2, z: 2 },
    });

  // Child B1 with cylinder MeshRenderer
  parentB
    .addChild("Child B1")
    .setTransform({
      position: { x: 0, y: 0, z: 3 },
    })
    .addComponent("MeshRenderer", {
      meshType: "cylinder",
      castShadows: true,
      receiveShadows: true,
    });

  return scene.build();
}
