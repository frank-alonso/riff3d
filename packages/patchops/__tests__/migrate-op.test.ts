import { describe, it, expect, vi } from "vitest";
import { migrateOp, MIGRATION_REGISTRY } from "../src/migrations/migrate-op.js";
import { CURRENT_PATCHOP_VERSION } from "../src/version.js";

describe("migrateOp", () => {
  it("current-version op passes through unchanged", () => {
    const rawOp = {
      id: "op_test",
      timestamp: 1000,
      origin: "user",
      version: CURRENT_PATCHOP_VERSION,
      type: "CreateEntity",
      payload: {
        entityId: "ent_1",
        name: "Test",
        parentId: null,
      },
    };

    const result = migrateOp(rawOp);
    expect(result.type).toBe("CreateEntity");
    expect(result.version).toBe(CURRENT_PATCHOP_VERSION);
  });

  it("emits console.warn when migration applies", () => {
    // Register a mock migration from v0 -> v1
    const mockMigration = vi.fn((raw: unknown) => {
      const obj = raw as Record<string, unknown>;
      return { ...obj, version: 1 };
    });

    MIGRATION_REGISTRY.set(0, mockMigration);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const rawOp = {
        id: "op_test",
        timestamp: 1000,
        origin: "user",
        version: 0,
        type: "CreateEntity",
        payload: {
          entityId: "ent_1",
          name: "Test",
          parentId: null,
        },
      };

      migrateOp(rawOp);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("migrated"),
      );
      expect(mockMigration).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      MIGRATION_REGISTRY.delete(0);
    }
  });

  it("unparseable input throws ZodError", () => {
    expect(() => migrateOp({ garbage: true })).toThrow();
  });

  it("migration registry is empty for v1", () => {
    expect(MIGRATION_REGISTRY.size).toBe(0);
  });
});
