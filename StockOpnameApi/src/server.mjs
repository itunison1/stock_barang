import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { HttpError, OpnameService } from './opname-service.mjs';

const json = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
};

const readJson = async (request) => {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 64_000) throw new HttpError(413, 'Payload terlalu besar.', 'PAYLOAD_TOO_LARGE');
  }
  try { return raw ? JSON.parse(raw) : {}; }
  catch { throw new HttpError(400, 'JSON tidak valid.', 'INVALID_JSON'); }
};

const keyMatches = (given, expected) => {
  if (!expected || !given) return false;
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

export const createServer = ({ service, apiKey, logger = console }) => http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (request.method === 'GET' && url.pathname === '/healthz') return json(response, 200, { status: 'ok' });
    if (!keyMatches(request.headers['x-api-key'], apiKey)) throw new HttpError(401, 'API key tidak valid.', 'UNAUTHORIZED');

    const path = url.pathname.match(/^\/api\/opname\/sessions\/(\d+)(?:\/(summary|close|scans))?$/);
    if (request.method === 'POST' && url.pathname === '/api/opname/sessions') {
      return json(response, 201, await service.createSession(await readJson(request)));
    }
    if (path && request.method === 'GET' && !path[2]) return json(response, 200, await service.session(path[1]));
    if (path && request.method === 'GET' && path[2] === 'summary') return json(response, 200, await service.summary(path[1]));
    if (path && request.method === 'POST' && path[2] === 'scans') return json(response, 200, await service.scan(path[1], await readJson(request)));
    if (path && request.method === 'POST' && path[2] === 'close') {
      const body = await readJson(request);
      return json(response, 200, await service.close(path[1], body.client_request_id));
    }
    throw new HttpError(404, 'Route tidak ditemukan.', 'NOT_FOUND');
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const code = error instanceof HttpError ? error.code : 'INTERNAL_ERROR';
    if (status === 500) logger.error('stock-opname-api request failed', { method: request.method, path: url.pathname, code, error: error.message });
    return json(response, status, { error: code, message: error.message || 'Kesalahan internal.' });
  }
});

// Production repository is deliberately not instantiated until WIP schema is audited with
// the dedicated MySQL account. This avoids deploying an unsafe guessed mapping.
if (process.env.OPNAME_START_SERVER === '1') {
  const apiKey = process.env.OPNAME_API_KEY;
  if (!apiKey) throw new Error('OPNAME_API_KEY wajib diisi.');
  throw new Error('MySQL WIP schema belum diaudit; service produksi belum boleh dijalankan. Jalankan audit read-only lalu pasang repository produksi.');
}
