import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
// Read actual NTFS ACLs. Paths pass through child environment, never shell text.
// The privileged SYSTEM/Administrators principals do not grant ordinary users.
export function verifyPrivateParent(root,directory){
 const command="$ErrorActionPreference='Stop';$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$out=@();foreach($p in @($env:COCAL_RECOVERY_ACL_ROOT,$env:COCAL_RECOVERY_ACL_DIR)){if(([System.IO.File]::GetAttributes($p)-band [System.IO.FileAttributes]::Directory)-ne 0){$a=[System.IO.Directory]::GetAccessControl($p)}else{$a=[System.IO.File]::GetAccessControl($p)};$rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])|ForEach-Object{[pscustomobject]@{sid=$_.IdentityReference.Value;type=$_.AccessControlType.ToString();rights=$_.FileSystemRights.ToString();inherited=$_.IsInherited}});$out+=[pscustomobject]@{currentSid=$sid;rules=$rules}};ConvertTo-Json -InputObject $out -Depth 5 -Compress";
 const records=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{env:{...process.env,COCAL_RECOVERY_ACL_ROOT:root,COCAL_RECOVERY_ACL_DIR:directory},encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true,timeout:10000}));
 validateAclRecords(records);return records;
}
export function validateAclRecords(records){assert.equal(records.length,2);for(const record of records){const allowed=new Set([record.currentSid,'S-1-5-18','S-1-5-32-544']),grants=record.rules.filter(x=>x.type==='Allow');assert.ok(grants.some(x=>x.sid===record.currentSid&&x.rights.includes('FullControl')),'Dedicated owner must retain FullControl');assert.ok(grants.every(x=>allowed.has(x.sid)),'Recovery archive parent permits a non-owner ordinary principal');}}
