# ReqGen v3.1.9 — Release Notes

**Full project.** Replace your whole project folder with this zip (keep your `.env` / `.env.local` file).

## Print Register and Signing Tracker — database fix

Run `database/v3_1_9_print_register_tracker.sql` in Supabase. It replaces the v3.1.7 file, which is now marked SUPERSEDED. Do not run the v3.1.7 file.

**Why v3.1.7 failed ("deadlock detected"), twice.** The SQL Editor runs a whole file as one transaction. That file created the functions, then dropped and re-created a trigger on `payment_vouchers` (which needs the strongest lock), then updated vouchers. So it held locks on several tables while the live app read them in the opposite order. PostgreSQL cancelled it, and nothing was saved. That is why the Print Register and Pending Signatures could not find their functions.

**How v3.1.9 is built:**

- **Part 1** creates the Print Register and Signing Tracker functions. Creating functions takes no table locks, so this part cannot deadlock, and it is all the Print Register needs.
- **Part 2** creates the voucher trigger in its own short transaction, touching one table. It never drops the trigger, so it needs no exclusive lock, and normal reading does not block it. If vouchers are being edited at that moment, it waits 5 seconds and then reports "busy — run again" instead of failing.
- **Part 3** moves posted manual vouchers into the signing chain, following the same rule.
- **Every returned column is cast to its declared type,** so the functions work whatever the exact column types are (varchar or text, integer or numeric, with or without time zone).

**Tests:**

- I ran the whole file as one script, the way the Supabase editor does, on a test database with deliberately different column types.
- I ran it while another session was reading vouchers, and while another was editing them. It never failed. When vouchers were being edited, Part 2 reported busy, and running the file again completed it.

## Print Register page

- The new financial-year filter appears beside the search box.
- Search now also matches the PV number.
- If the database update has not been run, the page says exactly which file to run instead of showing a technical error. The Signing Tracker does the same.

## Deploy order

1. Replace the project folder with this zip, keeping your `.env` / `.env.local`.
2. Push:

   ```
   npm install
   npm run lint
   npm run typecheck
   npm run build
   git status
   git add -A
   git commit -m "ReqGen v3.1.9: deadlock-safe Print Register and Signing Tracker"
   git push origin main
   ```

3. In Supabase, run `database/v3_1_9_print_register_tracker.sql`. Rows 1 to 5 should say OK. If row 3 says "run again", run the file once more.
4. Check the v3.1.8 log check: re-run `database/v3_1_8_master_backup_log.sql`. Row 3 should now say OK.

## New audit

`npm run audit:v319` runs 7 checks and is added to `audit:production`.
