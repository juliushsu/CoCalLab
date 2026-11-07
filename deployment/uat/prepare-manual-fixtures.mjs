// Explicit synthetic files for Owner-driven native chooser/save acceptance only.
// No clients, cloud credentials, OCR, database, or application success fallback.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {syntheticPdf} from '../../backend/tools/product-preview/showcase.js';

const output=new URL('../../../tooling/manual-fixtures-20261107/',import.meta.url);
await mkdir(output,{recursive:true});
const files=[
  ['SYNTHETIC-100kWh.pdf',syntheticPdf('SYNTHETIC UAT ONLY - electricity 100 kWh - January 2026')],
  ['SYNTHETIC-empty.pdf',Buffer.alloc(0)],
  ['SYNTHETIC-invalid.pdf',Buffer.from('SYNTHETIC invalid type: plain text, not PDF')],
];
const manifest={synthetic:true,purpose:'manual native chooser test only; never OCR or business evidence',files:[]};
for(const [name,bytes]of files){
  const path=new URL(name,output);
  await writeFile(path,bytes,{flag:'wx'}).catch(async error=>{
    if(error.code!=='EEXIST')throw error;
    const existing=await readFile(path);
    if(!existing.equals(bytes))throw new Error('Existing fixture differs; preserved without overwrite: '+name);
  });
  const stored=await readFile(path);
  manifest.files.push({name,bytes:stored.length,sha256:createHash('sha256').update(stored).digest('hex'),expected:name==='SYNTHETIC-100kWh.pdf'?'valid synthetic PDF; actual upload still requires approval':'reject; never create successful receipt'});
}
// Local path contains no credentials; credentials and real files must never be supplied.
const manifestPath=new URL('manifest.json',output),manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
await writeFile(manifestPath,manifestBytes,{flag:'wx'}).catch(async error=>{
  if(error.code!=='EEXIST')throw error;
  if(!(await readFile(manifestPath)).equals(manifestBytes))throw new Error('Existing manifest differs; preserved without overwrite');
});
console.log(JSON.stringify({output:fileURLToPath(output),...manifest},null,2));
