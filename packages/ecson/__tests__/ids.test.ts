import { describe, it, expect } from "vitest";
import {
  generateEntityId,
  generateOpId,
  generateAssetId,
  generateWireId,
} from "../src/index";

describe("generateEntityId", () => {
  it("produces 16-character strings", () => {
    const id = generateEntityId();
    expect(id).toHaveLength(16);
  });

  it("produces alphanumeric-only characters", () => {
    const id = generateEntityId();
    expect(id).toMatch(/^[0-9a-zA-Z]+$/);
  });
});

describe("generateOpId", () => {
  it("produces 21-character strings", () => {
    const id = generateOpId();
    expect(id).toHaveLength(21);
  });
});

describe("generateAssetId", () => {
  it("starts with 'ast_'", () => {
    const id = generateAssetId();
    expect(id).toMatch(/^ast_/);
  });

  it("has total length of 16 (4-char prefix + 12-char body)", () => {
    const id = generateAssetId();
    expect(id).toHaveLength(16);
  });
});

describe("generateWireId", () => {
  it("starts with 'wir_'", () => {
    const id = generateWireId();
    expect(id).toMatch(/^wir_/);
  });

  it("has total length of 16 (4-char prefix + 12-char body)", () => {
    const id = generateWireId();
    expect(id).toHaveLength(16);
  });
});

describe("collision resistance", () => {
  it("generates 1000 entity IDs with zero collisions", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateEntityId());
    }
    expect(ids.size).toBe(1000);
  });

  it("generates 1000 op IDs with zero collisions", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateOpId());
    }
    expect(ids.size).toBe(1000);
  });

  it("generates 1000 asset IDs with zero collisions", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateAssetId());
    }
    expect(ids.size).toBe(1000);
  });

  it("generates 1000 wire IDs with zero collisions", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateWireId());
    }
    expect(ids.size).toBe(1000);
  });
});
