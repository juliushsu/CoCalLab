// TEST PREVIEW ONLY. Real installed SDK over same-origin, loopback-only synthetic services.
import {createClient} from '@supabase/supabase-js';
import {createLogoutSafeStorage} from '../../src/services/authPersistence';
const configuration=await fetch('/product-api/__synthetic/config').then(response=>{if(!response.ok)throw new Error('本機合成API尚未啟動（M1:4194／M2:4196／整合:4198／附件驗證:4200／重算:4202／完整流程:4204）；依README啟動，不回假資料。');return response.json();});
if(configuration.synthetic!==true||configuration.publicKey!=='SYNTHETIC-PRODUCT-PUBLIC-KEY'||!configuration.scope?.organizationId)throw new Error('本機測試設定無效。');
const storageKey='cocal-synthetic-product-'+configuration.scope.organizationId;
const authStorage=createLogoutSafeStorage(sessionStorage,storageKey);
const client=createClient(location.origin+'/product-api',configuration.publicKey,{auth:{storageKey,storage:authStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},global:{fetch:(input,init)=>{const url=new URL(String(input));if(url.origin!==location.origin||!url.pathname.startsWith('/product-api/'))throw new Error('LOCAL_PRODUCT_PREVIEW_BLOCKED_EXTERNAL_REQUEST');return fetch(input,init);}}});
export const getSupabaseClient=()=>client;
export const getAuthStorage=()=>authStorage;
export const isSupabaseConnected=()=>true;
