# Pull the LSLL two-step formulas and the one-step family metadata.
#
# Output: data/lsll.js
#   "两步": 302 ZBLS first-look formulas + 493 ZBLL/PLL second-look formulas
#   "一步": [] (the full 579,368 one-step formulas live in per-family files)
#   "families": 41 category cards with facelets, counts, slugs and file paths
#
# The full one-step data is split into data/lsll-one-step/<slug>.js so the app
# only downloads the selected family. Those files come from CubeRoot's
# /v1/alg/lsll/case/<key> API; pending categories are derived by mirroring the
# already-computed opposite category (see the checked-in data files).
#
# Usage: powershell -ExecutionPolicy Bypass -File tools/fetch-lsll.ps1
param(
    [switch]$Refresh
)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $root "data\lsll.js"
$keyPath = Join-Path $PSScriptRoot "lsll-zbls-keys.json"
$cacheDir = Join-Path $env:TEMP "tdtimer-lsll-cache"
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

function Clean-Alg([string]$a) {
    $t = $a -replace '[\u2191\u2193\u00b7]', ' '
    $t = $t -replace '[\u2018\u2019]', "'"
    $t = [regex]::Replace($t, '\(([^()]*)\)\s*([23])', {
            param($m)
            $g = $m.Groups[1].Value.Trim()
            $n = [int]$m.Groups[2].Value
            " " + (($g + " ") * $n).Trim() + " "
        })
    $t = $t -replace '[()]', ' '
    $t = $t -replace "([UDLRFBudlrfbMESxyz]w?)2'", '${1}2'
    $t = [regex]::Replace($t, "([UDLRFBudlrfbMESxyz]'?)(?=[UDLRFBudlrfbMESxyz])", '$1 ')
    $t = $t -replace "R4'?", 'R'
    $t = $t -replace "L4'?", "L'"
    # 部分公式用 R3 / L3' 表示 R^3 / (L^3)'，等同于 R' / L，先转成标准写法
    $t = $t -replace "R3'", 'R'
    $t = $t -replace 'R3', "R'"
    $t = $t -replace "L3'", 'L'
    $t = $t -replace 'L3', "L'"
    $t = $t -replace '\s+', ' '
    return $t.Trim()
}

function Esc([string]$s) {
    return $s.Replace('\', '\\').Replace('"', '\"')
}

function Get-Json([string]$url, [string]$name) {
    $cachePath = Join-Path $cacheDir $name
    if ((-not $Refresh) -and (Test-Path -LiteralPath $cachePath)) {
        $cached = [System.Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($cachePath)).TrimStart([char]0xFEFF)
        return $cached | ConvertFrom-Json
    }
    $resp = $null
    for ($try = 1; $try -le 6; $try++) {
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 60
            break
        } catch {
            if ($try -eq 6) { throw }
            Start-Sleep -Seconds (3 * $try)
        }
    }
    [IO.File]::WriteAllBytes($cachePath, $resp.RawContentStream.ToArray())
    return [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray()) | ConvertFrom-Json
}

function First-Alg($case) {
    if ($case.algs -and $case.algs.Count -gt 0 -and $case.algs[0].Count -gt 0) {
        return Clean-Alg ([string]$case.algs[0][0].alg)
    }
    return ""
}

$zbls = Get-Json "https://api.cuberoot.me/v1/alg/sets/3x3/zbls" "zbls.json"
$zbll = Get-Json "https://api.cuberoot.me/v1/alg/sets/3x3/zbll" "zbll.json"
$pll = Get-Json "https://api.cuberoot.me/v1/alg/sets/3x3/pll" "pll.json"
$keyText = [System.Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($keyPath)).TrimStart([char]0xFEFF)
$keys = $keyText | ConvertFrom-Json

