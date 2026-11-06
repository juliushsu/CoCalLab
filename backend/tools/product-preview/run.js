import { createProductRuntime } from './runtime.js';
const runtime=await createProductRuntime();
console.log(JSON.stringify({synthetic:true,api:runtime.baseUrl,publicKey:runtime.publicKey,accounts:runtime.accounts,scope:runtime.scope,notice:'LOCAL SYNTHETIC ONLY; real product handlers and SQL, no cloud or production data'},null,2));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await runtime.close();process.exit(0);});
