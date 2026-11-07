import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {build_report_payload} from '../src/services/build-report-payload.js';
const require=createRequire(new URL('../../frontend/readdy-app/package.json',import.meta.url)),ts=require('typescript');
test('JS report metadata boundary accepts selected objects/null/omission and rejects wrong metadata ID types',()=>{
 const virtual=fileURLToPath(new URL('./report-metadata-contract.virtual.mts',import.meta.url));
 const source=`import {build_report_payload} from '../src/services/build-report-payload.js';
const base={project:{id:'project',organization_id:'org'},activities:[],calculation_results:[]};
build_report_payload({...base,workspace:{id:'org',slug:'test',display_name:'Synthetic'},legal_entity:{id:'entity',registered_name:'Synthetic'},site:{id:'site',site_name:'Synthetic'}});
build_report_payload({...base,workspace:null,legal_entity:null,site:null});build_report_payload(base);
// @ts-expect-error metadata IDs cannot silently widen to any
build_report_payload({...base,workspace:{id:12}});
// @ts-expect-error legal entity ID must retain its string boundary
build_report_payload({...base,legal_entity:{id:12}});
// @ts-expect-error site ID must retain its string boundary
build_report_payload({...base,site:{id:12}});`;
 const options={noEmit:true,allowJs:true,checkJs:false,strict:true,skipLibCheck:false,types:[],target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext};
 const host=ts.createCompilerHost(options),get=host.getSourceFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=name=>path.resolve(name)===virtual||exists(name);host.getSourceFile=(name,...args)=>path.resolve(name)===virtual?ts.createSourceFile(name,source,options.target,true):get(name,...args);
 const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram([virtual],options,host));
 assert.deepEqual(diagnostics.map(d=>`TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`),[]);
});

test('report metadata preserves real selected labels/IDs and calculated kg, with absent metadata still explicit',()=>{
 const project={id:'SYNTHETIC-PROJECT',organization_id:'SYNTHETIC-ORG',reporting_start_date:'2026-01-01',reporting_end_date:'2026-12-31',boundary_type:'operational_control'};
 const input={project,activities:[{id:'SYNTHETIC-ACTIVITY',inclusion_status:'included',final_scope:2,category:'energy'}],calculation_results:[{id:'SYNTHETIC-CALC',emission_activity_id:'SYNTHETIC-ACTIVITY',status:'calculated',is_latest:true,co2e_kg:50}]};
 const payload=build_report_payload({...input,workspace:{id:project.organization_id,display_name:'SYNTHETIC workspace',slug:'synthetic'},legal_entity:{id:'SYNTHETIC-ENTITY',registered_name:'SYNTHETIC legal entity'},site:{id:'SYNTHETIC-SITE',site_name:'SYNTHETIC site'}});
 assert.equal(payload.workspace_snapshot.workspace_id,project.organization_id);assert.equal(payload.legal_entity_snapshot.legal_entity_id,'SYNTHETIC-ENTITY');assert.equal(payload.site_snapshot.site_id,'SYNTHETIC-SITE');assert.equal(payload.scope_totals.scope_2,50);
 const absent=build_report_payload(input);assert.deepEqual(absent.workspace_snapshot,{});assert.deepEqual(absent.legal_entity_snapshot,{});assert.deepEqual(absent.site_snapshot,{});assert.equal(absent.scope_totals.scope_2,50);
});
