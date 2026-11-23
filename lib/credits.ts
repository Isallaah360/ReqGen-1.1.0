/**
 * ReqGen v4.6.12 (Kit K14): the open-source software inside ReqGen, shown on
 * /credits and written in full to THIRD-PARTY-LICENSES.txt by
 * scripts/make-licenses.mjs. Keep this list in step with package.json.
 */
export type Credit = { name: string; pkg: string; licence: string; what: string; url: string };

export const CREDITS: Credit[] = [
  { name: "Next.js", pkg: "next", licence: "MIT", what: "The website framework", url: "https://github.com/vercel/next.js" },
  { name: "React", pkg: "react", licence: "MIT", what: "The screens", url: "https://github.com/facebook/react" },
  { name: "Supabase JS", pkg: "@supabase/supabase-js", licence: "MIT", what: "Sign-in and the database link", url: "https://github.com/supabase/supabase-js" },
  { name: "Lucide", pkg: "lucide-react", licence: "ISC", what: "The icons", url: "https://github.com/lucide-icons/lucide" },
  { name: "Motion", pkg: "motion", licence: "MIT", what: "Dialog and toast motion", url: "https://github.com/motiondivision/motion" },
  { name: "AutoAnimate", pkg: "@formkit/auto-animate", licence: "MIT", what: "Items sliding into lists", url: "https://github.com/formkit/auto-animate" },
  { name: "dotLottie", pkg: "@lottiefiles/dotlottie-react", licence: "MIT", what: "The success tick player", url: "https://github.com/LottieFiles/dotlottie-web" },
  { name: "dotLottie Web", pkg: "@lottiefiles/dotlottie-web", licence: "MIT", what: "The player engine (with ThorVG, MIT)", url: "https://github.com/LottieFiles/dotlottie-web" },
  { name: "SimpleWebAuthn", pkg: "@simplewebauthn/browser", licence: "MIT", what: "Website fingerprint sign-in", url: "https://github.com/MasterKale/SimpleWebAuthn" },
  { name: "node-qrcode", pkg: "qrcode", licence: "MIT", what: "QR codes on print-outs", url: "https://github.com/soldair/node-qrcode" },
  { name: "fflate", pkg: "fflate", licence: "MIT", what: "Backup files", url: "https://github.com/101arrowz/fflate" },
  { name: "Capacitor", pkg: "@capacitor/core", licence: "MIT", what: "The Android app and its plugins", url: "https://github.com/ionic-team/capacitor" },
  { name: "Capacitor File Opener", pkg: "@capacitor-community/file-opener", licence: "MIT", what: "Opening the app update", url: "https://github.com/capacitor-community/file-opener" },
  { name: "Capgo Native Biometric", pkg: "@capgo/capacitor-native-biometric", licence: "MPL-2.0", what: "Fingerprint in the app (unchanged source at the link)", url: "https://github.com/Cap-go/capacitor-native-biometric" },
];
