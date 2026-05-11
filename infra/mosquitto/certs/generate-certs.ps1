# T?o ch?ng ch? t? ký cho Mosquitto (dev/MVP). Yêu c?u openssl trong PATH (Git for Windows, Chocolatey...).
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
    Write-Error "Không tìm th?y openssl. Cài Git for Windows ho?c: choco install openssl"
}

openssl req -new -x509 -days 3650 -nodes `
    -subj "/CN=localhost/O=IoT-MVP" `
    -out server.crt `
    -keyout server.key

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Copy-Item -Force server.crt ca.crt
Write-Host "?ã t?o: ca.crt, server.crt, server.key trong $here"
