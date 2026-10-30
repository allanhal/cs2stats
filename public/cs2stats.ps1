#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Site = "https://cs2.allanpinheiro.com",
  [string[]]$Path,
  [string]$Nick = $env:USERNAME,
  [switch]$WhatIfOnly
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$HashChunk = 4MB
$Base = $env:LOCALAPPDATA
if (-not $Base) { $Base = $env:TEMP }
if (-not $Base) { $Base = "." }
$WorkDir = $Base.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar + "cs2stats"
$Node = $null
$NodeVersion = "v24.22.2"
$NodeMinimum = 22

function Write-Step {
  param([string]$Text, [string]$Color = "Gray")
  Write-Host $Text -ForegroundColor $Color
}

function Join-PathSafe {
  param([string]$Base, [string]$Leaf)
  if ([string]::IsNullOrWhiteSpace($Base)) { return "" }
  $separator = [System.IO.Path]::DirectorySeparatorChar
  $trimmed = $Base.TrimEnd("\", "/")
  if ([string]::IsNullOrWhiteSpace($trimmed)) { $trimmed = $Base }
  $tail = $Leaf.Replace("\", $separator).Replace("/", $separator)
  "$trimmed$separator$tail"
}

function Test-PathSafe {
  param([string]$Candidate)
  if ([string]::IsNullOrWhiteSpace($Candidate)) { return $false }
  try { return Test-Path -LiteralPath $Candidate -ErrorAction Stop } catch { return $false }
}

function Get-SteamLibraries {
  $roots = New-Object System.Collections.Generic.List[string]

  foreach ($key in @("HKCU:\Software\Valve\Steam", "HKLM:\SOFTWARE\WOW6432Node\Valve\Steam", "HKLM:\SOFTWARE\Valve\Steam")) {
    try {
      $item = Get-ItemProperty -Path $key -ErrorAction Stop
      foreach ($value in @($item.InstallPath, $item.SteamPath)) {
        if ($value) { $roots.Add($value.Replace("/", "\")) }
      }
    } catch {}
  }

  $drives = @()
  try { $drives = Get-PSDrive -PSProvider FileSystem -ErrorAction Stop } catch {}
  foreach ($drive in $drives) {
    foreach ($guess in @("Steam", "SteamLibrary", "Games\Steam", "Program Files (x86)\Steam", "Program Files\Steam")) {
      if (-not $drive.Root) { continue }
      $candidate = Join-PathSafe $drive.Root $guess
      if (Test-PathSafe $candidate) { $roots.Add($candidate) }
    }
  }

  $libraries = New-Object System.Collections.Generic.List[string]
  foreach ($root in ($roots | Select-Object -Unique)) {
    if (-not (Test-PathSafe $root)) { continue }
    $libraries.Add($root)
    $vdf = Join-PathSafe $root "steamapps\libraryfolders.vdf"
    if (Test-PathSafe $vdf) {
      foreach ($line in (Get-Content -LiteralPath $vdf -ErrorAction SilentlyContinue)) {
        if ($line -match '"path"\s+"([^"]+)"') {
          $libraries.Add($Matches[1].Replace("\\", "\"))
        }
      }
    }
  }
  $libraries | Select-Object -Unique
}

function Get-DemoFolders {
  $found = New-Object System.Collections.Generic.List[string]

  foreach ($library in Get-SteamLibraries) {
    if (-not (Test-PathSafe $library)) { continue }
    foreach ($game in @("Counter-Strike Global Offensive", "Counter-Strike 2")) {
      $csgo = Join-PathSafe $library "steamapps\common\$game\game\csgo"
      if (Test-PathSafe $csgo) {
        $found.Add($csgo)
        foreach ($sub in @("replays", "demos")) {
          $inner = Join-PathSafe $csgo $sub
          if (Test-PathSafe $inner) { $found.Add($inner) }
        }
      }
    }
  }

  if ($env:USERPROFILE) {
    $downloads = Join-PathSafe $env:USERPROFILE "Downloads"
    if (Test-PathSafe $downloads) { $found.Add($downloads) }
  }

  $found | Select-Object -Unique
}

function Read-Exactly {
  param([System.IO.Stream]$Stream, [byte[]]$Buffer)
  $read = 0
  while ($read -lt $Buffer.Length) {
    $got = $Stream.Read($Buffer, $read, $Buffer.Length - $read)
    if ($got -le 0) { throw "leitura interrompida antes do fim" }
    $read += $got
  }
}

function Get-DemoFingerprint {
  param([System.IO.FileInfo]$File)

  $size = $File.Length
  $headLength = [Math]::Min($HashChunk, $size)
  $tailStart = [Math]::Max($size - $HashChunk, 0)
  $tailLength = $size - $tailStart

  $head = New-Object byte[] $headLength
  $tail = New-Object byte[] $tailLength
  $stream = [System.IO.File]::OpenRead($File.FullName)
  try {
    $stream.Position = 0
    Read-Exactly -Stream $stream -Buffer $head
    $stream.Position = $tailStart
    Read-Exactly -Stream $stream -Buffer $tail
  } finally {
    $stream.Dispose()
  }

  $label = [Text.Encoding]::UTF8.GetBytes("$($size):")
  $payload = New-Object byte[] ($label.Length + $headLength + $tailLength)
  [Array]::Copy($label, 0, $payload, 0, $label.Length)
  [Array]::Copy($head, 0, $payload, $label.Length, $headLength)
  [Array]::Copy($tail, 0, $payload, $label.Length + $headLength, $tailLength)

  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    ($sha.ComputeHash($payload) | ForEach-Object { $_.ToString("x2") }) -join ""
  } finally {
    $sha.Dispose()
  }
}

function Read-ErrorBody {
  param($Failure)
  if ($Failure.ErrorDetails -and $Failure.ErrorDetails.Message) {
    return $Failure.ErrorDetails.Message
  }
  try {
    $stream = $Failure.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
  } catch {
    return ""
  }
}

function Get-StatusCode {
  param($Failure)
  try { return [int]$Failure.Exception.Response.StatusCode } catch { return 0 }
}

function Invoke-Json {
  param(
    [string]$Uri,
    [string]$Method = "Post",
    $Body,
    [int]$TimeoutSec = 600
  )
  $json = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 6 -Compress }
  try {
    $response = Invoke-RestMethod -Uri $Uri -Method $Method -ContentType "application/json" -Body $json -TimeoutSec $TimeoutSec
    return [pscustomobject]@{ Status = 200; Data = $response }
  } catch {
    $status = Get-StatusCode $_
    $raw = Read-ErrorBody $_
    $data = $null
    if ($raw) { try { $data = $raw | ConvertFrom-Json } catch {} }
    if ($status -eq 0) { throw }
    return [pscustomobject]@{ Status = $status; Data = $data }
  }
}

function Get-NodeMajor {
  param([string]$Version)
  if (-not $Version) { return 0 }
  $clean = $Version.Trim().TrimStart("v")
  $first = $clean.Split(".")[0]
  $parsed = 0
  if ([int]::TryParse($first, [ref]$parsed)) { return $parsed }
  0
}

function Find-UsableNode {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    foreach ($candidate in @("node", "$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe")) {
      try {
        $version = & $candidate --version 2>$null
        if ($LASTEXITCODE -eq 0 -and (Get-NodeMajor $version) -ge $NodeMinimum) {
          return [pscustomobject]@{ Exe = $candidate; Version = "$version".Trim() }
        }
      } catch {}
    }
  } finally {
    $ErrorActionPreference = $previous
  }
  $null
}

function Install-PortableNode {
  $arch = "x64"
  if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { $arch = "arm64" }
  $name = "node-$NodeVersion-win-$arch"
  $exe = Join-PathSafe (Join-PathSafe $WorkDir $name) "node.exe"
  if (Test-PathSafe $exe) {
    return [pscustomobject]@{ Exe = $exe; Version = $NodeVersion }
  }

  Write-Step "Baixando o Node $NodeVersion (~30 MB, so na primeira vez)..." "DarkGray"
  $zip = Join-PathSafe $WorkDir "$name.zip"
  Invoke-RestMethod -Uri "https://nodejs.org/dist/$NodeVersion/$name.zip" -OutFile $zip -TimeoutSec 1800
  Expand-Archive -LiteralPath $zip -DestinationPath $WorkDir -Force
  Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue

  if (-not (Test-PathSafe $exe)) { throw "nao consegui preparar o Node portatil" }
  [pscustomobject]@{ Exe = $exe; Version = $NodeVersion }
}

function Resolve-Node {
  $found = Find-UsableNode
  if ($found) { return $found }
  Install-PortableNode
}

function Invoke-Native {
  param([string]$Exe, [string[]]$Arguments, [string]$OutFile, [string]$ErrFile)
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    if ($OutFile) {
      & $Exe @Arguments 1> $OutFile 2> $ErrFile
    } else {
      & $Exe @Arguments 1> $null 2> $ErrFile
    }
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Read-TextFile {
  param([string]$Path)
  if (-not (Test-PathSafe $Path)) { return "" }
  $texto = Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue
  if ($null -eq $texto) { return "" }
  $texto.Trim()
}

function Resolve-NodeDir {
  $exe = $Node.Exe
  if ($exe -and $exe -ne "node" -and (Test-PathSafe $exe)) {
    return Split-Path -Parent $exe
  }
  try {
    $cmd = Get-Command node -ErrorAction Stop
    if ($cmd.Source) { return Split-Path -Parent $cmd.Source }
  } catch {}
  ""
}

function Resolve-NpmCli {
  $dir = Resolve-NodeDir
  if (-not $dir) { return "" }
  foreach ($relativo in @("node_modules\npm\bin\npm-cli.js", "..\lib\node_modules\npm\bin\npm-cli.js")) {
    $cli = Join-PathSafe $dir $relativo
    if (Test-PathSafe $cli) { return $cli }
  }
  ""
}

function Invoke-Npm {
  param([string[]]$Arguments)
  $log = Join-PathSafe $WorkDir "npm.log"
  $cli = Resolve-NpmCli
  if ($cli) {
    return Invoke-Native -Exe $Node.Exe -Arguments (@($cli) + $Arguments) -OutFile $log -ErrFile "$log.err"
  }
  foreach ($candidato in @("npm.cmd", "npm")) {
    try {
      if (Get-Command $candidato -ErrorAction Stop) {
        return Invoke-Native -Exe $candidato -Arguments $Arguments -OutFile $log -ErrFile "$log.err"
      }
    } catch {}
  }
  throw "não encontrei o npm junto do Node em $(Resolve-NodeDir)"
}

function Initialize-Parser {
  if (-not (Test-PathSafe $WorkDir)) {
    New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
  }
  $script:WorkDir = (Resolve-Path -LiteralPath $WorkDir).Path

  $extractor = Join-PathSafe $WorkDir "cs2stats-extract.mjs"
  Write-Step "Baixando o extrator..." "DarkGray"
  Invoke-RestMethod -Uri "$Site/cs2stats-extract.mjs" -OutFile $extractor -TimeoutSec 300

  $marker = Join-PathSafe $WorkDir "node_modules\@laihoe\demoparser2\index.js"
  if (-not (Test-PathSafe $marker)) {
    Write-Step "Instalando o parser (uma vez só, ~20 MB)..." "DarkGray"
    Push-Location $WorkDir
    try {
      $code = Invoke-Npm @("install", "--no-save", "--no-audit", "--no-fund", "--loglevel=error", "@laihoe/demoparser2@0.42.0")
      if ($code -ne 0) {
        $detalhe = Read-TextFile (Join-PathSafe $WorkDir "npm.log.err")
        if (-not $detalhe) { $detalhe = Read-TextFile (Join-PathSafe $WorkDir "npm.log") }
        if (-not $detalhe) { $detalhe = "o npm saiu com código $code e não disse por quê" }
        throw "o npm falhou ao instalar o parser: $detalhe"
      }
    } finally {
      Pop-Location
    }
    if (-not (Test-PathSafe $marker)) { throw "não consegui instalar o parser com o npm" }
  }
  $extractor
}

function Read-MatchRecord {
  param([System.IO.FileInfo]$File, [string]$Extractor)

  $output = Join-PathSafe $WorkDir "record.json"
  if (Test-PathSafe $output) { Remove-Item -LiteralPath $output -Force }

  Push-Location $WorkDir
  try {
    $code = Invoke-Native -Exe $Node.Exe -Arguments @($Extractor, $File.FullName, $Nick) -OutFile $output -ErrFile "$output.err"
  } finally {
    Pop-Location
  }

  if ($code -ne 0) {
    $reason = Read-TextFile "$output.err"
    if (-not $reason) { $reason = "o parser saiu com código $code" }
    throw $reason
  }
  $json = Read-TextFile $output
  if (-not $json) { throw "o parser não devolveu nada" }
  $json
}

function Submit-Demo {
  param([System.IO.FileInfo]$File, [string]$Extractor)

  $megabytes = [Math]::Round($File.Length / 1MB)
  Write-Host ""
  Write-Step "$($File.Name)  ($megabytes MB)" "White"

  $hash = Get-DemoFingerprint -File $File
  $check = Invoke-Json -Uri "$Site/api/upload/check" -Body @{ hash = $hash; name = $File.Name; size = $File.Length }
  if ($check.Data.known) {
    Write-Step "  já está no site, nada enviado" "DarkGray"
    return "conhecida"
  }
  if ($check.Data.outdated) {
    Write-Step "  já está no site, mas com dados antigos: vou reprocessar" "Yellow"
  }

  if ($WhatIfOnly) {
    Write-Step "  seria processada aqui e só os números iriam para o site" "Yellow"
    return "pendente"
  }

  Write-Step "  lendo a demo aqui no seu PC..." "DarkGray"
  $record = Read-MatchRecord -File $File -Extractor $Extractor

  Write-Step "  enviando as estatísticas..." "DarkGray"
  $payload = "{""hash"":""$hash"",""record"":$record}"
  $send = Invoke-Json -Uri "$Site/api/matches" -Body $payload

  if ($send.Status -eq 200) {
    $m = $send.Data
    if ($m.updated) {
      Write-Step "  atualizada com os dados novos: $($m.map) $($m.score.A)-$($m.score.B)" "Green"
      return "atualizada"
    }
    Write-Step "  pronto: $($m.map) $($m.score.A)-$($m.score.B), $($m.rounds) rounds" "Green"
    return "enviada"
  }
  if ($send.Data.duplicate) {
    Write-Step "  essa partida já estava no site" "DarkGray"
    return "conhecida"
  }
  $reason = if ($send.Data.error) { $send.Data.error } else { "erro $($send.Status)" }
  Write-Step "  falhou: $reason" "Red"
  "falhou"
}

if (-not $Path -or $Path.Count -eq 0) {
  $Path = Get-DemoFolders
  if (-not $Path -or $Path.Count -eq 0) {
    Write-Host "Nao achei a pasta do CS2." -ForegroundColor Red
    Write-Host "Ela costuma ser:" -ForegroundColor Yellow
    Write-Host "  C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\replays" -ForegroundColor Yellow
    Write-Host "Rode apontando a pasta das demos:" -ForegroundColor Yellow
    Write-Host "  .\cs2stats.ps1 -Path 'C:\caminho\para\as\demos'" -ForegroundColor Yellow
    exit 1
  }
}

Write-Host "CS2 Stats - envio de demos" -ForegroundColor Cyan
Write-Host "A demo e lida aqui no seu PC; para o site vao so os numeros." -ForegroundColor DarkGray
Write-Host "Site: $Site"
Write-Host "Nick: $Nick"
foreach ($folder in $Path) { Write-Host "Pasta: $folder" }

$demos = @()
foreach ($folder in $Path) {
  if (-not (Test-PathSafe $folder)) {
    Write-Step "Pasta nao encontrada: $folder" "Yellow"
    continue
  }
  $demos += Get-ChildItem -Path $folder -Recurse -File -Include "*.dem", "*.dem.zst", "*.dem.bz2" -ErrorAction SilentlyContinue
}
$demos = $demos | Sort-Object FullName -Unique | Sort-Object Name

if ($demos.Count -eq 0) {
  Write-Host ""
  Write-Host "Nenhum arquivo .dem encontrado." -ForegroundColor Yellow
  exit 0
}

Write-Host ""
Write-Host "$($demos.Count) demo(s) para conferir." -ForegroundColor Cyan

$Extractor = ""
if (-not $WhatIfOnly) {
  if (-not (Test-PathSafe $WorkDir)) {
    New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
  }
  $WorkDir = (Resolve-Path -LiteralPath $WorkDir).Path
  $Node = Resolve-Node
  Write-Step "Node $($Node.Version)" "DarkGray"
  $Extractor = Initialize-Parser
}

$tally = @{ enviada = 0; atualizada = 0; conhecida = 0; falhou = 0; pendente = 0 }
foreach ($demo in $demos) {
  try {
    $outcome = Submit-Demo -File $demo -Extractor $Extractor
  } catch {
    Write-Step "  falhou: $($_.Exception.Message)" "Red"
    $outcome = "falhou"
  }
  $tally[$outcome]++
}

Write-Host ""
Write-Host "Fim: $($tally.enviada) enviada(s), $($tally.atualizada) atualizada(s), $($tally.conhecida) já estavam lá, $($tally.falhou) com erro." -ForegroundColor Cyan
if ($tally.pendente -gt 0) {
  Write-Host "$($tally.pendente) seriam enviadas (rode sem -WhatIfOnly)." -ForegroundColor Yellow
}
Write-Host "Veja em $Site/matches" -ForegroundColor Cyan
