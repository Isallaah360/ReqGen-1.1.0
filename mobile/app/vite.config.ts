import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ReqGen real app: the screens are built into ../www and packed inside the APK.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "../www", emptyOutDir: true, target: "es2020", chunkSizeWarningLimit: 900, sourcemap: false },
});
