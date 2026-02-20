import type { SceneDocument } from "@riff3d/ecson";
import { testRoundTrip } from "./round-trip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FixtureResult {
  fixture: string;
  roundTrip: boolean;
  errors: string[];
}

export interface ConformanceResult {
  passed: number;
  failed: number;
  results: FixtureResult[];
}

// ---------------------------------------------------------------------------
// Conformance Suite Runner
// ---------------------------------------------------------------------------

/**
 * Run the conformance suite against a set of fixtures.
 *
 * For each fixture:
 * - Runs round-trip test (ECSON -> IR -> ECSON)
 * - Reports pass/fail with detailed diffs on failure
 * - Returns aggregate results
 */
export function runConformanceSuite(
  fixtures: Array<{ name: string; doc: SceneDocument }>,
): ConformanceResult {
  const results: FixtureResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const { name, doc } of fixtures) {
    const errors: string[] = [];

    // Round-trip test
    const rtResult = testRoundTrip(doc);
    if (!rtResult.passed) {
      errors.push(`Round-trip failed: ${rtResult.diff ?? "unknown diff"}`);
    }

    const fixtureResult: FixtureResult = {
      fixture: name,
      roundTrip: rtResult.passed,
      errors,
    };

    results.push(fixtureResult);

    if (errors.length === 0) {
      passed++;
    } else {
      failed++;
    }
  }

  return { passed, failed, results };
}
