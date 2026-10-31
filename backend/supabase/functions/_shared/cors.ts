/** Browser-origin policy is independent of JWT/tenant authorization. */
type Handler = (request: Request) => Response | Promise<Response>;
export interface CorsConfig {
  allowedOrigins?: string;
  allowedMethods: readonly ('GET' | 'POST')[];
}
const DEVELOPMENT_ORIGINS = [
  'http://localhost:5173', 'http://localhost:5174',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174',
];
const ALLOWED_HEADERS = new Set([
  'authorization', 'apikey', 'content-type', 'x-client-info', 'x-request-id', 'x-correlation-id',
  'x-supabase-client-platform', 'x-supabase-client-platform-version',
  'x-supabase-client-runtime', 'x-supabase-client-runtime-version', 'x-supabase-client-version',
]);
function originsFromConfig(value: string | undefined): Set<string> {
  if (value === undefined) return new Set(DEVELOPMENT_ORIGINS);
  const entries = value.split(',').map(entry => entry.trim());
  if (!entries.length || entries.some(entry => {
    try {
      const url = new URL(entry);
      return !['http:', 'https:'].includes(url.protocol) || url.origin !== entry;
    } catch { return true; }
  })) throw new Error('Invalid CORS_ALLOWED_ORIGINS');
  return new Set(entries);
}
function errorResponse(status: number, code: string): Response {
  return new Response(JSON.stringify({ success: false, data: null, error: { code, message: code } }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
function withHeaders(response: Response, origin: string | null, preflightHeaders?: string[], allowedMethods?: readonly string[]): Response {
  const headers = new Headers(response.headers);
  // Never preserve a downstream wildcard or credential policy.
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith('access-control-')) headers.delete(name);
  }
  const vary = (headers.get('Vary') || '').split(',').map(value => value.trim()).filter(Boolean);
  for (const value of ['Origin', ...(preflightHeaders ? ['Access-Control-Request-Method', 'Access-Control-Request-Headers'] : [])]) {
    if (!vary.some(item => item.toLowerCase() === value.toLowerCase())) vary.push(value);
  }
  headers.set('Vary', vary.join(', '));
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  if (preflightHeaders) {
    headers.set('Access-Control-Allow-Methods', (allowedMethods || []).join(', '));
    if (preflightHeaders.length) headers.set('Access-Control-Allow-Headers', preflightHeaders.join(', '));
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Pure request wrapper: rejected origins/preflights cannot reach the business handler. */
export function createCorsHandler(handler: Handler, config: CorsConfig): Handler {
  let allowedOrigins: Set<string> | null = null;
  try { allowedOrigins = originsFromConfig(config.allowedOrigins); } catch { /* fail closed */ }
  const methods = new Set(config.allowedMethods);
  return async (request: Request) => {
    if (!allowedOrigins || !methods.size || [...methods].some(method => !['GET', 'POST'].includes(method))) {
      return withHeaders(errorResponse(503, 'CORS_CONFIGURATION_INVALID'), null);
    }
    const origin = request.headers.get('Origin');
    if (origin !== null && !allowedOrigins.has(origin)) {
      return withHeaders(errorResponse(403, 'ORIGIN_NOT_ALLOWED'), null);
    }
    if (request.method === 'OPTIONS') {
      if (!origin) return withHeaders(errorResponse(400, 'PREFLIGHT_ORIGIN_REQUIRED'), null);
      const method = request.headers.get('Access-Control-Request-Method');
      const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') || '')
        .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
      if (!method || !methods.has(method as 'GET' | 'POST') || requestedHeaders.some(name => !ALLOWED_HEADERS.has(name))) {
        return withHeaders(errorResponse(403, 'PREFLIGHT_NOT_ALLOWED'), origin);
      }
      return withHeaders(new Response(null, { status: 204 }), origin, requestedHeaders, [...methods]);
    }
    if (!methods.has(request.method as 'GET' | 'POST')) {
      return withHeaders(errorResponse(405, 'METHOD_NOT_ALLOWED'), origin);
    }
    try { return withHeaders(await handler(request), origin); }
    catch { return withHeaders(errorResponse(500, 'INTERNAL_SERVER_ERROR'), origin); }
  };
}

/** Deno-only runtime registration; no environment access occurs in the pure core. */
export function serveWithCors(handler: Handler, config: CorsConfig): unknown {
  const deno = (globalThis as unknown as { Deno: {
    env: { get(name: string): string | undefined };
    serve(handler: Handler): unknown;
  } }).Deno;
  let allowedOrigins = config.allowedOrigins;
  if (allowedOrigins === undefined) {
    try { allowedOrigins = deno.env.get('CORS_ALLOWED_ORIGINS'); }
    catch { allowedOrigins = '*'; } // Invalid sentinel ensures denied access fails closed.
  }
  return deno.serve(createCorsHandler(handler, { ...config, allowedOrigins }));
}
