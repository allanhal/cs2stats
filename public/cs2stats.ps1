#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Site = "https://cs2.allanpinheiro.com",
  [string[]]$Path,
  [string]$Nick = $env:USERNAME,
  [string]$Archive = "https://public.allanpinheiro.com",
  [switch]$NoArchive,
  [switch]$WhatIfOnly
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Archive = $Archive.TrimEnd("/")
$ArchiveChunk = 8 * 1024 * 1024
$script:ArchiveFiles = @{}

$FallbackSite = "https://cs2-backup.allanpinheiro.com"
$SitePinned = $PSBoundParameters.ContainsKey("Site")
$HashChunk = 4MB
$Base = $env:LOCALAPPDATA
if (-not $Base) { $Base = $env:TEMP }
if (-not $Base) { $Base = "." }
$WorkDir = $Base.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar + "cs2stats"
$Node = $null
$NodeVersion = "v24.22.2"
$NodeMinimum = 22
$ParserVersion = "0.42.0"
$ParserPatch = "14197"
$Registry = "https://registry.npmjs.org"
$RetryDelays = @(5, 20)

function Write-Step {
  param([string]$Text, [string]$Color = "Gray")
  Write-Host $Text -ForegroundColor $Color
}

function Test-SiteAlive {
  param([string]$Url)
  for ($tentativa = 0; $tentativa -le $RetryDelays.Count; $tentativa++) {
    try {
      Invoke-WebRequest -Uri "$Url/robots.txt" -Method Head -TimeoutSec 90 -UseBasicParsing | Out-Null
      return $true
    } catch {
      if ($tentativa -lt $RetryDelays.Count) {
        Write-Step "Sem resposta de $Url, tentando de novo em $($RetryDelays[$tentativa])s" "DarkGray"
        Start-Sleep -Seconds $RetryDelays[$tentativa]
      }
    }
  }
  $false
}

function Resolve-Site {
  if ($script:SitePinned) { return }
  if (Test-SiteAlive $script:Site) { return }
  if (Test-SiteAlive $script:FallbackSite) {
    Write-Step "Site principal fora do ar, usando $script:FallbackSite" "Yellow"
    $script:Site = $script:FallbackSite
    return
  }
  Write-Host "Site fora do ar: $script:Site" -ForegroundColor Red
  exit 1
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

function Test-TransientStatus {
  param([int]$Status)
  ($Status -eq 0) -or ($Status -eq 408) -or ($Status -eq 425) -or ($Status -eq 429) -or ($Status -ge 500)
}

function Format-Failure {
  param($Resultado)
  if ($Resultado.Status -gt 0) { return "HTTP $($Resultado.Status)" }
  if ($Resultado.Reason) { return $Resultado.Reason }
  "sem resposta"
}

function Invoke-JsonOnce {
  param([string]$Uri, [string]$Method, [string]$Json, [int]$TimeoutSec)
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Json)
    $response = Invoke-RestMethod -Uri $Uri -Method $Method -ContentType "application/json; charset=utf-8" -Body $bytes -TimeoutSec $TimeoutSec
    return [pscustomobject]@{ Status = 200; Data = $response; Reason = "" }
  } catch {
    $status = Get-StatusCode $_
    $raw = Read-ErrorBody $_
    $data = $null
    if ($raw) { try { $data = $raw | ConvertFrom-Json } catch {} }
    return [pscustomobject]@{ Status = $status; Data = $data; Reason = $_.Exception.Message }
  }
}

function Invoke-Json {
  param(
    [string]$Route,
    [string]$Method = "Post",
    $Body,
    [int]$TimeoutSec = 600
  )
  $json = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 6 -Compress }
  $origens = @($script:Site)
  if (-not $script:SitePinned -and $script:Site -ne $script:FallbackSite) {
    $origens += $script:FallbackSite
  }
  $ultimo = $null
  foreach ($origem in $origens) {
    for ($tentativa = 0; $tentativa -le $RetryDelays.Count; $tentativa++) {
      $resultado = Invoke-JsonOnce -Uri "$origem$Route" -Method $Method -Json $json -TimeoutSec $TimeoutSec
      if (-not (Test-TransientStatus $resultado.Status)) {
        if ($origem -ne $script:Site) {
          Write-Step "  site principal fora do ar, seguindo por $origem" "Yellow"
          $script:Site = $origem
        }
        return $resultado
      }
      $ultimo = $resultado
      if ($tentativa -lt $RetryDelays.Count) {
        $espera = $RetryDelays[$tentativa]
        Write-Step "  o site nao respondeu ($(Format-Failure $resultado)), tentando de novo em $espera s" "Yellow"
        Start-Sleep -Seconds $espera
      }
    }
  }
  $ultimo
}

