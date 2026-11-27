@echo off
title ReqGen app maker (Google Play)
echo.
echo  ReqGen app maker for Google Play
echo  --------------------------------
echo  This builds the Google Play file (.aab) on this laptop, signed with the
echo  ReqGen key. Upload it in Play Console. It is NOT for the website.
echo  Keep the laptop on Wi-Fi and plugged in. Close Chrome and other big programs.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make_app.ps1" -Play
echo.
pause
