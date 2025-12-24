Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = projectDir & "\start-clinica.bat"
iconPath = projectDir & "\frontend\public\favicon.ico"
desktopPath = shell.SpecialFolders("Desktop")
shortcutPath = desktopPath & "\ABRIR SHOWCLINIC.lnk"

If Not fso.FileExists(batPath) Then
  WScript.Echo "No se encontro: " & batPath
  WScript.Quit 1
End If

Set shortcut = shell.CreateShortcut(shortcutPath)
shortcut.TargetPath = batPath
shortcut.WorkingDirectory = projectDir
shortcut.WindowStyle = 1
shortcut.Description = "Abrir ShowClinic (modo clinica)"
If fso.FileExists(iconPath) Then
  shortcut.IconLocation = iconPath
End If
shortcut.Save

WScript.Echo "Acceso directo creado en el Escritorio: " & shortcutPath
