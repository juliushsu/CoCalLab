import test from 'node:test';import assert from 'node:assert/strict';
import {importsOf,classify,graphFor,assertAnalysisCommand} from './graph.mjs';
test('AST graph includes type/bare/re-export/literal dynamic imports without reading commented examples',()=>{
 const parsed=importsOf('a.ts',`// import 'https://wrong.invalid/a';\nimport type {X} from './x.ts';import './b.ts';export {x} from './c.ts';const p=import('./d.ts');const q=import(variable);`);
 assert.deepEqual(parsed.imports.map(x=>x.specifier),['./x.ts','./b.ts','./c.ts','./d.ts']);assert.equal(parsed.unresolved.length,1);
});
test('graph records outside-functions source and refuses silently missing or escaping imports',()=>{
 const files=new Map([['backend/supabase/functions/a/index.ts',`import '../../../src/a.js';import './missing.ts';`],['backend/src/a.js',`export const a=1;`]]);
 const graph=graphFor('backend/supabase/functions/a/index.ts',files);assert.deepEqual(graph.outsideFunctions,['backend/src/a.js']);assert.deepEqual(graph.missing,['backend/supabase/functions/a/missing.ts']);
});
test('exact pins are distinguished from a floating major and runtime execution permissions are never accepted',()=>{
 assert.equal(classify('https://esm.sh/@supabase/supabase-js@2.49.4'),'exact_https');assert.equal(classify('https://esm.sh/@supabase/supabase-js@2'),'floating_or_unclassified_https');
 for(const args of [['run','a.ts'],['serve','a.ts'],['check','--preload=evil.ts','a.ts'],['cache','--env-file=secret','a.ts'],['bundle','--allow-net','a.ts']])assert.throws(()=>assertAnalysisCommand(args));assert.doesNotThrow(()=>assertAnalysisCommand(['bundle','--allow-import=esm.sh','a.ts']));
});

test('native npm and triple-slash type dependencies are inventoried, including the exact Node declaration pin',()=>{
 const parsed=importsOf('sdk.ts',`/// <reference types="npm:@types/node@22.12.0" />\nexport {createClient} from 'npm:@supabase/supabase-js@2.49.4';`);
 assert.equal(classify('npm:@supabase/supabase-js@2.49.4'),'exact_npm');
 assert.equal(classify('npm:@supabase/supabase-js@2'),'floating_npm');
 assert.equal(classify('npm:@supabase/supabase-js'),'floating_npm');
 assert.deepEqual(parsed.imports.find(i=>i.typeReference),{specifier:'npm:@types/node@22.12.0',dynamic:false,typeReference:true});
});
