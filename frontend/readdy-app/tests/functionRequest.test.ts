import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFunctionRequest } from '../src/services/functionRequest.ts';

test('GET encodes scoped parameters without a request body', () => {
  const request = buildFunctionRequest({ functionName: 'emissions-analytics', method: 'GET', query: { organization_id: 'a&b', absent: undefined, zero: 0 } });
  assert.equal(request.functionPath, 'emissions-analytics?organization_id=a%26b&zero=0');
  assert.equal(request.body, undefined);
  assert.equal(request.method, 'GET');
});
test('existing mutations keep POST and JSON payload', () => {
  assert.deepEqual(buildFunctionRequest({ functionName: 'generate-report', payload: { project_id: 'p' } }), {
    functionPath: 'generate-report', method: 'POST', body: { project_id: 'p' },
  });
});
test('reject ambiguous GET bodies and paths that could redirect the request', () => {
  assert.throws(() => buildFunctionRequest({ functionName: 'reports', method: 'GET', payload: { id: 'p' } }));
  assert.throws(() => buildFunctionRequest({ functionName: '../other' }));
});