# CubeRoot's LSLL hub groups families in kind order, and sorts +/- inside a kind.
# kind/c/e/d come from CubeRoot model.ts CATEGORIES (O is pure-LL and omitted).
$familyConfigs = @(
    [pscustomobject]@{ key = 'A+'; slug = 'ap'; kind = 'TT'; c = 2; e = 0; d = 0 },
    [pscustomobject]@{ key = 'A-'; slug = 'am'; kind = 'TT'; c = 1; e = 1; d = 1 },
    [pscustomobject]@{ key = 'B+'; slug = 'bp'; kind = 'TT'; c = 1; e = 0; d = 3 },
    [pscustomobject]@{ key = 'B-'; slug = 'bm'; kind = 'TT'; c = 2; e = 1; d = 2 },
    [pscustomobject]@{ key = 'G+'; slug = 'gp'; kind = 'TT'; c = 0; e = 0; d = 1 },
    [pscustomobject]@{ key = 'G-'; slug = 'gm'; kind = 'TT'; c = 0; e = 1; d = 0 },
    [pscustomobject]@{ key = 'H+'; slug = 'hp'; kind = 'TT'; c = 0; e = 0; d = 0 },
    [pscustomobject]@{ key = 'H-'; slug = 'hm'; kind = 'TT'; c = 0; e = 1; d = 1 },
    [pscustomobject]@{ key = 'I+'; slug = 'ip'; kind = 'TT'; c = 2; e = 0; d = 1 },
    [pscustomobject]@{ key = 'I-'; slug = 'im'; kind = 'TT'; c = 1; e = 1; d = 0 },
    [pscustomobject]@{ key = 'K+'; slug = 'kp'; kind = 'TT'; c = 1; e = 0; d = 0 },
    [pscustomobject]@{ key = 'K-'; slug = 'km'; kind = 'TT'; c = 2; e = 1; d = 1 },
    [pscustomobject]@{ key = 'M+'; slug = 'mp'; kind = 'TT'; c = 2; e = 0; d = 2 },
    [pscustomobject]@{ key = 'M-'; slug = 'mm'; kind = 'TT'; c = 1; e = 1; d = 3 },
    [pscustomobject]@{ key = 'P+'; slug = 'pp'; kind = 'TT'; c = 0; e = 0; d = 2 },
    [pscustomobject]@{ key = 'P-'; slug = 'pm'; kind = 'TT'; c = 0; e = 1; d = 3 },
    [pscustomobject]@{ key = 'Q+'; slug = 'qp'; kind = 'TT'; c = 0; e = 0; d = 3 },
    [pscustomobject]@{ key = 'Q-'; slug = 'qm'; kind = 'TT'; c = 0; e = 1; d = 2 },
    [pscustomobject]@{ key = 'R+'; slug = 'rp'; kind = 'TT'; c = 1; e = 0; d = 2 },
    [pscustomobject]@{ key = 'R-'; slug = 'rm'; kind = 'TT'; c = 2; e = 1; d = 3 },
    [pscustomobject]@{ key = 'W+'; slug = 'wp'; kind = 'TT'; c = 2; e = 0; d = 3 },
    [pscustomobject]@{ key = 'W-'; slug = 'wm'; kind = 'TT'; c = 1; e = 1; d = 2 },
    [pscustomobject]@{ key = 'X+'; slug = 'xp'; kind = 'TT'; c = 1; e = 0; d = 1 },
    [pscustomobject]@{ key = 'X-'; slug = 'xm'; kind = 'TT'; c = 2; e = 1; d = 0 },
    [pscustomobject]@{ key = 'E+'; slug = 'ep'; kind = 'CS'; c = 0; e = 0; d = 0 },
    [pscustomobject]@{ key = 'E-'; slug = 'em'; kind = 'CS'; c = 0; e = 1; d = 0 },
    [pscustomobject]@{ key = 'J+'; slug = 'jp'; kind = 'CS'; c = 1; e = 0; d = 0 },
    [pscustomobject]@{ key = 'L-'; slug = 'lm'; kind = 'CS'; c = 1; e = 1; d = 0 },
    [pscustomobject]@{ key = 'L+'; slug = 'lp'; kind = 'CS'; c = 2; e = 0; d = 0 },
    [pscustomobject]@{ key = 'J-'; slug = 'jm'; kind = 'CS'; c = 2; e = 1; d = 0 },
    [pscustomobject]@{ key = 'S'; slug = 's'; kind = 'ES'; c = 0; e = 0; d = 0 },
    [pscustomobject]@{ key = 'T'; slug = 't'; kind = 'ES'; c = 0; e = 1; d = 0 },
    [pscustomobject]@{ key = 'U-'; slug = 'um'; kind = 'ES'; c = 1; e = 0; d = 0 },
    [pscustomobject]@{ key = 'V-'; slug = 'vm'; kind = 'ES'; c = 1; e = 1; d = 0 },
    [pscustomobject]@{ key = 'U+'; slug = 'up'; kind = 'ES'; c = 2; e = 0; d = 0 },
    [pscustomobject]@{ key = 'V+'; slug = 'vp'; kind = 'ES'; c = 2; e = 1; d = 0 },
    [pscustomobject]@{ key = 'C+'; slug = 'cp'; kind = 'SS'; c = 1; e = 1; d = 0 },
    [pscustomobject]@{ key = 'C-'; slug = 'cm'; kind = 'SS'; c = 2; e = 1; d = 0 },
    [pscustomobject]@{ key = 'D+'; slug = 'dp'; kind = 'SS'; c = 1; e = 0; d = 0 },
    [pscustomobject]@{ key = 'D-'; slug = 'dm'; kind = 'SS'; c = 2; e = 0; d = 0 },
    [pscustomobject]@{ key = 'F'; slug = 'f'; kind = 'SS'; c = 0; e = 1; d = 0 }
)
$familyOrder = @($familyConfigs | ForEach-Object { $_.key })

