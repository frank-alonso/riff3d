import { describe, it, expect } from "vitest";
import {
  GLTF_ALLOWLIST,
  isAllowedExtension,
  getPortableExtensions,
} from "../src/index";
import type { GltfExtensionEntry } from "../src/index";

describe("glTF Extension Allowlist v0", () => {
  describe("GLTF_ALLOWLIST", () => {
    it("contains expected entries", () => {
      expect(GLTF_ALLOWLIST.length).toBe(5);
      const names = GLTF_ALLOWLIST.map((e) => e.name);
      expect(names).toContain("core_gltf_2.0");
      expect(names).toContain("KHR_lights_punctual");
      expect(names).toContain("KHR_materials_unlit");
      expect(names).toContain("KHR_texture_transform");
      expect(names).toContain("KHR_physics_rigid_bodies");
    });

    it("each entry has required fields", () => {
      for (const entry of GLTF_ALLOWLIST) {
        expect(typeof entry.name).toBe("string");
        expect(entry.name.length).toBeGreaterThan(0);
        expect(["ratified", "draft"]).toContain(entry.status);
        expect(typeof entry.portable).toBe("boolean");
        expect(Array.isArray(entry.fixturesCovering)).toBe(true);
        expect(typeof entry.notes).toBe("string");
        expect(entry.notes.length).toBeGreaterThan(0);
      }
    });

    it("core_gltf_2.0 is ratified and portable", () => {
      const core = GLTF_ALLOWLIST.find((e) => e.name === "core_gltf_2.0");
      expect(core).toBeDefined();
      expect(core!.status).toBe("ratified");
      expect(core!.portable).toBe(true);
    });

    it("KHR_physics_rigid_bodies is draft and non-portable", () => {
      const physics = GLTF_ALLOWLIST.find(
        (e) => e.name === "KHR_physics_rigid_bodies",
      );
      expect(physics).toBeDefined();
      expect(physics!.status).toBe("draft");
      expect(physics!.portable).toBe(false);
    });
  });

  describe("isAllowedExtension", () => {
    it("returns true for KHR_lights_punctual", () => {
      expect(isAllowedExtension("KHR_lights_punctual")).toBe(true);
    });

    it("returns true for KHR_materials_unlit", () => {
      expect(isAllowedExtension("KHR_materials_unlit")).toBe(true);
    });

    it("returns false for KHR_draco_mesh_compression (not in allowlist)", () => {
      expect(isAllowedExtension("KHR_draco_mesh_compression")).toBe(false);
    });

    it("returns false for arbitrary unknown extension", () => {
      expect(isAllowedExtension("VENDOR_custom_ext")).toBe(false);
    });

    it("returns true for core_gltf_2.0", () => {
      expect(isAllowedExtension("core_gltf_2.0")).toBe(true);
    });
  });

  describe("getPortableExtensions", () => {
    it("returns only portable entries", () => {
      const portable = getPortableExtensions();
      for (const entry of portable) {
        expect(entry.portable).toBe(true);
      }
    });

    it("returns 3 portable extensions in v0", () => {
      const portable = getPortableExtensions();
      expect(portable.length).toBe(3);
      const names = portable.map((e) => e.name);
      expect(names).toContain("core_gltf_2.0");
      expect(names).toContain("KHR_lights_punctual");
      expect(names).toContain("KHR_materials_unlit");
    });

    it("does not include non-portable extensions", () => {
      const portable = getPortableExtensions();
      const names = portable.map((e) => e.name);
      expect(names).not.toContain("KHR_texture_transform");
      expect(names).not.toContain("KHR_physics_rigid_bodies");
    });
  });
});
