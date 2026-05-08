export type LocalizedMessage = {
  zh_tw: string;
  en: string;
  ja: string;
};

type SuccessMeta = {
  request_id: string;
  timestamp: string;
  status: string;
  reason: LocalizedMessage | null;
  warnings: unknown[];
};

type ErrorBody = {
  code: string;
  message: string;
  details?: unknown;
  reason?: LocalizedMessage | null;
};

function resolveRequestId(request: Request, fallback?: string): string {
  const fromHeader = request.headers.get('x-request-id') || request.headers.get('x-correlation-id');
  return fallback || fromHeader || crypto.randomUUID();
}

function baseMeta(requestId: string, status: string, reason: LocalizedMessage | null, warnings: unknown[] = []): SuccessMeta {
  return {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    status,
    reason,
    warnings,
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function successEnvelope(request: Request, data: unknown, options?: {
  status?: string;
  reason?: LocalizedMessage | null;
  warnings?: unknown[];
  requestId?: string;
}, httpStatus = 200): Response {
  const requestId = resolveRequestId(request, options?.requestId);
  const meta = baseMeta(requestId, options?.status || 'ok', options?.reason || null, options?.warnings || []);
  return jsonResponse({
    success: true,
    data,
    error: null,
    meta,
  }, httpStatus);
}

export function errorEnvelope(request: Request, error: ErrorBody, options?: {
  status?: string;
  reason?: LocalizedMessage | null;
  warnings?: unknown[];
  requestId?: string;
  httpStatus?: number;
}): Response {
  const requestId = resolveRequestId(request, options?.requestId);
  const meta = baseMeta(requestId, options?.status || 'failed', options?.reason || null, options?.warnings || []);
  return jsonResponse({
    success: false,
    data: null,
    error,
    meta,
  }, options?.httpStatus || 400);
}

export function methodNotAllowed(request: Request): Response {
  return errorEnvelope(request, {
    code: 'METHOD_NOT_ALLOWED',
    message: 'Method not allowed',
  }, { httpStatus: 405 });
}

export async function parseJson<T = unknown>(request: Request): Promise<T> {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}

export function toErrorEnvelope(request: Request, error: unknown, options?: {
  code?: string;
  httpStatus?: number;
  requestId?: string;
  reason?: LocalizedMessage | null;
}): Response {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return errorEnvelope(request, {
    code: options?.code || 'BAD_REQUEST',
    message,
    details: error,
    reason: options?.reason || null,
  }, {
    httpStatus: options?.httpStatus || 400,
    requestId: options?.requestId,
  });
}
