import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// ReqGen real app: the screens are built into ../www and packed inside the APK.
export default defineConfig({
  plugins: [react()],
  // 2.1.0: the website's own module list and access rules (one source for both)
  resolve: { alias: { "@web": fileURLToPath(new URL("../../lib", import.meta.url)) } },
  base: "./",
  build: { outDir: "../www", emptyOutDir: true, target: "es2020", chunkSizeWarningLimit: 900, sourcemap: false },
});
