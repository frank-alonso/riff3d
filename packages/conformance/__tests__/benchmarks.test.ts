import { describe, it, expect } from "vitest";
import {
  buildTransformsParentingFixture,
  buildMaterialsLightsFixture,
  buildAnimationFixture,
  buildEventsTriggersFixture,
  buildCharacterStubFixture,
  buildTimelineStubFixture,
  buildAdversarialFixture,
} from "@riff3d/fixtures";
import { compile } from "@riff3d/canonical-ir";
import {
  benchmarkCompilation,
  benchmarkDecompilation,
  benchmarkOpApplication,
  getFixtureSize,
  PERFORMANCE_BUDGETS,
} from "../src/benchmarks";
import {
  TIERED_BUDGETS,
  SIMPLE_BUDGETS,
  TIERED_PERFORMANCE_BUDGETS,
  checkBudget,
} from "../src/budgets";
import { generateOpsForFixture } from "../src/replay";
import { type SceneDocument, SceneDocumentSchema, CURRENT_SCHEMA_VERSION } from "@riff3d/ecson";

// ---------------------------------------------------------------------------
// CI_MARGIN: 2x budget for CI environments (machine variance)
// ---------------------------------------------------------------------------

const CI_MARGIN = 2;

// ---------------------------------------------------------------------------
// All fixtures for benchmarking
// ---------------------------------------------------------------------------

const ALL_FIXTURES = [
  { name: "transforms-parenting", build: buildTransformsParentingFixture },
  { name: "materials-lights", build: buildMaterialsLightsFixture },
  { name: "animation", build: buildAnimationFixture },
  { name: "events-triggers", build: buildEventsTriggersFixture },
  { name: "character-stub", build: buildCharacterStubFixture },
  { name: "timeline-stub", build: buildTimelineStubFixture },
  { name: "adversarial", build: buildAdversarialFixture },
] as const;

// ---------------------------------------------------------------------------
// Benchmark tests
//
// These verify that benchmark infrastructure is operational and results
// are within budget. Use generous CI margins (2x).
// ---------------------------------------------------------------------------

