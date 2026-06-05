$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Url = "http://127.0.0.1:22333"

function Test-Query2CardPort {
    try {
        $Client = New-Object System.Net.Sockets.TcpClient
        $Async = $Client.BeginConnect("127.0.0.1", 22333, $null, $null)
        $Connected = $Async.AsyncWaitHandle.WaitOne(300)
        if ($Connected) {
            $Client.EndConnect($Async)
        }
        $Client.Close()
        return $Connected
    } catch {
        return $false
    }
}

if (-not (Test-Query2CardPort)) {
    Push-Location $Backend
    try {
        py -m pip install -r requirements.txt
        Start-Process -FilePath "py" -ArgumentList "app.py" -WorkingDirectory $Backend -WindowStyle Minimized
    } finally {
        Pop-Location
    }

    Start-Sleep -Seconds 2
}

Start-Process $Url
