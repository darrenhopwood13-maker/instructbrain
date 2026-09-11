// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  vite: {
    resolve: {
      alias: [
        {
          find: /^pdf-lib$/,
          // pdf-lib's package entry is CommonJS and its old tslib helpers fail
          // under the Worker bundler. Its self-contained ESM build has no such
          // runtime require and serves both report and compliance PDFs.
          replacement: fileURLToPath(
            new URL("./node_modules/pdf-lib/dist/pdf-lib.esm.min.js", import.meta.url),
          ),
        },
      ],
    },
  },
  nitro: {
    cloudflare: { nodeCompat: true },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
