# scripts/make-icon.ps1
# Renders build/icon.png (256x256): app-bg rounded square + accent "TT" mark.
# One-time generator, run manually; the PNG is committed. Write-Host is fine here
# (interactive utility, never a PDQ step).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

# Rounded-rect background in the midnight palette --bg
$bg = [System.Drawing.Color]::FromArgb(255, 0x0b, 0x0e, 0x14)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 48
$path.AddArc(0, 0, $r, $r, 180, 90)
$path.AddArc($size - $r, 0, $r, $r, 270, 90)
$path.AddArc($size - $r, $size - $r, $r, $r, 0, 90)
$path.AddArc(0, $size - $r, $r, $r, 90, 90)
$path.CloseFigure()
$g.FillPath((New-Object System.Drawing.SolidBrush($bg)), $path)

# Accent "TT" mark in --acc
$acc = [System.Drawing.Color]::FromArgb(255, 0x5b, 0x8c, 0xff)
$font = New-Object System.Drawing.Font('Consolas', 96, [System.Drawing.FontStyle]::Bold)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString('TT', $font, (New-Object System.Drawing.SolidBrush($acc)), (New-Object System.Drawing.RectangleF(0, 0, $size, $size)), $fmt)

$outDir = Join-Path $PSScriptRoot '..\build'
New-Item -ItemType Directory -Force $outDir | Out-Null
$out = Join-Path $outDir 'icon.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host "wrote $out"
