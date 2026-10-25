[CmdletBinding()]
param(
  [string]$SuitePath = 'waylit_kane_test_suite.txt',
  [string]$BaseUrl = 'http://localhost:4173',
  [ValidateRange(1, 120)]
  [int]$TimeoutMinutes = 10
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$suiteCandidate = if ([IO.Path]::IsPathRooted($SuitePath)) { $SuitePath } else { Join-Path $repoRoot $SuitePath }
$suiteFullPath = (Resolve-Path $suiteCandidate).Path
$resultsDirectory = Join-Path $repoRoot 'kane-results'
$logsDirectory = Join-Path $resultsDirectory 'logs'
New-Item -ItemType Directory -Force -Path $logsDirectory | Out-Null

# Keep run logs, evidence links, and summaries out of source control.
$gitignorePath = Join-Path $repoRoot '.gitignore'
$gitignoreText = if (Test-Path -LiteralPath $gitignorePath) { [IO.File]::ReadAllText($gitignorePath) } else { '' }
if ($gitignoreText -notmatch '(?m)^kane-results/?$') {
  Add-Content -LiteralPath $gitignorePath -Value 'kane-results/' -Encoding UTF8
}

function Redact-Object {
  param([object]$Value)
  if ($null -eq $Value) { return $null }
  if ($Value -is [Array]) {
    for ($i = 0; $i -lt $Value.Length; $i++) { $Value[$i] = Redact-Object $Value[$i] }
    return ,$Value
  }
  if ($Value -is [System.Management.Automation.PSCustomObject]) {
    $secretProperty = $Value.PSObject.Properties['secret']
    $recordIsSecret = $secretProperty -and ($secretProperty.Value -eq $true)
    foreach ($property in @($Value.PSObject.Properties)) {
      if ($property.Name -match '(?i)^(authorization|cookie|set-cookie|access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|access[_-]?key|client[_-]?secret|password)$') {
        $property.Value = '[REDACTED]'
      } elseif ($recordIsSecret -and $property.Name -eq 'value') {
        $property.Value = '[REDACTED]'
      } else {
        $property.Value = Redact-Object $property.Value
      }
    }
    return $Value
  }
  return $Value
}

function Protect-OutputText {
  param([AllowEmptyString()][string]$Text)
  if ([string]::IsNullOrEmpty($Text)) { return $Text }
  $protectedLines = foreach ($line in ($Text -split "`r?`n")) {
    $candidate = $line
    try {
      $event = ConvertFrom-Json -InputObject $line -ErrorAction Stop
      $event = Redact-Object $event
      $candidate = ConvertTo-Json -InputObject $event -Depth 100 -Compress
    } catch {
      $candidate = [regex]::Replace($candidate, '(?i)\bBearer\s+[A-Za-z0-9._~+/-]+=*', 'Bearer [REDACTED]')
      $candidate = [regex]::Replace($candidate, '(?i)(\b(?:access[_-]?token|refresh[_-]?token|api[_-]?key|access[_-]?key|client[_-]?secret|password)\b\s*[=:]\s*)[^\s,;]+', '$1[REDACTED]')
    }
    $candidate
  }
  return ($protectedLines -join [Environment]::NewLine)
}

function Get-RunEvents {
  param([string[]]$Lines)
  foreach ($line in $Lines) {
    if (-not $line.TrimStart().StartsWith('{')) { continue }
    try { ConvertFrom-Json -InputObject $line -ErrorAction Stop } catch { }
  }
}

function Start-KaneProcess {
  param(
    [Parameter(Mandatory = $true)][string]$KaneCliPath,
    [Parameter(Mandatory = $true)][string]$Objective,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$TestName,
    [Parameter(Mandatory = $true)][int]$TimeoutMilliseconds
  )

  $processInfo = New-Object System.Diagnostics.ProcessStartInfo
  $processInfo.FileName = Join-Path $env:SystemRoot 'System32\cmd.exe'
  $processInfo.WorkingDirectory = $repoRoot
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true
  $processInfo.EnvironmentVariables['KANE_CLI_USER_AGENT'] = 'codex'
  $processInfo.EnvironmentVariables['WAYLIT_KANE_OBJECTIVE'] = $Objective
  $processInfo.EnvironmentVariables['WAYLIT_KANE_URL'] = $Url
  $processInfo.EnvironmentVariables['WAYLIT_KANE_NAME'] = $TestName

  # The suite objectives contain no double quotes. Keeping the objective in an
  # environment variable avoids interpolating its punctuation into cmd syntax.
  $command = '"' + $KaneCliPath + '" run "%WAYLIT_KANE_OBJECTIVE%" --url "%WAYLIT_KANE_URL%" --agent --name "%WAYLIT_KANE_NAME%"'
  $processInfo.Arguments = '/d /s /c "' + $command + '"'

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $processInfo
  if (-not $process.Start()) { throw 'Could not start kane-cli.' }

  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $completed = $process.WaitForExit($TimeoutMilliseconds)
  if (-not $completed) {
    & (Join-Path $env:SystemRoot 'System32\taskkill.exe') /PID $process.Id /T /F 2>$null | Out-Null
    [void]$process.WaitForExit(30000)
  } else {
    $process.WaitForExit()
  }

  $stdout = ''
  $stderr = ''
  try { $stdout = $stdoutTask.GetAwaiter().GetResult() } catch { }
  try { $stderr = $stderrTask.GetAwaiter().GetResult() } catch { }
  $exitCode = if ($process.HasExited) { $process.ExitCode } else { $null }
  $process.Dispose()

  return [pscustomobject]@{
    stdout = Protect-OutputText $stdout
    stderr = Protect-OutputText $stderr
    exitCode = $exitCode
    timedOut = (-not $completed)
  }
}

$suiteText = [IO.File]::ReadAllText($suiteFullPath, [Text.Encoding]::UTF8)
$blockPattern = '(?m)^TEST\s+(\d{2})\s+\u2014\s+(.+?)\r?\n-+\r?\n(kane-cli run .+)$'
$tests = [Collections.Generic.List[object]]::new()
foreach ($match in [regex]::Matches($suiteText, $blockPattern)) {
  $commandMatch = [regex]::Match($match.Groups[3].Value, '^kane-cli run "(.+)" --url (\S+) --agent --name (\S+)$')
  if (-not $commandMatch.Success) { throw "Could not parse Kane command for test $($match.Groups[1].Value)." }
  $testUrl = $commandMatch.Groups[2].Value
  if ($testUrl -ne $BaseUrl) { throw "Test $($match.Groups[1].Value) targets $testUrl, expected $BaseUrl." }
  $tests.Add([pscustomobject]@{
    number = $match.Groups[1].Value
    title = $match.Groups[2].Value.Trim()
    objective = $commandMatch.Groups[1].Value
    cliName = $commandMatch.Groups[3].Value
  })
}
if ($tests.Count -ne 7) { throw "Expected seven suite tests, parsed $($tests.Count) from $suiteFullPath." }

$kaneCommand = Get-Command 'kane-cli.cmd' -ErrorAction Stop
$kaneCliPath = $kaneCommand.Source
$runStartedAt = [DateTimeOffset]::UtcNow
$runStamp = $runStartedAt.ToString('yyyyMMddTHHmmssZ')
$results = [Collections.Generic.List[object]]::new()
$timeoutMilliseconds = $TimeoutMinutes * 60 * 1000

try {
  $null = Invoke-WebRequest -Uri $BaseUrl -TimeoutSec 8 -UseBasicParsing
  $appIsAvailable = $true
  $appFailure = $null
} catch {
  $appIsAvailable = $false
  $appFailure = "Target app was unavailable at suite start: $($_.Exception.Message)"
}

foreach ($test in $tests) {
  $startedAt = [DateTimeOffset]::UtcNow
  $safeCliName = $test.cliName -replace '[^A-Za-z0-9_-]', '-'
  $logBase = Join-Path $logsDirectory ($runStamp + '_' + $safeCliName)
  $stdoutPath = $logBase + '.stdout.log'
  $stderrPath = $logBase + '.stderr.log'
  $fullLogPath = $logBase + '.log'
  $processExitCode = $null
  $timedOut = $false
  $stdout = ''
  $stderr = ''
  $launchError = $null

  if ($appIsAvailable) {
    try {
      $processResult = Start-KaneProcess -KaneCliPath $kaneCliPath -Objective $test.objective -Url $BaseUrl -TestName $test.cliName -TimeoutMilliseconds $timeoutMilliseconds
      $stdout = $processResult.stdout
      $stderr = $processResult.stderr
      $processExitCode = $processResult.exitCode
      $timedOut = $processResult.timedOut
    } catch {
      $launchError = $_.Exception.Message
      $stderr = Protect-OutputText $launchError
    }
  }

  [IO.File]::WriteAllText($stdoutPath, $stdout, [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($stderrPath, $stderr, [Text.UTF8Encoding]::new($false))
  $fullLog = "=== STDOUT ===`r`n$stdout`r`n=== STDERR ===`r`n$stderr`r`n"
  [IO.File]::WriteAllText($fullLogPath, $fullLog, [Text.UTF8Encoding]::new($false))

  $events = @(Get-RunEvents -Lines (@($stdout -split "`r?`n") + @($stderr -split "`r?`n")))
  $runEnd = @($events | Where-Object { $_.type -eq 'run_end' } | Select-Object -Last 1) | Select-Object -First 1
  $failedSteps = @($events | Where-Object { $null -ne $_.step -and $_.status -eq 'failed' } | ForEach-Object { $_.remark })
  $evidenceHint = [regex]::Match(($stdout + "`n" + $stderr), '(?im)^evidence: view locally with `?kane-cli evidence serve ([^`r`n]+)')
  $evidencePath = if ($evidenceHint.Success) { $evidenceHint.Groups[1].Value.Trim('`', ' ', '"') } else { $null }
  $testUrl = if ($runEnd -and $runEnd.test_url) { [string]$runEnd.test_url } else { $null }
  $verdict = if ($runEnd -and $runEnd.status) { ([string]$runEnd.status).ToLowerInvariant() } else { $null }
  $reason = $null

  if (-not $appIsAvailable) {
    $outcome = 'INDETERMINATE'
    $reason = $appFailure
  } elseif ($timedOut -and -not $runEnd) {
    $outcome = 'INDETERMINATE'
    $reason = "Timed out after $TimeoutMinutes minutes before Kane emitted a final run_end verdict."
  } elseif ($verdict -eq 'passed') {
    $outcome = 'PASS'
    if ($timedOut) { $reason = 'Kane reported passed before the process timed out during shutdown.' }
  } elseif ($verdict -eq 'failed') {
    $outcome = 'FAIL'
    $reason = if ($runEnd.summary) { [string]$runEnd.summary } elseif ($runEnd.reason) { [string]$runEnd.reason } else { 'Kane emitted a failed run_end verdict.' }
  } elseif ($verdict) {
    $outcome = 'INDETERMINATE'
    $reason = "Kane emitted run_end status '$verdict', which is not a confirmed pass or fail."
  } else {
    $outcome = 'INDETERMINATE'
    if ($launchError) { $reason = "Could not launch Kane: $launchError" }
    elseif ($timedOut) { $reason = "Timed out after $TimeoutMinutes minutes without a final Kane verdict." }
    elseif ($processExitCode -ne 0) { $reason = "Kane exited with code $processExitCode and emitted no final run_end verdict." }
    else { $reason = 'Kane emitted no final run_end verdict.' }
  }

  if ($failedSteps.Count -gt 0) {
    $stepDetails = ($failedSteps | ForEach-Object { [string]$_ }) -join ' | '
    if ($reason) { $reason += " Failed step details: $stepDetails" } elseif ($outcome -eq 'PASS') { $reason = "Kane reported passed; failed step events were also present: $stepDetails" }
  }

  $finishedAt = [DateTimeOffset]::UtcNow
  $evidenceLinks = @()
  if ($testUrl) { $evidenceLinks += [pscustomobject]@{ type = 'Test Manager'; url = $testUrl } }
  if ($evidencePath) { $evidenceLinks += [pscustomobject]@{ type = 'Evidence pack'; path = $evidencePath } }
  $results.Add([pscustomobject]@{
    number = $test.number
    name = $test.title
    kaneName = $test.cliName
    result = $outcome
    failureReason = if ($outcome -eq 'PASS') { $null } else { $reason }
    notes = if ($outcome -eq 'PASS' -and $reason) { $reason } else { $null }
    kaneVerdict = $verdict
    kaneSummary = if ($runEnd -and $runEnd.summary) { [string]$runEnd.summary } else { $null }
    processExitCode = $processExitCode
    timedOut = $timedOut
    startedAtUtc = $startedAt.ToString('o')
    finishedAtUtc = $finishedAt.ToString('o')
    durationSeconds = [Math]::Round(($finishedAt - $startedAt).TotalSeconds, 2)
    kaneTimestamp = if ($runEnd -and $runEnd.ts) { [string]$runEnd.ts } else { $null }
    evidenceLinks = $evidenceLinks
    stdoutLog = $stdoutPath.Substring($repoRoot.TrimEnd('\').Length + 1)
    stderrLog = $stderrPath.Substring($repoRoot.TrimEnd('\').Length + 1)
    fullLog = $fullLogPath.Substring($repoRoot.TrimEnd('\').Length + 1)
  })

  Write-Host ('[{0}] {1} - {2}' -f $test.number, $test.title, $outcome)
  if ($reason) { Write-Host ("  {0}" -f $reason) }
}

$passedCount = @($results | Where-Object result -eq 'PASS').Count
$failedCount = @($results | Where-Object result -eq 'FAIL').Count
$indeterminateCount = @($results | Where-Object result -eq 'INDETERMINATE').Count
$runFinishedAt = [DateTimeOffset]::UtcNow
$summary = [pscustomobject]@{
  suite = 'Waylit Kane CLI Browser Test Suite'
  target = $BaseUrl
  runStartedAtUtc = $runStartedAt.ToString('o')
  runFinishedAtUtc = $runFinishedAt.ToString('o')
  timeoutMinutesPerTest = $TimeoutMinutes
  totals = [pscustomobject]@{ total = $results.Count; passed = $passedCount; failed = $failedCount; indeterminate = $indeterminateCount }
  tests = @($results)
}
$jsonPath = Join-Path $resultsDirectory 'summary.json'
$markdownPath = Join-Path $resultsDirectory 'summary.md'
$summary | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$markdown = [Collections.Generic.List[string]]::new()
$markdown.Add('# Waylit Kane CLI suite results')
$markdown.Add('')
$markdown.Add("- Target: ``$BaseUrl``")
$markdown.Add("- Started (UTC): $($runStartedAt.ToString('o'))")
$markdown.Add("- Finished (UTC): $($runFinishedAt.ToString('o'))")
$markdown.Add("- Totals: **$passedCount passed**, **$failedCount failed**, **$indeterminateCount indeterminate** out of $($results.Count).")
$markdown.Add('')
$markdown.Add('| Test | Result | Failure reason / notes | Evidence | Started (UTC) | Finished (UTC) | Full log |')
$markdown.Add('|---|---|---|---|---|---|---|')
foreach ($result in $results) {
  $reasonCell = if ($result.failureReason) { $result.failureReason } elseif ($result.notes) { $result.notes } else { '-' }
  $reasonCell = ($reasonCell -replace '\|', '\|') -replace '[\r\n]+', ' '
  $evidenceCell = if ($result.evidenceLinks.Count -gt 0) {
    ($result.evidenceLinks | ForEach-Object { if ($_.url) { "[Test Manager]($($_.url))" } else { "Evidence pack: ``$($_.path)``" } }) -join '<br>'
  } else { '-' }
  $markdown.Add("| $($result.number) $($result.name) | $($result.result) | $reasonCell | $evidenceCell | $($result.startedAtUtc) | $($result.finishedAtUtc) | ``$($result.fullLog)`` |")
}
$markdown.Add('')
$markdown.Add('Full redacted stdout and stderr are stored separately in `kane-results/logs/`. Process exit codes are recorded for diagnosis; the result classification uses the terminal Kane `run_end.status` verdict. A missing verdict, timeout, or non-final status is **INDETERMINATE**.')
[IO.File]::WriteAllLines($markdownPath, $markdown, [Text.UTF8Encoding]::new($false))

Write-Host ''
Write-Host ("Final totals: {0} passed, {1} failed, {2} indeterminate." -f $passedCount, $failedCount, $indeterminateCount)
Write-Host "Reports: $markdownPath and $jsonPath"
Write-Host "Logs: $logsDirectory"
