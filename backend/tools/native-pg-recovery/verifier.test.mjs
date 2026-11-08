import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArgs,validateReceipt} from './run.mjs';
import {validateAclRecords} from './private-acl.mjs';
import {digest,differences,requireEqual} from './snapshot.mjs';
const run='20261108060154015-4430f35e';
const receipt=()=>({status:'NAMED_NATIVE_CASES_PASS',source:'da5a0990c8ec82d2b55064dd7e009b771409fa73',synthetic:true,cloudTouched:false,existing5432Touched:false,database:'cocal_sql_race_'+run.replace('-','_'),migrations:Array(44).fill({}),omitted:Array(3).fill('HELD')});
test('opt-in accepts strict run identity and rejects paths arbitrary flags and wrong approved receipt',()=>{
 assert.equal(parseArgs([]),null);assert.equal(parseArgs(['--run','--source-run',run]),run);
 for(const args of [['--run'],['--reset','--source-run',run],['--run','--source-run','../'+run],['--run','--source-run',run+'/result.json'],['--run','--source-run',run,'extra']])assert.throws(()=>parseArgs(args));
 assert.doesNotThrow(()=>validateReceipt(receipt(),run));
 for(const patch of [{status:'PARTIAL'},{source:'ed6ca9bbfbc5581cdcacf2969340575217fcb8c4'},{synthetic:false},{cloudTouched:true},{existing5432Touched:true},{database:'postgres'},{database:'cocal_sql_race_20261108060154015_00000000'},{migrations:[]},{omitted:[]}])assert.throws(()=>validateReceipt({...receipt(),...patch},run));
});
const expected=()=>({rows:{'public.report_generations':['{"id":"SYNTHETIC","amount":12345678901234567890.12345678}'],'cocal_report_private.snapshots':['{"report":"SYNTHETIC","sealed":true}']},catalog:{relations:[{name:'report_generations',relrowsecurity:true,owner:'SYNTHETIC-owner',acl:['SYNTHETIC-owner=arwdDxtm/SYNTHETIC-owner']}],functions:[{name:'SYNTHETIC-verifier',prosecdef:true,proconfig:['search_path=""']}],constraints:[{name:'SYNTHETIC-not-valid',convalidated:false}]},sequences:{'cocal_recalc_private.completion_order':{last_value:'9007199254740993',is_called:true}}});
test('whole row comparison retains exact numeric JSON and detects missing private proof or table',()=>{
 const a=expected();assert.equal(requireEqual(a,structuredClone(a)),true);
 for(const mutate of [b=>b.rows['public.report_generations'][0]='{"id":"SYNTHETIC","amount":12345678901234567890.12345679}',b=>delete b.rows['cocal_report_private.snapshots'],b=>b.rows['cocal_report_private.snapshots']=[]]){const b=structuredClone(a);mutate(b);assert.ok(differences(a,b).some(x=>x.section==='rows'));assert.throws(()=>requireEqual(a,b),/RECOVERY_CONTENT_MISMATCH/);}
});
test('RLS grants owner function config and NOT VALID changes all fail verification',()=>{
 const a=expected();for(const mutate of [b=>b.catalog.relations[0].relrowsecurity=false,b=>b.catalog.relations[0].acl.push('public=r/SYNTHETIC-owner'),b=>b.catalog.relations[0].owner='another-owner',b=>b.catalog.functions[0].proconfig=['search_path=public'],b=>b.catalog.constraints[0].convalidated=true]){const b=structuredClone(a);mutate(b);assert.throws(()=>requireEqual(a,b),/RECOVERY_CONTENT_MISMATCH/);}
});
test('sequence value and is_called changes fail rather than silently accepting a stale authority counter',()=>{
 for(const patch of [{last_value:'9007199254740992'},{is_called:false}]){const a=expected(),b=structuredClone(a);Object.assign(b.sequences['cocal_recalc_private.completion_order'],patch);assert.throws(()=>requireEqual(a,b),/RECOVERY_CONTENT_MISMATCH/);}
});
test('binary/archive hashes cover raw bytes and archive ACL refuses broad ordinary grants',()=>{
 assert.equal(digest(Buffer.from('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 const owner={currentSid:'S-1-5-21-SYNTHETIC',rules:[{sid:'S-1-5-21-SYNTHETIC',type:'Allow',rights:'FullControl'}]},valid=[structuredClone(owner),structuredClone(owner)];assert.doesNotThrow(()=>validateAclRecords(valid));
 const broad=structuredClone(valid);broad[1].rules.push({sid:'S-1-1-0',type:'Allow',rights:'ReadAndExecute'});assert.throws(()=>validateAclRecords(broad),/non-owner/);
 const missingOwner=structuredClone(valid);missingOwner[1].rules=[];assert.throws(()=>validateAclRecords(missingOwner),/FullControl/);
});
