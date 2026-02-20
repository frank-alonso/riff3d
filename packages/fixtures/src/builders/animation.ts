import type { SceneDocument } from "@riff3d/ecson";
import { SceneBuilder } from "./builder";

/**
 * Golden fixture: animation component and clip references.
 *
 * - Entity with Animation component
 * - Two clip references (walk, idle)
 * - Default clip set
 * - Basic transform keyframe data in the animation
 *
 * Tests: animation component schema, clip references.
 */
export function buildAnimationFixture(): SceneDocument {
  const scene = SceneBuilder.create("Animation", "anim0");

  // Animated character entity
  scene
    .addEntity("AnimatedCharacter")
    .setTransform({ position: { x: 0, y: 0, z: 0 } })
    .addComponent("MeshRenderer", { meshType: "box" })
    .addComponent("Animation", {
      clips: ["walk", "idle"],
      defaultClip: "idle",
      autoPlay: true,
      loop: true,
      speed: 1.0,
      tracks: {
        "position-track": {
          keyframes: [
            { time: 0, value: { x: 0, y: 0, z: 0 }, interpolation: "linear" },
            { time: 0.5, value: { x: 1, y: 0, z: 0 }, interpolation: "linear" },
            { time: 1.0, value: { x: 0, y: 0, z: 0 }, interpolation: "linear" },
          ],
        },
        "rotation-track": {
          keyframes: [
            {
              time: 0,
              value: { x: 0, y: 0, z: 0, w: 1 },
              interpolation: "linear",
            },
            {
              time: 1.0,
              value: { x: 0, y: 0.7071068, z: 0, w: 0.7071068 },
              interpolation: "linear",
            },
          ],
        },
      },
    });

  // A static prop for the animation scene
  scene
    .addEntity("Pedestal")
    .setTransform({ position: { x: 0, y: -0.5, z: 0 } })
    .addComponent("MeshRenderer", { meshType: "cylinder" });

  return scene.build();
}
