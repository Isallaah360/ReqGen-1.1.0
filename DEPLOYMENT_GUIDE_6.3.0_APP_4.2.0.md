# ReqGen 6.3.0 and app 4.2.0: backup officers

A request no longer waits with one person. If the officer holding it does not treat it within 25 working minutes, it moves to their backup. The backup is told by SMS, e-mail and an app notice.

6.3.0 includes everything in 6.2.0. If you have not deployed 6.2.0 yet, you can go straight to 6.3.0.

## How it works

1. A request reaches an officer, for example the HOD of General Admin.
2. **25 working minutes** pass and the HOD has not treated it. It moves to the **HOD's backup**, who gets an SMS, an e-mail and an app notice. The HOD is told it moved.
3. The backup also does not treat it within 25 working minutes. It goes **back to the HOD and stays there**. The HOD is told again, and so is the **Registry** (request number only, never its contents).
4. If a step has **no backup**, the request stays where it is and the Registry is told once, so the Super Admin can add one.

Some things to know:
- **Working minutes** count only Monday to Friday, 8:00 AM to 5:00 PM (Lagos time). A request sent at 9:00 PM starts its clock at 8:00 AM the next working day. Nobody gets SMS at night.
- **Only the review steps hand over:** PD, DOD, HOD, DIN Admin, HR Coordinator and Registrar.
- **These never move by themselves:**
  - the DG, Account and HR Filing steps;
  - Direct requests;
  - requests sent back to their sender.
- **When the officer or the backup treats it,** it goes to the next step as usual. The clock starts again there.
- **Every move is written in the request's history** ("Handed to backup", "Back to first officer").
- **The Super Admin can change** the minutes, the days and the hours, or switch it off.
- **Routes are not changed.** Only who holds the current step changes, the same way "Mark away" already works.

## Step 1. Database (Supabase), 3 minutes

1. Supabase › **Database › Extensions**: make sure **pg_cron** and **pg_net** are both switched on. If one is off, switch it on.
2. SQL editor: run **`database/v6_3_0_backup_handover.sql`**. Every row of the report should say **OK**.
   - If a row about pg_cron or pg_net says CHECK, switch that extension on (point 1) and run the file again.
   - Nothing is dropped. Three columns are added to requests, and the clock starts now for requests already waiting, so nothing jumps on the first run.
   - It is safe to run twice.

## Step 2. The database programs (Edge Functions), 3 minutes

1. Unzip **`ReqGen_Edge_Functions_6.3.0.zip`** over your `reqgen-web` folder.
2. Double-click **`DEPLOY_FUNCTIONS.bat`**. `reqgen-office` now also sends the backup SMS and e-mails.
3. The Sendchamp secrets you set before are used as they are. Nothing new to set.

## Step 3. Website and app together

1. Unzip **`ReqGen_v6.3.0_source.zip`** over `reqgen-web`, and **`ReqGen_App_Kit_4.2.0.zip`** over its `mobile` folder ("Replace all").
2. Double-click **`MAKE_APP.bat`**. It reads version 4.2.0, build 12, signs with `C:\ReqGen_Key\reqgen-android.keystore` (alias `reqgen`), and puts the APK into the website's download folder.
   - The key and its password never go on GitHub, Vercel or WhatsApp.
3. Push:

```
git add -A
git commit -m "ReqGen 6.3.0: backup officers after 25 working minutes; app 4.2.0"
git push
```

4. Upload the same `ReqGen.apk` to Supabase › Storage › `app-releases`, copy its public link, and run:

```
insert into public.reqgen_app_releases (version, build, apk_url, notes)
values ('4.2.0', 12, 'PASTE THE PUBLIC LINK HERE', '{"new":["Backup officers: a request that waits too long with an officer moves to the backup, then back to the officer.","The Super Admin sets a backup under each officer in the Routing Engine."],"better":["Times are shown with AM and PM.","The opening screen sits in the middle, with a live loading bar."]}');
```

## Step 4. Super Admin: set the backups, 10 minutes

**On the website:** Administration › Routing Engine › **Backups & away cover**.
- **Backup rule:** "backups take over after 25 working minutes". Use **Change** to set the minutes, the days and the hours, or switch it off.
- **Department backups:**
  1. Choose a department.
  2. Add a backup for each step that department uses: PD, DOD, HOD, DIN Admin, HR Coordinator, Registrar.
  3. Repeat for every department.
- **Institution-wide backups** (HR Coordinator, Registrar, DIN Admin) cover every department that has no backup of its own.

**In the app:** Offices › Administration › Routing Engine.
- The **Backup rule** card is at the top.
- Open a department: under each officer there is now **Backup**. Choose the person and tap **Save the route**, then confirm with your PIN.

## Step 5. Check it (during working hours)

1. As the Super Admin, set the rule to **10 working minutes** for the test.
2. In a test department, set a backup for the HOD.
3. As a staff member of that department, send a small official request.
4. Do not treat it as the HOD. After about 10 minutes:
   - [ ] the request is with the backup (their Approvals list);
   - [ ] the backup received an SMS and an e-mail;
   - [ ] the request's history shows "Handed to backup".
5. Do not treat it as the backup. After 10 more minutes:
   - [ ] it is back with the HOD, and stays there;
   - [ ] the Registry received a notice.
6. Treat it as the HOD: it moves on as usual.
7. Set the rule back to **25 working minutes**.

## Tested before delivery (three full rounds)

- **The database step:**
  - run twice on a fresh test database;
  - the officer, then the backup, then back to the officer, where it stays;
  - the Registry is told, including when no backup is set;
  - Direct, sent-back and DG requests never move;
  - the clock starts afresh after an approval;
  - only working minutes count (Friday 4:50 PM to Monday 8:20 AM = 30 minutes; a weekend or 7:00 PM = 0);
  - only the Super Admin can set the rule or the backups;
  - staff cannot read the timer secret or the message list.
- **The app:** the backup rule and the backup under each officer at three sizes, with the PIN, plus every earlier app test.
- **The website:** the backup rule window and all six department backup steps on a computer and a phone, plus the frame on 68 pages at three widths.
- **Every release check** and the full website build. The three Edge Functions type-check on Deno.
- **One thing only Supabase can show:** the timer (pg_cron) and the call to the Edge Function (pg_net) cannot run on my test database. Step 5 is the proof on yours.