# ---- 大类卡片 facelets (port of CubeRoot lsll/model.ts categoryCardFacelets) ----
$CF = @(@(8, 9, 20), @(6, 18, 38), @(0, 36, 47), @(2, 45, 11), @(29, 26, 15), @(27, 44, 24), @(33, 53, 42), @(35, 17, 51))
$EF = @(@(5, 10), @(7, 19), @(3, 37), @(1, 46), @(32, 16), @(28, 25), @(30, 43), @(34, 52), @(23, 12), @(21, 41), @(50, 39), @(48, 14))
$CCOL = @(@(0, 1, 2), @(0, 2, 4), @(0, 4, 5), @(0, 5, 1), @(3, 2, 1), @(3, 4, 2), @(3, 5, 4), @(3, 1, 5))
$ECOL = @(@(0, 1), @(0, 2), @(0, 4), @(0, 5), @(3, 1), @(3, 2), @(3, 4), @(3, 5), @(2, 1), @(2, 4), @(5, 4), @(5, 1))
$FACE_CH = @('u', 'r', 'f', 'd', 'l', 'b')
$solvedFacelets = ('u' * 9) + ('r' * 9) + ('f' * 9) + ('d' * 9) + ('l' * 9) + ('b' * 9)

function Paint-Corner([char[]]$f, [int]$pos, [int]$piece, [int]$o) {
    for ($k = 0; $k -lt 3; $k++) {
        $f[$CF[$pos][($k + $o) % 3]] = $FACE_CH[$CCOL[$piece][$k]]
    }
}

function Paint-Edge([char[]]$f, [int]$pos, [int]$piece, [int]$o) {
    for ($k = 0; $k -lt 2; $k++) {
        $f[$EF[$pos][($k + $o) % 2]] = $FACE_CH[$ECOL[$piece][$k]]
    }
}

function Category-Facelets($config) {
    $f = $solvedFacelets.ToCharArray()
    foreach ($p in 0..4) { foreach ($i in $CF[$p]) { $f[$i] = 'o' } }
    foreach ($p in @(0, 1, 2, 3, 8)) { foreach ($i in $EF[$p]) { $f[$i] = 'o' } }
    $f[4] = 'o' # U center is part of the LL

    $cpos = if (@('CS', 'SS') -contains $config.kind) { 4 } else { 0 }
    $epos = if (@('ES', 'SS') -contains $config.kind) { 4 }
        elseif ($config.kind -eq 'TT') { $config.d }
        else { $config.e }

    Paint-Corner $f $cpos 4 $config.c
    Paint-Edge $f $epos 8 $config.e
    return -join $f
}

