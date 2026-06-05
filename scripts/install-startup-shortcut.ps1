$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$BatPath = Join-Path $Root "start-query2card.bat"
$Startup = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $Startup "Query2Card.lnk"

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $BatPath
$Shortcut.WorkingDirectory = $Root
$Shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$Shortcut.Description = "Start Query2Card local backend and open the dashboard"
$Shortcut.Save()

Write-Host "Created startup shortcut: $ShortcutPath"
