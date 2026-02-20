/**
 * Per-fixture tolerance bands for visual regression testing.
 *
 * Each golden fixture has customized tolerance thresholds that account for
 * known rendering differences between PlayCanvas and Babylon.js. This replaces
 * the Phase 3 generic beta thresholds with per-fixture precision.
 *
 * Tolerance philosophy:
 * - Simple geometry/transform scenes: tight tolerance (mostly identical)
 * - Material-heavy PBR scenes: moderate tolerance (PBR implementation differences)
 * - Spot light scenes: wider tolerance (Babylon uses exponent approximation
 *   for inner cone angle instead of exact inner cone, producing visually
 *   acceptable but measurably different falloff patterns)
 * - Adversarial scenes: moderate tolerance (many entities, varied components)
 *
 * Per-engine baselines: Each engine is compared against its OWN baseline
 * (not cross-engine). Cross-engine comparison is advisory only.
 */

export interface ToleranceBand {
  /** Maximum percentage of pixels that can differ (0-1 scale) */
  maxDiffPixels: number;
  /** Maximum color distance per pixel (0-1 scale, Playwright threshold) */
  maxColorDelta: number;
  /** Acceptable regions to mask (e.g., shadow edges, AA boundaries) */
  maskRegions?: Array<{ x: number; y: number; width: number; height: number }>;
}

/**
 * Tolerance bands keyed by golden fixture name.
 *
 * Fixture names must match the builder function names from @riff3d/fixtures:
 * - transforms-parenting: Nested transforms, parent-child hierarchy
 * - materials-lights: PBR materials, multiple light types including spot
 * - animation: Animated entities (static frame capture)
 * - events-triggers: Cross-entity event wiring (structural, minimal rendering)
 * - character-stub: Character entity with components
 * - timeline-stub: Timeline entity with keyframes
 * - adversarial: Edge cases, deep hierarchy, Unicode names, max components
 */
export const TOLERANCE_BANDS: Record<string, ToleranceBand> = {
  // Simple scenes with primitives and basic transforms
  "transforms-parenting": { maxDiffPixels: 0.02, maxColorDelta: 0.05 },

  // Material-heavy scenes: PBR differences between engines + spot light
  // Spot light inner cone tolerance is explicitly wider here because
  // Babylon.js uses an exponent-based falloff approximation rather than
  // exact inner cone angle. This is a known acceptable difference documented
  // in 04-01 research. The higher maxColorDelta (0.15) allows for the
  // gradient difference in spot light falloff regions.
  "materials-lights": { maxDiffPixels: 0.05, maxColorDelta: 0.15 },

  // Animation fixture: static frame capture, moderate tolerance
  "animation": { maxDiffPixels: 0.03, maxColorDelta: 0.08 },

  // Structural scenes (events, triggers) with minimal rendering variation
  "events-triggers": { maxDiffPixels: 0.02, maxColorDelta: 0.05 },

  // Character stub: single entity with multiple components
  "character-stub": { maxDiffPixels: 0.03, maxColorDelta: 0.08 },

  // Timeline stub: keyframe entities, minimal rendering
  "timeline-stub": { maxDiffPixels: 0.02, maxColorDelta: 0.05 },

  // Adversarial: many entities, varied components, deep hierarchy
  "adversarial": { maxDiffPixels: 0.05, maxColorDelta: 0.10 },

  // Default for any unlisted fixtures (new fixtures get moderate tolerance)
  "default": { maxDiffPixels: 0.05, maxColorDelta: 0.10 },
};

/**
 * Get the tolerance band for a fixture, falling back to default.
 */
export function getToleranceBand(fixtureName: string): ToleranceBand {
  return TOLERANCE_BANDS[fixtureName] ?? TOLERANCE_BANDS["default"]!;
}
