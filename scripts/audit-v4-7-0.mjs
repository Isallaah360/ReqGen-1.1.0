// ReqGen v4.7.0 release lock, with the real app 2.0.0 and the Barderian Privacy and Lightness Check.
//  1. One SMS and e-mail code for every send and every decision (website and app), checked by the database.
//  2. Direct to one or many people from any departments; each answers on their own; forward to the DG to be paid.
//  3. Recipients are told at once (SMS, e-mail, in-app). The SMS and e-mail carry the number only.
//  4. What each officer said shows on the request and prints on page 2. Page 1 is unchanged.
//  5. The real app: screens inside the APK, never a window on the website.
//  6. Privacy: only our own servers; no trackers; no outside fonts or scripts; CSP set.
import fs from "node:fs";
import path from "node:path";
const read = (f) => fs.readFileSync(f, "utf8");
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) failures += 1; };
const walk = (d, out = []) => { if (!fs.existsSync(d)) return out; for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.name === "node_modules" || f.name === ".next") continue; if (f.isDirectory()) walk(p, out); else out.push(p); } return out; };

const pkg = JSON.parse(read("package.json"));
check("Version 4.7.0 or later, the same in package.json and lib/version.ts", /^(4\.(7|[89]|\d\d)|[5-9])\./.test(pkg.version) && read("lib/version.ts").includes(`REQGEN_SEMVER = "${pkg.version}"`));
check("CHANGELOG has this version", read("CHANGELOG.md").includes(`## ${pkg.version}`));

// 1. codes
const sql = read("database/v4_7_0_upgrade.sql");
check("DB: the pass table is written only by the server (row security on, no grants)", sql.includes("reqgen_action_passes") && /alter table public\.reqgen_action_passes enable row level security/i.test(sql) && /revoke all on (table )?public\.reqgen_action_passes from (public, )?anon, authenticated/i.test(sql));
check("DB: requests refuse a send or a decision without a fresh pass", sql.includes("reqgen_guard_request_action") && sql.includes("REQGEN_CODE_REQUIRED") && /before insert or update of current_owner on public\.requests/i.test(sql));
check("DB: nothing is dropped except the guard and policies it replaces", !/drop table|drop column|truncate (?!v470_report)/i.test(sql));
const code = read("lib/server/codeService.ts");
check("Server: code by SMS and e-mail, 10 minutes, 5 tries, resend wait", code.includes("sendSendchampSms") && code.includes("sendSendchampEmail") && code.includes("CODE_MINUTES") && /5/.test(code) && code.includes("RESEND_SECONDS"));
check("Server: the code is never written to the SMS log in clear", code.includes("ReqGen code (hidden)"));
check("Website: the code box is mounted once for every page", read("app/layout.tsx").includes("<CodeHost />"));
check("Website: a refused call asks for the code and tries once more", read("lib/supabaseClient.ts").includes("REQGEN_CODE_REQUIRED") && read("lib/supabaseClient.ts").includes("confirmWithCode"));
const work = read("app/components/requests/RequestDetailsWorkspace.tsx");
check("Website: Approve and Send back use the SMS or e-mail code, not the authenticator", work.includes('await confirmWithCode(what)') && !work.includes('if (!totpFactorId) {\n      setMsg("✕ You must set up 2FA'));
check("Website: sending a request always asks for the code", read("app/requests/new/page.tsx").includes('confirmWithCode("send this request")') && read("app/requests/direct/page.tsx").includes("confirmWithCode("));
check("Website API: code routes open to the app only (CORS for https://localhost)", read("lib/server/cors.ts").includes('"https://localhost"') && ["app/api/otp/send/route.ts", "app/api/otp/verify/route.ts", "app/api/notifications/alert/route.ts", "app/api/app-config/route.ts"].every((f) => read(f).includes("OPTIONS = preflight")));
check("App config gives only public values (no service key)", !/SERVICE_ROLE|service_role/i.test(read("app/api/app-config/route.ts")));

// 2. Direct to many
check("DB: Direct to up to 50 people, each answers on their own, forward to the DG with the Account Officer", sql.includes("reqgen_direct_send") && sql.includes("reqgen_direct_answer") && sql.includes("forward_dg") && /50/.test(sql));
check("DB: Registry sees the Direct route (sender and people), never the message", sql.includes("reqgen_registry_moves_routed") && sql.includes("Sent by"));
check("Website: Direct page picks people from every department", read("app/requests/direct/page.tsx").includes("reqgen_direct_people") && read("app/requests/direct/page.tsx").includes("reqgen_direct_send"));
check("Website: Direct waiting counts in the bell, Home and Approvals", ["app/components/v4/AppFrame.tsx", "app/approvals/inbox/page.tsx", "app/dashboard/page.tsx"].every((f) => read(f).includes("reqgen_direct_waiting")));

