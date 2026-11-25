param([Parameter(Mandatory)][string] $Executable)

$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class StudioWindow {
    [DllImport("user32.dll")]
    public static extern bool IsZoomed(IntPtr window);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    public static extern int GetWindowLong(IntPtr window, int index);
}
'@

$studio = Start-Process -FilePath $Executable -PassThru
try {
    $handle = [IntPtr]::Zero
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $studio.Refresh()
        if ($studio.HasExited) { throw "WG Social Studio exited with code $($studio.ExitCode)" }
        $handle = $studio.MainWindowHandle
        if ($handle -ne [IntPtr]::Zero -and [StudioWindow]::IsZoomed($handle)) { break }
        Start-Sleep -Milliseconds 500
    }

    if ($handle -eq [IntPtr]::Zero -or -not [StudioWindow]::IsZoomed($handle)) {
        throw 'WG Social Studio should open maximized.'
    }
    # WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX
    $windowControls = 0x00CB0000
    $style = [StudioWindow]::GetWindowLong($handle, -16)
    if (($style -band $windowControls) -ne $windowControls) {
        throw "The window must have a title bar and all standard window controls. Style: $style"
    }
    Write-Output 'Maximized Windows window with a title bar and standard controls verified.'
} finally {
    Stop-Process -Id $studio.Id -ErrorAction SilentlyContinue
}
