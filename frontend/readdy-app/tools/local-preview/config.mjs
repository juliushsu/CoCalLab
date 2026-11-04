import {mergeConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import base from '../../vite.config.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const fixture=JSON.stringify(fileURLToPath(new URL('./fixture.ts',import.meta.url)));
export function localPreview(backend){
  const port=backend?4193:4192;
  const banner=backend?'SYNTHETIC 唯讀後台預覽 · 保留真 App／路由／layout；非真實租戶隔離驗收。帳號 a@preview.invalid、b@preview.invalid、shared@preview.invalid；測試密碼 SYNTHETIC-ONLY。可讀組織／專案／文件及私有原檔；其他未提供端點明確失敗，禁止資源寫入。':'原首頁／登入離線預覽 · 保留真 App／路由；未設定服務，後台受原登入保護。外部裝飾資產已阻擋。';
  const navigation=backend?' <a href="/admin/documents/list?organization_id=00000000-0000-4000-8000-000000000001&projectId=00000000-0000-4000-8000-000000000011">A 文件</a> · <a href="/admin/documents/list?organization_id=00000000-0000-4000-8000-000000000002&projectId=00000000-0000-4000-8000-000000000012">B 文件</a> · <a href="/login">登入／換帳號</a>':' <a href="/">首頁</a> · <a href="/login">登入</a>';
  const diagnostics='<div id="local-preview-error" role="alert"></div><script>function localPreviewError(value){document.getElementById("local-preview-error").textContent="本機預覽載入失敗："+String(value);}window.addEventListener("error",function(event){localPreviewError(event.message);});window.addEventListener("unhandledrejection",function(event){localPreviewError(event.reason);});</script>';
  return mergeConfig(base,{
    root,envDir:fileURLToPath(new URL('./isolated-env',import.meta.url)),base:'/',cacheDir:root+'node_modules/.vite-local-preview-'+(backend?'backend':'public'),
    define:{'import.meta.env.VITE_PUBLIC_SUPABASE_URL':'""','import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY':'""',__BASE_PATH__:'"/"',__IS_PREVIEW__:'true',__READDY_PROJECT_ID__:'""',__READDY_VERSION_ID__:'""',__READDY_AI_DOMAIN__:'""'},
    plugins:[{name:'local-preview-only',enforce:'pre',resolveId(source){if(backend&&source.endsWith('/lib/supabase'))return '\0local-preview-supabase';},load(id){if(id==='\0local-preview-supabase')return 'export {getSupabaseClient,getAuthStorage,isSupabaseConnected} from '+fixture+';';},transformIndexHtml(html){return html.replace(/<link\b[^>]*href="https?:[^"]*"[^>]*>/g,'').replace('<body>','<body style="padding-bottom:120px"><aside role="status" style="position:fixed;bottom:0;left:0;right:0;max-height:110px;overflow:auto;z-index:1000;padding:14px 20px;background:#fff0bf;color:#493400;font:14px/1.6 system-ui;border-bottom:2px solid #c79722">'+banner+navigation+'</aside>'+diagnostics);}}],
    server:{host:'127.0.0.1',port,strictPort:true,fs:{allow:[root]},headers:{'Content-Security-Policy':"default-src 'self'; connect-src 'self' ws://127.0.0.1:"+port+"; img-src 'self' data: blob:; frame-src 'self' blob:; font-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'self'"}},
  });
}