$zblsMap = @{}
$zblsRank = @{}
$rank = 0
foreach ($c in $zbls.cases) {
    $pair = "$($c.subgroup)|$($c.name)"
    if (-not $zblsMap.ContainsKey($pair)) {
        $zblsMap[$pair] = First-Alg $c
        $zblsRank[$pair] = $rank
        $rank++
    }
}

$keyProps = $keys.PSObject.Properties
$twoRows = New-Object System.Collections.Generic.List[object]

foreach ($prop in $keyProps) {
    $refs = @($prop.Value)
    if (-not $refs.Count) { continue }
    $ref = $refs[0]
    if ($ref.subgroup -eq 'O') { continue }

    $pair = "$($ref.subgroup)|$($ref.name)"
    $zblsAlg = $zblsMap[$pair]
    if ($zblsAlg) {
        $twoRows.Add([pscustomobject]@{
                family = $ref.subgroup
                rank = $zblsRank[$pair]
                name = "ZBLS $($ref.subgroup) $($ref.name)"
                alg = $zblsAlg
            })
    }
}

$twoRows = @($twoRows | Sort-Object @{ Expression = { $i = [array]::IndexOf($familyOrder, $_.family); if ($i -lt 0) { 999 } else { $i } } }, rank, name)

foreach ($c in $zbll.cases) {
    $alg = First-Alg $c
    if (-not $alg) { continue }
    $twoRows += [pscustomobject]@{ name = $c.name; alg = $alg }
}
foreach ($c in $pll.cases) {
    $alg = First-Alg $c
    if (-not $alg) { continue }
    $twoRows += [pscustomobject]@{ name = "PLL $($c.name)"; alg = $alg }
}

function Rows-Json($rows) {
    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($r in $rows) {
        $parts.Add('["' + (Esc ([string]$r.name)) + '","' + (Esc ([string]$r.alg)) + '"]')
    }
    return '[' + ($parts -join ',') + ']'
}

$familyRows = New-Object System.Collections.Generic.List[object]
foreach ($config in $familyConfigs) {
    $count = if ($config.kind -eq 'SS') { if ($config.e -eq 0) { 3916 } else { 3888 } } else { 15552 }
    $familyRows.Add([pscustomobject]@{
            key = $config.key
            slug = $config.slug
            count = $count
            file = ('data/lsll-one-step/{0}.js' -f $config.slug)
            facelets = Category-Facelets $config
        })
}

function Families-Json($rows) {
    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($r in $rows) {
        $parts.Add('{"key":"' + (Esc ([string]$r.key)) +
            '","slug":"' + (Esc ([string]$r.slug)) +
            '","count":' + [int]$r.count +
            ',"file":"' + (Esc ([string]$r.file)) +
            '","facelets":"' + (Esc ([string]$r.facelets)) + '"}')
    }
    return '[' + ($parts -join ',') + ']'
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('// LSLL formulas, generated by tools/fetch-lsll.ps1.')
$lines.Add('// Two-step: ZBLS first look + ZBLL/PLL second look.')
$lines.Add('// One-step: 579,368 optimal solutions split into data/lsll-one-step/<slug>.js.')
$lines.Add('// families: 54-facelet LS-state thumbnails plus per-family file metadata.')
$lines.Add('window.LSLLDB = {')
$lines.Add('    "两步": ' + (Rows-Json $twoRows) + ',')
$lines.Add('    "一步": [],')
$lines.Add('    "families": ' + (Families-Json $familyRows))
$lines.Add('};')
[System.IO.File]::WriteAllText($outPath, ($lines -join "`n"), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ("two-step: {0} rows, one-step families: {1}, file KB: {2}" -f $twoRows.Count, $familyRows.Count, [math]::Round((Get-Item $outPath).Length / 1024))
