import type { SceneDocument } from "@riff3d/ecson";
import { SceneBuilder } from "./builder.js";

/**
 * Golden fixture: events and triggers.
 *
 * - TriggerZone entity wired to ScoreZone entity (onEnter -> activate)
 * - Timer entity wired to Spawner entity (onComplete -> spawn)
 * - KillZone with respawn behavior
 * - 3-step event chain: TriggerZone.onEnter -> Timer.start -> Spawner.spawn
 *
 * Tests: event wiring, cross-entity connections, gameplay components.
 */
export function buildEventsTriggersFixture(): SceneDocument {
  const scene = SceneBuilder.create("Events & Triggers", "evtrg");

  // TriggerZone
  const triggerZone = scene
    .addEntity("TriggerZone", { tags: ["trigger", "gameplay"] })
    .setTransform({ position: { x: 0, y: 0, z: 5 } })
    .addComponent("TriggerZone", {
      shape: "box",
      size: { x: 4, y: 2, z: 4 },
      oneShot: false,
    })
    .addComponent("Collider", {
      shape: "box",
      halfExtents: { x: 2, y: 1, z: 2 },
      isTrigger: true,
    });

  // ScoreZone
  const scoreZone = scene
    .addEntity("ScoreZone", { tags: ["scoring", "gameplay"] })
    .setTransform({ position: { x: 10, y: 0, z: 0 } })
    .addComponent("ScoreZone", {
      points: 100,
      teamFilter: "any",
    });

  // Timer
  const timer = scene
    .addEntity("SpawnTimer", { tags: ["logic", "gameplay"] })
    .addComponent("Timer", {
      duration: 5.0,
      autoStart: false,
      repeat: true,
    });

  // Spawner
  const spawner = scene
    .addEntity("EnemySpawner", { tags: ["spawner", "gameplay"] })
    .setTransform({ position: { x: -5, y: 0, z: -5 } })
    .addComponent("Spawner", {
      prefabId: "enemy-prefab",
      maxInstances: 10,
      spawnInterval: 2.0,
    });

  // KillZone
  scene
    .addEntity("KillZone", { tags: ["hazard", "gameplay"] })
    .setTransform({ position: { x: 0, y: -10, z: 0 } })
    .addComponent("KillZone", {
      damage: Infinity,
      respawnEntityId: "checkpoint-1",
    });

  // Wire 1: TriggerZone.onEnter -> ScoreZone.activate
  scene.addWire({
    sourceEntityId: triggerZone.getId(),
    sourceEvent: "onEnter",
    targetEntityId: scoreZone.getId(),
    targetAction: "activate",
  });

  // Wire 2: Timer.onComplete -> Spawner.spawn
  scene.addWire({
    sourceEntityId: timer.getId(),
    sourceEvent: "onComplete",
    targetEntityId: spawner.getId(),
    targetAction: "spawn",
  });

  // Wire 3: 3-step chain -- TriggerZone.onEnter -> Timer.start
  scene.addWire({
    sourceEntityId: triggerZone.getId(),
    sourceEvent: "onEnter",
    targetEntityId: timer.getId(),
    targetAction: "start",
    parameters: { delay: 0 },
  });

  return scene.build();
}
