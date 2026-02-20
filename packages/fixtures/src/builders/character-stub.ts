import type { SceneDocument } from "@riff3d/ecson";
import { SceneBuilder } from "./builder";

/**
 * Golden fixture: character stub with gameplay entities.
 *
 * - Character entity with MeshRenderer, RigidBody, Collider (capsule), Animation
 * - Checkpoint entities (3, ordered)
 * - MovingPlatform entity
 * - PathFollower entity with waypoint references
 *
 * Tests: character components, gameplay stubs, entity references.
 */
export function buildCharacterStubFixture(): SceneDocument {
  const scene = SceneBuilder.create("Character Stub", "chrst");

  // Character entity with full component set
  scene
    .addEntity("PlayerCharacter", { tags: ["player", "character"] })
    .setTransform({ position: { x: 0, y: 1, z: 0 } })
    .addComponent("MeshRenderer", {
      meshType: "box",
      castShadows: true,
      receiveShadows: true,
    })
    .addComponent("RigidBody", {
      type: "dynamic",
      mass: 70,
      linearDamping: 0.1,
      angularDamping: 0.1,
    })
    .addComponent("Collider", {
      shape: "capsule",
      radius: 0.3,
      height: 1.8,
      isTrigger: false,
    })
    .addComponent("Animation", {
      clips: ["idle", "walk", "run", "jump"],
      defaultClip: "idle",
      autoPlay: true,
      loop: true,
      speed: 1.0,
      tracks: {},
    });

  // 3 ordered checkpoints
  const cp1 = scene
    .addEntity("Checkpoint-1", { tags: ["checkpoint"] })
    .setTransform({ position: { x: 10, y: 0, z: 0 } })
    .addComponent("Checkpoint", {
      order: 1,
      isStart: true,
      respawnOffset: { x: 0, y: 1, z: 0 },
    });

  const cp2 = scene
    .addEntity("Checkpoint-2", { tags: ["checkpoint"] })
    .setTransform({ position: { x: 20, y: 5, z: 10 } })
    .addComponent("Checkpoint", {
      order: 2,
      isStart: false,
      respawnOffset: { x: 0, y: 1, z: 0 },
    });

  scene
    .addEntity("Checkpoint-3", { tags: ["checkpoint"] })
    .setTransform({ position: { x: 30, y: 0, z: 20 } })
    .addComponent("Checkpoint", {
      order: 3,
      isStart: false,
      respawnOffset: { x: 0, y: 1, z: 0 },
    });

  // Moving platform
  scene
    .addEntity("MovingPlatform", { tags: ["platform"] })
    .setTransform({ position: { x: 15, y: 3, z: 5 } })
    .addComponent("MeshRenderer", { meshType: "box" })
    .addComponent("RigidBody", { type: "kinematic", mass: 0 })
    .addComponent("Collider", {
      shape: "box",
      halfExtents: { x: 3, y: 0.25, z: 3 },
      isTrigger: false,
    })
    .addComponent("MovingPlatform", {
      speed: 2.0,
      pauseDuration: 1.0,
      waypoints: [
        { x: 15, y: 3, z: 5 },
        { x: 15, y: 8, z: 5 },
        { x: 25, y: 8, z: 5 },
      ],
    });

  // PathFollower entity referencing checkpoints as waypoints
  scene
    .addEntity("PatrolGuard", { tags: ["npc"] })
    .setTransform({ position: { x: 10, y: 0, z: 0 } })
    .addComponent("MeshRenderer", { meshType: "box" })
    .addComponent("PathFollower", {
      speed: 3.0,
      loop: true,
      waypointEntityIds: [cp1.getId(), cp2.getId()],
    });

  return scene.build();
}
