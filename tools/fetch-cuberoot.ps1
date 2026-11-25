# 从 CubeRoot API 重新拉取公式，生成 data/cuberoot.js
# 用法：在仓库根目录执行 powershell -ExecutionPolicy Bypass -File tools/fetch-cuberoot.ps1
# 盲拧、魔表、单手项目暂不拉取；其余项目按 CubeRoot 现有套导入。
param(
    [switch]$Refresh
)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $root "data\cuberoot.js"
New-Item -ItemType Directory -Force -Path (Join-Path $root "data") | Out-Null

$sets = [ordered]@{
    "3x3" = @(
        @("OLL", "oll"),
        @("PLL", "pll"),
        @("2-Look OLL", "2-look-oll"),
        @("2-Look PLL", "2-look-pll"),
        @("F2L", "f2l"),
        @("Adv F2L", "adv-f2l"),
        @("Pseudo F2L", "psf2l"),
        @("COLL", "coll"),
        @("ZBLL", "zbll"),
        @("ZBLS", "zbls"),
        @("1LLL", "1lll"),
        @("OLLCP", "ollcp"),
        @("CMLL", "cmll"),
        @("2-Look CMLL", "2-look-cmll"),
        @("OH CMLL", "oh-cmll"),
        @("ELL", "ell"),
        @("CLS", "cls"),
        @("WV", "wv"),
        @("VLS", "vls"),
        @("SV", "sv"),
        @("FRUF", "fruf"),
        @("SBLS", "sbls"),
        @("LSE-EOLR", "lse-eolr"),
        @("EO4A", "eo4a"),
        @("Anti-PLL", "anti-pll")
    )
    "2x2" = @(
        @("OLL", "ortega-oll"),
        @("PBL", "ortega-pbl"),
        @("CLL", "cll"),
        @("EG1", "eg1"),
        @("EG2", "eg2"),
        @("LEG1", "leg1"),
        @("TCLL+", "tcll-plus"),
        @("TCLL-", "tcll-minus"),
        @("LS1", "ls1"),
        @("LS2", "ls2"),
        @("LS3", "ls3"),
        @("LS4", "ls4"),
        @("LS5", "ls5"),
        @("LS6", "ls6"),
        @("LS7", "ls7"),
        @("LS8", "ls8"),
        @("LS9", "ls9"),
        @("TEG2+", "teg2-plus")
    )
    "4x4" = @(
        @("OLL Parity", "oll-parity"),
        @("PLL Parity", "pll-parity")
    )
    "5x5" = @(
        @("L2C", "l2c"),
        @("L2E", "l2e")
    )
    "6x6" = @(
        @("L2C", "l2c"),
        @("L2E", "l2e")
    )
    "fto" = @(
        @("1L3T", "1l3t"),
        @("TCP", "tcp"),
        @("PF", "pf"),
        @("TL", "tl"),
        @("LT", "lt")
    )
    "megaminx" = @(
        @("CO", "co"),
        @("CP", "cp"),
        @("EO", "eo"),
        @("EP", "ep"),
        @("PLL", "full-pll")
    )
    "pyraminx" = @(
        @("L3E", "l3e"),
        @("L4E", "l4e")
    )
    "skewb" = @(
        ,@("Sarah Advanced", "sarahs-advanced")
    )
    "sq1" = @(
        @("CS", "cs"),
        @("CO", "co"),
        @("CP", "cp"),
        @("EO", "eo"),
        @("EP", "ep"),
        @("CSP", "csp"),
        @("PBL", "pbl"),
        @("OBL", "obl"),
        @("Parity", "parity")
    )
}

# 3x3 / 2x2 的原始清洗规则：保持既有数据格式不变
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

# 其余项目保留 CubeRoot 的记法，只做字符和空格整理；
# 具体的记法转换放在前端 3D 展示层，避免改动原始数据。
function Clean-Alg-Generic([string]$a, [string]$puzzle) {
    $t = $a -replace '[\u2191\u2193\u00b7]', ' '
    $t = $t -replace '[\u2018\u2019]', "'"
    if ($puzzle -ne "sq1") {
        $t = $t -replace '[()]', ' '
    }
    $t = $t -replace '\s+', ' '
    return $t.Trim()
}

function Esc([string]$s) {
    return $s.Replace('\', '\\').Replace('"', '\"')
}

$cacheDir = Join-Path $env:TEMP "tdtimer-cuberoot-cache"
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

$tokenRe = '^[UDLRFBudlrfbMESxyz]w?(?:2''?|'')?$'
$total = 0
$invalid = 0
$invalidSamples = New-Object System.Collections.Generic.List[string]
$puzzleParts = New-Object System.Collections.Generic.List[string]

foreach ($puzzle in $sets.Keys) {
    $setParts = New-Object System.Collections.Generic.List[string]
    foreach ($pair in $sets[$puzzle]) {
        $label = $pair[0]
        $slug = $pair[1]
        $url = "https://api.cuberoot.me/v1/alg/sets/$puzzle/$slug"
        $cachePath = Join-Path $cacheDir ("{0}_{1}.json" -f $puzzle, $slug)
        if ((-not $Refresh) -and (Test-Path -LiteralPath $cachePath)) {
            $json = [System.Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($cachePath)) | ConvertFrom-Json
        } else {
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
            $json = [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray()) | ConvertFrom-Json
        }

        $caseParts = New-Object System.Collections.Generic.List[string]
        $sortedCases = $json.cases | Sort-Object { [regex]::Replace($_.name, '\d+', { param($m) $m.Value.PadLeft(6, '0') }) }
        foreach ($c in $sortedCases) {
            $raw = $null
            if ($c.algs -and $c.algs.Count -gt 0 -and $c.algs[0].Count -gt 0) {
                $raw = $c.algs[0][0].alg
            }
            if (-not $raw) { continue }

            if ($puzzle -eq "3x3" -or $puzzle -eq "2x2") {
                $alg = Clean-Alg $raw
                $total++
                $badTokens = @($alg.Split(' ') | Where-Object { $_ -ne '' -and $_ -notmatch $tokenRe })
                if ($badTokens.Count -gt 0) {
                    $invalid++
                    if ($invalidSamples.Count -lt 30) { $invalidSamples.Add("$puzzle/$slug $($c.name): $alg") }
                    continue
                }
            } else {
                $alg = Clean-Alg-Generic $raw $puzzle
                if (-not $alg) { continue }
                $total++
            }
            $caseParts.Add('["' + (Esc $c.name) + '","' + (Esc $alg) + '"]')
        }
        $setParts.Add('"' + (Esc $label) + '":[' + ($caseParts -join ',') + ']')
        Write-Host ("{0}/{1} {2}: {3} cases" -f $puzzle, $slug, $label, $json.cases.Count)
    }
    $puzzleParts.Add('"' + $puzzle + '":{' + ($setParts -join ',') + '}')
}

$content = "window.CubeRootDB={" + ($puzzleParts -join ',') + "};"
[System.IO.File]::WriteAllText($outPath, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ("total cases: {0}, invalid: {1}, file KB: {2}" -f $total, $invalid, [math]::Round((Get-Item $outPath).Length / 1024))
if ($invalidSamples.Count -gt 0) { $invalidSamples | ForEach-Object { Write-Host "BAD: $_" } }
