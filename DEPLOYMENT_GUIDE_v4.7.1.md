# ReqGen v4.7.1 and app 2.0.1: update guide

**From:** v4.7.0 and app 2.0.0. **Time:** about 30 minutes. **Database:** no new step (v4_7_0_upgrade.sql must already be run).

## What changes

**One standard for checks, the same on the website and in the app:**

| When | How you confirm |
| --- | --- |
| Signing in | Password, then the 6-digit code from your **authenticator app (2FA)**. In the app, after that, your **fingerprint or app PIN** opens ReqGen. |
| Every action | The 6-digit code sent by **SMS and e-mail** (either one works for 10 minutes). |

"Every action" covers:
- sending, approving, sending back, declining and forwarding a request;
- correcting, deleting, withdrawing and reopening a request, and changing the subhead;
- Finance and voucher actions;
- deleting an account;
- the Super Admin jobs: finance reset, restore and handover.

The authenticator is still used to change your password or your 2FA.

**Notices:** when a request moves on, the person who sent it gets an SMS and an e-mail too, not only the person who now has it. The app sends the same notices as the website.

**Fixed:**
- **App Me page cut off:** rows such as "Password and signature" and "About and credits" were hidden on some phones. Every row now shows, and the page scrolls. The same fix applies to every app screen.
- **vercel.app address:** it showed "This fingerprint request came from a different website". A fingerprint belongs to the address it was set up on. So on the vercel.app address ReqGen no longer offers the fingerprint; it asks for the authenticator code.
- **Request page on phones:** the Withdraw, Edit and Delete buttons no longer push the page sideways.

**Next (app 2.1.0):** Registry, Vouchers, Finance, Budget and Subheads, Reports, Administration, Audit and the full Profile, as app screens.

## 1. Website

```
cd C:\Projects\reqgen-web
git checkout main
git pull origin main
```

Delete everything in the folder **except** `.git`, `.env.local`, `public\downloads` and `public\.well-known`. Then unzip `ReqGen_v4.7.1_source.zip` into the folder.

```
npm install
npm run lint
npm run typecheck
npm run audit:deploy
git add -A
git commit -m "ReqGen v4.7.1: one standard (2FA to sign in, SMS or e-mail code for every action), sender told when a request moves, app 2.0.1 kit"
git push origin main
```

Wait for Vercel **Ready**. The footer should read **ReqGen v4.7.1**.

## 2. App 2.0.1

1. Unzip `ReqGen_App_Kit_2.0.1.zip` into `C:\Projects\reqgen-web` and choose **Replace** for every file.
2. Double-click `mobile\MAKE_APP.bat`, then type the ReqGen key password (the same new key as 2.0.0). It must end with **DONE: ReqGen.apk 2.0.1 (build 5) is ready**.
3. Push:
   ```
   git add -A
   git commit -m "ReqGen app 2.0.1"
   git push origin main
   ```
4. On the phones: the app shows **Version 2.0.1 is ready** under Me, App version. Download and install. There is no need to uninstall, because the key is the same as 2.0.0.

## 3. Check it live

1. **App sign-in:** sign out of the app, then sign in. After the password, it asks for the **code from your authenticator app**, not an SMS. Then the PIN.
2. **Website sign-in:** the same. Password, then the authenticator code (or the fingerprint on ietreqgen.barderians.com.ng).
3. **Send a request** (website or app): the SMS or e-mail code is asked. The first officer gets an SMS and an e-mail.
4. **Approve it:** the SMS or e-mail code is asked. The next officer **and the sender** get an SMS and an e-mail.
5. **Delete** an early request of your own: the SMS or e-mail code is asked, not the authenticator.
6. **App Me page:** scroll down. Every row shows, down to **Sign out of this phone** and the footer.
7. **vercel.app address:** sign in there. No fingerprint button and no red warning; the authenticator code works.
