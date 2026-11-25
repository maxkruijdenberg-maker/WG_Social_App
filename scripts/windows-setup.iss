#ifndef AppVersion
  #error AppVersion must be passed to the compiler
#endif

[Setup]
AppId=nl.wgmakelaars.socialstudio
AppName=WG Social Studio
AppVersion={#AppVersion}
AppPublisher=WG Makelaars
DefaultDirName={localappdata}\Programs\WG Social Studio
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=WG-Social-Studio-Setup
UninstallDisplayIcon={app}\WG Social Studio.exe
Compression=lzma2/fast

[Files]
Source: "..\dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userdesktop}\WG Social Studio"; Filename: "{app}\WG Social Studio.exe"; WorkingDir: "{app}"
Name: "{userprograms}\WG Social Studio"; Filename: "{app}\WG Social Studio.exe"; WorkingDir: "{app}"
