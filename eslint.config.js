import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * Two long-standing problems are fixed here, and one decision is recorded.
 *
 * 1. The config pinned `eslint-plugin-prettier/recommended`, which reports every
 *    formatting difference as a lint *error*. It also meant ESLint could never
 *    run at all, because typescript-eslint has no release supporting TypeScript
 *    7 (its peer range is `typescript >=4.8.4 <6.1.0`). The run died on startup
 *    before reading a single file, so nobody saw the thousands of problems it
 *    was hiding.
 *
 *    Formatting now belongs to `bun run format`, which is what Prettier's own
 *    documentation asks for. `eslint-config-prettier` stays last in the chain so
 *    no stylistic rule can fight the formatter.
 *
 * 2. `@typescript-eslint/no-explicit-any` is a warning, not an error. Several
 *    data modules take `any` deliberately: the generated Supabase types lag the
 *    applied migrations, and the escape hatch is documented in the code that
 *    uses it. Warning keeps it visible; error would fail on a decision already
 *    made, and would train everyone to ignore this file's output.
 *
 * Recorded rather than enforced: the repository is not currently Prettier-clean.
 * `bun run format` will reformat it, but that touches most of the tree, so it
 * wants doing as its own commit.
 */
export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Deliberate escape hatch where generated types lag migrations. See note 2.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  prettierConfig,
);