describe("Performance benchmarks", () => {
  describe("compilation benchmarks", () => {
    for (const { name, build } of ALL_FIXTURES) {
      it(`compiles ${name} fixture within budget`, () => {
        const fixture = build();
        const result = benchmarkCompilation(fixture);
        const size = getFixtureSize(fixture);
        const budget = PERFORMANCE_BUDGETS.compilationTime[size] * CI_MARGIN;

        expect(result.timeMs).toBeLessThan(budget);
        expect(result.timeMs).toBeGreaterThanOrEqual(0);
      });
    }
  });

  describe("decompilation benchmarks", () => {
    for (const { name, build } of ALL_FIXTURES) {
      it(`decompiles ${name} fixture within budget`, () => {
        const fixture = build();
        const ir = compile(fixture);
        const result = benchmarkDecompilation(ir);
        const size = getFixtureSize(fixture);
        const budget = PERFORMANCE_BUDGETS.decompilationTime[size] * CI_MARGIN;

        expect(result.timeMs).toBeLessThan(budget);
        expect(result.timeMs).toBeGreaterThanOrEqual(0);
      });
    }
  });

  describe("PatchOp application benchmarks", () => {
    it("applies 100 sequential PatchOps within budget", () => {
      // Generate ops from the adversarial fixture (richest op set)
      const fixture = buildAdversarialFixture();
      const baseOps = generateOpsForFixture(fixture);

      // Repeat ops to get at least 100
      const ops = [];
      let counter = 0;
      for (const op of baseOps) {
        ops.push({
          ...op,
          id: `bench_op_${String(counter++).padStart(6, "0")}`,
        });
        if (ops.length >= 100) break;
      }

      // Create a fresh doc for application
      const doc = SceneDocumentSchema.parse({
        id: "bench_doc_id_0000",
        name: "Benchmark Document",
        schemaVersion: CURRENT_SCHEMA_VERSION,
        rootEntityId: "bench_root_id_00",
        entities: {
          "bench_root_id_00": {
            id: "bench_root_id_00",
            name: "Root",
            parentId: null,
            children: [],
            components: [],
            tags: [],
            transform: {
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
            visible: true,
            locked: false,
          },
        },
      });

      const result = benchmarkOpApplication(doc, ops);
      // Use tiered budget fail threshold with CI margin
      const budget = TIERED_PERFORMANCE_BUDGETS.patchOp.batchOf100.fail * CI_MARGIN;

      expect(result.timeMs).toBeLessThan(budget);
      expect(result.opsPerSecond).toBeGreaterThan(0);
    });

    it("applies a BatchOp of 100 sub-ops within budget", () => {
      const fixture = buildTransformsParentingFixture();
      const baseOps = generateOpsForFixture(fixture);

      // Repeat pattern to get 100 ops (create entities with unique IDs)
      const ops = [];
      for (let i = 0; i < 100; i++) {
        const entityId = `batch_ent_${String(i).padStart(6, "0")}`;
        ops.push({
          id: `batch_sub_${String(i).padStart(6, "0")}`,
          timestamp: Date.now(),
          origin: "replay" as const,
          version: 1,
          type: "CreateEntity" as const,
          payload: {
            entityId,
            name: `BatchEntity_${i}`,
            parentId: "batch_root_id_00",
            transform: {
              position: { x: i, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
            tags: [],
          },
        });
      }

      const batchOp = {
        id: "batch_benchmark_op",
        timestamp: Date.now(),
        origin: "replay" as const,
        version: 1,
        type: "BatchOp" as const,
        payload: { ops },
      };

      const doc = SceneDocumentSchema.parse({
        id: "batch_doc_id_0000",
        name: "Batch Benchmark Document",
        schemaVersion: CURRENT_SCHEMA_VERSION,
        rootEntityId: "batch_root_id_00",
        entities: {
          "batch_root_id_00": {
            id: "batch_root_id_00",
            name: "Root",
            parentId: null,
            children: [],
            components: [],
            tags: [],
            transform: {
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
            visible: true,
            locked: false,
          },
        },
      });

      const result = benchmarkOpApplication(doc, [batchOp] as unknown as import("@riff3d/patchops").PatchOp[]);
      const budget = TIERED_PERFORMANCE_BUDGETS.patchOp.batchOf100.fail * CI_MARGIN;

      expect(result.timeMs).toBeLessThan(budget);
    });
  });

  describe("tiered budget compilation (CI-measurable)", () => {
    it("small fixture compilation within tiered fail threshold", () => {
      const fixture = buildTransformsParentingFixture();
      const result = benchmarkCompilation(fixture);
      const budget = TIERED_PERFORMANCE_BUDGETS.compilation.small.fail * CI_MARGIN;

      expect(result.timeMs).toBeLessThan(budget);

      // Log tier achieved
      const tier = checkBudget("ir-compilation-small", result.timeMs);
      expect(["excellent", "pass", "fail"]).toContain(tier);
    });

    it("large fixture compilation within tiered fail threshold", () => {
      const fixture = buildAdversarialFixture();
      const result = benchmarkCompilation(fixture);
      const budget = TIERED_PERFORMANCE_BUDGETS.compilation.large.fail * CI_MARGIN;

      expect(result.timeMs).toBeLessThan(budget);

      const tier = checkBudget("ir-compilation-large", result.timeMs);
      expect(["excellent", "pass", "fail"]).toContain(tier);
    });
  });

  describe("tiered budget decompilation (CI-measurable)", () => {
    it("small fixture decompilation within tiered fail threshold", () => {
      const fixture = buildTransformsParentingFixture();
      const ir = compile(fixture);
      const result = benchmarkDecompilation(ir);
      const budget = TIERED_PERFORMANCE_BUDGETS.decompilation.small.fail * CI_MARGIN;

      expect(result.timeMs).toBeLessThan(budget);
    });

    it("large fixture decompilation within tiered fail threshold", () => {
      const fixture = buildAdversarialFixture();
      const ir = compile(fixture);
      const result = benchmarkDecompilation(ir);
      const budget = TIERED_PERFORMANCE_BUDGETS.decompilation.large.fail * CI_MARGIN;

      expect(result.timeMs).toBeLessThan(budget);
    });
  });

  describe("local-only budgets (skipped in CI)", () => {
    it.skip("FPS editing idle ~20 entities -- local only", () => {
      // Requires GPU + browser environment
      // Budget: Excellent >= 72 FPS, Pass >= 45 FPS, Fail < 30 FPS
    });

    it.skip("FPS editing idle ~100 entities -- local only", () => {
      // Requires GPU + browser environment
      // Budget: Excellent >= 60 FPS, Pass >= 30 FPS, Fail < 20 FPS
    });

    it.skip("Scene load time small fixture -- local only", () => {
      // Requires PlayCanvas adapter running
      // Budget: Excellent < 100ms, Pass < 500ms, Fail >= 1000ms
    });

    it.skip("Scene load time adversarial fixture -- local only", () => {
      // Requires PlayCanvas adapter running
      // Budget: Excellent < 300ms, Pass < 1000ms, Fail >= 3000ms
    });

    it.skip("Editor total memory (heap) -- local only", () => {
      // Requires full editor environment
      // Budget: Excellent < 100MB, Pass < 200MB, Fail >= 400MB
    });

    it.skip("Scene rebuild ~20 entities -- local only", () => {
      // Requires PlayCanvas adapter running
      // Budget: Pass < 100ms, Fail >= 500ms
    });
  });

  describe("budget definitions", () => {
    it("has all required budget categories (legacy)", () => {
      expect(PERFORMANCE_BUDGETS.compilationTime).toBeDefined();
      expect(PERFORMANCE_BUDGETS.decompilationTime).toBeDefined();
      expect(PERFORMANCE_BUDGETS.patchOpApply).toBeDefined();
      expect(PERFORMANCE_BUDGETS.memoryBaseline).toBeDefined();
    });

    it("compilation budgets are reasonable (legacy)", () => {
      expect(PERFORMANCE_BUDGETS.compilationTime.smallFixture).toBeLessThanOrEqual(
        PERFORMANCE_BUDGETS.compilationTime.mediumFixture,
      );
      expect(PERFORMANCE_BUDGETS.compilationTime.mediumFixture).toBeLessThanOrEqual(
        PERFORMANCE_BUDGETS.compilationTime.largeFixture,
      );
    });

    it("has at least 7 tiered budgets", () => {
      expect(TIERED_BUDGETS.length).toBeGreaterThanOrEqual(7);
    });

    it("has at least 4 simple budgets", () => {
      expect(SIMPLE_BUDGETS.length).toBeGreaterThanOrEqual(4);
    });

    it("all tiered budgets have valid direction", () => {
      for (const budget of TIERED_BUDGETS) {
        expect(["lower-is-better", "higher-is-better"]).toContain(budget.direction);
      }
    });

    it("all simple budgets have valid direction", () => {
      for (const budget of SIMPLE_BUDGETS) {
        expect(["lower-is-better", "higher-is-better"]).toContain(budget.direction);
      }
    });

    it("tiered budgets have consistent thresholds", () => {
      for (const budget of TIERED_BUDGETS) {
        if (budget.direction === "lower-is-better") {
          // excellent <= pass <= fail
          expect(budget.excellent).toBeLessThanOrEqual(budget.pass);
          expect(budget.pass).toBeLessThanOrEqual(budget.fail);
        } else {
          // excellent >= pass >= fail (higher is better)
          expect(budget.excellent).toBeGreaterThanOrEqual(budget.pass);
          expect(budget.pass).toBeGreaterThanOrEqual(budget.fail);
        }
      }
    });

    it("checkBudget returns correct tier for lower-is-better", () => {
      // ir-compilation-small: excellent=25, pass=50, fail=100
      expect(checkBudget("ir-compilation-small", 10)).toBe("excellent");
      expect(checkBudget("ir-compilation-small", 25)).toBe("excellent");
      expect(checkBudget("ir-compilation-small", 30)).toBe("pass");
      expect(checkBudget("ir-compilation-small", 50)).toBe("pass");
      expect(checkBudget("ir-compilation-small", 101)).toBe("fail");
    });

    it("checkBudget returns correct tier for higher-is-better", () => {
      // fps-editing-idle-20: excellent=72, pass=45, fail=30
      expect(checkBudget("fps-editing-idle-20", 80)).toBe("excellent");
      expect(checkBudget("fps-editing-idle-20", 72)).toBe("excellent");
      expect(checkBudget("fps-editing-idle-20", 60)).toBe("pass");
      expect(checkBudget("fps-editing-idle-20", 45)).toBe("pass");
      expect(checkBudget("fps-editing-idle-20", 20)).toBe("fail");
    });

    it("checkBudget works for simple budgets", () => {
      // patchop-single-apply: pass=1, fail=5 (lower-is-better)
      expect(checkBudget("patchop-single-apply", 0.5)).toBe("pass");
      expect(checkBudget("patchop-single-apply", 1)).toBe("pass");
      expect(checkBudget("patchop-single-apply", 6)).toBe("fail");
    });

    it("checkBudget throws for unknown metric", () => {
      expect(() => checkBudget("nonexistent-metric", 42)).toThrow("Unknown budget metric");
    });

    it("CI-measurable budgets include compilation and PatchOps", () => {
      const ciTiered = TIERED_BUDGETS.filter((b) => b.measurable === "ci");
      const ciSimple = SIMPLE_BUDGETS.filter((b) => b.measurable === "ci");

      // At least IR compilation budgets are CI-measurable
      expect(ciTiered.some((b) => b.metric.includes("compilation"))).toBe(true);
      // At least PatchOp budgets are CI-measurable
      expect(ciSimple.some((b) => b.metric.includes("patchop"))).toBe(true);
    });
  });
});
