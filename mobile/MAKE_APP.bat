@echo off
title ReqGen app maker
echo.
echo  ReqGen app maker
echo  ----------------
echo  This builds ReqGen.apk on this laptop. The first time it downloads
echo  Java, Node and the Android build tools (about 1 GB). Keep the laptop
echo  on Wi-Fi and plugged in. Close Chrome and other big programs.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make_app.ps1"
echo.
pause
