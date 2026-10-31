import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

// https://vite.dev/config/
export default defineConfig({
  build: { license: { fileName: "license.md" } },
  fmt: { sortImports: {}, sortTailwindcss: {} },
  lint: {
    plugins: ["react", "typescript", "oxc"],
    rules: {
      "react/rules-of-hooks": "error",
      "react/only-export-components": ["warn", { allowConstantExport: true }],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: { typeAware: true, typeCheck: true },
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
  },
  plugins: lazyPlugins(() => [
    react(),
    tailwindcss(),
    ...(process.env.VITEST ? [] : [cloudflare()]),
  ]),
  server: { watch: { usePolling: true } },
  staged: { "*": "vp check --fix" },
  test: { coverage: { enabled: true, include: ["src/**/*.{ts,tsx}"] } },
});
