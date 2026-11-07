// Offline summary/hash audit of existing evidence. No compiler, business code,
// credentials, Git mutation, network, Docker or cloud operation is invoked.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {auditStatus} from './audit.mjs';
const candidate=process.argv[2];
if(process.argv.length>3||(candidate&&!/^[a-f0-9]{40}$/.test(candidate)))throw new Error('Expected optional full source SHA');
const historical=!candidate||candidate==='ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),dir=path.join(repo,'docs/delivery/evidence',historical?'deployment-preflight-20261107':'deployment-preflight-20261107-'+candidate.slice(0,12));
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const summary={sourceCommit:manifest.sourceCommit,status:manifest.status,lockSha256:manifest.lockSha256,lockMatches:sha(fs.readFileSync(path.join(dir,'deno.lock')))===manifest.lockSha256,diagnosticCounting:'instances across separate function checks; shared errors repeat and are not unique defects',functions:[]};
const count=items=>Object.fromEntries([...new Set(items)].sort().map(key=>[key,items.filter(x=>x===key).length]));
for(const fn of manifest.functions){
 const text=fs.readFileSync(path.join(dir,fn.check.log),'utf8'),errors=[];
 for(const match of text.matchAll(/^(TS\d+) \[ERROR\]:([\s\S]*?)(?=^TS\d+ \[ERROR\]:|^Found \d+ errors?\.|^error:|$(?![\s\S]))/gm)){
  const block=match[0],location=block.match(/^\s+at (.+):(\d+):(\d+)\s*$/m),file=location?.[1]||'UNCLASSIFIED';
  const origin=file.startsWith('<FIXED_SOURCE>/')?'local_source':/^https?:/.test(file)?'remote_dependency':file.startsWith('asset:')?'native_runtime_types':'unclassified';
  errors.push({code:match[1],message:match[2].trim().split('\n')[0],origin,file,line:location?Number(location[2]):null,column:location?Number(location[3]):null,...(origin==='local_source'?{excerpt:block.trim()}: {})});
 }
 const declared=text.match(/Found (\d+) errors?\./),nodeBuiltins=[...new Set((fn.bundle.remainingImports||[]).map(x=>x.specifier).filter(s=>s.startsWith('node:')))].sort();
 const bundleHashMatches=fn.bundle.path&&fs.existsSync(fn.bundle.path)&&sha(fs.readFileSync(fn.bundle.path))===fn.bundle.sha256;
 const map=fn.bundle.sourceMap,sourceMapHashMatches=map&&fs.existsSync(map.path)&&sha(fs.readFileSync(map.path))===map.sha256;
 summary.functions.push({name:fn.name,typeCheck:fn.check.status,declaredErrorCount:declared?Number(declared[1]):fn.check.status==='PASS'?0:null,parsedErrorCount:errors.length,diagnosticCountMatches:declared?Number(declared[1])===errors.length:fn.check.status==='PASS'&&errors.length===0,errorCodes:count(errors.map(e=>e.code)),origins:count(errors.map(e=>e.origin)),localErrors:errors.filter(e=>e.origin==='local_source'),remoteFiles:count(errors.filter(e=>e.origin==='remote_dependency').map(e=>e.file)),bundleSha256:fn.bundle.sha256,bundleHashMatches,sourceMapHashMatches,remainingNodeBuiltins:nodeBuiltins,edgeCompatibility:'NOT_RUN'});
}
summary.totals={functions:summary.functions.length,checksPassed:summary.functions.filter(f=>f.typeCheck==='PASS').length,checksFailed:summary.functions.filter(f=>f.typeCheck==='FAILED').length,diagnosticInstances:summary.functions.reduce((n,f)=>n+f.parsedErrorCount,0),localDiagnosticInstances:summary.functions.reduce((n,f)=>n+(f.origins.local_source||0),0),remoteDiagnosticInstances:summary.functions.reduce((n,f)=>n+(f.origins.remote_dependency||0),0),allDiagnosticCountsMatch:summary.functions.every(f=>f.diagnosticCountMatches),allBundleHashesMatch:summary.functions.every(f=>f.bundleHashMatches&&f.sourceMapHashMatches)};
summary.totals.allSourceHashesMatch=manifest.sourceFiles.every(f=>sha(fs.readFileSync(path.join(manifest.artifactRoot,'source',f.path)))===f.sha256);
summary.totals.allToolHashesMatch=manifest.toolchain.every(t=>sha(fs.readFileSync(t.archivePath))===t.archiveSha256&&sha(fs.readFileSync(t.binary))===t.binarySha256);
const audit=auditStatus({requestedCommit:candidate||'ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde',sourceCommit:manifest.sourceCommit,reportedStatus:manifest.status,checks:{lock:summary.lockMatches,diagnosticCounts:summary.totals.allDiagnosticCountsMatch,bundles:summary.totals.allBundleHashesMatch,sources:summary.totals.allSourceHashesMatch,tools:summary.totals.allToolHashesMatch,nativePassConsistent:manifest.status!=='STATIC_PREFLIGHT_PASS_NOT_RUNTIME_ACCEPTANCE'||(summary.totals.checksPassed===summary.totals.functions&&manifest.summary.bundlesCreated===manifest.summary.total&&manifest.lockUnchanged)}});
summary.status=audit.status;summary.integrityFailures=audit.failures;
fs.writeFileSync(path.join(dir,'failure-summary.json'),JSON.stringify(summary,null,2)+'\n');
const lines=['# Native Deno static preflight — '+summary.status,
 '',`Source: \`${summary.sourceCommit}\`. Native Deno 2.9.8; Supabase CLI 2.122.1. No Node application shim is used for these checks.`,
 '',`Frozen lock SHA256: \`${summary.lockSha256}\`; unchanged after bundle: ${manifest.lockUnchanged}; independently rehashed: ${summary.lockMatches}.`,
 '',`Checks: ${summary.totals.checksPassed}/${summary.totals.functions} passed. Static ESM bundles: ${manifest.summary.bundlesCreated}/${manifest.summary.total}. JS/map hashes rechecked: ${summary.totals.allBundleHashesMatch}. Bundle compilation does not type-check by default and is not Edge ESZIP or live acceptance.`,
 '', '| Function | Errors | Local | Remote | Codes |', '|---|---:|---:|---:|---|'];
