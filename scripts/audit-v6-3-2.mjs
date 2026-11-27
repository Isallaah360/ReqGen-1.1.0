// ReqGen 6.3.2 with app 4.2.2 (build 14): clean signatures, the Direct message paper, links, error reports with a picture,
// the app home with More, Glass light and dark, and the Google Play build.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) failures += 1; };

const a4 = read("mobile/app/src/lib/a4.ts");
check("App papers: every signature is drawn as ink only", a4.includes("async function sigInline") && !/[^g]inline\(signatureUrl\(|[^g]inline\(sigOf\(/.test(a4.replace(/async function sigInline[\s\S]*?\n}\n/, "")));
check("App papers: a name without a stored step signature uses the person's saved signature", a4.includes("async function savedSigs") && a4.includes("pick(v.prepared_signature_url, vv.prepared_by)") && a4.includes("saved[String(r.created_by"));
const webDetails = read("app/profile/details/page.tsx"), appAcct = read("mobile/app/src/screens/Account.tsx");
check("Saving a signature always removes the paper background (website and app)", webDetails.includes("const cleanBg = true;") && appAcct.includes("up = (await cleanSignatureFile(up)).file; // always") && webDetails.includes("Clean my saved signature") && appAcct.includes("Clean my saved signature"));

const dlWeb = read("lib/directLetter.ts"), dlApp = read("mobile/app/src/lib/directLetter.ts");
check("Direct message paper: one file shared word for word by the website and the app", dlWeb === dlApp);
check("Direct message paper: a receiver sees only their own answer; DG (stamp) and Account added when paid", dlWeb.includes("if (!sender && !toDg && h.action_by && h.action_by !== viewerId) continue;") && dlWeb.includes('label: "Approved by the Director General"') && /stamp: true/.test(dlWeb) && dlWeb.includes("isAccount("));
check("Direct message paper: always one A4 page (smaller to 72%, then cut with a note)", dlWeb.includes("export function fitDirect") && dlWeb.includes("z > 0.72") && dlWeb.includes("Scan the code to read all of it"));
check("Direct message paper: used by the app PDF and the website print page", a4.includes("return printDirect(") && read("app/requests/[id]/print/page.tsx").includes("<DirectPrint "));
check("Links: only http and https become links, opened safely", /URL_RE = \/\\bhttps\?:/.test(dlWeb) && dlWeb.includes('rel="noopener noreferrer"') && read("app/components/ui/LinkText.tsx").includes("noopener noreferrer") && read("mobile/app/src/ui.tsx").includes("export function LinkText"));

const sql = read("database/v6_3_2_error_reports.sql");
check("Error reports: database step drops nothing and keeps the pictures private", !/drop\s+(table|function|column)/i.test(sql) && sql.includes("public, false") === false && sql.includes("'app-error-shots', 'app-error-shots', false") && sql.includes("(storage.foldername(name))[1] = auth.uid()::text") && sql.includes("using (bucket_id = 'app-error-shots' and public.reqgen_is_admin())"));
check("Error reports: the Super Admin is told at once, at most once in 10 minutes", sql.includes("p.system_account = 'superadmin'") && sql.includes("interval '10 minutes'"));
const core = read("mobile/app/src/lib/core.ts");
check("Error reports: the app sends a picture for real errors only, and falls back on older databases", core.includes('c.storage.from("app-error-shots").upload') && core.includes('normal ? "warning" : "error"') && core.includes('rpc("reqgen_app_log_error"'));
check("Error reports: a broken screen shows a calm page and is reported", read("mobile/app/src/Crash.tsx").includes("componentDidCatch") && read("mobile/app/src/main.tsx").includes("<Crash><App /></Crash>"));
check("Error reports: Super Admin reads them with the picture (website and app)", read("app/admin/system-health/ErrorReports.tsx").includes("createSignedUrl") && read("mobile/app/src/screens/office/Admin.tsx").includes("function ErrorReports"));

const home = read("mobile/app/src/screens/Home.tsx"), all = read("mobile/app/src/screens/AllApps.tsx"), icons = read("mobile/app/src/lib/appIcons.tsx");
check("App home: two rows of app icons, then More (four rounded squares) for every page", home.includes("all.length > 8") && home.includes('label: "More"') && all.includes("LayoutGrid") && all.includes('placeholder="Find a page'));
check("App icons: one picture per page; Settings is a gear, Profile a person", (icons.match(/<[A-Z][A-Za-z0-9]+ size=\{S\} \/>/g) || []).length >= 55 && !/Settings size=\{S\}/.test(icons) && icons.includes("Profile: <CircleUserRound"));
const css = read("mobile/app/src/styles.css"), appTsx = read("mobile/app/src/App.tsx"), me = read("mobile/app/src/screens/Me.tsx");
check("App: Glass Dock has light and dark; dark Icon Grid is IET blue, not black", css.includes(':root[data-look="glass"][data-theme="light"]{') && css.includes(':root[data-look="glass"][data-theme="dark"]{') && !css.includes("--bg:#0B0C0D") && appTsx.includes('const dark = theme === "dark" || (theme === "system" && mq.matches);') && !me.includes("always deep IET blue"));
check("App: Sign out is a solid red bar with readable white text", css.includes(".btn.bsignout,:root[data-look] .btn.bsignout{background:#EF3F27;color:#FFFFFF") && (me.match(/bsignout/g) || []).length >= 2);

const ps = read("mobile/make_app.ps1");
check("Google Play: MAKE_PLAY builds a signed .aab without the install permission or self-update", fs.existsSync("mobile/MAKE_PLAY.bat") && ps.includes("param([switch]$Play)") && ps.includes("bundleRelease") && ps.includes('-notmatch "REQUEST_INSTALL_PACKAGES"') && read("mobile/app/src/lib/native.ts").includes("if (!isNative() || FROM_PLAY) return null;") && read("mobile/.gitignore").includes("*.aab"));
check("Google Play: the app targets Android 16 (API 36)", /targetSdkVersion = 3[6-9]/.test(read("mobile/android/variables.gradle")));

const man = read("mobile/android/app/src/main/AndroidManifest.xml"), ui = read("mobile/app/src/ui.tsx");
check("App: the camera can be used for attachments and photos (asked the first time); no broad storage access", man.includes('android.permission.CAMERA') && man.includes('android:name="android.hardware.camera" android:required="false"') && !/READ_MEDIA_IMAGES|READ_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/.test(man) && ui.includes('capture="environment"') && ["NewRequest", "EditRequest", "DirectNew", "office/Vouchers"].every((f) => read(`mobile/app/src/screens/${f}.tsx`).includes("<AttachButtons")));

const pkg = JSON.parse(read("package.json"));
check("Website version 6.3.2 or later", /^(6\.3\.([2-9]|\d\d)|6\.([4-9]|\d\d)\.|([7-9]|\d\d)\.)/.test(pkg.version) && read("lib/version.ts").includes(`"${pkg.version}"`));
const vp = read("mobile/version.properties"); const vn = (vp.match(/REQGEN_VERSION_NAME=(.+)/) || [])[1]?.trim();
check("App version 4.2.2 or later, build 14 or later", /^4\.(2\.([2-9]|\d\d)|([3-9]|\d\d)\.)/.test(vn || "") && Number((vp.match(/REQGEN_VERSION_CODE=(\d+)/) || [])[1]) >= 14 && read("mobile/app/src/lib/core.ts").includes(`APP_VERSION = "${vn}"`));

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll ReqGen 6.3.2 checks passed.");
process.exit(failures ? 1 : 0);
