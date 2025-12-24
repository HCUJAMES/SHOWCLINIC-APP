# Crear icono .ico desde el logo PNG y crear acceso directo en el Escritorio
# Ejecutar con PowerShell: clic derecho -> Run with PowerShell

$ErrorActionPreference = 'Stop'

$ProjectDir = Split-Path -Parent $PSCommandPath
$BatPath = Join-Path $ProjectDir 'start-clinica.bat'
$PngPath = Join-Path $ProjectDir 'frontend\public\logo-showclinic.png'
$IcoPath = Join-Path $ProjectDir 'showclinic.ico'

if (!(Test-Path $BatPath)) { throw "No se encontro: $BatPath" }
if (!(Test-Path $PngPath)) { throw "No se encontro: $PngPath" }

Add-Type -AssemblyName System.Drawing

# Cargar PNG y exportar ICO multi-size simple (256)
$bmp = [System.Drawing.Bitmap]::FromFile($PngPath)
try {
  $iconBmp = New-Object System.Drawing.Bitmap 256, 256
  $g = [System.Drawing.Graphics]::FromImage($iconBmp)
  try {
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($bmp, 0, 0, 256, 256)
  } finally {
    $g.Dispose()
  }

  $hIcon = $iconBmp.GetHicon()
  $icon = [System.Drawing.Icon]::FromHandle($hIcon)
  try {
    $fs = New-Object System.IO.FileStream($IcoPath, [System.IO.FileMode]::Create)
    try {
      $icon.Save($fs)
    } finally {
      $fs.Dispose()
    }
  } finally {
    $icon.Dispose()
  }
} finally {
  $bmp.Dispose()
}

# Crear acceso directo
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath 'ABRIR SHOWCLINIC.lnk'

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $BatPath
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.WindowStyle = 1
$Shortcut.Description = 'Abrir ShowClinic (modo clinica)'
$Shortcut.IconLocation = $IcoPath
$Shortcut.Save()

Write-Host "Acceso directo creado/actualizado: $ShortcutPath"
Write-Host "Icono generado: $IcoPath"
Write-Host "Si no cambia el icono inmediatamente, borra el acceso directo y ejecuta este script otra vez."
