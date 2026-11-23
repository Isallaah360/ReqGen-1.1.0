// ReqGen v4.6.12 (Kit K14): writes THIRD-PARTY-LICENSES.txt (project root and
// public/) from lib/credits.ts and each package's own licence file.
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync("lib/credits.ts", "utf8");
const pkgs = [...src.matchAll(/pkg: "([^"]+)"/g)].map((m) => m[1]);
const extra = ["react-dom", "@simplewebauthn/server", "@capacitor/app", "@capacitor/filesystem", "@capacitor/network", "@capacitor/preferences", "@capacitor/share", "@capacitor/splash-screen", "@capacitor/status-bar",
  // v4.7.0: packed inside the app 2.0.0 (mobile/app)
  "@capacitor/core", "@capacitor/haptics", "@capgo/capacitor-native-biometric", "@capacitor-community/file-opener"];
const all = [...new Set([...pkgs, ...extra])];
const out = [
  "ReqGen, Islamic Education Trust (IET)",
  "Third-party software licences",
  "",
  "ReqGen uses the open-source software listed below. Each is used unchanged,",
  "under its own licence, which is copied in full here. The success tick",
  "animation (public/kit/tick.json) and the empty-state drawing were made for",
  "ReqGen and carry no third-party licence.",
  "",
];
for (const name of all) {
  const dir = [path.join("node_modules", name), path.join("mobile", "app", "node_modules", name)].find((d) => fs.existsSync(path.join(d, "package.json"))) || path.join("node_modules", name);
  let pj;
  try { pj = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")); } catch { console.error(`Missing ${name}`); process.exitCode = 1; continue; }
  const file = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  const text = file ? fs.readFileSync(path.join(dir, file), "utf8").trim() : `${pj.license} licence. See ${pj.homepage || (pj.repository && (pj.repository.url || pj.repository)) || "the package"}.`;
  out.push("=".repeat(72), `${name} ${pj.version} (${pj.license})`, "=".repeat(72), text, "");
}
out.push("=".repeat(72), "ThorVG (inside @lottiefiles/dotlottie-web, MIT)", "=".repeat(72), "Copyright (c) 2020 - 2025 the ThorVG project. Licensed under the MIT licence: https://github.com/thorvg/thorvg/blob/main/LICENSE", "");
const body = out.join("\n");
fs.writeFileSync("THIRD-PARTY-LICENSES.txt", body);
fs.writeFileSync(path.join("public", "THIRD-PARTY-LICENSES.txt"), body);
console.log(`THIRD-PARTY-LICENSES.txt: ${all.length + 1} packages, ${Math.round(body.length / 1024)} KB`);
