import type { EdgeFunctionOptions } from './types';

/** Keep read parameters in the URL; fetch rejects GET requests with bodies. */
export function buildFunctionRequest(options: EdgeFunctionOptions) {
  if (!/^[a-z0-9-]+$/.test(options.functionName)) {
    throw new Error('Invalid Edge function name');
  }
  const method = options.method ?? 'POST';
  if (method === 'GET' && options.payload && Object.keys(options.payload).length) {
    throw new Error('GET requests require query parameters, not a payload');
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) query.set(key, String(value));
  }
  const suffix = query.toString();
  return {
    functionPath: options.functionName + (suffix ? `?${suffix}` : ''),
    method,
    body: method === 'GET' ? undefined : options.payload ?? {},
  };
}
