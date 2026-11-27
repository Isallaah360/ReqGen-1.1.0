# ReqGen 6.3.2 and app 4.2.2 (build 14): clean signatures, Direct message paper, error reports with a picture

6.3.2 includes everything in 6.3.1.

## What changes

**Papers and signatures (website and app)**
- **Signatures print as ink only.** The paper background is removed when the signature is drawn on the paper, in the app's PDFs too. It is also removed every time someone saves a signature; the old "remove background" switch is gone.
- **Old signatures:** a signature saved before cleaning existed can be re-saved as ink only with **Clean my saved signature** (My Account › Signature).
- **Every name has its signature.** If a step kept no signature of its own, the person's saved signature is used. This covers the request letter (requester, the officer who checked it, DG) and the voucher (prepared, checked, authorised, counter signed).
- **A Direct message prints on its own one-page paper:**
  - **From:** the sender, with their signature.
  - **To:** only the people it was sent to.
  - **The message**, with its links.
  - **Answers:** each answer, added only when that person acts, with their signature.
  - **Printed by a receiver:** they see only their own answer.
  - **Paid messages:** the DG's approval (with the IET stamp) and the Account's step are added.
  - **Very long messages** still fit one page, with "Scan the code to read all of it".
- **Links** in messages and comments can be tapped, on the website and in the app.

**Error reports with a picture**
- When the app meets a real error, it takes a picture of the screen and sends a report. The **Super Admin gets a notice at once**: "App error reported".
- Normal messages (for example "Write the title.") are not errors and send nothing.
- **Where to read them:** reports and pictures are in **Administration › Diagnostics › Error reports**, on the website and in the app.
- **Who can read them:** only the Super Admin and the Developer.
- **If a screen breaks,** the person sees a calm page that says the report was sent, with a button to open ReqGen again.

**App 4.2.2**
- **Home:** two rows of app icons. The **More** icon (four rounded squares) opens every page you can open, office by office, with a search.
- **Icons:** every icon has its own picture. Settings is a gear, Profile is a person.
- **Glass Dock** has Light, Dark and Match phone, like Icon Grid.
- **Dark Icon Grid** is deep IET blue, not black.
- **Sign out** is the bright IET red bar of the Glass mock-up, in every look, with large bold words.
- **Camera:** every attachment place (new request, Direct message, sent-back request, voucher) has **Take a photo** and **Choose a file**. The profile photo can be taken or chosen.
  - The first time someone taps Take a photo, Android asks "Allow ReqGen to take pictures?". After that, the camera shows as allowed in the app's permissions.
  - No storage permission is needed: "Choose a file" opens the phone's own picker, which reaches every photo and document. Google Play also prefers this way.

## Step 1. Database (Supabase), 2 minutes

In the Supabase **SQL editor**, run **`database/v6_3_2_error_reports.sql`**.
- **Check:** every row says **OK**.
- **What it does:**
  - adds three columns to the error list;
  - makes the private picture folder `app-error-shots`;
  - adds the notice to the Super Admin.
- **Safety:** nothing is dropped, and it is safe to run twice.
- **Before you run it,** phones still report errors the old way, without a picture.

There is **no Edge Function change**.

If you have not deployed 6.3.0 yet, first run `database/v6_3_0_backup_handover.sql` and deploy `ReqGen_Edge_Functions_6.3.0.zip`, both included in this pack.

## Step 2. Website and app together (10 minutes)

1. Unzip the two files into `reqgen-web`, choosing "Replace all" both times:
   - **`ReqGen_v6.3.2_source.zip`** over `reqgen-web`;
   - **`ReqGen_App_Kit_4.2.2.zip`** over its `mobile` folder.
2. Double-click **`mobile\MAKE_APP.bat`**.
   - It reads **4.2.2, build 14**, signs with `C:\ReqGen_Key\reqgen-android.keystore` (alias `reqgen`), and puts the APK in `public\downloads`.
   - The key and its password never go on GitHub, Vercel or WhatsApp.
