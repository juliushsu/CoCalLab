param(
  [Parameter(Mandatory=$true)][string]$ArchiveRoot,
  [Parameter(Mandatory=$true)][string]$KeyRoot,
  [Parameter(Mandatory=$true)][string]$EvidenceRoot
)
$ErrorActionPreference = 'Stop'
# Windows Owner adapter only. No provider, credentials, schedule, backup deletion or real ref.
$ownerSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$systemSid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$localBase = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CoCalLab'))
$roots = @($ArchiveRoot, $KeyRoot, $EvidenceRoot)
foreach ($root in $roots) {
  $absolute = [IO.Path]::GetFullPath($root)
  if (-not $absolute.StartsWith($localBase + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Target must be inside the approved local application directory' }
  # Refuse junctions/symlinks in every existing ancestor; never redirect into Git/OneDrive.
  $ancestor = $absolute
  while ($ancestor) {
    if (Test-Path -LiteralPath $ancestor) {
      $item = Get-Item -LiteralPath $ancestor -Force
      if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Linked or non-directory target refused' }
    }
    $ancestor = [IO.Path]::GetDirectoryName($ancestor)
  }
}
if ($ArchiveRoot -eq $KeyRoot -or $ArchiveRoot -eq $EvidenceRoot -or $KeyRoot -eq $EvidenceRoot) { throw 'Separate roots required' }
function Assert-ProtectedDirectory([string]$Path) {
  $acl = Get-Acl -LiteralPath $Path
  if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $ownerSid.Value) { throw 'Owner or inheritance mismatch' }
  $rules = @($acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]))
  if ($rules.Count -ne 2) { throw 'Unexpected directory access rules' }
  $principals = @($rules | ForEach-Object { $_.IdentityReference.Value } | Sort-Object -Unique)
  if ($principals.Count -ne 2 -or $ownerSid.Value -notin $principals -or $systemSid.Value -notin $principals) { throw 'Owner and SYSTEM must both be present' }
  foreach ($rule in $rules) {
    if ($rule.IdentityReference.Value -notin @($ownerSid.Value,$systemSid.Value) -or $rule.AccessControlType -ne 'Allow' -or $rule.IsInherited -or ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl -or $rule.InheritanceFlags -ne [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit' -or $rule.PropagationFlags -ne [Security.AccessControl.PropagationFlags]::None) { throw 'Unexpected directory permissions' }
  }
  return $acl
}
function New-ProtectedDirectory([string]$Path) {
  if (Test-Path -LiteralPath $Path) { throw 'Refusing to reuse or overwrite an existing probe directory' }
  [void][IO.Directory]::CreateDirectory($Path)
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetOwner($ownerSid)
  $acl.SetAccessRuleProtection($true,$false)
  foreach ($sid in @($ownerSid,$systemSid)) {
    $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
    $acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $Path -AclObject $acl
  [void](Assert-ProtectedDirectory $Path)
}
foreach ($root in $roots) {
  if (Test-Path -LiteralPath $root) { [void](Assert-ProtectedDirectory $root) }
  else { New-ProtectedDirectory $root }
}
$drive = (Get-Item -LiteralPath $ArchiveRoot).PSDrive.Name
$free = (Get-PSDrive -Name $drive).Free
if ($free -lt 1GB) { throw 'At least 1 GiB free is required for the small synthetic probe; actual backup sizing is separate' }
$probeId = 'SYNTHETIC-PROBE-' + [DateTime]::UtcNow.ToString('yyyyMMdd') + '-' + [guid]::NewGuid().ToString()
$archiveDirectory = Join-Path $ArchiveRoot $probeId
$keyDirectory = Join-Path $KeyRoot $probeId
$evidenceDirectory = Join-Path $EvidenceRoot $probeId
foreach ($path in @($archiveDirectory,$keyDirectory,$evidenceDirectory)) { New-ProtectedDirectory $path }
$probeScript = Join-Path $PSScriptRoot 'owner-delivery-probe.mjs'
$output = & node $probeScript $archiveDirectory $keyDirectory $probeId
if ($LASTEXITCODE -ne 0) { throw 'Synthetic encryption/readback failed; preserve incomplete probe files for diagnosis' }
$result = $output | ConvertFrom-Json
# Check file ACLs too: inheritance must grant only Owner/SYSTEM, no other principals.
$checkedFiles = 0
foreach ($path in @($archiveDirectory,$keyDirectory,$evidenceDirectory)) {
  [void](Assert-ProtectedDirectory $path)
  foreach ($file in Get-ChildItem -LiteralPath $path -File -Force) {
    $fileAcl = Get-Acl -LiteralPath $file.FullName
    if ($fileAcl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $ownerSid.Value) { throw 'File owner mismatch' }
    $fileRules = @($fileAcl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]))
    if ($fileRules.Count -ne 2) { throw 'Unexpected file access rules' }
    $filePrincipals = @($fileRules | ForEach-Object { $_.IdentityReference.Value } | Sort-Object -Unique)
    if ($filePrincipals.Count -ne 2 -or $ownerSid.Value -notin $filePrincipals -or $systemSid.Value -notin $filePrincipals) { throw 'Owner and SYSTEM must both have file access' }
    foreach ($rule in $fileRules) {
      if ($rule.IdentityReference.Value -notin @($ownerSid.Value,$systemSid.Value) -or $rule.AccessControlType -ne 'Allow' -or ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl) { throw 'Unexpected file principal' }
    }
    $checkedFiles++
  }
}
$receipt = [ordered]@{
  status = $result.status; actual_new_uat_ref = $null; probe_id = $probeId
  recorded_at_utc = [DateTime]::UtcNow.ToString('o'); free_bytes_before_probe = $free
  archive_directory = $archiveDirectory; key_directory = $keyDirectory
  owner_sid = $ownerSid.Value; system_sid = $systemSid.Value
  directory_acl = 'PROTECTED_OWNER_AND_SYSTEM_ONLY'; file_acl = 'OWNER_AND_SYSTEM_ONLY'; files_checked = $checkedFiles
  manifest_sha256 = $result.manifestSha256; archive_sha256 = $result.archiveSha256
  negative_checks = $result.negativeChecks; same_host = $true; offsite_backup = $false
  owner_accepted_actual_backup = $false; cloud_resources_created = 0; actual_restore = 'NOT_RUN'
}
$receiptPath = Join-Path $evidenceDirectory 'OWNER_DELIVERY_PROBE_RECEIPT.json'
$receiptJson = $receipt | ConvertTo-Json -Depth 6
# CreateNew is important: no existing receipt is ever replaced.
$receiptStream = [IO.File]::Open($receiptPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try {
  $receiptBytes = [Text.UTF8Encoding]::new($false).GetBytes($receiptJson + "`n")
  $receiptStream.Write($receiptBytes,0,$receiptBytes.Length); $receiptStream.Flush($true)
} finally { $receiptStream.Dispose() }
[ordered]@{status=$result.status; actual_new_uat_ref=$null; acl='OWNER_SYSTEM_ONLY_VERIFIED'; free_bytes=$free; files_checked=$checkedFiles; manifest_sha256=$result.manifestSha256; receipt_sha256=(Get-FileHash -LiteralPath $receiptPath -Algorithm SHA256).Hash; same_host=$true; offsite_backup=$false; cloud_writes=0} | ConvertTo-Json -Compress
