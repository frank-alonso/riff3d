/**
 * Shared helpers for adapter conformance tests.
 *
 * Provides:
 * - Golden fixture loading (ECSON -> CanonicalScene)
 * - globalThis stubs for DOM APIs (canvas, window, document)
 * - Helper to compile fixtures to CanonicalScene
 */
import { vi } from "vitest";
import type { SceneDocument } from "@riff3d/ecson";
import type { CanonicalScene } from "@riff3d/canonical-ir";
import { compile } from "@riff3d/canonical-ir";
import {
  buildTransformsParentingFixture,
  buildMaterialsLightsFixture,
  buildAnimationFixture,
  buildEventsTriggersFixture,
  buildCharacterStubFixture,
  buildTimelineStubFixture,
  buildAdversarialFixture,
} from "@riff3d/fixtures";

// ---------------------------------------------------------------------------
// Golden fixture definitions
// ---------------------------------------------------------------------------

export interface GoldenFixture {
  name: string;
  doc: SceneDocument;
  scene: CanonicalScene;
}

/**
 * Load all golden fixtures and compile them to CanonicalScene.
 *
 * Returns an array of { name, doc, scene } tuples for test iteration.
 */
export function loadAllGoldenFixtures(): GoldenFixture[] {
  const fixtures: Array<{ name: string; build: () => SceneDocument }> = [
    { name: "transforms-parenting", build: buildTransformsParentingFixture },
    { name: "materials-lights", build: buildMaterialsLightsFixture },
    { name: "animation", build: buildAnimationFixture },
    { name: "events-triggers", build: buildEventsTriggersFixture },
    { name: "character-stub", build: buildCharacterStubFixture },
    { name: "timeline-stub", build: buildTimelineStubFixture },
    { name: "adversarial", build: buildAdversarialFixture },
  ];

  return fixtures.map(({ name, build }) => {
    const doc = build();
    const scene = compile(doc);
    return { name, doc, scene };
  });
}

// ---------------------------------------------------------------------------
// DOM stubs for adapter tests (canvas, window, document)
// ---------------------------------------------------------------------------

class FakeHTMLCanvasElement {
  width = 800;
  height = 600;
  style: Record<string, string> = {};
  parentElement = {
    clientWidth: 800,
    clientHeight: 600,
    style: {} as Record<string, string>,
    appendChild: vi.fn(),
  };
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    width: 800,
    height: 600,
  }));
  getContext = vi.fn(() => null);
}

/**
 * Set up globalThis stubs for DOM APIs needed by adapter initialization.
 *
 * Call once at the top of test files, before any adapter imports.
 * These stubs avoid needing jsdom or a real browser environment.
 */
export function setupDomStubs(): void {
  globalThis.HTMLCanvasElement =
    FakeHTMLCanvasElement as unknown as typeof HTMLCanvasElement;
  globalThis.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as Window & typeof globalThis;
  globalThis.document = {
    createElement: vi.fn((tag: string) => {
      if (tag === "div") {
        return { style: {} as Record<string, string>, parentElement: null };
      }
      return {};
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as Document;
}

/**
 * Create a fake HTMLCanvasElement for adapter initialization.
 */
export function createMockCanvas(): HTMLCanvasElement {
  return new FakeHTMLCanvasElement() as unknown as HTMLCanvasElement;
}