function Save-File {
  param([string]$Uri, [string]$OutFile, [int]$TimeoutSec = 900)
  for ($tentativa = 0; $tentativa -le $RetryDelays.Count; $tentativa++) {
    try {
      Invoke-RestMethod -Uri $Uri -OutFile $OutFile -TimeoutSec $TimeoutSec
      return
    } catch {
      if ($tentativa -ge $RetryDelays.Count) { throw }
      $espera = $RetryDelays[$tentativa]
      Write-Step "Download falhou ($($_.Exception.Message)), tentando de novo em $espera s" "Yellow"
      Start-Sleep -Seconds $espera
    }
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
          return [pscustomobject]@{ Exe = $candidate; Version = "$version".Trim(); Portable = $false }
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
    return [pscustomobject]@{ Exe = $exe; Version = $NodeVersion; Portable = $true }
  }

  Write-Step "Baixando o Node $NodeVersion (~30 MB, so na primeira vez)..." "DarkGray"
  $zip = Join-PathSafe $WorkDir "$name.zip"
  Save-File -Uri "https://nodejs.org/dist/$NodeVersion/$name.zip" -OutFile $zip -TimeoutSec 1800
  Expand-Archive -LiteralPath $zip -DestinationPath $WorkDir -Force
  Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue

  if (-not (Test-PathSafe $exe)) { throw "nao consegui preparar o Node portatil" }
  [pscustomobject]@{ Exe = $exe; Version = $NodeVersion; Portable = $true }
}

function Resolve-Node {
  $found = Find-UsableNode
  if ($found) { return $found }
  Install-PortableNode
}

function Invoke-Native {
  param([string]$Exe, [string[]]$Arguments, [string]$OutFile, [string]$ErrFile)
  $saida = $OutFile
  if (-not $saida) { $saida = Join-PathSafe $env:TEMP "cs2stats-native.log" }
  $lista = @()
  foreach ($argumento in $Arguments) {
    if ([string]::IsNullOrEmpty($argumento) -or $argumento -match "[\s()&|<>^,;]") { $lista += ('"' + $argumento + '"') } else { $lista += $argumento }
  }
  if ($Exe -notmatch "\.exe$") {
    $lista = @("/c", ('"' + $Exe + '"')) + $lista
    $Exe = "cmd.exe"
  }
  if ($lista.Count -gt 0) {
    $processo = Start-Process -FilePath $Exe -ArgumentList $lista -NoNewWindow -Wait -PassThru -RedirectStandardOutput $saida -RedirectStandardError $ErrFile
  } else {
    $processo = Start-Process -FilePath $Exe -NoNewWindow -Wait -PassThru -RedirectStandardOutput $saida -RedirectStandardError $ErrFile
  }
  $processo.ExitCode
}

function Read-TextFile {
  param([string]$Path)
  if (-not (Test-PathSafe $Path)) { return "" }
  $texto = Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue
  if ($null -eq $texto) { return "" }
  $texto.Trim()
}

