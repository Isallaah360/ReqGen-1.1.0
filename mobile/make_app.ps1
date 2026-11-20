# ReqGen app maker (Windows). Run MAKE_APP.bat, not this file.
# Builds mobile\android into a signed ReqGen.apk, then puts the APK,
# app-version.json and assetlinks.json in the website's public folder.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$Web     = Split-Path -Parent $Here
$Tools   = Join-Path $env:USERPROFILE "BarderianTools"
$KeyDir  = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "ReqGen_Key"
$KeyFile = Join-Path $KeyDir "reqgen-android.keystore"
New-Item -ItemType Directory -Force -Path $Tools | Out-Null

function Say($t)  { Write-Host "  $t" -ForegroundColor Cyan }
function Good($t) { Write-Host "  $t" -ForegroundColor Green }
function Stop-Red($t) { Write-Host ""; Write-Host "  STOPPED: $t" -ForegroundColor Red; Write-Host "  Send a photo of this screen on WhatsApp 0803 119 7746." -ForegroundColor Red; exit 1 }
function Get-Zip($url, $zip, $dest) {
  Say "Downloading $(Split-Path -Leaf $zip) ..."
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  Say "Unpacking ..."
  Expand-Archive -Path $zip -DestinationPath $dest -Force
  Remove-Item $zip -Force
}

