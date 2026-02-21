import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".turbo/**",
      ".next/**",
      "apps/editor/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // ── Mutation-boundary enforcement (CF-P4-01) ──────────────────────────
  // Adapters must never import from @riff3d/patchops or @riff3d/ecson.
  // They read Canonical IR only (Architecture Rule #3).
  {
    files: [
      "packages/adapter-playcanvas/src/**/*.ts",
      "packages/adapter-babylon/src/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@riff3d/patchops",
              message:
                "Adapters must not import PatchOps. Adapters read Canonical IR only (Architecture Rule #3).",
            },
            {
              name: "@riff3d/ecson",
              message:
                "Adapters must not import ECSON directly. Adapters read Canonical IR only (Architecture Rule #3).",
            },
          ],
        },
      ],
    },
  },
);
