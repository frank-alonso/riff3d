export const VERSION = "0.0.1";

/**
 * Physics evaluation: Rapier.js spike completed.
 * See .planning/research/RAPIER_SPIKE.md for findings.
 * Decision: Use @dimforge/rapier3d-compat v0.19.x as web runtime physics adapter.
 * Physics contracts (RigidBody, Collider schemas) are engine-agnostic per spike recommendations.
 */

// Conformance harness
export {
  runConformanceSuite,
  type ConformanceResult,
  type FixtureResult,
} from "./harness";

// Round-trip utilities
export { testRoundTrip, normalizeForComparison } from "./round-trip";

// Replay determinism utilities
export {
  testReplayDeterminism,
  generateOpsForFixture,
} from "./replay";

// Performance benchmarks
export {
  benchmarkCompilation,
  benchmarkDecompilation,
  benchmarkOpApplication,
  getFixtureSize,
  PERFORMANCE_BUDGETS,
  type TimingResult,
  type OpBenchmarkResult,
} from "./benchmarks";
