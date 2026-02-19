/// <reference types="node" />

import type { SceneDocument } from "@riff3d/ecson";
import { compile, decompile, type CanonicalScene } from "@riff3d/canonical-ir";
import { applyOps, type PatchOp } from "@riff3d/patchops";

// ---------------------------------------------------------------------------
// Performance Budgets
// ---------------------------------------------------------------------------

/**
 * Performance budgets for CI regression detection.
 *
 * These are baseline targets. CI environments use 2x margin.
 * The budgets are for tracking trends, not hard gates initially.
 */
export const PERFORMANCE_BUDGETS = {
  compilationTime: {
    smallFixture: 50, // ms -- 1-10 entities
    mediumFixture: 200, // ms -- 10-50 entities
    largeFixture: 1000, // ms -- 50-200 entities
  },
  decompilationTime: {
    smallFixture: 50, // ms
    mediumFixture: 200, // ms
    largeFixture: 1000, // ms
  },
  patchOpApply: {
    singleOp: 1, // ms
    batchOf100: 50, // ms
  },
  memoryBaseline: {
    emptyDocument: 1024 * 50, // 50KB
    largeFixture: 1024 * 500, // 500KB
  },
} as const;

// ---------------------------------------------------------------------------
// Benchmark result types
// ---------------------------------------------------------------------------

export interface TimingResult {
  timeMs: number;
  memoryBytes: number;
}

export interface OpBenchmarkResult {
  timeMs: number;
  opsPerSecond: number;
}

// ---------------------------------------------------------------------------
// Benchmark utilities
// ---------------------------------------------------------------------------

/**
 * Benchmark compilation of an ECSON SceneDocument to Canonical IR.
 */
export function benchmarkCompilation(fixture: SceneDocument): TimingResult {
  const memBefore = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  compile(fixture);

  const endTime = performance.now();
  const memAfter = process.memoryUsage().heapUsed;

  return {
    timeMs: endTime - startTime,
    memoryBytes: Math.max(0, memAfter - memBefore),
  };
}

/**
 * Benchmark decompilation of Canonical IR back to ECSON.
 */
export function benchmarkDecompilation(ir: CanonicalScene): TimingResult {
  const memBefore = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  decompile(ir);

  const endTime = performance.now();
  const memAfter = process.memoryUsage().heapUsed;

  return {
    timeMs: endTime - startTime,
    memoryBytes: Math.max(0, memAfter - memBefore),
  };
}

/**
 * Benchmark applying a sequence of PatchOps to a SceneDocument.
 */
export function benchmarkOpApplication(
  doc: SceneDocument,
  ops: PatchOp[],
): OpBenchmarkResult {
  const startTime = performance.now();

  applyOps(doc, ops);

  const endTime = performance.now();
  const elapsed = endTime - startTime;

  return {
    timeMs: elapsed,
    opsPerSecond: elapsed > 0 ? (ops.length / elapsed) * 1000 : Infinity,
  };
}

/**
 * Get the entity count classification for budget lookup.
 */
export function getFixtureSize(
  fixture: SceneDocument,
): "smallFixture" | "mediumFixture" | "largeFixture" {
  const count = Object.keys(fixture.entities).length;
  if (count <= 10) return "smallFixture";
  if (count <= 50) return "mediumFixture";
  return "largeFixture";
}
