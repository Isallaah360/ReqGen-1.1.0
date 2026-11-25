@echo off
REM ReqGen 6.0.0: puts the two database programs (Edge Functions) on Supabase. Run once, and again after an update.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_functions.ps1"
pause
