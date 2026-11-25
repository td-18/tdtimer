param(
    [int]$Port = 8765
)

# Dependency-free static HTTP server for local browser checks.
# Usage: powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8765
# Then open http://127.0.0.1:8765/tools/wca-m0-check.html

$ErrorActionPreference = "Continue"
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$rootFull = [IO.Path]::GetFullPath($root)
$listener = New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "serving $root at http://127.0.0.1:$Port/"

while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
        $requestLine = $reader.ReadLine()
        if (-not $requestLine) { $client.Close(); continue }
        while ($true) {
            $line = $reader.ReadLine()
            if ($line -eq $null -or $line -eq "") { break }
        }

        $parts = $requestLine -split " "
        $method = $parts[0]
        $rawUrl = $parts[1]
        $pathPart = ($rawUrl -split "\?")[0]
        $rel = [Uri]::UnescapeDataString($pathPart.TrimStart("/"))
        if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
        $full = [IO.Path]::GetFullPath((Join-Path $root $rel))

        $status = "200 OK"
        $contentType = "application/octet-stream"
        $body = [byte[]]@()

        if ($method -ne "GET" -and $method -ne "HEAD") {
            $status = "405 Method Not Allowed"
            $body = [Text.Encoding]::UTF8.GetBytes("method not allowed")
        } elseif (-not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
            $status = "403 Forbidden"
            $body = [Text.Encoding]::UTF8.GetBytes("forbidden")
        } elseif (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
            $status = "404 Not Found"
            $body = [Text.Encoding]::UTF8.GetBytes("not found")
        } else {
            $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".js"   { "text/javascript; charset=utf-8" }
                ".mjs"  { "text/javascript; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".svg"  { "image/svg+xml" }
                ".png"  { "image/png" }
                default { "application/octet-stream" }
            }
            $body = [IO.File]::ReadAllBytes($full)
        }

        $header = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`n`r`n"
        $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        if ($method -ne "HEAD") { $stream.Write($body, 0, $body.Length) }
        $stream.Flush()
    } catch {
        try { $client.Close() } catch {}
    } finally {
        try { $client.Close() } catch {}
    }
}
