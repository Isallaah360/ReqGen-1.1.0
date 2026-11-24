import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// 3.0.2: only the website's own components get the pop-up layer version of react-dom (see src/shim/reactDom.ts).
const WEBSITE_APP = fileURLToPath(new URL("../../app/", import.meta.url));
const SHIM = fileURLToPath(new URL("./src/shim/reactDom.ts", import.meta.url));
const WEBSITE_LIB = fileURLToPath(new URL("../../lib/", import.meta.url));
function websitePortals(): Plugin {
  return {
    name: "reqgen-website-portals",
    enforce: "pre",
    async resolveId(source, importer) {
      if (source === "react-dom" && importer && importer.startsWith(WEBSITE_APP)) return SHIM;
      return null;
    },
    // a website page that moves the whole browser ("go to sign-in") moves inside the app instead
    transform(code, id) {
      if (!(id.startsWith(WEBSITE_APP) || id.startsWith(WEBSITE_LIB))) return null;
      if (!/window\.location\.(assign|replace)\(/.test(code)) return null;
      return { code: code.replace(/window\.location\.(assign|replace)\(/g, "(window as any).__rgGo("), map: null };
    },
  };
}

// ReqGen real app: the screens are built into ../www and packed inside the APK.
export default defineConfig({
  plugins: [react(), websitePortals()],
  // 2.1.0: the website's own module list and access rules (one source for both)
  // 3.0.2: the website's data helpers are used as they are ("@/lib/..."); three are swapped for the app's own.
  resolve: {
    dedupe: ["react", "react-dom", "@supabase/supabase-js", "lucide-react"],
    alias: [
      { find: "@web", replacement: fileURLToPath(new URL("../../lib", import.meta.url)) },
      { find: /^@\/lib\/supabaseClient$/, replacement: fileURLToPath(new URL("./src/shim/supabaseClient.ts", import.meta.url)) },
      { find: /^@\/lib\/codeConfirm$/, replacement: fileURLToPath(new URL("./src/shim/codeConfirm.ts", import.meta.url)) },
      { find: /^@\/lib\/activity$/, replacement: fileURLToPath(new URL("./src/shim/activity.ts", import.meta.url)) },
      { find: /^@\/lib\/printA4$/, replacement: fileURLToPath(new URL("./src/shim/printA4.ts", import.meta.url)) },
      { find: /^next\/navigation$/, replacement: fileURLToPath(new URL("./src/office/next/navigation.ts", import.meta.url)) },
      { find: /^next\/link$/, replacement: fileURLToPath(new URL("./src/office/next/link.tsx", import.meta.url)) },
      { find: /^next\/image$/, replacement: fileURLToPath(new URL("./src/office/next/image.tsx", import.meta.url)) },
      { find: /^@\//, replacement: fileURLToPath(new URL("../../", import.meta.url)) },
    ],
  },
  base: "./",
  build: { outDir: "../www", emptyOutDir: true, target: "es2020", chunkSizeWarningLimit: 900, sourcemap: false },
});
