// Actual scheduler test engine, synthetic files only. No cloud adapter or credentials.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const args=process.argv.slice(2);assert.equal(args.length,4);assert.equal(args[0],'--config');assert.equal(args[2],'--phase');
const configPath=path.resolve(args[1]),phase=args[3];assert.ok(['backup','expire'].includes(phase));
const config=JSON.parse(fs.readFileSync(configPath,'utf8')),root=path.dirname(configPath),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(config.mode,'SYNTHETIC_SCHEDULER_TEST_ONLY','Real cloud execution is not implemented or armed');assert.match(config.runId,/^20261109-[a-f0-9]{8}$/);assert.match(config.targetRef,/^SYNTHETIC-UAT-/);
assert.equal(config.organizationId,'empvseawywarugdnyhzl');assert.equal(config.projectName,'CoCalLab-UAT-CLOUD-01');assert.equal(config.productSHA,'fd7efcfc6450dbf10f54aa97b65fe48e431b277d');
assert.equal(fs.realpathSync(root),root);const within=name=>{const p=path.resolve(root,name);assert.ok(p.startsWith(root+path.sep));return p;};
const read=name=>JSON.parse(fs.readFileSync(within(name),'utf8'));
function write(name,value){const p=within(name),tmp=p+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,p);}
function audit(event,extra={}){fs.appendFileSync(within('audit.ndjson'),JSON.stringify({time:new Date().toISOString(),pid:process.pid,phase,event,mode:config.mode,targetRef:config.targetRef,...extra})+'\n');}
function bind(){const resource=read('synthetic-resource.json');assert.equal(resource.ref,config.targetRef,'EXACT_TARGET_MISMATCH');assert.equal(resource.organizationId,config.organizationId);assert.equal(resource.projectName,config.projectName);assert.notEqual(resource.ref,'wynqnvidepzzcwutexvn');return resource;}
function verifyBackup(){const saved=read('backup-manifest.json');assert.equal(saved.targetRef,config.targetRef);assert.equal(saved.organizationId,config.organizationId);assert.equal(saved.productSHA,config.productSHA);assert.equal(saved.verified,true,'BACKUP_NOT_VERIFIED');assert.equal(hash(fs.readFileSync(within('backup-manifest.json'))),read('verification-ticket.json').manifestSha256,'MANIFEST_TAMPERED');for(const f of saved.files){assert.ok(['database/public.json','database/private-ledgers-proofs.json','storage/SYNTHETIC-original.pdf','settings.json'].includes(f.path));assert.equal(hash(fs.readFileSync(within('backup/'+f.path))),f.sha256,'BACKUP_BYTES_CHANGED');assert.equal(hash(fs.readFileSync(within('restore-check/'+f.path))),f.sha256,'RESTORE_CHECK_CHANGED');}return saved;}
try{
 const resource=bind();audit('START');
 if(phase==='backup'){
  if(fs.existsSync(within('verification-ticket.json'))){verifyBackup();audit('ALREADY_VERIFIED');process.exit(0);}
  if(config.fault==='backup_failure')throw Error('INJECTED_SYNTHETIC_BACKUP_FAILURE');
  const inputs=['database/public.json','database/private-ledgers-proofs.json','storage/SYNTHETIC-original.pdf','settings.json'],files=[];
  for(const file of inputs){const original=within('fixture/'+file);assert.equal(fs.lstatSync(original).isSymbolicLink(),false);const bytes=fs.readFileSync(original);assert.ok(bytes.includes(Buffer.from('SYNTHETIC')));const backup=within('backup/'+file),restore=within('restore-check/'+file);fs.mkdirSync(path.dirname(backup),{recursive:true});fs.mkdirSync(path.dirname(restore),{recursive:true});fs.writeFileSync(backup,bytes,{flag:'wx'});fs.copyFileSync(backup,restore,fs.constants.COPYFILE_EXCL);files.push({path:file,bytes:bytes.length,sha256:hash(bytes)});}
  if(config.fault==='restore_failure')fs.appendFileSync(within('restore-check/database/private-ledgers-proofs.json'),'SYNTHETIC CORRUPTION');
  for(const f of files)assert.equal(hash(fs.readFileSync(within('restore-check/'+f.path))),f.sha256,'RESTORE_ROUNDTRIP_FAILED');
  write('backup-manifest.json',{synthetic:true,targetRef:config.targetRef,organizationId:config.organizationId,productSHA:config.productSHA,verified:true,verifiedAt:new Date().toISOString(),verificationMethod:'Synthetic file copy/readback only; NOT pg_dump or Supabase Storage restoration',files});
  write('verification-ticket.json',{manifestSha256:hash(fs.readFileSync(within('backup-manifest.json')))});verifyBackup();
  if(config.fault==='tamper_after_verification')fs.appendFileSync(within('backup/storage/SYNTHETIC-original.pdf'),'SYNTHETIC TAMPER');
  audit('BACKUP_TEST_VERIFIED',{files:files.length});
 }else{
  assert.ok(Date.now()>=Date.parse(config.expiresAt),'EARLY_EXPIRY_NOT_DUE');verifyBackup();
  if(resource.present===false){audit('ALREADY_MARKED_ABSENT');process.exit(0);}
  assert.equal(resource.present,true);write('synthetic-resource.json',{...resource,present:false,deleteTransitions:resource.deleteTransitions+1,notice:'SYNTHETIC_MARKER_ONLY_NO_REAL_DELETE'});audit('SYNTHETIC_DELETE_MARKER_ONLY');
 }
}catch(error){audit('BLOCKED',{reason:error.message});write('ALERT_REQUIRED.json',{status:'BLOCKED',phase,time:new Date().toISOString(),targetRef:config.targetRef,reason:error.message,delivery:'Local alert marker ONLY. No human/remote notification delivery is configured or claimed.'});process.exitCode=23;}
