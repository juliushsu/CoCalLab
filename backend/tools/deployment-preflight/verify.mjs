// Static compiler preflight only. No deno run/serve, Supabase link/deploy/DB, or .env.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync,execFileSync} from 'node:child_process';import {fileURLToPath,pathToFileURL} from 'node:url';
import {graphFor,importsOf,parserVersion,assertAnalysisCommand} from './graph.mjs';
const COMMIT='ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const tools=path.resolve(repo,'../tooling/deployment-20261107'),work=path.join(tools,COMMIT),source=path.join(work,'source'),bundles=path.join(work,'bundles');
const evidence=path.join(repo,'docs/delivery/evidence/deployment-preflight-20261107');
const lock=path.join(evidence,'deno.lock'),deno=path.join(tools,'deno-2.9.8/deno.exe'),supabase=path.join(tools,'supabase-2.122.1/supabase.exe');
const git='git',mode=process.argv[2]||'all';
if(!['inventory','all','verify'].includes(mode)||process.argv.length>3)throw new Error('Usage: node backend/tools/deployment-preflight/verify.mjs [inventory|all|verify]');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const pins=[
 {name:'Supabase CLI',version:'2.122.1',archive:'supabase_2.122.1_windows_amd64.zip',archiveSha256:'254d141398da58b9acd273ff3f98c69b3efc89a077946715b1e4f7c22d4b0b99',binary:supabase,binarySha256:'19c0a8a2c911d05bf64b4fe2a1c1e25ad59eac1d04e2d0d10b2f9758668203df',url:'https://github.com/supabase/cli/releases/download/v2.122.1/supabase_2.122.1_windows_amd64.zip'},
 {name:'Deno',version:'2.9.8',archive:'deno-2.9.8-x86_64-pc-windows-msvc.zip',archiveSha256:'cba84b26e0df5ae7f74fc66b86a95b866872a86292ebd84fa1e959927edd93bf',binary:deno,binarySha256:'924397800533d3eb0ed0c889b20ad70e18b970d93acd8135bc043f425e528266',url:'https://github.com/denoland/deno/releases/download/v2.9.8/deno-x86_64-pc-windows-msvc.zip'},
];
for(const dir of [source,bundles,evidence])fs.mkdirSync(dir,{recursive:true});
for(const pin of pins){pin.archivePath=path.join(tools,pin.archive);if(sha(fs.readFileSync(pin.archivePath))!==pin.archiveSha256||sha(fs.readFileSync(pin.binary))!==pin.binarySha256)throw new Error('Pinned asset/binary mismatch: '+pin.name);}
const env={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,CI:'1',NO_COLOR:'1',DENO_NO_UPDATE_CHECK:'1',DENO_NO_PROMPT:'1',DENO_DIR:path.join(tools,'deno-cache'),DENO_TLS_CA_STORE:'system,mozilla',SUPABASE_HOME:path.join(tools,'supabase-home')};
const commands=[];
const sanitize=text=>String(text||'').replaceAll(pathToFileURL(source+path.sep).href,'<FIXED_SOURCE>/').replaceAll(source,'<FIXED_SOURCE>').replaceAll(tools,'<TOOL_ROOT>').replaceAll(repo,'<REPO_ROOT>').replace(/\x1b\[[0-9;]*m/g,'');
for(const file of fs.readdirSync(evidence).filter(name=>name.endsWith('.txt')))fs.writeFileSync(path.join(evidence,file),sanitize(fs.readFileSync(path.join(evidence,file),'utf8')));
function command(binary,args,label){
 if(binary===deno)assertAnalysisCommand(args);else if(binary!==supabase||args.join(' ')!=='--version')throw new Error('Only local tool version/analysis commands permitted');
 const started=new Date().toISOString(),result=spawnSync(binary,args,{cwd:source,env,encoding:'utf8',timeout:30000,maxBuffer:20*1024*1024});
 const record={label,binary,args,started,exitCode:result.status,error:result.error?.message||null};commands.push(record);
 fs.writeFileSync(path.join(evidence,label+'.txt'),sanitize([result.stdout,result.stderr,result.error?.message].filter(Boolean).join('\n')));
 return {...record,stdout:result.stdout||'',stderr:result.stderr||''};
}
function gitRead(args){return execFileSync(git,args,{cwd:repo,encoding:null,timeout:30000,maxBuffer:20*1024*1024});}
if(gitRead(['cat-file','-t',COMMIT]).toString().trim()!=='commit')throw new Error('Fixed source commit missing');
const files=new Map(),sourceManifest=[];
for(const record of gitRead(['ls-tree','-r','-z',COMMIT,'--','backend/supabase/functions','backend/src','modules']).toString().split('\0').filter(Boolean)){
 const [header,name]=record.split('\t'),[fileMode,type,oid]=header.split(' ');if(!/\.[cm]?[jt]sx?$/.test(name))continue;
 if(type!=='blob'||fileMode==='120000')throw new Error('Unsupported fixed-source entry '+name);
 const bytes=gitRead(['cat-file','blob',oid]),target=path.join(source,...name.split('/'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);files.set(name,bytes.toString('utf8'));sourceManifest.push({path:name,gitBlob:oid,sha256:sha(bytes),bytes:bytes.length});
}
const entries=[...files.keys()].filter(name=>/^backend\/supabase\/functions\/[^/]+\/index[.]ts$/.test(name)).sort();
const functions=entries.map(entry=>({name:entry.split('/').at(-2),...graphFor(entry,files)}));
const versions=pins.map(pin=>({name:pin.name,...command(pin.binary,['--version'],'version-'+pin.name.replaceAll(' ','-').toLowerCase())}));
const manifest={sourceCommit:COMMIT,checkoutHead:gitRead(['rev-parse','HEAD']).toString().trim(),node:{version:process.version,path:process.execPath},git:{invocation:'git (PATH)',version:gitRead(['--version']).toString().trim()},astParser:{name:'typescript',version:parserVersion},toolchain:pins,versions:versions.map(({stdout,stderr,...r})=>({...r,output:sanitize(stdout+stderr)})),functionCount:functions.length,sourceFiles:sourceManifest,functions,commands,managedEdgeRuntime:{pinControl:'NOT_CONTROLLED_BY_THIS_PREFLIGHT',reference:'supabase/edge-runtime v1.78.1',referenceDeno:'2.1.4',referenceDenoCore:'0.324.0',referenceSources:['https://github.com/supabase/edge-runtime/blob/v1.78.1/deno/Cargo.toml','https://github.com/supabase/edge-runtime/blob/v1.78.1/Cargo.toml'],managedActual:'UNKNOWN',status:'NOT_RUN'},notRun:['Deno run/serve or business handlers','Supabase cloud/login/link/deploy/database','Docker/Edge ESZIP/live Edge compatibility','Real JWT/Storage/business E2E'],artifactRoot:work};
const manifestName=mode==='inventory'?'inventory.json':'manifest.json';
const save=()=>{fs.writeFileSync(path.join(evidence,manifestName),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(evidence,mode==='inventory'?'inventory-commands.json':'commands.json'),JSON.stringify(commands,null,2)+'\n');};
save();
if(mode==='inventory'){console.log(JSON.stringify({mode,functions:functions.length,manifest:path.join(evidence,manifestName)}));process.exit(0);}
const common=['--no-config','--node-modules-dir=none','--allow-import=esm.sh,registry.npmjs.org','--lock='+lock];
const transportFailure=text=>/error sending request|certificate|TLS|timed out|ENOTFOUND|ECONN|Failed to fetch|Client error/i.test(text);
const blockedRoots=new Set();
if(mode==='all')for(const fn of functions){
 const roots=fn.edges.filter(e=>e.kind.endsWith('https')).map(e=>e.specifier);
 if(roots.some(root=>blockedRoots.has(root))){fn.discovery={status:'NOT_RUN_SHARED_TRANSPORT_BLOCKER'};continue;}
 // Cache resolves the graph/lock without making success depend on type-check
 // success. A failed deno check may not write a lock at all. No code executes.
 const result=command(deno,['cache',...common,'--frozen-lockfile=false',path.join(source,fn.entry)],'cache-'+fn.name);
 fn.discovery={exitCode:result.exitCode,status:result.exitCode===0?'PASS':'FAILED',log:'cache-'+fn.name+'.txt'};
 if(result.error||transportFailure(result.stderr)){for(const root of roots)blockedRoots.add(root);fn.discovery.status='BLOCKED_TRANSPORT';}save();console.log(JSON.stringify({phase:'discover',function:fn.name,status:fn.discovery.status}));
}
if(!fs.existsSync(lock)){manifest.status='BLOCKED_NO_REMOTE_LOCK';save();process.exit(2);}
manifest.lockSha256=sha(fs.readFileSync(lock));
for(const fn of functions){
 if(fn.missing.length||fn.unresolved.length||fn.discovery?.status?.includes('TRANSPORT')){fn.check={status:'BLOCKED_SOURCE_OR_TRANSPORT'};fn.bundle={status:'NOT_RUN'};continue;}
 const target=path.join(source,fn.entry),check=command(deno,['check','--all',...common,'--frozen-lockfile','--cached-only',target],'check-'+fn.name);
 fn.check={status:check.exitCode===0?'PASS':'FAILED',exitCode:check.exitCode,log:'check-'+fn.name+'.txt'};
 const info=command(deno,['info','--json',...common,'--frozen-lockfile',target],'graph-'+fn.name);
 if(info.exitCode===0){try{const graph=JSON.parse(info.stdout),modules=(graph.modules||[]).filter(m=>!m.specifier.startsWith('file:')).map(m=>({specifier:m.specifier,mediaType:m.mediaType,kind:m.kind,error:m.error})),reachable=new Set(modules.map(m=>m.specifier));fn.resolvedGraph={redirectsScope:'reachable targets or direct source imports; raw Deno info may include shared-lock redirects',redirects:Object.fromEntries(Object.entries(graph.redirects||{}).filter(([from,to])=>reachable.has(to)||fn.edges.some(e=>e.specifier===from))),supabaseSdkVersions:[...new Set(modules.flatMap(m=>[...m.specifier.matchAll(/@supabase\/supabase-js@(\d+[.]\d+[.]\d+)/g)].map(match=>match[1])))],modules};}catch{fn.graphError='INVALID_DENO_INFO_JSON';}}
 const output=path.join(bundles,fn.name+'.js'),bundle=command(deno,['bundle',...common,'--frozen-lockfile','--platform=deno','--packages=bundle','--format=esm','--sourcemap=external','--output='+output,target],'bundle-'+fn.name);
 fn.bundle={status:bundle.exitCode===0?'STATIC_BUNDLE_CREATED':'FAILED',exitCode:bundle.exitCode,typeChecking:'separate deno check; bundle does not type-check by default',log:'bundle-'+fn.name+'.txt'};
 if(bundle.exitCode===0&&fs.existsSync(output)){const bytes=fs.readFileSync(output);fn.bundle={...fn.bundle,path:output,sha256:sha(bytes),bytes:bytes.length,remainingImports:importsOf(output,bytes.toString()).imports};const map=output+'.map';if(fs.existsSync(map))fn.bundle.sourceMap={path:map,sha256:sha(fs.readFileSync(map)),bytes:fs.statSync(map).size};}
 save();console.log(JSON.stringify({phase:'verify',function:fn.name,check:fn.check.status,bundle:fn.bundle.status}));
}
manifest.lockUnchanged=sha(fs.readFileSync(lock))===manifest.lockSha256;
manifest.summary={checksPassed:functions.filter(f=>f.check?.status==='PASS').length,checksFailed:functions.filter(f=>f.check?.status==='FAILED').length,bundlesCreated:functions.filter(f=>f.bundle?.status==='STATIC_BUNDLE_CREATED').length,total:functions.length};
manifest.status=manifest.lockUnchanged&&manifest.summary.checksPassed===functions.length&&manifest.summary.bundlesCreated===functions.length?'STATIC_PREFLIGHT_PASS_NOT_RUNTIME_ACCEPTANCE':'BLOCKED_OR_PARTIAL';save();
console.log(JSON.stringify({status:manifest.status,...manifest.summary,lockUnchanged:manifest.lockUnchanged,manifest:path.join(evidence,'manifest.json')}));process.exitCode=manifest.status==='STATIC_PREFLIGHT_PASS_NOT_RUNTIME_ACCEPTANCE'?0:2;
