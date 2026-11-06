// Product-owned storage adapter. Credentials/config are injected, never embedded.
export function createSupabasePrivateFileAdapter({url,serviceKey,fetchImpl=fetch}){
  if(!url||!serviceKey)throw new Error('Private file storage is not configured');
  return {async read(reference,{signal}={}){
    const path=[reference.bucket,...reference.path.split('/')].map(encodeURIComponent).join('/');
    const response=await fetchImpl(url.replace(/\/$/,'')+'/storage/v1/object/authenticated/'+path,{headers:{Authorization:'Bearer '+serviceKey,apikey:serviceKey},redirect:'error',signal});
    if(!response.ok){await response.body?.cancel().catch(()=>{});throw new Error('Private original download failed');}
    const raw=response.headers.get('content-length');
    return {body:response.body,mimeType:response.headers.get('content-type')?.split(';')[0].trim()||null,contentLength:raw===null?null:/^\d+$/.test(raw)?Number(raw):NaN};
  }};
}
