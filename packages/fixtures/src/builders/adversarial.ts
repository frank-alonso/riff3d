import type { SceneDocument } from "@riff3d/ecson";
import { SceneBuilder } from "./builder.js";

/**
 * Adversarial fixture: exercises edge cases, deep paths, shared references,
 * encoding, and maximum complexity.
 *
 * - 6+ level deep hierarchy with varied branch widths
 * - 3 entities sharing the same material asset (SharedMaterial pattern)
 * - 3-step cross-entity event wire chain (A triggers B triggers C)
 * - Empty entities (no components) at various levels -- must survive round-trip
 * - Unicode entity names: emoji, CJK characters, RTL text
 * - Entity with maximum component count (all major component types on one entity)
 * - Engine tuning sections on selected entities
 * - Deeply nested component properties (for path-based SetProperty testing)
 * - Game settings populated with non-default values
 */
export function buildAdversarialFixture(): SceneDocument {
  const scene = SceneBuilder.create("Adversarial", "advrs");

  // --- Shared material asset ---
  const sharedMatId = scene.addAsset("material", "SharedAdversarialMat", {
    data: {
      baseColor: "#ff00ff",
      metallic: 1.0,
      roughness: 0.0,
      emissive: "#440044",
    },
  });

  // --- Deep hierarchy (6+ levels) ---
  const level1 = scene.addEntity("Level-1-Wide");

  const level2a = level1.addChild("Level-2a");
  const level2b = level1.addChild("Level-2b-Empty"); // empty entity
  const level2c = level1.addChild("Level-2c");

  const level3a = level2a.addChild("Level-3a");
  level2a.addChild("Level-3b-Empty"); // empty entity
  const level3c = level2c.addChild("Level-3c");

  const level4 = level3a.addChild("Level-4");
  const level5 = level4.addChild("Level-5");
  const level6 = level5.addChild("Level-6-Deep");
  level6
    .addComponent("MeshRenderer", { meshType: "sphere" })
    .setTransform({
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.5, y: 0.5, z: 0.5, w: 0.5 },
      scale: { x: 0.1, y: 0.1, z: 0.1 },
    });

  // Level 7 for good measure
  level6.addChild("Level-7-Deepest")
    .addComponent("MeshRenderer", { meshType: "box" });

  // --- 3 entities sharing same material ---
  const shared1 = level3c.addChild("SharedMat-Entity-1")
    .addComponent("Material", { materialAssetId: sharedMatId })
    .addComponent("MeshRenderer", { meshType: "box", materialAssetId: sharedMatId });

  const shared2 = level3c.addChild("SharedMat-Entity-2")
    .addComponent("Material", { materialAssetId: sharedMatId })
    .addComponent("MeshRenderer", { meshType: "sphere", materialAssetId: sharedMatId });

  const shared3 = level2c.addChild("SharedMat-Entity-3")
    .addComponent("Material", { materialAssetId: sharedMatId })
    .addComponent("MeshRenderer", { meshType: "cylinder", materialAssetId: sharedMatId });

  // --- Unicode entity names ---
  scene.addEntity("\u{1F680} Rocket Ship")
    .addComponent("MeshRenderer", { meshType: "box" });

  scene.addEntity("\u4E16\u754C Hello")
    .addComponent("MeshRenderer", { meshType: "sphere" });

  scene.addEntity("\u0645\u0631\u062D\u0628\u0627 RTL-Text")
    .addComponent("MeshRenderer", { meshType: "cylinder" });

  // --- Empty entities at root level ---
  scene.addEntity("Empty-Root-Level");

  // Another empty nested inside hierarchy
  level2b; // already created above as empty

  // --- Entity with maximum component count ---
  scene
    .addEntity("MaxComponentEntity", { tags: ["stress-test", "max-components"] })
    .setTransform({
      position: { x: 99, y: 99, z: 99 },
      rotation: { x: 0, y: 1, z: 0, w: 0 },
      scale: { x: 0.01, y: 0.01, z: 0.01 },
    })
    .addComponent("MeshRenderer", { meshType: "box", castShadows: true, receiveShadows: true })
    .addComponent("Light", { type: "point", color: "#ffffff", intensity: 1.0 })
    .addComponent("Camera", { fov: 60, near: 0.1, far: 1000, projection: "perspective" })
    .addComponent("RigidBody", { type: "dynamic", mass: 10 })
    .addComponent("Collider", { shape: "sphere", radius: 1.0, isTrigger: false })
    .addComponent("AudioSource", { clip: "test-audio", volume: 0.5, loop: false })
    .addComponent("AudioListener", {})
    .addComponent("Animation", {
      clips: ["test-clip"],
      defaultClip: "test-clip",
      autoPlay: false,
      loop: false,
      speed: 1.0,
      tracks: {},
    })
    .addComponent("Material", {
      baseColor: "#abcdef",
      metallic: 0.5,
      roughness: 0.5,
    });

  // --- Engine tuning on entity ---
  scene
    .addEntity("TunedEntity")
    .addComponent("MeshRenderer", { meshType: "box" })
    .setTuning("playcanvas", {
      batchGroupId: 42,
      layers: [0, 1, 2],
      renderOrder: 10,
    })
    .setTuning("babylon", {
      billboardMode: 7,
      checkCollisions: true,
    });

  // --- Deeply nested component properties ---
  scene
    .addEntity("DeepProps")
    .addComponent("MeshRenderer", {
      meshType: "box",
      advanced: {
        level1: {
          level2: {
            level3: {
              value: "deeply-nested-value",
              array: [1, 2, 3, { inner: true }],
            },
          },
        },
      },
    });

  // --- 3-step event wire chain ---
  // TriggerA.onEnter -> TimerB.start -> SpawnerC.spawn
  const triggerA = scene
    .addEntity("WireChain-TriggerA")
    .addComponent("TriggerZone", {
      shape: "sphere",
      size: { x: 5, y: 5, z: 5 },
      oneShot: true,
    });

  const timerB = scene
    .addEntity("WireChain-TimerB")
    .addComponent("Timer", {
      duration: 3.0,
      autoStart: false,
      repeat: false,
    });

  const spawnerC = scene
    .addEntity("WireChain-SpawnerC")
    .addComponent("Spawner", {
      prefabId: "adversarial-prefab",
      maxInstances: 5,
      spawnInterval: 1.0,
    });

  scene.addWire({
    sourceEntityId: triggerA.getId(),
    sourceEvent: "onEnter",
    targetEntityId: timerB.getId(),
    targetAction: "start",
  });

  scene.addWire({
    sourceEntityId: timerB.getId(),
    sourceEvent: "onComplete",
    targetEntityId: spawnerC.getId(),
    targetAction: "spawn",
    parameters: { count: 3 },
  });

  // Third wire to complete the chain demonstration
  scene.addWire({
    sourceEntityId: spawnerC.getId(),
    sourceEvent: "onSpawn",
    targetEntityId: triggerA.getId(),
    targetAction: "reset",
  });

  // --- Non-default game settings ---
  scene.setGameSettings({
    maxPlayers: 16,
    roundDuration: 300,
    respawnEnabled: false,
    respawnDelay: 10,
  });

  // --- Non-default environment ---
  scene.setEnvironment({
    skybox: { type: "hdri", uri: "skyboxes/adversarial-test.hdr" },
    fog: {
      enabled: true,
      type: "exponential",
      color: "#330033",
      density: 0.05,
      near: 1,
      far: 50,
    },
    ambientLight: { color: "#220022", intensity: 0.3 },
    gravity: { x: 0, y: -5, z: 0 },
  });

  return scene.build();
}
