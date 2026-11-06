// Portable file-verification core v1.0.0. No product/table/bucket/tenant policy.
export const FILE_VERIFICATION_VERSION='1.0.0';
export class FileVerificationError extends Error{constructor(code){super(code);this.name='FileVerificationError';this.code=code;}}
const fail=code=>{throw new FileVerificationError(code);};
const mime=value=>value==='image/jpg'?'image/jpeg':value;
export async function verifyStoredFile({storage,reference,expected,maxBytes=10485760,timeoutMs=15000,signal}){
  if(!storage||typeof storage.read!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<=0||!Number.isSafeInteger(expected?.size)||expected.size<=0||expected.size>maxBytes)fail('FILE_SIZE_INVALID');
  const expectedMime=mime(expected.mimeType);if(!['application/pdf','image/jpeg','image/png'].includes(expectedMime))fail('FILE_MIME_INVALID');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new FileVerificationError('FILE_READ_TIMEOUT')),timeoutMs);
  const abort=()=>controller.abort(signal.reason||new FileVerificationError('FILE_READ_ABORTED'));
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  let reader,activeBody;
  const aborted=new Promise((_,reject)=>{const rejectAbort=()=>{reader?.cancel().catch(()=>{});reject(controller.signal.reason instanceof FileVerificationError?controller.signal.reason:new FileVerificationError('FILE_READ_ABORTED'));};if(controller.signal.aborted)rejectAbort();else controller.signal.addEventListener('abort',rejectAbort,{once:true});});
  async function operation(){
    const result=await storage.read(reference,{signal:controller.signal});
    activeBody=result.body;
    if(controller.signal.aborted){if(activeBody&&typeof activeBody.cancel==='function')await activeBody.cancel().catch(()=>{});throw controller.signal.reason;}
    if(mime(result.mimeType)!==expectedMime)fail('FILE_MIME_MISMATCH');
    const length=result.contentLength;
    if(length!==null&&length!==undefined&&(!Number.isSafeInteger(length)||length<0))fail('FILE_LENGTH_INVALID');
    if(length>maxBytes)fail('FILE_TOO_LARGE');
    const parts=[];let size=0;
    const add=chunk=>{if(!(chunk instanceof Uint8Array))fail('FILE_READ_INVALID');size+=chunk.byteLength;if(size>maxBytes)fail('FILE_TOO_LARGE');parts.push(chunk);};
    if(result.body instanceof Uint8Array)add(result.body);
    else if(result.body instanceof Blob){if(result.body.size>maxBytes)fail('FILE_TOO_LARGE');add(new Uint8Array(await result.body.arrayBuffer()));}
    else if(result.body&&typeof result.body.getReader==='function'){reader=result.body.getReader();try{for(;;){const next=await reader.read();if(next.done)break;add(next.value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();reader=undefined;}}
    else fail('FILE_READ_INVALID');
    if(controller.signal.aborted)throw controller.signal.reason;
    if(size!==expected.size||(length!==undefined&&length!==null&&size!==length))fail('FILE_SIZE_MISMATCH');
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
    const signature=expectedMime==='application/pdf'?new TextDecoder().decode(bytes.slice(0,5))==='%PDF-':expectedMime==='image/png'?[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if(!signature)fail('FILE_SIGNATURE_INVALID');
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return {sha256:Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join(''),size,mimeType:expectedMime,moduleVersion:FILE_VERIFICATION_VERSION};
  }
  try{return await Promise.race([operation(),aborted]);}catch(error){if(error instanceof FileVerificationError)throw error;throw new FileVerificationError('FILE_READ_FAILED');}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(activeBody&&typeof activeBody.cancel==='function'&&!activeBody.locked)await activeBody.cancel().catch(()=>{});}
}
