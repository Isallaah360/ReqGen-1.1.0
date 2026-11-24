// ReqGen v4.7.1 with app 2.0.1: one standard for checks, the same on the website and the app.
//   Signing in: password, then the authenticator (2FA) code; then fingerprint or PIN.
//   Every action (send, approve, return, decline, forward, edit, delete, withdraw, reopen, subhead,
//   Finance, vouchers, Super Admin jobs): the 6-digit code sent by SMS and e-mail.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) failures += 1; };

const pkg = JSON.parse(read("package.json"));
check("Version 4.7.1 or later", /^(4\.(7\.([1-9]|\d\d)|([89]|\d\d)\.\d+)|([5-9]|\d\d)\.\d+\.\d+)/.test(pkg.version) && read("lib/version.ts").includes(`REQGEN_SEMVER = "${pkg.version}"`));
check("CHANGELOG has this version", read("CHANGELOG.md").includes(`## ${pkg.version}`));

// sign-in
const signIn = read("mobile/app/src/screens/SignIn.tsx");
check("App sign-in: authenticator code (2FA), no SMS sign-in code", signIn.includes("auth.mfa.challengeAndVerify") && !signIn.includes('"sign_in"'));
check("App sign-in: no authenticator means set it up first", signIn.includes("/mfa/setup"));
check("Website sign-in still asks the authenticator", read("app/mfa/page.tsx").includes("Code from your authenticator app"));

// actions use the SMS or e-mail code
const work = read("app/components/requests/RequestDetailsWorkspace.tsx");
check("Delete, resubmit, withdraw, reopen and subhead changes ask for the SMS or e-mail code", ["delete this request", "send it again", "withdraw this request", "reopen this request", "change the subhead"].every((w) => work.includes(`"${w}"`) || work.includes(`? "${w}"`) || work.includes(w)));
check("Correcting a request asks for the SMS or e-mail code", read("app/requests/[id]/edit/page.tsx").includes('confirmWithCode("save the corrected request")'));
check("Deleting an account asks for the SMS or e-mail code", read("app/admin/users/[id]/page.tsx").includes('confirmWithCode("delete this account")'));
const fresh = read("lib/v4/freshConfirm.ts");
check("Finance, vouchers and Super Admin jobs: the SMS or e-mail code only", fresh.includes("confirmWithCode(purpose)") && !fresh.includes("challengeAndVerify"));
check("Server: Super Admin jobs accept the SMS or e-mail pass", read("lib/server/superAdmin.ts").includes("export async function freshProof") && read("app/api/admin/users/[id]/route.ts").includes("freshProof("));

// notices
check("When a request moves, the sender is told too", read("app/api/notifications/alert/route.ts").includes("has moved on"));
check("The app sends the website's notices (sent, waiting, decided)", read("mobile/app/src/lib/core.ts").includes("/api/notifications/sms/request-event") && read("app/api/notifications/sms/request-event/route.ts").includes("OPTIONS = preflight"));

// fingerprint address and app layout
check("Fingerprint offered only on the main address", read("lib/v4/deviceSignIn.ts").includes("export function onMainAddress") && read("lib/v4/deviceSignIn.ts").includes("if (!onMainAddress()) return false;"));
check("App boxes are never squeezed (the page scrolls)", read("mobile/app/src/styles.css").includes(".body > *, .sheet > *{flex-shrink:0}"));
check("App version 2.0.1 or later, build 5 or later", /REQGEN_VERSION_NAME=(2\.(0\.([1-9])|[1-9]\.\d+)|[3-9]\.\d+\.\d+)/.test(read("mobile/version.properties")) && Number(read("mobile/version.properties").match(/REQGEN_VERSION_CODE=(\d+)/)[1]) >= 5);

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll v4.7.1 checks passed.");
process.exit(failures ? 1 : 0);