function Read-Utf8File {
  param([string]$Path)
  if (-not (Test-PathSafe $Path)) { return "" }
  try {
    $conteudo = [System.IO.File]::ReadAllText($Path, (New-Object System.Text.UTF8Encoding($false)))
  } catch {
    return ""
  }
  if ($null -eq $conteudo) { return "" }
  $conteudo.Trim()
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

function Get-InstalledParserVersion {
  $package = Join-PathSafe $WorkDir "node_modules\@laihoe\demoparser2\package.json"
  if (-not (Test-PathSafe $package)) { return "" }
  try {
    $manifest = Get-Content -LiteralPath $package -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    if ($manifest.version) { return "$($manifest.version)" }
  } catch {}
  ""
}

function Get-NodeArch {
  $saida = Join-PathSafe $WorkDir "node-arch.txt"
  $code = Invoke-Native -Exe $Node.Exe -Arguments @("-p", "process.arch") -OutFile $saida -ErrFile "$saida.err"
  if ($code -ne 0) { return "x64" }
  $valor = Read-TextFile $saida
  if ($valor) { return $valor }
  "x64"
}

function Get-ParserPlatformPackage {
  switch (Get-NodeArch) {
    "arm64" { "demoparser2-win32-arm64-msvc" }
    "ia32" { "demoparser2-win32-ia32-msvc" }
    default { "demoparser2-win32-x64-msvc" }
  }
}

function Get-ParserPatchTriple {
  switch (Get-NodeArch) {
    "arm64" { "win32-arm64-msvc" }
    "ia32" { "win32-ia32-msvc" }
    default { "win32-x64-msvc" }
  }
}

function Update-ParserPatch {
  $pasta = Join-PathSafe $WorkDir "node_modules\@laihoe\demoparser2"
  if (-not (Test-PathSafe $pasta)) { return }
  $triple = Get-ParserPatchTriple
  $marcador = Join-PathSafe $pasta "cs2stats-patch.txt"
  $alvo = Join-PathSafe $pasta "demoparser2.$triple.node"
  if ((Test-PathSafe $alvo) -and (Read-TextFile $marcador) -eq $ParserPatch) { return }

  Write-Step "Aplicando a correcao do parser para o CS2 $ParserPatch..." "DarkGray"
  $temporario = "$alvo.novo"
  try {
    Save-File -Uri "$Site/parser/demoparser2.$triple.node" -OutFile $temporario -TimeoutSec 300
    Move-Item -LiteralPath $temporario -Destination $alvo -Force
    Set-Content -LiteralPath $marcador -Value $ParserPatch -Encoding ASCII
  } catch {
    Remove-Item -LiteralPath $temporario -Force -ErrorAction SilentlyContinue
    Write-Step "  nao consegui baixar a correcao; sigo com o parser do npm" "Yellow"
  }
}

function Expand-Tarball {
  param([string]$Archive, [string]$Destination)
  $tar = Join-PathSafe $env:SystemRoot "System32\tar.exe"
  if (-not (Test-PathSafe $tar)) { throw "este Windows nao tem o tar.exe; instale o Node pelo site oficial e rode de novo" }
  if (-not (Test-PathSafe $Destination)) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  }
  $log = Join-PathSafe $WorkDir "tar.log"
  $code = Invoke-Native -Exe $tar -Arguments @("-xzf", $Archive, "-C", $Destination, "--strip-components=1") -OutFile $log -ErrFile "$log.err"
  if ($code -ne 0) {
    $detalhe = Read-TextFile "$log.err"
    if (-not $detalhe) { $detalhe = "o tar saiu com codigo $code" }
    throw "nao consegui abrir ${Archive}: $detalhe"
  }
}

function Install-ParserTarball {
  foreach ($pacote in @("demoparser2", (Get-ParserPlatformPackage))) {
    $tgz = Join-PathSafe $WorkDir "$pacote-$ParserVersion.tgz"
    Save-File -Uri "$Registry/@laihoe/$pacote/-/$pacote-$ParserVersion.tgz" -OutFile $tgz
    Expand-Tarball -Archive $tgz -Destination (Join-PathSafe $WorkDir "node_modules\@laihoe\$pacote")
    Remove-Item -LiteralPath $tgz -Force -ErrorAction SilentlyContinue
  }
}

function Test-ParserLoads {
  $entrada = Join-PathSafe $WorkDir "node_modules\@laihoe\demoparser2\index.js"
  if (-not (Test-PathSafe $entrada)) { return $false }
  $saida = Join-PathSafe $WorkDir "parser-check.txt"
  $code = Invoke-Native -Exe $Node.Exe -Arguments @("-e", "require(process.argv[1])", $entrada) -OutFile $saida -ErrFile "$saida.err"
  $code -eq 0
}

function Test-ParserReady {
  if ((Get-InstalledParserVersion) -ne $ParserVersion) { return $false }
  Test-ParserLoads
}