try {
  # 1. Java 21
  $jdk = Get-ChildItem -Path $Tools -Directory -Filter "jdk-21*" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $jdk) {
    Get-Zip "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse" (Join-Path $Tools "jdk21.zip") $Tools
    $jdk = Get-ChildItem -Path $Tools -Directory -Filter "jdk-21*" | Select-Object -First 1
  }
  $env:JAVA_HOME = $jdk.FullName
  $env:Path = "$($jdk.FullName)\bin;$env:Path"
  Good "Java 21 ready."

  # 2. Node (only if this laptop has none)
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $node = Get-ChildItem -Path $Tools -Directory -Filter "node-v22*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $node) {
      Get-Zip "https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip" (Join-Path $Tools "node.zip") $Tools
      $node = Get-ChildItem -Path $Tools -Directory -Filter "node-v22*" | Select-Object -First 1
    }
    $env:Path = "$($node.FullName);$env:Path"
  }
  Good "Node $(node -v) ready."

  # 3. Android build tools
  $sdk = $env:ANDROID_HOME
  if (-not $sdk -or -not (Test-Path $sdk)) { $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
  if (-not (Test-Path (Join-Path $sdk "platforms"))) { $sdk = Join-Path $Tools "android-sdk" }
  $sdkman = Join-Path $sdk "cmdline-tools\latest\bin\sdkmanager.bat"
  if (-not (Test-Path $sdkman)) {
    New-Item -ItemType Directory -Force -Path (Join-Path $sdk "cmdline-tools") | Out-Null
    Get-Zip "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" (Join-Path $Tools "cmdline.zip") (Join-Path $sdk "cmdline-tools")
    Rename-Item (Join-Path $sdk "cmdline-tools\cmdline-tools") "latest"
  }
  $env:ANDROID_HOME = $sdk
  $env:ANDROID_SDK_ROOT = $sdk
  if (-not (Test-Path (Join-Path $sdk "build-tools\36.0.0"))) {
    Say "Accepting the Android licences and installing the build tools ..."
    $yes = ("y`n" * 20)
    $yes | & $sdkman --licenses | Out-Null
    & $sdkman "platform-tools" "platforms;android-36" "build-tools;36.0.0" | Out-Null
  }
  Good "Android build tools ready."

  # 4. The app project
  Set-Location $Here
  Say "Getting the app parts (npm) ..."
  & npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Stop-Red "npm could not get the app parts." }
  & npx cap sync android
  if ($LASTEXITCODE -ne 0) { Stop-Red "Capacitor could not prepare the Android project." }
  Set-Content -Path (Join-Path $Here "android\local.properties") -Value ("sdk.dir=" + ($sdk -replace '\\','\\'))

  # 5. The ReqGen signing key (kept OUTSIDE the project; never on GitHub, Vercel or WhatsApp)
  New-Item -ItemType Directory -Force -Path $KeyDir | Out-Null
  if (-not (Test-Path $KeyFile)) {
    Write-Host ""
    Write-Host "  No ReqGen key yet. Making a NEW ReqGen signing key." -ForegroundColor Yellow
    Write-Host "  Choose a strong password (at least 8 characters). Write it down." -ForegroundColor Yellow
    $p1 = Read-Host "  Password" -AsSecureString
    $p2 = Read-Host "  Same password again" -AsSecureString
    $a = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p1))
    $b = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p2))
    if ($a -ne $b) { Stop-Red "The two passwords were not the same. Run MAKE_APP.bat again." }
    if ($a.Length -lt 8) { Stop-Red "The password must have at least 8 characters." }
    & keytool -genkeypair -v -keystore $KeyFile -alias reqgen -keyalg RSA -keysize 4096 -validity 10000 -storepass $a -keypass $a -dname "CN=ReqGen, O=Barderian Enterprises, L=Minna, C=NG" | Out-Null
    if ($LASTEXITCODE -ne 0) { Stop-Red "The key could not be made." }
    Good "New key saved in $KeyFile"
    Write-Host "  COPY THIS KEY FILE TO A FLASH DRIVE AND GOOGLE DRIVE NOW, and keep the password." -ForegroundColor Yellow
    Write-Host "  Every future ReqGen update must use this same key." -ForegroundColor Yellow
    $pass = $a
  } else {
    $p = Read-Host "  ReqGen key password" -AsSecureString
    $pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))
    & keytool -list -keystore $KeyFile -storepass $pass -alias reqgen | Out-Null
    if ($LASTEXITCODE -ne 0) { Stop-Red "That is not the ReqGen key password." }
  }

  # 6. Build
  $props = @{}
  Get-Content (Join-Path $Here "version.properties") | Where-Object { $_ -match "=" -and $_ -notmatch "^#" } | ForEach-Object { $k, $v = $_ -split "=", 2; $props[$k.Trim()] = $v.Trim() }
  $vName = $props["REQGEN_VERSION_NAME"]; $vCode = $props["REQGEN_VERSION_CODE"]
  Say "Building ReqGen $vName (build $vCode). This takes a few minutes ..."
  $env:REQGEN_KEYSTORE = $KeyFile
  $env:REQGEN_KEY_PASSWORD = $pass
  Set-Location (Join-Path $Here "android")
  & .\gradlew.bat assembleRelease "-PREQGEN_VERSION_CODE=$vCode" "-PREQGEN_VERSION_NAME=$vName" --no-daemon
  if ($LASTEXITCODE -ne 0) { Stop-Red "The Android build failed (see the red lines above)." }
  Remove-Item Env:REQGEN_KEY_PASSWORD
  $apk = Join-Path $Here "android\app\build\outputs\apk\release\app-release.apk"
  if (-not (Test-Path $apk)) { Stop-Red "The APK was not made." }

  # 7. Check the signature is the ReqGen key
  $apksigner = Join-Path $sdk "build-tools\36.0.0\apksigner.bat"
  $certs = & $apksigner verify --print-certs $apk 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { Stop-Red "The APK signature did not verify." }
  $keyList = & keytool -list -v -keystore $KeyFile -storepass $pass -alias reqgen | Out-String
  $pass = $null
  $certSha = ([regex]::Match($keyList, "SHA256:\s*([0-9A-F:]+)")).Groups[1].Value
  $apkCertSha = ([regex]::Match($certs, "SHA-256 digest:\s*([0-9a-f]+)")).Groups[1].Value
  if (-not $certSha -or ($certSha -replace ":","").ToLower() -ne $apkCertSha) { Stop-Red "The APK is not signed with the ReqGen key." }

  # 8. Put the app on the website: APK, app-version.json, assetlinks.json
  $downloads = Join-Path $Web "public\downloads"
  $wellKnown = Join-Path $Web "public\.well-known"
  New-Item -ItemType Directory -Force -Path $downloads, $wellKnown | Out-Null
  $outApk = Join-Path $downloads "ReqGen.apk"
  Copy-Item $apk $outApk -Force
  $sha = (Get-FileHash -Algorithm SHA256 $outApk).Hash.ToUpper()
  $shaGroups = ($sha -split "(.{4})" | Where-Object { $_ }) -join " "
  $size = "{0:N1} MB" -f ((Get-Item $outApk).Length / 1MB)
  $notes = Get-Content (Join-Path $Here "release-notes.json") -Raw | ConvertFrom-Json
  $release = [ordered]@{
    version = $vName; build = [int]$vCode; apk = "/downloads/ReqGen.apk"; size = $size
    date = (Get-Date).ToString("d MMM yyyy", [Globalization.CultureInfo]::GetCultureInfo("en-GB"))
    sha256 = $shaGroups; new = @($notes.new); fixed = @($notes.fixed); better = @($notes.better)
  }
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [IO.File]::WriteAllText((Join-Path $downloads "app-version.json"), ($release | ConvertTo-Json -Depth 4), $utf8)
  $links = @(@{ relation = @("delegate_permission/common.handle_all_urls"); target = @{ namespace = "android_app"; package_name = "ng.com.barderians.reqgen"; sha256_cert_fingerprints = @($certSha) } })
  [IO.File]::WriteAllText((Join-Path $wellKnown "assetlinks.json"), (ConvertTo-Json -InputObject $links -Depth 5), $utf8)

  Write-Host ""
  Good "DONE: ReqGen.apk $vName is ready and signed with the ReqGen key."
  Good "It is in public\downloads, with app-version.json; assetlinks.json is in public\.well-known."
  Write-Host "  SHA-256 of the APK: $shaGroups"
  Write-Host "  Next: commit and push the website (the guide has the commands)."
} catch {
  Stop-Red $_.Exception.Message
}
