param([ValidateSet('Install','Inspect','ReplayHappy')][string]$Mode='Inspect',[string]$RunDirectory)
$ErrorActionPreference='Stop'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$toolRoot=[IO.Path]::GetFullPath((Join-Path $repoRoot '../tooling/uat-lifecycle-20261109'))
$node=(Get-Command node.exe -ErrorAction Stop).Source
$engine=Join-Path $PSScriptRoot 'synthetic-scheduler-engine.mjs'
$user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
if ($user -match 'codexsandbox') { throw 'Use the actual logged-in Owner account, not the transient Codex sandbox identity.' }
if ($Mode -eq 'Install') {
  if ($RunDirectory) { throw 'Install creates its own unique test directory.' }
  $runId='20261109-'+[guid]::NewGuid().ToString('N').Substring(0,8)
  $RunDirectory=Join-Path $toolRoot $runId
  if (Test-Path -LiteralPath $RunDirectory) { throw 'Never overwrite existing test evidence.' }
  New-Item -ItemType Directory -Path $RunDirectory -Force | Out-Null
  $taskPath='\CoCalLab-UAT-Lifecycle\'+$runId+'\'
  $service=New-Object -ComObject 'Schedule.Service';$service.Connect();$folder=$service.GetFolder('\')
  foreach($segment in @('CoCalLab-UAT-Lifecycle',$runId)) { try { $folder=$folder.GetFolder($segment) } catch { $folder=$folder.CreateFolder($segment) } }
  $base=Get-Date;$base=$base.AddTicks(-($base.Ticks % [TimeSpan]::TicksPerSecond))
  $backupAt=$base.AddSeconds(65);$expireAt=$base.AddSeconds(125)
  $cases=@('happy','backup_failure','restore_failure','tamper_after_verification','target_mismatch')
  $tasks=@();foreach($case in $cases) {
    $caseDir=Join-Path $RunDirectory $case;New-Item -ItemType Directory -Path $caseDir -Force | Out-Null
    $ref='SYNTHETIC-UAT-'+$runId+'-'+$case
    foreach($rel in @('database/public.json','database/private-ledgers-proofs.json','storage/SYNTHETIC-original.pdf','settings.json')) {
      $f=Join-Path $caseDir ('fixture/'+$rel);New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($f)) -Force | Out-Null
      [IO.File]::WriteAllText($f,('SYNTHETIC ONLY '+$rel+'; no real DB, proof, credentials or Storage data.'),(New-Object Text.UTF8Encoding($false)))
    }
    $cfg=@{mode='SYNTHETIC_SCHEDULER_TEST_ONLY';runId=$runId;targetRef=$ref;organizationId='empvseawywarugdnyhzl';projectName='CoCalLab-UAT-CLOUD-01';productSHA='fd7efcfc6450dbf10f54aa97b65fe48e431b277d';fault=$case;expiresAt=$expireAt.ToUniversalTime().ToString('o')}
    $resource=@{ref=$(if($case -eq 'target_mismatch'){'SYNTHETIC-OTHER-RESOURCE'}else{$ref});organizationId=$cfg.organizationId;projectName=$cfg.projectName;present=$true;deleteTransitions=0}
    foreach($entry in @(@('config.json',$cfg),@('synthetic-resource.json',$resource))) { [IO.File]::WriteAllText((Join-Path $caseDir $entry[0]),($entry[1]|ConvertTo-Json -Depth 10),(New-Object Text.UTF8Encoding($false))) }
    foreach($phase in @('backup','expire')) {
      $name=$case+'-'+$phase
      $action=New-ScheduledTaskAction -Execute $node -Argument ('"'+$engine+'" --config "'+(Join-Path $caseDir 'config.json')+'" --phase '+$phase) -WorkingDirectory $repoRoot
      $at=if($phase -eq 'backup'){$backupAt}else{$expireAt}
      $trigger=New-ScheduledTaskTrigger -Once -At $at
      $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
      $principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
      if(Get-ScheduledTask -TaskPath $taskPath -TaskName $name -ErrorAction SilentlyContinue){throw 'Existing task must not be replaced.'}
      Register-ScheduledTask -TaskPath $taskPath -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'SYNTHETIC scheduler proof only; NO CLOUD CALLS OR REAL DELETION' | Out-Null
      $tasks+=@{name=$name;phase=$phase;case=$case;atUtc=$at.ToUniversalTime().ToString('o')}
    }
  }
  $receipt=@{runId=$runId;directory=$RunDirectory;taskPath=$taskPath;user=$user;principal='Interactive/Limited';syntheticOnly=$true;cloudExecutionArmed=$false;node=$node;nodeSHA256=(Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash;engine=$engine;engineSHA256=(Get-FileHash -LiteralPath $engine -Algorithm SHA256).Hash;registeredAt=(Get-Date).ToUniversalTime().ToString('o');tasks=$tasks;limitation='Requires this Windows account logged in and PC powered on; not a 24x7/cloud deadline guarantee. Local alerts are not delivered notifications.'}
  $receipt|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path $RunDirectory 'registration.json') -Encoding utf8
  $receipt|ConvertTo-Json -Depth 10
  exit 0
}
if(-not $RunDirectory){throw 'Specify the returned unique RunDirectory.'}
$RunDirectory=[IO.Path]::GetFullPath($RunDirectory)
if(-not $RunDirectory.StartsWith($toolRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Foreign run path rejected.'}
$receipt=Get-Content -LiteralPath (Join-Path $RunDirectory 'registration.json') -Raw|ConvertFrom-Json
if($Mode -eq 'ReplayHappy'){Start-ScheduledTask -TaskPath $receipt.taskPath -TaskName 'happy-expire';[pscustomobject]@{manualReplayStarted=$true;taskPath=$receipt.taskPath;cloudExecutionArmed=$false}|ConvertTo-Json;exit 0}
$rows=@();foreach($task in $receipt.tasks){$state=Get-ScheduledTask -TaskPath $receipt.taskPath -TaskName $task.name;$info=Get-ScheduledTaskInfo -TaskPath $receipt.taskPath -TaskName $task.name;$rows+=@{name=$task.name;state=[string]$state.State;lastRunUtc=$(if($info.LastRunTime){$info.LastRunTime.ToUniversalTime().ToString('o')}else{$null});lastResult=$info.LastTaskResult;nextRunUtc=$(if($info.NextRunTime){$info.NextRunTime.ToUniversalTime().ToString('o')}else{$null});trigger=$task.atUtc}}
$cases=@();foreach($name in @('happy','backup_failure','restore_failure','tamper_after_verification','target_mismatch')){$d=Join-Path $RunDirectory $name;$resource=Get-Content -LiteralPath (Join-Path $d 'synthetic-resource.json') -Raw|ConvertFrom-Json;$audit=Join-Path $d 'audit.ndjson';$cases+=@{name=$name;resourcePresent=$resource.present;deleteTransitions=$resource.deleteTransitions;events=$(if(Test-Path -LiteralPath $audit){@(Get-Content -LiteralPath $audit|ForEach-Object{$_|ConvertFrom-Json})}else{@()});localAlertPresent=(Test-Path -LiteralPath (Join-Path $d 'ALERT_REQUIRED.json'))}}
$result=@{inspectedAt=(Get-Date).ToUniversalTime().ToString('o');taskPath=$receipt.taskPath;syntheticOnly=$true;cloudExecutionArmed=$false;tasks=$rows;cases=$cases};$result|ConvertTo-Json -Depth 14|Set-Content -LiteralPath (Join-Path $RunDirectory 'inspection.json') -Encoding utf8;$result|ConvertTo-Json -Depth 14
