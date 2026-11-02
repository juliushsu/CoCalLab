import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const fixture = JSON.stringify(fileURLToPath(new URL('./fixture.ts', import.meta.url)));
const stubs = {
  '/components/layout/AdminLayout': 'export default function Layout({children}) {return children}',
  '/hooks/useAuth': `import {session} from ${fixture}; export const useAuth=()=>({session,loading:false});`,
  '/hooks/useSubscriptionStatus': 'export const useSubscriptionStatus=()=>({isReadonly:false,loading:false,error:null});',
  '/services/documentService': `export {readDrafts as getExtractedDrafts} from ${fixture};`,
  '/services/edgeFunction': `import {invoke} from ${fixture}; export const EdgeFunctionService={invoke};`,
};
export default defineConfig({root,envDir:root,plugins:[{name:'explicit-synthetic-fixture',enforce:'pre',
  resolveId(source) {const key=Object.keys(stubs).find(key=>source.endsWith(key));return key?'\0synthetic:'+key:null;},
  load(id) {return id.startsWith('\0synthetic:')?stubs[id.slice('\0synthetic:'.length)]:null;},
},react()],server:{host:'127.0.0.1',port:4188,strictPort:true,fs:{allow:[fileURLToPath(new URL('../../../',import.meta.url))]}}});
