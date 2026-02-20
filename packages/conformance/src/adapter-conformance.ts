import type { EngineAdapter } from "@riff3d/canonical-ir";
import type { CanonicalScene } from "@riff3d/canonical-ir";

/**
 * Result of running adapter conformance checks for a single fixture.
 */
export interface AdapterConformanceResult {
  fixture: string;
  passed: boolean;
  entityCount: number;
  expectedEntityCount: number;
  errors: string[];
}

/**
 * Run conformance checks for a single fixture against an adapter.
 *
 * Tests:
 * 1. loadScene does not throw
 * 2. Entity map has correct number of entries (matches IR node count)
 * 3. rebuildScene does not throw
 * 4. Entity map is consistent after rebuild (same count)
 * 5. applyDelta with a transform delta does not throw
 * 6. dispose does not throw
 *
 * The adapter must already be initialized (initialize() called) before
 * calling this function.
 */
export function runAdapterConformance(
  adapter: EngineAdapter,
  fixtureName: string,
  scene: CanonicalScene,
): AdapterConformanceResult {
  const errors: string[] = [];
  const expectedEntityCount = scene.nodes.length;

  // Test 1: loadScene does not throw
  try {
    adapter.loadScene(scene);
  } catch (err: unknown) {
    errors.push(
      `loadScene threw: ${err instanceof Error ? err.message : String(err)}`,
    );
    return {
      fixture: fixtureName,
      passed: false,
      entityCount: 0,
      expectedEntityCount,
      errors,
    };
  }

  // Test 2: Entity map has correct number of entries
  const entityMap = adapter.getEntityMap();
  const entityCount = entityMap.size;
  if (entityCount !== expectedEntityCount) {
    errors.push(
      `Entity count mismatch: got ${entityCount}, expected ${expectedEntityCount}`,
    );
  }

  // Test 3: rebuildScene does not throw
  try {
    adapter.rebuildScene(scene);
  } catch (err: unknown) {
    errors.push(
      `rebuildScene threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Test 4: Entity map consistent after rebuild
  const entityMapAfterRebuild = adapter.getEntityMap();
  const countAfterRebuild = entityMapAfterRebuild.size;
  if (countAfterRebuild !== expectedEntityCount) {
    errors.push(
      `Entity count after rebuild mismatch: got ${countAfterRebuild}, expected ${expectedEntityCount}`,
    );
  }

  // Test 5: applyDelta with transform does not throw (if there are nodes)
  if (scene.nodes.length > 0) {
    const firstNode = scene.nodes[0]!;
    try {
      adapter.applyDelta({
        type: "node-transform",
        nodeId: firstNode.id,
        transform: {
          position: { x: 1, y: 2, z: 3 },
        },
      });
    } catch (err: unknown) {
      errors.push(
        `applyDelta threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Test 6: dispose does not throw
  try {
    adapter.dispose();
  } catch (err: unknown) {
    errors.push(
      `dispose threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    fixture: fixtureName,
    passed: errors.length === 0,
    entityCount,
    expectedEntityCount,
    errors,
  };
}
