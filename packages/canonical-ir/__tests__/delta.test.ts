import { describe, it, expect } from "vitest";
import { computeDelta } from "../src/delta";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a minimal PatchOp-like object for testing. */
function makeOp(type: string, payload: Record<string, unknown> = {}) {
  return { type, payload };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("computeDelta", () => {
  describe("SetProperty -> node-transform deltas", () => {
    it("maps transform.position to node-transform delta", () => {
      const delta = computeDelta(
        makeOp("SetProperty", {
          entityId: "e1",
          path: "transform.position",
          value: { x: 1, y: 2, z: 3 },
        }),
      );

      expect(delta).toEqual({
        type: "node-transform",
        nodeId: "e1",
        transform: { position: { x: 1, y: 2, z: 3 } },
      });
    });

    it("maps transform.rotation to node-transform delta", () => {
      const delta = computeDelta(
        makeOp("SetProperty", {
          entityId: "e1",
          path: "transform.rotation",
          value: { x: 0.1, y: 0.2, z: 0.3, w: 0.9 },
        }),
      );

      expect(delta).toEqual({
        type: "node-transform",
        nodeId: "e1",
        transform: { rotation: { x: 0.1, y: 0.2, z: 0.3, w: 0.9 } },
      });
    });

    it("maps transform.scale to node-transform delta", () => {
      const delta = computeDelta(
        makeOp("SetProperty", {
          entityId: "e1",
          path: "transform.scale",
          value: { x: 2, y: 2, z: 2 },
        }),
      );

      expect(delta).toEqual({
        type: "node-transform",
        nodeId: "e1",
        transform: { scale: { x: 2, y: 2, z: 2 } },
      });
    });
  });

  describe("SetProperty -> node-visibility delta", () => {
    it("maps visible to node-visibility delta", () => {
      const delta = computeDelta(
        makeOp("SetProperty", {
          entityId: "e1",
          path: "visible",
          value: false,
        }),
      );

      expect(delta).toEqual({
        type: "node-visibility",
        nodeId: "e1",
        visible: false,
      });
    });
  });

  describe("SetProperty -> environment delta", () => {
    it("maps environment.fog.color to environment delta", () => {
      const delta = computeDelta(
        makeOp("SetProperty", {
          entityId: "__environment__",
          path: "environment.fog.color",
          value: "#ff0000",
        }),
      );

      expect(delta).toEqual({
        type: "environment",
        path: "fog.color",
        value: "#ff0000",
      });
    });

    it("maps environment.ambientLight.intensity to environment delta", () => {
      const delta = computeDelta(
        makeOp("SetProperty", {
          entityId: "__environment__",
          path: "environment.ambientLight.intensity",
          value: 0.8,
        }),
      );

      expect(delta).toEqual({
        type: "environment",
        path: "ambientLight.intensity",
        value: 0.8,
      });
    });
  });

  describe("SetProperty -> unknown path falls back to full-rebuild", () => {
    it("unknown property path triggers full rebuild", () => {
      const delta = computeDelta(
        makeOp("SetProperty", {
          entityId: "e1",
          path: "some.unknown.path",
          value: 42,
        }),
      );

      expect(delta).toEqual({ type: "full-rebuild" });
    });
  });

  describe("SetComponentProperty -> component-property delta", () => {
    it("maps SetComponentProperty to component-property delta", () => {
      const delta = computeDelta(
        makeOp("SetComponentProperty", {
          entityId: "e1",
          componentType: "Material",
          propertyPath: "baseColor",
          value: "#00ff00",
        }),
      );

      expect(delta).toEqual({
        type: "component-property",
        nodeId: "e1",
        componentIndex: 0,
        property: "Material:baseColor",
        value: "#00ff00",
      });
    });

    it("encodes componentType in property string", () => {
      const delta = computeDelta(
        makeOp("SetComponentProperty", {
          entityId: "e1",
          componentType: "Light",
          propertyPath: "intensity",
          value: 2.5,
        }),
      );

      expect(delta.type).toBe("component-property");
      if (delta.type === "component-property") {
        expect(delta.property).toBe("Light:intensity");
      }
    });
  });

  describe("Structural ops -> full-rebuild", () => {
    const structuralOps = [
      "CreateEntity",
      "DeleteEntity",
      "Reparent",
      "AddComponent",
      "RemoveComponent",
      "AddChild",
      "RemoveChild",
      "BatchOp",
      "AddAsset",
      "RemoveAsset",
      "ReplaceAssetRef",
      "AddKeyframe",
      "RemoveKeyframe",
      "SetKeyframeValue",
    ];

    for (const opType of structuralOps) {
      it(`${opType} produces full-rebuild`, () => {
        const delta = computeDelta(makeOp(opType));
        expect(delta).toEqual({ type: "full-rebuild" });
      });
    }
  });

  describe("Unknown op types -> full-rebuild", () => {
    it("unknown op type produces full-rebuild", () => {
      const delta = computeDelta(makeOp("UnknownFutureOp"));
      expect(delta).toEqual({ type: "full-rebuild" });
    });
  });
});
