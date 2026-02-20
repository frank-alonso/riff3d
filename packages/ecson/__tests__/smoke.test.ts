import { describe, it, expect } from "vitest";
import { VERSION } from "../src/index";

describe("@riff3d/ecson", () => {
  it("exports a VERSION string", () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe("string");
  });

  it("VERSION matches expected format", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
