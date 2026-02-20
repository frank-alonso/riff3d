/**
 * Tiered performance budget definitions for Riff3D.
 *
 * Budgets define three tiers: Excellent, Pass, and Fail.
 * - **Excellent:** Forward-looking target (e.g., WebXR-ready 72+ FPS for Phase 10 VR)
 * - **Pass:** Acceptable for current phase and general editor use
 * - **Fail:** Below acceptable threshold; indicates a regression
 *
 * Budgets are split into two categories:
 * - **CI-measurable:** Can be reliably tested in CI (compilation, PatchOps, round-trip)
 * - **Local-only:** Require GPU/browser environment (FPS, memory, load time)
 *
 * These budgets formalize Phase 3 success criterion #4: "Performance budgets are met."
 */

// ---------------------------------------------------------------------------
// Budget interfaces
// ---------------------------------------------------------------------------

/**
 * A performance budget with three tiers: Excellent, Pass, and Fail.
 *
 * For "lower-is-better" metrics (e.g., latency):
 *   value <= excellent is "excellent"
 *   value <= pass is "pass"
 *   value >= fail is "fail"
 *
 * For "higher-is-better" metrics (e.g., FPS):
 *   value >= excellent is "excellent"
 *   value >= pass is "pass"
 *   value < fail is "fail"
 */
export interface TieredBudget {
  metric: string;
  unit: string;
  excellent: number;
  pass: number;
  fail: number;
  direction: "lower-is-better" | "higher-is-better";
  measurable: "ci" | "local-only";
  description: string;
}

/**
 * A simple performance budget with Pass and Fail thresholds only.
 * Used for metrics where an "Excellent" tier is not meaningful.
 */
export interface SimpleBudget {
  metric: string;
  unit: string;
  pass: number;
  fail: number;
  direction: "lower-is-better" | "higher-is-better";
  measurable: "ci" | "local-only";
  description: string;
}

// ---------------------------------------------------------------------------
// Tiered budgets (Excellent / Pass / Fail)
// ---------------------------------------------------------------------------

export const TIERED_BUDGETS: readonly TieredBudget[] = [
  {
    metric: "fps-editing-idle-20",
    unit: "fps",
    excellent: 72,
    pass: 45,
    fail: 30,
    direction: "higher-is-better",
    measurable: "local-only",
    description: "FPS editing idle with ~20 entities",
  },
  {
    metric: "fps-editing-idle-100",
    unit: "fps",
    excellent: 60,
    pass: 30,
    fail: 20,
    direction: "higher-is-better",
    measurable: "local-only",
    description: "FPS editing idle with ~100 entities",
  },
  {
    metric: "scene-load-small",
    unit: "ms",
    excellent: 100,
    pass: 500,
    fail: 1000,
    direction: "lower-is-better",
    measurable: "local-only",
    description: "Scene load time for small fixture (1-10 entities)",
  },
  {
    metric: "scene-load-adversarial",
    unit: "ms",
    excellent: 300,
    pass: 1000,
    fail: 3000,
    direction: "lower-is-better",
    measurable: "local-only",
    description: "Scene load time for adversarial fixture (50+ entities)",
  },
  {
    metric: "editor-memory-heap",
    unit: "MB",
    excellent: 100,
    pass: 200,
    fail: 400,
    direction: "lower-is-better",
    measurable: "local-only",
    description: "Editor total memory (heap) usage",
  },
  {
    metric: "ir-compilation-small",
    unit: "ms",
    excellent: 25,
    pass: 50,
    fail: 100,
    direction: "lower-is-better",
    measurable: "ci",
    description: "IR compilation time for small fixture (1-10 entities)",
  },
  {
    metric: "ir-compilation-large",
    unit: "ms",
    excellent: 250,
    pass: 1000,
    fail: 2000,
    direction: "lower-is-better",
    measurable: "ci",
    description: "IR compilation time for large fixture (50+ entities)",
  },
] as const;

// ---------------------------------------------------------------------------
// Simple budgets (Pass / Fail)
// ---------------------------------------------------------------------------

export const SIMPLE_BUDGETS: readonly SimpleBudget[] = [
  {
    metric: "patchop-single-apply",
    unit: "ms",
    pass: 1,
    fail: 5,
    direction: "lower-is-better",
    measurable: "ci",
    description: "PatchOp single apply time",
  },
  {
    metric: "patchop-batch-100",
    unit: "ms",
    pass: 50,
    fail: 200,
    direction: "lower-is-better",
    measurable: "ci",
    description: "PatchOp batch of 100 operations",
  },
  {
    metric: "scene-rebuild-20",
    unit: "ms",
    pass: 100,
    fail: 500,
    direction: "lower-is-better",
    measurable: "local-only",
    description: "Scene rebuild time for ~20 entities",
  },
  {
    metric: "ecson-roundtrip-loss",
    unit: "%",
    pass: 0,
    fail: 0,
    direction: "lower-is-better",
    measurable: "ci",
    description: "ECSON round-trip loss for portable subset (must be 0%)",
  },
] as const;

// ---------------------------------------------------------------------------
// Budget lookup helper
// ---------------------------------------------------------------------------

/**
 * Check a metric value against its tiered or simple budget.
 *
 * @param metric - The metric identifier (matches TieredBudget.metric or SimpleBudget.metric)
 * @param value - The measured value
 * @returns "excellent" | "pass" | "fail" for tiered budgets, "pass" | "fail" for simple
 * @throws Error if the metric is not found in either budget list
 */
export function checkBudget(metric: string, value: number): "excellent" | "pass" | "fail" {
  // Search tiered budgets first
  const tiered = TIERED_BUDGETS.find((b) => b.metric === metric);
  if (tiered) {
    if (tiered.direction === "lower-is-better") {
      if (value <= tiered.excellent) return "excellent";
      if (value <= tiered.pass) return "pass";
      return "fail";
    } else {
      // higher-is-better
      if (value >= tiered.excellent) return "excellent";
      if (value >= tiered.pass) return "pass";
      return "fail";
    }
  }

  // Search simple budgets
  const simple = SIMPLE_BUDGETS.find((b) => b.metric === metric);
  if (simple) {
    if (simple.direction === "lower-is-better") {
      if (value <= simple.pass) return "pass";
      return "fail";
    } else {
      if (value >= simple.pass) return "pass";
      return "fail";
    }
  }

  throw new Error(`Unknown budget metric: ${metric}`);
}

// ---------------------------------------------------------------------------
// Legacy budget mapping (bridges old PERFORMANCE_BUDGETS consumers)
// ---------------------------------------------------------------------------

/**
 * Maps the tiered/simple budgets back to the original PERFORMANCE_BUDGETS
 * structure used by the existing conformance benchmarks.
 *
 * The `fail` threshold is used as the absolute maximum (with CI_MARGIN applied
 * separately in tests). The `pass` threshold is used as the baseline target.
 */
export const TIERED_PERFORMANCE_BUDGETS = {
  compilation: {
    small: { excellent: 25, pass: 50, fail: 100 },
    large: { excellent: 250, pass: 1000, fail: 2000 },
  },
  decompilation: {
    small: { excellent: 25, pass: 50, fail: 100 },
    large: { excellent: 250, pass: 1000, fail: 2000 },
  },
  patchOp: {
    single: { pass: 1, fail: 5 },
    batchOf100: { pass: 50, fail: 200 },
  },
} as const;
