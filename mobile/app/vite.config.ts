import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * ReqGen app 4.0.0: an app of its own. Nothing from the website is packed in it.
 * The database address and its PUBLIC key are read at build time from the website folder's
 * .env.local (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY only: the prefix below
 * lets nothing else in). The secret service key is never read and never packed.
 */
export default defineConfig({
  plugins: [react()],
  envDir: fileURLToPath(new URL("../../", import.meta.url)),
  envPrefix: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  // 4.2.2: the Google Play copy (MAKE_PLAY.bat sets REQGEN_STORE=play) never downloads APKs itself: Play updates it.
  define: { __REQGEN_STORE__: JSON.stringify(process.env.REQGEN_STORE === "play" ? "play" : "site") },
  base: "./",
  build: { outDir: "../www", emptyOutDir: true, target: "es2020", chunkSizeWarningLimit: 900, sourcemap: false },
});