function Initialize-Parser {
  if (-not (Test-PathSafe $WorkDir)) {
    New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
  }
  $script:WorkDir = (Resolve-Path -LiteralPath $WorkDir).Path

  $extractor = Join-PathSafe $WorkDir "cs2stats-extract.mjs"
  Write-Step "Baixando o extrator..." "DarkGray"
  Save-File -Uri "$Site/cs2stats-extract.mjs" -OutFile $extractor -TimeoutSec 300

  if (Test-ParserReady) {
    Update-ParserPatch
    return $extractor
  }

  $instalado = Get-InstalledParserVersion
  $acao = if ($instalado) { "Atualizando" } else { "Instalando" }
  Write-Step "$acao o parser $ParserVersion (~20 MB)..." "DarkGray"
  Push-Location $WorkDir
  try {
    $code = Invoke-Npm @("install", "--no-save", "--no-audit", "--no-fund", "--loglevel=error", "@laihoe/demoparser2@$ParserVersion")
    if ($code -ne 0) {
      $detalhe = Read-TextFile (Join-PathSafe $WorkDir "npm.log.err")
      if (-not $detalhe) { $detalhe = Read-TextFile (Join-PathSafe $WorkDir "npm.log") }
      if (-not $detalhe) { $detalhe = "o npm saiu com codigo $code e nao disse por que" }
      Write-Step "  o npm nao deu conta: $detalhe" "Yellow"
    }
  } catch {
    Write-Step "  o npm nao deu conta: $($_.Exception.Message)" "Yellow"
  } finally {
    Pop-Location
  }

  if (Test-ParserReady) {
    Update-ParserPatch
    return $extractor
  }

  Write-Step "Baixando o parser direto do registro do npm..." "Yellow"
  Install-ParserTarball
  if (Test-ParserReady) {
    Update-ParserPatch
    return $extractor
  }
  throw "nao consegui preparar o parser com este Node"
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
    $linhas = (Read-TextFile "$output.err") -split "`r?`n"
    $reason = ($linhas | Where-Object { $_.Trim() } | Select-Object -First 1)
    if (-not $reason) { $reason = "o parser saiu com código $code" }
    throw $reason.Trim()
  }
  $json = Read-Utf8File $output
  if (-not $json) { throw "o parser não devolveu nada" }
  $json
}

function Get-CanonicalName {
  param([string]$Name)
  return [regex]::Replace($Name, ' \(\d+\)(\.dem(\.(zst|bz2))?)$', '$1', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

function Get-ArchiveIndex {
  if ($script:NoArchive) { return }
  $script:ArchiveFiles = @{}
  try {
    $listing = Invoke-RestMethod -Uri "$script:Archive/api/files" -Method Get -TimeoutSec 120
  } catch {
    Write-Step "Nao consegui falar com o acervo em $script:Archive; sigo sem guardar as demos." "Yellow"
    $script:NoArchive = $true
    return
  }
  foreach ($file in @($listing.files)) {
    $script:ArchiveFiles["$(Get-CanonicalName $file.name)|$($file.size)"] = $true
  }
}

function Format-Eta {
  param([int]$Segundos)
  if ($Segundos -lt 60) { return "$($Segundos)s" }
  if ($Segundos -lt 3600) { return "{0}min{1:d2}s" -f [int]($Segundos / 60), ($Segundos % 60) }
  "{0}h{1:d2}min" -f [int]($Segundos / 3600), [int](($Segundos % 3600) / 60)
}

function Write-UploadProgress {
  param([int64]$Offset, [int64]$Total, [datetime]$Started)
  $decorridos = ((Get-Date) - $Started).TotalSeconds
  $texto = "    {0}% - {1}/{2} MB" -f `
    [int]($Offset * 100 / $Total), [int]($Offset / 1MB), [int]($Total / 1MB)
  if ($decorridos -ge 2) {
    $taxa = $Offset / $decorridos
    $texto = "{0} - {1:n1} MB/s - faltam {2}" -f `
      $texto, ($taxa / 1MB), (Format-Eta ([int](($Total - $Offset) / $taxa)))
  }
  if ([Console]::IsOutputRedirected) {
    Write-Step $texto "DarkGray"
  } else {
    Write-Host "`r$($texto.PadRight(72))" -NoNewline -ForegroundColor DarkGray
  }
}

function Save-DemoToArchive {
  param([System.IO.FileInfo]$File)

  if ($script:NoArchive) { return }
  $stored = Get-CanonicalName $File.Name
  if ($script:ArchiveFiles.ContainsKey("$stored|$($File.Length)")) {
    Write-Step "  a demo ja esta guardada no acervo" "DarkGray"
    return
  }

  try {
    $init = Invoke-RestMethod -Uri "$script:Archive/api/uploads" -Method Post `
      -ContentType "application/json; charset=utf-8" `
      -Body ([Text.Encoding]::UTF8.GetBytes((@{ name = $stored; size = $File.Length; type = "" } | ConvertTo-Json -Compress))) `
      -TimeoutSec 120
  } catch {
    Write-Step "  nao consegui abrir o envio para o acervo: $($_.Exception.Message)" "Yellow"
    return
  }

  $id = $init.id
  $ceiling = if ($init.chunkBytes) { [int]$init.chunkBytes } else { $ArchiveChunk }
  $chunk = [Math]::Min($ArchiveChunk, $ceiling)
  $offset = [int64]$init.received
  $failures = 0
  $shown = 0
  $desenhou = $false
  $inicio = Get-Date

  Write-Step "  guardando a demo no acervo ($([Math]::Round($File.Length / 1MB)) MB)..." "DarkGray"
  $stream = [System.IO.File]::OpenRead($File.FullName)
  try {
    while ($offset -lt $File.Length) {
      $length = [int][Math]::Min([int64]$chunk, $File.Length - $offset)
      $buffer = New-Object byte[] $length
      $stream.Position = $offset
      Read-Exactly -Stream $stream -Buffer $buffer
      $sent = $null
      try {
        $sent = Invoke-RestMethod -Uri "$script:Archive/api/uploads/$id`?offset=$offset" -Method Patch `
          -ContentType "application/octet-stream" -Body $buffer -TimeoutSec 300
      } catch {
        $raw = Read-ErrorBody $_
        if ($raw) { try { $sent = $raw | ConvertFrom-Json } catch {} }
      }
      if ($sent -and $sent.received -gt $offset) {
        $offset = [int64]$sent.received
        $failures = 0
        if ([Console]::IsOutputRedirected) {
          $fatia = [int]($offset * 10 / $File.Length)
          if ($fatia -gt $shown) {
            $shown = $fatia
            Write-UploadProgress -Offset $offset -Total $File.Length -Started $inicio
          }
        } else {
          Write-UploadProgress -Offset $offset -Total $File.Length -Started $inicio
          $desenhou = $true
        }
        continue
      }
      $failures++
      if ($failures -gt 5) {
        if ($desenhou) { Write-Host ""; $desenhou = $false }
        Write-Step "  o envio da demo para o acervo falhou; as estatisticas ja foram conferidas" "Yellow"
        try { Invoke-RestMethod -Uri "$script:Archive/api/uploads/$id" -Method Delete -TimeoutSec 60 | Out-Null } catch {}
        return
      }
      Start-Sleep -Seconds $failures
    }
  } finally {
    $stream.Dispose()
    if ($desenhou) { Write-Host "" }
  }

  try {
    $done = Invoke-RestMethod -Uri "$script:Archive/api/uploads/$id/complete" -Method Post -TimeoutSec 120
  } catch {
    Write-Step "  o acervo nao fechou o arquivo: $($_.Exception.Message)" "Yellow"
    return
  }
  if ($done.duplicate) {
    Write-Step "  a demo ja estava guardada no acervo" "DarkGray"
  } else {
    Write-Step "  demo guardada no acervo" "DarkGray"
  }
  $script:ArchiveFiles["$stored|$($File.Length)"] = $true
}

