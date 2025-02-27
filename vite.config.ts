import {copyFileSync} from "node:fs"
import dts from "vite-plugin-dts"
import {defineConfig} from "vitest/config"

// https://vitest.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: "index.ts",
      name: "connect-redis",
      formats: ["es", "cjs"],
    },
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      external: ["express-session"],
      treeshake: false,
    },
    target: "node18",
  },
  plugins: [
    dts({
      include: ["index.ts"],
      rollupTypes: true,
      insertTypesEntry: true,
      afterBuild: () => {
        copyFileSync("dist/connect-redis.d.ts", "dist/connect-redis.d.cts")
      },
    }),
  ],
  test: {
    include: ["**/*_test.[jt]s"],
    coverage: {
      reporter: ["text"],
    },
  },
})
