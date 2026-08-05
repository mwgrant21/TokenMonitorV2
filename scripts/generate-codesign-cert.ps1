#Requires -Version 5.1
<#
.SYNOPSIS
    Generates a fresh self-signed code-signing certificate for Claude Token Tracker
    and writes the cert (.pfx/.cer) and its password to codesign/ as a matched pair.
.NOTES
    Run this from the TokenMonitor project root, or anywhere - it resolves paths
    relative to this script's location. Re-run any time the cert/password drift
    or the cert needs renewal; it always overwrites both files together so they
    can never get out of sync again.
#>

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$codesignDir = Join-Path $repoRoot 'codesign'
$pfxPath = Join-Path $codesignDir 'tokentracker-codesign.pfx'
$cerPath = Join-Path $codesignDir 'tokentracker-codesign.cer'
$passwordPath = Join-Path $codesignDir 'pfx-password.txt'

if (-not (Test-Path $codesignDir)) {
    New-Item -ItemType Directory -Path $codesignDir -Force | Out-Null
}

# Generate a random password (32 chars, URL-safe alphabet only - no quoting/escaping surprises)
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
$rng.GetBytes($bytes)
$rng.Dispose()
$password = [System.Convert]::ToBase64String($bytes) -replace '[+/=]', ''
$securePassword = ConvertTo-SecureString -String $password -Force -AsPlainText

Write-Output "Generating self-signed code-signing certificate..."
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=Matt Grant" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyUsage DigitalSignature `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -NotAfter (Get-Date).AddYears(3)

try {
    Write-Output "Exporting PFX to $pfxPath"
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null

    Write-Output "Exporting public certificate to $cerPath"
    Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null

    Write-Output "Writing password to $passwordPath"
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($passwordPath, $password, $utf8NoBom)
}
finally {
    Write-Output "Removing cert from CurrentUser\My store (kept only as exported .pfx)"
    Remove-Item -Path "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force -Confirm:$false
}

Write-Output "Done. Thumbprint: $($cert.Thumbprint)"
Write-Output "Expires: $($cert.NotAfter)"
