// ReqGen v4.6.12 release lock: Blueprint 06 (ReqGen) and Blueprint 00 (the
// Barderian Design & Motion Kit) in IET colours. Design and motion only: no
// database change, no routing change, print-outs unchanged.
import fs from "node:fs";
import path from "node:path";
const read = (f) => fs.readFileSync(f, "utf8");
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) failures += 1; };
const walk = (d, out = []) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p, out); else out.push(p); } return out; };

const kit = read("app/v4/v4-kit.css");
const layout = read("app/layout.tsx");
check("Version 4.6.12 or later", /REQGEN_SEMVER = "4\.(6\.(1[2-9]|[2-9]\d)|([7-9]|[1-9]\d)\.\d+)"/.test(read("lib/version.ts")) && JSON.parse(read("package.json")).version === read("lib/version.ts").match(/REQGEN_SEMVER = "([^"]+)"/)[1]);
check("CHANGELOG has this version", read("CHANGELOG.md").includes(`## ${JSON.parse(read("package.json")).version}`));
check("Kit stylesheet loads after the brief", layout.indexOf("v4-kit.css") > layout.indexOf("v4-brief.css"));
check("Motion tokens: press 100, fast 180, base 240, slow 400, spring 450", ["--k-press: 100ms", "--k-fast: 180ms", "--k-base: 240ms", "--k-slow: 400ms", "--k-spring: 450ms"].every((t) => kit.includes(t)));
check("Kit pins: motion, dotLottie, auto-animate (exact versions)", (() => { const d = JSON.parse(read("package.json")).dependencies; return /^\d/.test(d.motion) && /^\d/.test(d["@lottiefiles/dotlottie-react"]) && /^\d/.test(d["@formkit/auto-animate"]); })());
check("Reduced motion and low-power phones get instant changes", kit.includes("prefers-reduced-motion: reduce") && kit.includes("html.v4-low-power"));
check("Printing is never animated", kit.includes("@media print"));
check("No purple in the Kit", !/#7C3AED|#8B5CF6|#4C1D95|#6D28D9|purple|violet/i.test(kit));

// K1 skeleton
check("K1 skeleton shimmer 1.3 s", kit.includes("animation-duration: 1.3s"));
// K2 dialog
const host = read("app/components/ui/DialogHost.tsx");
check("K2 dialog: scale 0.96 to 1 in 240 ms", kit.includes("k-dialog-in") && kit.includes("scale(.96)") && kit.includes("var(--k-base, 240ms)"));
check("K2 dialog: danger starts on Cancel, red button on the right", host.includes('dialog.tone === "danger" && cancelRef.current') && host.indexOf("cancelRef} type") < host.indexOf("rg-btn-danger"));
check("K2 dialog: comment box of several lines", host.includes("rg-dialog-textarea") && read("lib/dialog.ts").includes("multiline?: boolean"));
check("K2 form dialogs centred on phones too", kit.includes("k-modal-in") && /max-width: 640px[\s\S]*top: 50%/.test(kit));
// K3 update
const sheet = read("app/components/app/UpdateSheet.tsx");
check("K3 app: Do you want to upgrade? Later and Upgrade, then KB of KB, %, Cancel", sheet.includes("Do you want to upgrade?") && sheet.includes(">Later<") && sheet.includes("Upgrade") && sheet.includes("of ${kb(") && sheet.includes(">Cancel<") && read("lib/app/update.ts").includes("cancelled?.()"));
check("K3 website: New version is ready with Refresh, from /api/version", read("app/components/kit/WebUpdate.tsx").includes("New version v{ready} is ready.") && fs.existsSync("app/api/version/route.ts") && layout.includes("<WebUpdate />"));
// K4 toast
const toastHost = read("app/components/kit/ToastHost.tsx");
check("K4 centred toast for 2.5 s with optional Undo", toastHost.includes("2500") && toastHost.includes("t.undo") && kit.includes("place-items: center") && layout.includes("<ToastHost />"));
check("K4 optimistic approve: the step fills at once and rolls back on failure", (() => { const w = read("app/components/requests/RequestDetailsWorkspace.tsx"); return w.includes("setOptimistic(true)") && w.includes("setOptimistic(false)") && w.includes("Your approval was undone.") && w.includes('"v4-done v4-saving"'); })());
// K5 busy button
check("K5 busy button keeps its width and ignores a second tap", read("app/components/kit/BusyButton.tsx").includes('visibility: "hidden"') && read("app/components/kit/BusyButton.tsx").includes("if (busy) { e.preventDefault(); return; }"));
// K6 tab bar
check("K6 tab bar: marker slides on the spring; Approvals for approvers only", read("app/components/v4/PhoneNav.tsx").includes("k-pill") && kit.includes("var(--k-spring, 450ms)") && read("app/components/v4/PhoneNav.tsx").includes("approves(me.roleSet)"));
// K8 empty state
const empty = read("app/components/kit/EmptyState.tsx");
check("K8 empty state: drawn person with a darker skin tone, under 30 KB", empty.includes("#6B3F24") && Buffer.byteLength(empty) < 30 * 1024);
// K9 success
const tick = JSON.parse(read("public/kit/tick.json"));
check("K9 dotLottie tick plays once in 1.2 s or less", (tick.op - tick.ip) / tick.fr <= 1.2 && read("app/components/kit/SuccessTick.tsx").includes("loop={false}"));
check("K9 player engine self-hosted and the same as the installed one", fs.existsSync("public/kit/dotlottie-player.wasm") && fs.statSync("public/kit/dotlottie-player.wasm").size === fs.statSync("node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm").size && read("app/components/kit/SuccessTick.tsx").includes('setWasmUrl("/kit/dotlottie-player.wasm")'));
check("K9 player loads lazily, never with the page", !/from "@lottiefiles\/dotlottie-react"/.test(read("app/components/kit/SuccessTick.tsx").replace(/import type[^\n]+\n/, "")) && read("app/components/kit/SuccessTick.tsx").includes('import("@lottiefiles/dotlottie-react")'));
check("K9 only for real milestones; other saves get the toast", read("app/components/v4/Motion.tsx").includes("MILESTONE") && read("app/components/v4/Motion.tsx").includes("toast({"));
check("K9 new request: Request sent with its number", read("app/requests/new/page.tsx").includes('celebrate({ title: "Request sent", line: `${requestNo}'));
check("DG stamp lands beside the signature: scale 1.15 to 1, 300 ms, once", kit.includes("scale(1.15)") && kit.includes("k-land 300ms") && read("app/components/v4/Motion.tsx").includes('src="/v4/iet-stamp.png"'));
// K10 ticker
const motion = read("app/components/v4/Motion.tsx");
check("K10 number ticker: about 1.4 s, once, when in view", motion.includes("const dur = 1400") && motion.includes("IntersectionObserver"));
// K13 icons
check("K13 Lucide icons with a 2 px stroke", read("app/components/v4/Icon.tsx").includes("strokeWidth={2}"));
// K14 credits
check("K14 /credits page, public, linked from both footers and the app", fs.existsSync("app/credits/page.tsx") && read("lib/permissions.ts").includes('"/credits"') && read("app/components/PublicAuthShell.tsx").includes('href="/credits"') && read("app/components/v4/AppFrame.tsx").includes('href="/credits"') && read("app/components/v4/PhoneNav.tsx").includes('href="/credits"'));
check("THIRD-PARTY-LICENSES.txt in the project and on the website", fs.existsSync("THIRD-PARTY-LICENSES.txt") && fs.existsSync("public/THIRD-PARTY-LICENSES.txt") && read("THIRD-PARTY-LICENSES.txt").includes("motion "));
// K15 idle
const idle = read("app/components/SessionTimeout.tsx");
check("K15 idle sign-out: K2 dialog with a countdown ring, same rule", idle.includes("k-ring") && idle.includes("Still there?") && idle.includes("WARNING_BEFORE_LOGOUT_MS = 60 * 1000"));

// Blueprint 06 screens
check("Route: a vertical timeline; done filled, current pulses (2 s), skipped dashed", kit.includes("k-pulse 2s") && kit.includes("li.v4-skip::before") && read("app/components/requests/RequestDetailsWorkspace.tsx").includes('cls: "v4-skip"'));
check("Approve and reject open a K2 dialog with a comment box", read("app/components/requests/RequestDetailsWorkspace.tsx").includes("askThenAct(\"Approve\")") && read("app/components/requests/RequestDetailsWorkspace.tsx").includes("multiline: true"));
check("Requests list: rows slide in, K8 when empty", read("app/requests/mine/page.tsx").includes("useListMotion") && read("app/requests/mine/page.tsx").includes("<EmptyState"));
const pv = read("app/payment-vouchers/new/page.tsx");
check("Vouchers: selectable cards, live x of 10, the 11th refused with a K4 message", pv.includes("const CAP = 10") && pv.includes('className="k-pick"') && pv.includes("{officialChosen} of {CAP}") && pv.includes("Start another voucher for the rest.`, tone: \"error\""));
check("Subhead balances: bar gauge, red with Over budget and the block message", read("app/finance/subheads/page.tsx").includes("Over budget") && read("app/finance/subheads/page.tsx").includes("No new request can use"));
check("Notifications: the bell dot pops, the lists slide", read("app/components/v4/Bell.tsx").includes("v4-dot k-pop") && read("app/components/v4/Bell.tsx").includes("<MotionList") && read("app/notifications/page.tsx").includes("<MotionList"));
check("QR check: result card enters slowly, tick or cross with the reason", read("app/check/[kind]/[id]/page.tsx").includes("k-check k-good") && read("app/check/[kind]/[id]/page.tsx").includes("k-check k-bad") && kit.includes("var(--k-slow, 400ms)"));

// What must not change
const files = walk("app").concat(walk("lib")).filter((f) => /\.(tsx?|mjs)$/.test(f));
check("No browser alert, confirm or prompt anywhere", files.every((f) => !/(?<![\w.])(window\.)?(alert|confirm|prompt)\s*\(/.test(read(f).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "").replace(/(alertDialog|confirmDialog|promptDialog)\s*\(/g, ""))));
check("No database step in this release", !fs.readdirSync("database").some((f) => /4_6_12/.test(f)));
check("Print-outs do not load the Kit", walk("app").filter((f) => /print/i.test(f) && /\.tsx$/.test(f)).every((f) => !/components\/kit|v4-kit|motion\/react|dotlottie|auto-animate/.test(read(f))));
check("Fingerprint label unchanged (saved fingerprints are kept)", read("lib/app/native.ts").includes('APP_SERVER_NAME = "reqgen.barderians.com.ng"'));
check("Kit wording: no long dashes", ["app/components/kit/ToastHost.tsx", "app/components/kit/EmptyState.tsx", "app/components/kit/WebUpdate.tsx", "app/components/app/UpdateSheet.tsx", "app/credits/page.tsx", "lib/toast.ts"].every((f) => !read(f).includes("—")));

console.log(failures ? `v4.6.12 release lock: ${failures} failure(s).` : "v4.6.12 release lock: PASSED");
process.exit(failures ? 1 : 0);
