// Local compile artifact only: no preview adapter, .env or remote project binding.
import {mergeConfig} from '../../frontend/readdy-app/node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
import base from '../../frontend/readdy-app/vite.config.ts';
export default mergeConfig(base,{
  root:fileURLToPath(new URL('../../frontend/readdy-app/',import.meta.url)),
  envDir:fileURLToPath(new URL('./isolated-artifact-env/',import.meta.url)),
  base:'/',
  define:{'import.meta.env.VITE_PUBLIC_SUPABASE_URL':'""','import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY':'""',__BASE_PATH__:'"/"',__IS_PREVIEW__:'false',__READDY_PROJECT_ID__:'""',__READDY_VERSION_ID__:'""',__READDY_AI_DOMAIN__:'""'},
  build:{emptyOutDir:false},
});
