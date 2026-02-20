import type { SceneDocument } from "@riff3d/ecson";
import { SceneBuilder } from "./builder";

/**
 * Golden fixture: multi-track timeline with keyframe sequences across entities.
 *
 * - Scene with 3 entities, each with Animation components
 * - Multi-track timeline: entity A has position + rotation tracks,
 *   entity B has scale track, entity C has material color track
 * - Each track has 3-5 keyframes at different times with interpolation metadata
 * - Timeline metadata: duration, loop mode, playback speed
 * - Cross-entity synchronization: all tracks share a common timeline duration (5.0s)
 * - Keyframe data uses the animation keyframe schema
 *
 * Tests: multi-track timeline data, keyframe sequences across entities,
 * timeline metadata -- distinct from the simple animation fixture.
 */
export function buildTimelineStubFixture(): SceneDocument {
  const scene = SceneBuilder.create("Timeline Stub", "tmlns");

  const TIMELINE_DURATION = 5.0;

  // Entity A: position + rotation tracks
  scene
    .addEntity("CubeAnimated", { tags: ["animated", "timeline"] })
    .setTransform({ position: { x: 0, y: 0, z: 0 } })
    .addComponent("MeshRenderer", { meshType: "box" })
    .addComponent("Animation", {
      clips: ["main-timeline"],
      defaultClip: "main-timeline",
      autoPlay: true,
      loop: true,
      speed: 1.0,
      timelineDuration: TIMELINE_DURATION,
      tracks: {
        "position": {
          keyframes: [
            { time: 0, value: { x: 0, y: 0, z: 0 }, interpolation: "linear" },
            { time: 1.0, value: { x: 5, y: 0, z: 0 }, interpolation: "ease-in" },
            { time: 2.5, value: { x: 5, y: 3, z: 0 }, interpolation: "ease-out" },
            { time: 4.0, value: { x: 0, y: 3, z: 0 }, interpolation: "ease-in-out" },
            { time: 5.0, value: { x: 0, y: 0, z: 0 }, interpolation: "linear" },
          ],
        },
        "rotation": {
          keyframes: [
            { time: 0, value: { x: 0, y: 0, z: 0, w: 1 }, interpolation: "linear" },
            { time: 2.5, value: { x: 0, y: 0.7071068, z: 0, w: 0.7071068 }, interpolation: "slerp" },
            { time: 5.0, value: { x: 0, y: 0, z: 0, w: 1 }, interpolation: "slerp" },
          ],
        },
      },
    });

  // Entity B: scale track
  scene
    .addEntity("SphereAnimated", { tags: ["animated", "timeline"] })
    .setTransform({ position: { x: 3, y: 0, z: 3 } })
    .addComponent("MeshRenderer", { meshType: "sphere" })
    .addComponent("Animation", {
      clips: ["main-timeline"],
      defaultClip: "main-timeline",
      autoPlay: true,
      loop: true,
      speed: 1.0,
      timelineDuration: TIMELINE_DURATION,
      tracks: {
        "scale": {
          keyframes: [
            { time: 0, value: { x: 1, y: 1, z: 1 }, interpolation: "linear" },
            { time: 1.25, value: { x: 2, y: 2, z: 2 }, interpolation: "ease-in" },
            { time: 2.5, value: { x: 0.5, y: 0.5, z: 0.5 }, interpolation: "ease-out" },
            { time: 3.75, value: { x: 1.5, y: 1.5, z: 1.5 }, interpolation: "ease-in-out" },
            { time: 5.0, value: { x: 1, y: 1, z: 1 }, interpolation: "linear" },
          ],
        },
      },
    });

  // Entity C: material color track
  scene
    .addEntity("PlaneAnimated", { tags: ["animated", "timeline"] })
    .setTransform({ position: { x: -3, y: -1, z: 0 }, scale: { x: 5, y: 1, z: 5 } })
    .addComponent("MeshRenderer", { meshType: "box" })
    .addComponent("Material", {
      baseColor: "#ffffff",
      metallic: 0.0,
      roughness: 0.8,
    })
    .addComponent("Animation", {
      clips: ["main-timeline"],
      defaultClip: "main-timeline",
      autoPlay: true,
      loop: true,
      speed: 1.0,
      timelineDuration: TIMELINE_DURATION,
      tracks: {
        "material-color": {
          keyframes: [
            { time: 0, value: "#ffffff", interpolation: "linear" },
            { time: 1.67, value: "#ff0000", interpolation: "linear" },
            { time: 3.33, value: "#00ff00", interpolation: "linear" },
            { time: 5.0, value: "#ffffff", interpolation: "linear" },
          ],
        },
      },
    });

  return scene.build();
}