3. Push:

```
cd C:\path\to\reqgen-web
git add -A
git commit -m "ReqGen 6.3.2: clean signatures, Direct message paper, links, error reports with a picture; app 4.2.2 home with More, Glass light and dark"
git push
```

4. Go to Supabase › Storage › `app-releases`. Upload the same `ReqGen.apk` and copy its public link. Then run:

```
insert into public.reqgen_app_releases (version, build, apk_url, notes)
values ('4.2.2', 14, 'PASTE THE PUBLIC LINK HERE', '{"new":["Direct messages print on their own one-page paper: you, the people it went to, and their answers with signatures.","Links in messages open when you tap them.","More: every page you can open, as app icons, with a search.","Glass Dock now has light and dark too."],"fixed":["Signatures print as ink only, without the paper background.","Every name on a paper now has its signature."],"better":["Every app icon has its own picture.","Sign out is a clear red bar.","If something goes wrong, a report with a picture of the screen goes to the Super Admin at once."]}');
```

## Step 3. Check it (10 minutes)

- [ ] My Account › Signature: tap **Clean my saved signature**. The preview shows only the ink.
- [ ] Open a paid official request › **A4 PDF**. The requester, the checking officer and the DG (with the stamp) all show clean signatures.
- [ ] Open a paid voucher › **A4 PDF**. The Prepared, Checked, Authorised and Counter signed signatures all show and are clean.
- [ ] Send a Direct message with a link to one person.
  - The link opens when tapped.
  - **A4 PDF (Direct message)** shows only you and that person.
  - When they answer, their signature is added.
- [ ] Settings › Look › **Glass Dock**, then **Light** and **Dark**. Both work.
- [ ] Home › **More**: every page is there. Type "staff" in the search.
- [ ] New request › **Take a photo**: Android asks for the camera once; the photo is attached.
- [ ] As the Super Admin: Administration › **Diagnostics** › **Error reports** shows "No errors reported".

## Google Play (when the developer account is ready)

1. Double-click **`mobile\MAKE_PLAY.bat`**.
   - It makes `mobile\ReqGen-Play-4.2.2-build14.aab`, signed with the same ReqGen key.
   - This copy has no "install unknown apps" permission and never downloads updates itself, because Google Play updates it.
   - The file is for Google Play only. It is not for the website.
2. In Play Console:
   - create the app **ReqGen** (package `ng.com.barderians.reqgen`);
   - choose **Use Play App Signing**, the default, with our key as the upload key;
   - upload the .aab to the **Closed testing** track (personal account) or **Production** (organization account).
3. Store listing: I will prepare the text, the 512 x 512 icon, the 1024 x 500 feature graphic, the phone screenshots, the privacy policy page and the Data safety answers when you are ready.
4. For each later version: raise the build number, run MAKE_PLAY.bat, upload, and phones update by themselves.

## Tested before delivery (three full rounds)

- **The app's own PDF maker,** with signature photos on brown paper with shadows, as real phone photos look:
  - the official request letter;
  - the paid voucher, with all four signatures;
  - a Direct message for money (sender, forward, DG with the stamp, Account);
  - the same kind of message printed by a receiver;
  - a very long message, still one page.
- **The website's Direct message paper:** the same layout, a clickable link, all signatures as ink.
- **Error reports:** a crash is reported with a picture from the person's own folder. On a fresh test database, the SQL step was run twice, and these were checked:
  - the Super Admin gets one notice, not ten;
  - normal messages send no notice;
  - a picture from another person's folder is refused;
  - staff cannot read the list.
- **The camera permission** is in the app, with no broad storage access.
- **The app** in Icon Grid and Glass Dock, light and dark, at 412, 360 and 320 wide:
  - every screen;
  - every page from More;
  - every flow;
  - contrast checked on every word.
- **The website** in Royal Blue and Glass, light and dark: 68 pages at three widths.
- **Every release check,** including the new 6.3.2 check, and the full website build.
