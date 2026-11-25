# ReqGen 6.1.0: deploys the Supabase Edge Functions reqgen-notify (SMS and e-mail notices),
# reqgen-code (the back-up 6-digit code) and reqgen-office (staff accounts, reminders, backups, reset).
# The app calls only these and the database, never the website.
# The Sendchamp key and the code secret are read from .env.local and sent straight to Supabase as secrets.
# Nothing secret is printed, saved in the project or sent anywhere else.
# Supabase prints notes and progress on the error stream; Windows PowerShell must not treat those as failures.
# Each step is judged only by its exit code.
$ErrorActionPreference = "Continue"
$env:SUPABASE_PROJECT_ID = ""
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Here
function Say($t) { Write-Host "`n$t" -ForegroundColor Cyan }
function Good($t) { Write-Host "  OK  $t" -ForegroundColor Green }
function Stop-Red($t) { Write-Host "`n  STOP  $t`n" -ForegroundColor Red; exit 1 }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Stop-Red "Node.js is not installed. Install it from nodejs.org (LTS), then run this again." }
$envFile = Join-Path $Here ".env.local"
if (-not (Test-Path $envFile)) { Stop-Red ".env.local is not in this folder. Run this from your reqgen-web folder." }

$vals = @{}
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$') { $vals[$Matches[1]] = $Matches[2] }
}
$url = $vals["NEXT_PUBLIC_SUPABASE_URL"]
if (-not $url -or $url -notmatch 'https://([a-z0-9]+)\.supabase\.co') { Stop-Red "NEXT_PUBLIC_SUPABASE_URL is missing in .env.local." }
$ref = $Matches[1]
Good "Supabase project: $ref"

$keys = @("SENDCHAMP_API_KEY","SENDCHAMP_SENDER_NAME","SENDCHAMP_ROUTE","SENDCHAMP_SMS_ENABLED","SENDCHAMP_EMAIL_ENABLED","SENDCHAMP_EMAIL_FROM_EMAIL","SENDCHAMP_EMAIL_FROM_NAME","SENDCHAMP_FROM_EMAIL","SENDCHAMP_FROM_NAME","OTP_HASH_SECRET","NEXT_PUBLIC_APP_URL")
if (-not $vals["SENDCHAMP_API_KEY"]) { Stop-Red "SENDCHAMP_API_KEY is not in .env.local. Copy it (and the other SENDCHAMP_ values and OTP_HASH_SECRET) from Vercel > Settings > Environment Variables into .env.local, then run this again." }
if (-not $vals["OTP_HASH_SECRET"]) { Write-Host "  NOTE  OTP_HASH_SECRET is not in .env.local. If Vercel has one, copy it too, so codes from the app and the website match." -ForegroundColor Yellow }

$tmp = Join-Path $env:TEMP ("reqgen-secrets-" + [guid]::NewGuid().ToString() + ".env")
try {
  $out = foreach ($k in $keys) { if ($vals[$k]) { "$k=$($vals[$k])" } }
  Set-Content -Path $tmp -Value $out -Encoding ASCII

  Say "Signing in to Supabase (a browser window may open the first time) ..."
  $token = Join-Path $env:USERPROFILE ".supabase\access-token"
  if (-not (Test-Path $token) -and -not $env:SUPABASE_ACCESS_TOKEN) {
    & npx --yes supabase login
    if ($LASTEXITCODE -ne 0) { Stop-Red "Supabase sign-in did not finish." }
  }
  Good "Signed in to Supabase."

  Say "Linking this folder to the ReqGen project ..."
  & npx --yes supabase link --project-ref $ref
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  NOTE  If it asks for the database password, it is in Supabase > Project Settings > Database. Press Enter to skip it; deploying does not need it." -ForegroundColor Yellow
  }

  Say "Saving the secrets on Supabase ..."
  & npx --yes supabase secrets set --env-file "$tmp" --project-ref $ref
  if ($LASTEXITCODE -ne 0) { Stop-Red "The secrets were not saved." }
  Good "Secrets saved (Sendchamp and the code secret)."
} finally {
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
}

foreach ($fn in @("reqgen-notify","reqgen-code","reqgen-office")) {
  Say "Deploying $fn ..."
  # Supabase sometimes answers "502 Bad gateway" for a moment: wait and try again (up to 3 times)
  $done = $false
  for ($try = 1; $try -le 3 -and -not $done; $try++) {
    & npx --yes supabase functions deploy $fn --project-ref $ref --no-verify-jwt --yes
    if ($LASTEXITCODE -eq 0) { $done = $true }
    elseif ($try -lt 3) { Write-Host "  WAIT  Supabase was busy. Trying $fn again in 60 seconds ($try of 3) ..." -ForegroundColor Yellow; Start-Sleep -Seconds 60 }
  }
  if (-not $done) { Stop-Red "$fn did not deploy. Wait a few minutes and run DEPLOY_FUNCTIONS.bat again." }
  Good "$fn is live."
}
Write-Host "`nDone. The app's notices and back-up codes now come from Supabase.`n" -ForegroundColor Green
