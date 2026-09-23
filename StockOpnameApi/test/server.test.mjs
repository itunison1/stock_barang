import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../src/server.mjs';

const uuid = '00000000-0000-4000-8000-000000000001';

const withServer = async (handler) => {
  const server = createServer({
    apiKey: 'test-api-key',
    service: {
      createSession: async (body) => ({ id: 1, divisi: body.divisi, status: 'OPEN' }),
    },
    logger: { error() {} },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await handler(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
};

test('health is public but API session requires correct key', async () => withServer(async (baseUrl) => {
  const health = await fetch(`${baseUrl}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const denied = await fetch(`${baseUrl}/api/opname/sessions`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ divisi: 'G01' }),
  });
  assert.equal(denied.status, 401);

  const created = await fetch(`${baseUrl}/api/opname/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'test-api-key' },
    body: JSON.stringify({ client_request_id: uuid, divisi: 'G01', device_name: 'handheld-test' }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await created.json(), { id: 1, divisi: 'G01', status: 'OPEN' });
}));
