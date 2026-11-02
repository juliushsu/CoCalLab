import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const fixture=JSON.stringify(fileURLToPath(new URL('./fixture.ts',import.meta.url)));
const stubs={
  '/components/layout/AdminLayout':'export default function Layout({children}){return children}',
  '/lib/supabase':`export {getSupabaseClient,isSupabaseConnected,getAuthStorage} from ${fixture};`,
  '/utils/staging':'export const IS_STAGING=true;',
};
export default defineConfig({root,envDir:root,plugins:[{name:'synthetic-real-auth-upload',enforce:'pre',resolveId(source){const key=Object.keys(stubs).find(key=>source.endsWith(key));return key?'\0auth-upload:'+key:null;},load(id){return id.startsWith('\0auth-upload:')?stubs[id.slice('\0auth-upload:'.length)]:null;}},react()],server:{host:'127.0.0.1',port:4190,strictPort:true,fs:{allow:[fileURLToPath(new URL('../../../',import.meta.url))]}}});
