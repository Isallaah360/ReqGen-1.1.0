BaResPro app 4.0.0: a real app of its own
=========================================
Every screen is drawn by the app itself, with every module: Academic, CBT, Islamiyya and Hifz, and the school desk.
It never opens or calls the website. It talks only to the BaResPro database and its small database programs.
Sign in once, then open it with a 6-digit PIN or your fingerprint, like a bank app.
Learners can write CBT tests in it, and parents can check a result, before anyone signs in.

1. Unzip this kit into Documents (NOT inside C:\Projects\barespro-web).
   Replace the old BaResPro_App_Kit folder when asked.

2. Copy barespro-android.keystore (the same key as before) into Documents\BaResPro_App_Kit.

3. For phone alerts: copy google-services.json from your old kit folder too.
   Without it the app works, with no phone alerts yet.

4. Make sure the laptop is online (the app reads the website's PUBLIC settings once).
   Close Chrome and other big programs, then double-click MAKE_APP.bat
   - Paste the key password when asked (right-click in the black window), press Enter.
   - At the end it checks the signature itself and says:
     DONE: BaResPro.apk is ready and signed with the Barderian key

5. Install BaResPro.apk on your phone. It installs OVER the old app (same key, newer version).
   The first time, sign in with your e-mail and password, then make your app PIN.

6. Put the new app where every phone can get it (see the guide, Part 3):
   - Supabase: Storage, app-releases, Upload file, choose BaResPro.apk and name it BaResPro-4.0.0.apk.
   - The website: copy BaResPro.apk into public\downloads too, so App 3.2.0 phones can update.

The kit holds no key, no password and no secret. Never put the key or its password on GitHub, Vercel or WhatsApp.
If anything stops, take a photo of the black window and send it to Prof.