for(const fn of summary.functions)lines.push(`| ${fn.name} | ${fn.parsedErrorCount} | ${fn.origins.local_source||0} | ${fn.origins.remote_dependency||0} | ${Object.entries(fn.errorCodes).map(([k,n])=>`${k}: ${n}`).join(', ')} |`);
lines.push('', 'Counts are diagnostic instances, not a count of unique defects. See failure-summary.json for local file/line/excerpts and remote dependency locations; check-*.txt retain the complete sanitized compiler diagnostics.',
 '', historical?'Shared SDK literals are 2.49.4. create-organization retains floating @2 in the fixed source and resolved to 2.119.0 in this observed lock. No source import is rewritten. Re-resolving original TS during deployment without the frozen lock/artifact is BLOCKED.':'SDK and Node declaration versions are taken from the explicit candidate source and frozen lock. Original ba2 failure evidence is preserved in the separate historical directory. This is native static checking, not a managed deployment.',
 '', historical?'Local errors: generate-report TS2322 for workspace/legal_entity/site inference (3); verify-upload-receipt and delete-uploaded-document TS2339 for unknown caught-error properties (3 each). Third-party types also fail. No skipLibCheck, source casts or alternate Deno version were used to mask them.':'No skipLibCheck, no-check, or broad error suppression is used. Successful static checking does not close the separate four security P2s or live-runtime acceptance.',
 '', 'Bundles retain node: built-ins (including fs/net/tls/http in SDK dependencies). Their managed Edge support is NOT_RUN. Reference edge-runtime v1.78.1 uses Deno 2.1.4/deno_core 0.324.0; this differs from the local build/check Deno 2.9.8. The managed actual runtime is UNKNOWN and cannot be pinned here. This reference was not executed.',
 '', 'Large fixed-source/cache/bundle/map artifacts stay under ../tooling/deployment-20261107. manifest.json maps fixed Git blobs/SHA256, each function/transitive local source, remote resolutions and JS/map hashes. No .env, credentials, business handler, Deno serve, Docker or Supabase project service was used. Publication HOLD.');
fs.writeFileSync(path.join(dir,'RESULTS.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({status:summary.status,...summary.totals,lockMatches:summary.lockMatches,summary:path.join(dir,'failure-summary.json')}));
if(audit.failures.length)process.exitCode=1;
