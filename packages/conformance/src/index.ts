export const VERSION = "0.0.1";

// Conformance harness
export {
  runConformanceSuite,
  type ConformanceResult,
  type FixtureResult,
} from "./harness.js";

// Round-trip utilities
export { testRoundTrip, normalizeForComparison } from "./round-trip.js";

// Replay determinism utilities
export {
  testReplayDeterminism,
  generateOpsForFixture,
} from "./replay.js";
