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
      const budget = PERFORMANCE_BUDGETS.patchOpApply.batchOf100 * CI_MARGIN;

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
      const budget = PERFORMANCE_BUDGETS.patchOpApply.batchOf100 * CI_MARGIN;

      expect(result.timeMs).toBeLessThan(budget);
    });
  });

  describe("budget definitions", () => {
    it("has all required budget categories", () => {
      expect(PERFORMANCE_BUDGETS.compilationTime).toBeDefined();
      expect(PERFORMANCE_BUDGETS.decompilationTime).toBeDefined();
      expect(PERFORMANCE_BUDGETS.patchOpApply).toBeDefined();
      expect(PERFORMANCE_BUDGETS.memoryBaseline).toBeDefined();
    });

    it("compilation budgets are reasonable", () => {
      expect(PERFORMANCE_BUDGETS.compilationTime.smallFixture).toBeLessThanOrEqual(
        PERFORMANCE_BUDGETS.compilationTime.mediumFixture,
      );
      expect(PERFORMANCE_BUDGETS.compilationTime.mediumFixture).toBeLessThanOrEqual(
        PERFORMANCE_BUDGETS.compilationTime.largeFixture,
      );
    });
  });
});