function Submit-Demo {
  param([System.IO.FileInfo]$File, [string]$Extractor)

  $megabytes = [Math]::Round($File.Length / 1MB)
  Write-Host ""
  Write-Step "$($File.Name)  ($megabytes MB)" "White"

  $hash = Get-DemoFingerprint -File $File
  $check = Invoke-Json -Route "/api/upload/check" -Body @{ hash = $hash; name = $File.Name; size = $File.Length }
  if ($check.Status -ne 200) {
    Write-Step "  falhou ao consultar o site ($(Format-Failure $check))" "Red"
    return "falhou"
  }
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
  $send = Invoke-Json -Route "/api/matches" -Body $payload

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
  $reason = if ($send.Data.error) { $send.Data.error } else { Format-Failure $send }
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
Resolve-Site
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
  try {
    $Extractor = Initialize-Parser
  } catch {
    if ($Node.Portable) { throw }
    Write-Step "O Node do sistema nao deu conta: $($_.Exception.Message)" "Yellow"
    Write-Step "Tentando de novo com o Node portatil..." "Yellow"
    $Node = Install-PortableNode
    Write-Step "Node $($Node.Version)" "DarkGray"
    $Extractor = Initialize-Parser
  }
}

Write-Step "Etapa 1: processando e enviando as estatisticas..." "Cyan"

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

if (-not $WhatIfOnly -and -not $NoArchive) {
  Write-Host ""
  Write-Step "Etapa 2: guardando as demos em $Archive..." "Cyan"
  Get-ArchiveIndex
  foreach ($demo in $demos) {
    try {
      Write-Step $demo.Name "White"
      Save-DemoToArchive -File $demo
    } catch {
      Write-Step "  falhou no acervo: $($_.Exception.Message)" "Yellow"
    }
  }
}

Write-Host ""
Write-Host "Fim: $($tally.enviada) enviada(s), $($tally.atualizada) atualizada(s), $($tally.conhecida) já estavam lá, $($tally.falhou) com erro." -ForegroundColor Cyan
if ($tally.pendente -gt 0) {
  Write-Host "$($tally.pendente) seriam enviadas (rode sem -WhatIfOnly)." -ForegroundColor Yellow
}
Write-Host "Veja em $Site/matches" -ForegroundColor Cyan
