import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const fixture=JSON.stringify(fileURLToPath(new URL('./fixture.ts',import.meta.url)));
const stubs={
  '/components/layout/AdminLayout':'export default function Layout({children}){return children}',
  '/hooks/useAuth':`export {useFixtureAuth as useAuth} from ${fixture};`,
  '/services/documentService':`export {getUploadProjects,getUploadAccess,uploadDocument,recheckUploadReceipt,getIntakeRecovery,completeUploadReceipt,discardUploadReference,intakeQuarantinedCount} from ${fixture};`,
  '/utils/staging':'export const IS_STAGING=true;',
};
export default defineConfig({root,envDir:root,plugins:[{name:'explicit-synthetic-intake',enforce:'pre',resolveId(source){const key=Object.keys(stubs).find(key=>source.endsWith(key));return key?'\0synthetic:'+key:null;},load(id){return id.startsWith('\0synthetic:')?stubs[id.slice('\0synthetic:'.length)]:null;}},react()],server:{host:'127.0.0.1',port:4189,strictPort:true,fs:{allow:[fileURLToPath(new URL('../../../',import.meta.url))]}}});
