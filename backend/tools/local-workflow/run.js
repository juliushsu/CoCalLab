import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createLocalWorkflow} from './engine.js';
const repository=fileURLToPath(new URL('../../../',import.meta.url));
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim();
const checkoutDirty=Boolean(execFileSync('git',['status','--porcelain=v1'],{cwd:repository,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim());
const flow=await createLocalWorkflow();
if(process.argv.includes('--run')){
  try{
    const steps=[];
    for(const action of ['receive','review','calculate','snapshot']){
      const state=await flow[action]();
      steps.push({action,counts:state.counts,latest:state.calculations.filter(r=>r.is_latest).map(r=>({id:r.id,status:r.status,co2e_kg:r.co2e_kg}))});
    }
    const state=await flow.inspect();
    process.stdout.write(JSON.stringify({checkoutSha:sha,checkoutDirty,synthetic:true,mode:'local SQL and real business helpers; not cloud E2E',steps,...state},null,2)+'\n');
  }finally{await flow.close();}
}else{
  const html=await readFile(new URL('./index.html',import.meta.url));
  const port=4191,origin='http://127.0.0.1:'+port;
  const server=createServer(async(req,res)=>{
    const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(type==='application/json'?JSON.stringify(data):data);};
    if(req.headers.host!=='127.0.0.1:'+port||(req.headers.origin&&req.headers.origin!==origin)){send(403,{error:'LOCAL_ORIGIN_REQUIRED'});return;}
    try{
      if(req.method==='GET'&&req.url==='/'){send(200,html,'text/html');return;}
      if(req.method==='GET'&&req.url==='/api/state'){send(200,{checkoutSha:sha,checkoutDirty,...await flow.inspect()});return;}
      if(req.method==='GET'&&req.url==='/api/report'){
        const report=(await flow.inspect()).report;if(!report){send(409,{error:'NO_SAVED_REPORT'});return;}
        res.setHeader('Content-Disposition','attachment; filename="SYNTHETIC-local-report.json"');send(200,report);return;
      }
      if(req.method==='POST'&&req.url==='/api/action'){
        if(req.headers.origin!==origin||req.headers['content-type']!=='application/json'){send(403,{error:'LOCAL_JSON_ORIGIN_REQUIRED'});return;}
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192)throw new Error('BODY_TOO_LARGE');}
        const input=JSON.parse(body);
        if(!input||Array.isArray(input)||Object.keys(input).some(k=>!['action','input'].includes(k))||!['receive','review','calculate','snapshot'].includes(input.action))throw new Error('UNKNOWN_ACTION');
        send(200,{checkoutSha:sha,checkoutDirty,...await flow[input.action](input.input??{})});return;
      }
      send(404,{error:'NOT_FOUND'});
    }catch(error){send(409,{error:error.message});}
  });
  server.on('error',async error=>{console.error(error.message);await flow.close();process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log('SYNTHETIC LOCAL ONLY '+origin+' checkout='+sha+'; Ctrl+C closes only this in-memory run'));
  let stopping=false;
  async function stop(){if(stopping)return;stopping=true;server.close();await flow.close();}
  process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
}
