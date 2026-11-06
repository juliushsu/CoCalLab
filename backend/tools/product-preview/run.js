import { createProductRuntime } from './runtime.js';
const args=process.argv.slice(2);
if(args.some(arg=>!['--showcase','--manual-transcription'].includes(arg)&&!/^--port=\d+$/.test(arg))||args.filter(arg=>['--showcase','--manual-transcription'].includes(arg)).length>1||args.filter(arg=>arg.startsWith('--port=')).length>1)throw new Error('Usage: node backend/tools/product-preview/run.js [--showcase|--manual-transcription] [--port=4196]');
const scenario=args.includes('--showcase')?'showcase':args.includes('--manual-transcription')?'manual-transcription':'manual',portArg=args.find(arg=>arg.startsWith('--port='));
const runtime=await createProductRuntime({scenario,port:portArg?Number(portArg.slice(7)):scenario==='showcase'?4196:scenario==='manual-transcription'?4198:4194});
console.log(JSON.stringify({synthetic:true,...runtime.config,api:runtime.baseUrl,notice:'LOCAL SYNTHETIC ONLY; real product handlers and SQL, no cloud or production data'},null,2));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await runtime.close();process.exit(0);});