// 3. alerts
const alert = read("app/api/notifications/alert/route.ts");
check("Alerts: SMS and e-mail carry the request number only, never the title or amount", !/\.title|amount/.test(alert.replace(/\/\*[\s\S]*?\*\//g, "").replace(/select\([^)]*\)/g, "")) && alert.includes("is waiting for your action"));
check("Alerts: only someone involved in the request can send them, once a minute per person", alert.includes("You are not allowed to send alerts") && alert.includes("60000"));

// 4. comments trail
const print = read("app/requests/[id]/print/page.tsx");
check("Request page: What the officers said", work.includes("What the officers said") && work.includes("officerComments"));
check("Print: comments on page 2, page 1 unchanged", print.includes("rg-trail-page") && print.includes("[sheetRef.current, trailRef.current]"));

// 5. the real app
const cap = JSON.parse(read("mobile/capacitor.config.json"));
check("App: no website address inside (not a window on the website)", !cap.server?.url && cap.server?.androidScheme === "https");
check("App: screens built into mobile/www (data-reqgen-app=2)", fs.existsSync("mobile/www/index.html") && read("mobile/www/index.html").includes('data-reqgen-app="2"'));
check("App maker refuses an APK without the app screens", read("mobile/make_app.ps1").includes('data-reqgen-app="2"') && read("mobile/make_app.ps1").includes("The APK opens a website in a window"));
check("App version 2.0.0, build 4 or later", /REQGEN_VERSION_NAME=[2-9]\.\d+\.\d+/.test(read("mobile/version.properties")) && Number(read("mobile/version.properties").match(/REQGEN_VERSION_CODE=(\d+)/)[1]) >= 4);
const appSrc = walk("mobile/app/src").filter((f) => /\.(tsx?|css)$/.test(f)).map(read).join("\n");
check("App: code sheet for every send and decision, with the safety net", appSrc.includes('askCode("send this request")') && appSrc.includes("REQGEN_CODE_REQUIRED") && appSrc.includes("/api/otp/verify"));
check("App: PIN kept only as a SHA-256 fingerprint, locks after 15 minutes", appSrc.includes('crypto.subtle.digest("SHA-256"') && appSrc.includes("15 * 60 * 1000"));
check("App: sign-out removes the saved lists of that person", appSrc.includes('k.startsWith("rg:c:")'));
check("App: no balances shown (staff privacy)", !/approved_allocation|reserved_amount|expenditure/.test(appSrc));
check("App wording: no long dashes or dot bullets", !/[—–•]/.test(appSrc.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")));
check("App colours: no purple", !/#7C3AED|#8B5CF6|#6D28D9|purple|violet/i.test(appSrc.replace(/\/\*[\s\S]*?\*\//g, "")));
check("App: status bar follows light and dark (Android 15 and newer)", appSrc.includes("StatusBar.setStyle") && JSON.stringify(cap).includes('"insetsHandling":"css"'));

// 5b. password reset link (the DG could not reset his password from the app)
const reset = read("app/reset-password/page.tsx");
check("Reset link: the key in the address sets the session, even without a full reload", reset.includes('hash.get("access_token")') && reset.includes("supabase.auth.setSession"));
check("Reset link: expired or used links are explained, and the key is cleared from the address", reset.includes("otp_expired") && reset.includes('replaceState(null, "", "/reset-password")'));
check("Reset link: scanner-safe token_hash links are checked only on Continue", reset.includes("verifyOtp({ token_hash"));
check("App 1.0.2: sign-in and reset links load the page fully", read("app/components/app/AppBridge.tsx").includes("window.location.assign(u.toString())"));
check("App 2.0.0: website links open in the browser, not in the app", !read("mobile/android/app/src/main/AndroidManifest.xml").includes('android:host="ietreqgen.barderians.com.ng"'));

// 6. privacy
const nextCfg = read("next.config.ts");
check("Website CSP: only this website and our database", nextCfg.includes("Content-Security-Policy") && nextCfg.includes("default-src 'self'") && nextCfg.includes("frame-ancestors 'self'"));
check("App CSP: only our database and website", read("mobile/app/index.html").includes("connect-src 'self' https://*.supabase.co wss://*.supabase.co https://ietreqgen.barderians.com.ng"));
const client = walk("app").concat(walk("lib"), walk("mobile/app/src")).filter((f) => /\.(tsx?|css|mjs)$/.test(f) && !f.includes(`${path.sep}api${path.sep}`) && !f.includes(`lib${path.sep}server`));
const outside = [];
for (const f of client) {
  const t = read(f);
  for (const m of t.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    const h = m[1].toLowerCase();
    if (/(^|\.)barderians\.com\.ng$|supabase\.co$|^localhost$|^example\.|w3\.org$|wa\.me$|iet\.org\.ng$|^req-gen-[\w-]+\.vercel\.app$/.test(h)) continue;
    if (/schemas\.openxmlformats\.org$/.test(h)) continue; // spreadsheet XML names, never loaded
    if (f.endsWith(`lib${path.sep}sendchamp.ts`) && h === "api.sendchamp.com") continue; // server only: SMS and e-mail go out from our server
    if (f.endsWith(`lib${path.sep}credits.ts`) && /github\.com$|npmjs\.com$/.test(h)) continue; // credit links, never loaded
    outside.push(`${f}: ${h}`);
  }
}
check(`No outside addresses in the screens${outside.length ? ` (${outside.slice(0, 4).join(", ")})` : ""}`, outside.length === 0);
check("Sendchamp is used by the server only, never by a screen", !walk("app").concat(walk("lib")).filter((f) => /\.tsx?$/.test(f) && read(f).includes('"use client"')).some((f) => read(f).includes("lib/sendchamp")));
check("No trackers or analytics packages", !Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((d) => /analytics|gtag|segment|mixpanel|hotjar|posthog|sentry|amplitude/i.test(d)));
check("No outside fonts", !client.some((f) => /fonts\.googleapis|fonts\.gstatic/.test(read(f))));
check("No .env files or keystores in the project", !walk(".").some((f) => /(^|[\\/])\.env(\.|$)(?!example)|\.keystore$|\.jks$/.test(f) && !f.includes("node_modules")));

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll v4.7.0 checks passed.");
process.exit(failures ? 1 : 0);
